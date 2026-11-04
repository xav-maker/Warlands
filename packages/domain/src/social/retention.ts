/**
 * Rétention des données sociales (README 25, guide 6.8) : le chat de région se garde 7 jours, les messages
 * privés 90 jours. Les signalements ont copié leur contenu : ils survivent à la purge. Tâche du worker (horaire).
 */
import type { Db } from '@cr/db';

export const CHAT_RETENTION_DAYS = 7;
export const DIRECT_RETENTION_DAYS = 90;
const DAY = 86_400_000;

export async function purgeSocial(db: Db, now = new Date()): Promise<{ chat: number; direct: number }> {
  const chat = await db
    .deleteFrom('chat_message')
    .where('created_at', '<', new Date(now.getTime() - CHAT_RETENTION_DAYS * DAY))
    .executeTakeFirst();
  const direct = await db
    .deleteFrom('direct_message')
    .where('created_at', '<', new Date(now.getTime() - DIRECT_RETENTION_DAYS * DAY))
    .executeTakeFirst();
  return { chat: Number(chat.numDeletedRows), direct: Number(direct.numDeletedRows) };
}
