/**
 * Bus d'événements temps réel (guide 10.1). Les commandes publient `{topic, type, data}` après validation ;
 * chaque instance web écoute le canal Postgres `events` (LISTEN) sur une connexion dédiée et relaie aux flux SSE
 * de ses propres clients. Ainsi, plusieurs instances web restent cohérentes sans courtier de messages.
 *
 * Sans `connectionString` (tests, mono-processus), la diffusion est locale et immédiate.
 */
import pg from 'pg';
import { sql, type Kysely } from 'kysely';
import type { Database } from './schema.ts';

export interface BusEvent {
  topic: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface Bus {
  /** Publie ; n'échoue jamais (une perte de notification ne doit pas faire échouer une action déjà validée). */
  publish(events: readonly BusEvent[]): void;
  /** Reçoit chaque événement diffusé à cette instance ; renvoie la fonction de désinscription. */
  subscribe(fn: (e: BusEvent) => void): () => void;
  /** Vrai quand la connexion LISTEN est établie (toujours vrai en diffusion locale). */
  readonly listening: boolean;
  close(): Promise<void>;
}

export const BUS_CHANNEL = 'events';
/** NOTIFY est limité à 8000 octets : au-delà, l'événement part sans données (les clients relisent la base). */
const MAX_PAYLOAD = 7000;

export interface BusOptions {
  db: Kysely<Database>;
  /** URL Postgres de la connexion d'écoute dédiée ; absente = diffusion locale. */
  connectionString?: string;
  log?: (message: string, err?: unknown) => void;
}

export function createBus(opts: BusOptions): Bus {
  const listeners = new Set<(e: BusEvent) => void>();
  const log = opts.log ?? ((m, e) => console.error(m, e));
  let client: pg.Client | null = null;
  let connected = !opts.connectionString;
  let closed = false;
  let retry: NodeJS.Timeout | null = null;
  let delay = 500;

  const dispatch = (e: BusEvent): void => {
    for (const fn of [...listeners]) {
      try {
        fn(e);
      } catch (err) {
        log('bus : abonné en erreur', err);
      }
    }
  };

  async function connect(): Promise<void> {
    if (closed || !opts.connectionString) return;
    const c = new pg.Client({ connectionString: opts.connectionString });
    const lost = (err: unknown): void => {
      if (client !== c) return;
      client = null;
      connected = false;
      c.removeAllListeners();
      c.on('error', () => {});
      void c.end().catch(() => {});
      if (closed) return;
      log('bus : écoute Postgres perdue, nouvelle tentative', err);
      retry = setTimeout(() => void connect(), delay);
      delay = Math.min(delay * 2, 15_000);
    };
    c.on('error', lost);
    c.on('end', () => lost(new Error('connexion terminée')));
    c.on('notification', (m) => {
      if (m.channel !== BUS_CHANNEL || !m.payload) return;
      try {
        dispatch(JSON.parse(m.payload) as BusEvent);
      } catch (err) {
        log('bus : message illisible', err);
      }
    });
    try {
      await c.connect();
      await c.query(`LISTEN ${BUS_CHANNEL}`);
      client = c;
      connected = true;
      delay = 500;
    } catch (err) {
      client = c;
      lost(err);
    }
  }

  const ready = connect();

  return {
    publish(events) {
      for (const e of events) {
        if (!opts.connectionString || !connected) {
          // Pas d'écoute (tests, ou coupure) : au moins les clients de cette instance sont servis.
          dispatch(e);
          continue;
        }
        let payload = JSON.stringify(e);
        if (Buffer.byteLength(payload) > MAX_PAYLOAD) payload = JSON.stringify({ topic: e.topic, type: e.type });
        sql`select pg_notify(${BUS_CHANNEL}, ${payload})`.execute(opts.db).catch((err) => log('bus : NOTIFY impossible', err));
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get listening() {
      return connected;
    },
    async close() {
      closed = true;
      if (retry) clearTimeout(retry);
      await ready.catch(() => {});
      const c = client;
      client = null;
      if (c) {
        c.removeAllListeners();
        c.on('error', () => {});
        await c.end().catch(() => {});
      }
      listeners.clear();
    },
  };
}
