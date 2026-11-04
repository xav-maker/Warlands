/**
 * Premiers pas (tutoriel des nouveaux joueurs) : six étapes qui apprennent à combattre, rapporter du butin, acheter,
 * fabriquer, recruter et ce que coûte la mort. Chaque étape se coche d'elle-même quand le joueur l'a faite pour de vrai
 * (lu dans ses combats, ses mouvements de biens et le grand livre) ; « la mort » se coche à la première unité perdue, ou
 * quand le joueur a lu l'explication. Le tutoriel se masque, et se réaffiche depuis sa page.
 */
import { z } from 'zod';
import { sql, type Db } from '@cr/db';
import { command } from '../command.ts';

export const TUTORIAL_STEPS = ['combat', 'butin', 'acheter', 'fabriquer', 'recruter', 'mort'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

/** Ce que le joueur a lu ou choisi (player.tutorial). */
export interface TutorialState {
  read?: TutorialStep[];
  hidden?: boolean;
}

export interface TutorialView {
  steps: { id: TutorialStep; done: boolean }[];
  done: number;
  /** Première étape à faire, ou null quand tout est fait. */
  next: TutorialStep | null;
  hidden: boolean;
  /** Tout est fait : le tutoriel se retire de lui-même. */
  finished: boolean;
}

/** Où en est le joueur. Lecture seule. */
export async function tutorialView(db: Db, playerId: number): Promise<TutorialView> {
  const p = await db
    .selectFrom('player')
    .select(['stat_wins', 'stat_deaths', 'tutorial'])
    .where('id', '=', playerId)
    .executeTakeFirstOrThrow();
  const state = (p.tutorial ?? {}) as TutorialState;
  const r = await sql<{ butin: boolean; acheter: boolean; fabriquer: boolean; recruter: boolean }>`
    select
      exists (select 1 from asset_move where player_id = ${playerId} and reason in ('butin', 'ramassé')) as butin,
      exists (select 1 from asset_move where player_id = ${playerId} and reason in ('achat', 'achat boutique')) as acheter,
      exists (select 1 from asset_move where player_id = ${playerId} and reason = 'atelier') as fabriquer,
      exists (
        select 1 from gold_entry e join gold_account a on a.id = e.account_id
        where a.player_id = ${playerId} and e.reason like 'recrutement %'
      ) as recruter`.execute(db);
  const row = r.rows[0]!;
  const done: Record<TutorialStep, boolean> = {
    combat: p.stat_wins > 0,
    butin: row.butin,
    acheter: row.acheter,
    fabriquer: row.fabriquer,
    recruter: row.recruter,
    mort: p.stat_deaths > 0 || (state.read ?? []).includes('mort'),
  };
  const steps = TUTORIAL_STEPS.map((id) => ({ id, done: done[id] }));
  const count = steps.filter((s) => s.done).length;
  return {
    steps,
    done: count,
    next: steps.find((s) => !s.done)?.id ?? null,
    hidden: !!state.hidden,
    finished: count === steps.length,
  };
}

/** « J'ai compris » sur une étape qui s'apprend en lisant (la mort), ou masquer / réafficher le tutoriel. */
export const updateTutorial = command({
  name: 'tutorial.update',
  input: z.union([z.object({ read: z.literal('mort') }), z.object({ hidden: z.boolean() })]),
  rate: { perMinute: 30 },
  allowedDuringWatch: true,
  async run(ctx, input) {
    const state = { ...((ctx.player.tutorial ?? {}) as TutorialState) };
    if ('read' in input) state.read = [...new Set([...(state.read ?? []), input.read])];
    else state.hidden = input.hidden;
    await ctx.tx
      .updateTable('player')
      .set({ tutorial: JSON.stringify(state) })
      .where('id', '=', ctx.player.id)
      .execute();
    return state;
  },
});
