/**
 * Sanctions en vigueur (guide 12) : `mute` (chat et messages privés), `shop_ban` (mise en vente),
 * `suspend` (compte suspendu, durée limitée) et `ban` (compte banni). Une sanction est active tant qu'elle
 * n'est ni levée (`revoked_at`) ni arrivée à son terme (`until_at`).
 */
import { GameError } from '@cr/shared';
import type { Database, Db, SanctionKind, Transaction } from '@cr/db';

type Q = Db | Transaction<Database>;

export interface ActiveSanction {
  id: number;
  kind: SanctionKind;
  reason: string;
  until_at: Date | null;
}

/** « jusqu'au 04/11/2026 15:30 » ou « sans date de fin ». */
export function untilText(until: Date | null): string {
  return until
    ? `jusqu’au ${until.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}`
    : 'sans date de fin';
}

/** Sanction active la plus longue d'un type, ou `null`. */
export async function activeSanction(q: Q, playerId: number, kind: SanctionKind, now: Date): Promise<ActiveSanction | null> {
  const rows = await q
    .selectFrom('sanction')
    .select(['id', 'kind', 'reason', 'until_at'])
    .where('player_id', '=', playerId)
    .where('kind', '=', kind)
    .where('revoked_at', 'is', null)
    .where((eb) => eb.or([eb('until_at', 'is', null), eb('until_at', '>', now)]))
    .execute();
  if (!rows.length) return null;
  // Une sanction sans fin l'emporte ; sinon, celle qui finit le plus tard.
  return rows.reduce((a, b) => (a.until_at === null ? a : b.until_at === null || b.until_at > a.until_at ? b : a));
}

/** Toutes les sanctions actives d'un joueur (profil, outils de modération). */
export async function activeSanctions(q: Q, playerId: number, now: Date): Promise<ActiveSanction[]> {
  return q
    .selectFrom('sanction')
    .select(['id', 'kind', 'reason', 'until_at'])
    .where('player_id', '=', playerId)
    .where('revoked_at', 'is', null)
    .where((eb) => eb.or([eb('until_at', 'is', null), eb('until_at', '>', now)]))
    .orderBy('id')
    .execute();
}

/** Lève `MUTED` si le joueur est réduit au silence. */
export async function assertNotMuted(q: Q, playerId: number, now: Date): Promise<void> {
  const s = await activeSanction(q, playerId, 'mute', now);
  if (s) throw new GameError('MUTED', { fin: untilText(s.until_at) });
}

/** Lève `SHOP_BANNED` si le joueur n'a plus le droit de mettre en vente. */
export async function assertNotShopBanned(q: Q, playerId: number, now: Date): Promise<void> {
  const s = await activeSanction(q, playerId, 'shop_ban', now);
  if (s) throw new GameError('SHOP_BANNED', { fin: untilText(s.until_at) });
}

/**
 * Rend actifs les comptes dont la suspension est arrivée à son terme (worker chaque minute, et à la connexion).
 * Un compte reste suspendu tant qu'une suspension ou un bannissement actif subsiste sur l'un de ses joueurs.
 */
export async function liftExpiredSuspensions(db: Db, accountId?: number): Promise<number> {
  const now = new Date();
  const q = db
    .updateTable('account')
    .set({ status: 'active', updated_at: now })
    .where('status', '=', 'suspended')
    // Seule une suspension échue peut être levée : un compte suspendu sans trace de sanction (action manuelle) le reste.
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('sanction')
          .innerJoin('player', 'player.id', 'sanction.player_id')
          .select('sanction.id')
          .whereRef('player.account_id', '=', 'account.id')
          .where('sanction.kind', '=', 'suspend')
          .where('sanction.revoked_at', 'is', null)
          .where('sanction.until_at', '<=', now),
      ),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('sanction')
            .innerJoin('player', 'player.id', 'sanction.player_id')
            .select('sanction.id')
            .whereRef('player.account_id', '=', 'account.id')
            .where('sanction.kind', 'in', ['suspend', 'ban'])
            .where('sanction.revoked_at', 'is', null)
            .where((e2) => e2.or([e2('sanction.until_at', 'is', null), e2('sanction.until_at', '>', now)])),
        ),
      ),
    );
  const r = await (accountId === undefined ? q : q.where('id', '=', accountId)).executeTakeFirst();
  return Number(r.numUpdatedRows);
}
