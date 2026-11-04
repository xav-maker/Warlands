/**
 * Accès au chat, aux messages privés, aux demandes d'amis et aux boutiques : l'adresse e-mail du compte doit être
 * vérifiée (guide 13.1). Le serveur peut lever cette exigence (`requireVerifiedEmail` faux), par exemple tant que
 * l'envoi d'e-mails n'est pas en place ; l'exploitant peut aussi vérifier un compte à la main (`verify-email`).
 */
import { GameError } from '@cr/shared';
import type { CommandContext } from '../command.ts';

/** Lève `EMAIL_NOT_VERIFIED` si l'exigence est active et que le compte du joueur n'est pas vérifié. */
export async function assertEmailVerified(ctx: CommandContext): Promise<void> {
  if (!ctx.requireVerifiedEmail) return;
  const acc = await ctx.tx.selectFrom('account').select('email_verified_at').where('id', '=', ctx.player.account_id).executeTakeFirst();
  if (!acc?.email_verified_at) throw new GameError('EMAIL_NOT_VERIFIED');
}
