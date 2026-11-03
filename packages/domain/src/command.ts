import { createHash, randomInt } from 'node:crypto';
import type { z } from 'zod';
import { GameError } from '@cr/shared';
import { sql, type Db, type Player, type PositionKind, type Transaction, type Database } from '@cr/db';
import type { RateLimiter } from './rate-limit.ts';
import type { GameContent } from './game/content.ts';
import { startPlayer } from './game/troops.ts';

/** Événement à diffuser après le commit (SSE, J6). Jamais envoyé si la transaction échoue. */
export interface DomainEvent {
  topic: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface CommandContext {
  tx: Transaction<Database>;
  /** Ligne du joueur, verrouillée (`FOR UPDATE`) pour toute la commande. */
  player: Player;
  now: Date;
  emit(event: DomainEvent): void;
  /** Contenu actif ; une commande de jeu échoue sans lui. */
  content: GameContent;
  /** Tirage frais côté serveur (guide 8.1) : entier dans [0, max[. */
  random(max: number): number;
}

export interface CommandDef<S extends z.ZodType, R> {
  name: string;
  input: S;
  /** Commandes par minute et par joueur, par exemplaire `web` (guide 7.2). */
  rate: { perMinute: number };
  /** Positions autorisées ; absent = partout. */
  where?: readonly PositionKind[];
  /** Vrai pour le chat, les messages privés, la consultation (guide 7.2, dernier paragraphe). */
  allowedDuringWatch?: boolean;
  run(ctx: CommandContext, input: z.output<S>): Promise<R>;
}

/** Déclare une commande (forme du guide 3.3). */
export function command<S extends z.ZodType, R>(def: CommandDef<S, R>): CommandDef<S, R> {
  return def;
}

export interface CommandDeps {
  db: Db;
  rateLimiter: RateLimiter;
  publish(events: DomainEvent[]): void;
  clock?: () => Date;
  /** Pack de contenu actif (nécessaire aux commandes de jeu). */
  content?: GameContent;
  /** Aléa des tirages de jeu ; par défaut crypto.randomInt (imprévisible, guide 8.1). Remplacé dans les tests. */
  random?: (max: number) => number;
}

export interface CommandCall {
  playerId: number;
  input: unknown;
  /** Clé envoyée par le client (en-tête `Idempotency-Key`) ; une même clé renvoie la même réponse. */
  idempotencyKey?: string | undefined;
}

const hashInput = (name: string, input: unknown) =>
  createHash('sha256')
    .update(name)
    .update('\0')
    .update(JSON.stringify(input ?? null))
    .digest('hex');

/**
 * Exécute une commande dans l'ordre du guide 3.3 :
 * schéma → débit → BEGIN → verrou joueur → idempotence → position → run → réponse d'idempotence → COMMIT → diffusion.
 * Toute exception provoque un ROLLBACK et aucun événement n'est diffusé.
 */
export async function executeCommand<S extends z.ZodType, R>(deps: CommandDeps, def: CommandDef<S, R>, call: CommandCall): Promise<R> {
  const parsed = def.input.safeParse(call.input);
  if (!parsed.success) throw new GameError('INVALID_INPUT');

  if (!deps.rateLimiter.hit(`${def.name}:${call.playerId}`, def.rate.perMinute)) throw new GameError('RATE_LIMITED');

  const requestHash = hashInput(def.name, call.input);
  const events: DomainEvent[] = [];

  const result = await deps.db.transaction().execute(async (tx) => {
    let player = await tx.selectFrom('player').selectAll().where('id', '=', call.playerId).forUpdate().executeTakeFirst();
    if (!player) throw new GameError('PLAYER_NOT_FOUND');

    if (call.idempotencyKey) {
      const prev = await tx
        .selectFrom('idempotency_key')
        .select(['command', 'request_hash', 'response'])
        .where('player_id', '=', player.id)
        .where('key', '=', call.idempotencyKey)
        .executeTakeFirst();
      if (prev) {
        if (prev.command !== def.name || prev.request_hash !== requestHash) throw new GameError('IDEMPOTENCY_CONFLICT');
        return { replay: true as const, value: (prev.response as { v: R }).v };
      }
    }

    // L'heure de la transaction, pas celle du processus : toutes les comparaisons se font sur la même horloge.
    const now = deps.clock?.() ?? (await sql<{ now: Date }>`select now() as now`.execute(tx)).rows[0]!.now;

    // Kit de départ (README 8.1), remis à la première commande de jeu.
    if (deps.content && !player.started_at) {
      await startPlayer(tx, deps.content, player, now);
      player = await tx.selectFrom('player').selectAll().where('id', '=', player.id).executeTakeFirstOrThrow();
    }

    if (def.where && !def.where.includes(player.pos_kind)) throw new GameError('WRONG_POSITION');
    if (!def.allowedDuringWatch && player.watch_until && now < player.watch_until) {
      throw new GameError('WATCH_IN_PROGRESS', { secondes: Math.ceil((player.watch_until.getTime() - now.getTime()) / 1000) });
    }

    const random = deps.random ?? ((max: number) => randomInt(0, max));
    const content = deps.content;
    const ctx: CommandContext = {
      tx,
      player,
      now,
      emit: (e) => events.push(e),
      get content(): GameContent {
        if (!content) throw new Error(`commande ${def.name} sans contenu`);
        return content;
      },
      random,
    };
    const value = await def.run(ctx, parsed.data);

    if (call.idempotencyKey) {
      await tx
        .insertInto('idempotency_key')
        .values({
          player_id: player.id,
          key: call.idempotencyKey,
          command: def.name,
          request_hash: requestHash,
          response: JSON.stringify({ v: value ?? null }),
        })
        .execute();
    }
    return { replay: false as const, value };
  });

  if (!result.replay && events.length) deps.publish(events);
  return result.value;
}
