import { createHash, randomBytes, randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { GameError } from '@cr/shared';
import type { Account, Db, Player, Session } from '@cr/db';
import type { Mailer } from './mailer.ts';
import { liftExpiredSuspensions } from './social/sanctions.ts';
import { matchTotp, newTotpSecret, totpUri } from './totp.ts';

/** Région de départ : Havre-Gris (README 8.1), identifiant du contenu. */
export const START_REGION = 'ronces';
export const TOS_VERSION = '2026-11-03';
export const PASSWORD_MIN = 10;
const SESSION_DAYS = 30;
const VERIFY_HOURS = 48;

/** Paramètres argon2id recommandés par l'OWASP (19 Mio, 2 passes, 1 fil). */
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Pseudos réservés ou trompeurs (guide 12). La liste complète vivra dans le pack de contenu. */
const FORBIDDEN_PSEUDOS = ['admin', 'administrateur', 'moderateur', 'modérateur', 'support', 'systeme', 'système', 'garde', 'staff'];
const PSEUDO_RE = /^[\p{L}\p{N}][\p{L}\p{N} -]{1,18}[\p{L}\p{N}]$/u;

export function checkPseudo(raw: string): string {
  const pseudo = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!PSEUDO_RE.test(pseudo)) throw new GameError('PSEUDO_INVALID');
  const flat = pseudo.toLowerCase().replace(/[ -]/g, '');
  if (FORBIDDEN_PSEUDOS.some((f) => flat.includes(f.replace(/[ -]/g, '')))) throw new GameError('PSEUDO_FORBIDDEN');
  return pseudo;
}

export const SignupInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
  pseudo: z.string().max(40),
  password: z.string().max(200),
  acceptTos: z.literal(true),
});
export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(200),
  /** Code de l'application d'authentification, exigé si la double authentification est active. */
  code: z.string().trim().max(10).optional(),
});

export interface IdentityDeps {
  db: Db;
  mailer: Mailer;
  appUrl: string;
}

/** Tronque une IP (RGPD, guide 14) : /24 en IPv4, /48 en IPv6. */
export function ipPrefix(ip: string | undefined): string | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 3).join('.') + '.0/24';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::/48';
  return null;
}

async function sendVerification(deps: IdentityDeps, accountId: number, email: string): Promise<void> {
  const token = newToken();
  await deps.db
    .insertInto('email_verification')
    .values({
      token_hash: sha256(token),
      account_id: accountId,
      expires_at: new Date(Date.now() + VERIFY_HOURS * 3_600_000),
      used_at: null,
    })
    .execute();
  const link = `${deps.appUrl}/verifier?t=${encodeURIComponent(token)}`;
  await deps.mailer.send({
    to: email,
    subject: 'Les Cinq Régions : vérifiez votre adresse',
    text: `Bienvenue !\n\nPour confirmer votre adresse, ouvrez ce lien (valable ${VERIFY_HOURS} heures) :\n${link}\n\nSi vous n'avez pas créé de compte, ignorez ce message.`,
  });
}

/**
 * Inscription. Si l'e-mail existe déjà, la réponse est la même (pas d'énumération des comptes,
 * guide 13.1) et le titulaire reçoit un avertissement.
 */
export async function signup(deps: IdentityDeps, raw: unknown): Promise<{ created: boolean }> {
  const parsed = SignupInput.safeParse(raw);
  if (!parsed.success) throw new GameError('INVALID_INPUT');
  const { email, password } = parsed.data;
  const pseudo = checkPseudo(parsed.data.pseudo);
  if (password.length < PASSWORD_MIN) throw new GameError('PASSWORD_TOO_SHORT', { min: PASSWORD_MIN });

  const existing = await deps.db
    .selectFrom('account')
    .select('id')
    .where('email', '=', email)
    .where('status', '<>', 'deleted')
    .executeTakeFirst();
  if (existing) {
    await deps.mailer.send({
      to: email,
      subject: 'Les Cinq Régions : tentative d’inscription',
      text: `Quelqu'un a essayé de créer un compte avec votre adresse. Vous avez déjà un compte : connectez-vous sur ${deps.appUrl}/connexion.\n\nSi ce n'était pas vous, ignorez ce message.`,
    });
    return { created: false };
  }

  const pseudoTaken = await deps.db
    .selectFrom('player')
    .select('id')
    .where((eb) => eb(eb.fn('lower', ['pseudo']), '=', pseudo.toLowerCase()))
    .executeTakeFirst();
  if (pseudoTaken) throw new GameError('PSEUDO_TAKEN');

  const passwordHash = await hash(password, ARGON);
  let accountId: number;
  try {
    accountId = await deps.db.transaction().execute(async (tx) => {
      const acc = await tx
        .insertInto('account')
        .values({
          email,
          password_hash: passwordHash,
          email_verified_at: null,
          totp_secret: null,
          tos_version: TOS_VERSION,
          tos_accepted_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await tx
        .insertInto('player')
        .values({
          account_id: acc.id,
          pseudo,
          seed: randomInt(0, 2 ** 32 - 1) >>> 0, // graine secrète tirée par le serveur (README 26)
          pos_kind: 'city',
          pos_region: START_REGION,
          pos_route: null,
          pos_direction: null,
          pos_step: null,
          pos_dungeon_run: null,
          watch_until: null,
          last_seen_at: null,
        })
        .execute();
      return acc.id;
    });
  } catch (e) {
    // Course entre deux inscriptions : la contrainte d'unicité tranche.
    const constraint = (e as { constraint?: string }).constraint;
    if (constraint === 'player_pseudo_uq') throw new GameError('PSEUDO_TAKEN');
    if (constraint === 'account_email_uq') return { created: false };
    throw e;
  }
  await sendVerification(deps, accountId, email);
  return { created: true };
}

export async function verifyEmail(db: Db, token: string): Promise<void> {
  const ok = await db.transaction().execute(async (tx) => {
    const row = await tx
      .updateTable('email_verification')
      .set({ used_at: new Date() })
      .where('token_hash', '=', sha256(token))
      .where('used_at', 'is', null)
      .where('expires_at', '>', new Date())
      .returning('account_id')
      .executeTakeFirst();
    if (!row) return false;
    await tx
      .updateTable('account')
      .set({ email_verified_at: new Date(), updated_at: new Date() })
      .where('id', '=', row.account_id)
      .where('email_verified_at', 'is', null)
      .execute();
    return true;
  });
  if (!ok) throw new GameError('VERIFY_TOKEN_INVALID');
}

export async function resendVerification(deps: IdentityDeps, accountId: number): Promise<void> {
  const acc = await deps.db
    .selectFrom('account')
    .select(['email', 'email_verified_at'])
    .where('id', '=', accountId)
    .executeTakeFirstOrThrow();
  if (!acc.email_verified_at) await sendVerification(deps, accountId, acc.email);
}

/**
 * Garde-fou des connexions (guide 13.1), en base pour tous les exemplaires : après LOGIN_MAX_FAILURES échecs pour une
 * adresse en LOGIN_WINDOW_MIN minutes (qu'elle ait un compte ou non), ou LOGIN_MAX_IP_FAILURES depuis un même préfixe
 * d'IP, la connexion est refusée jusqu'à ce que la fenêtre glisse. Un succès efface les échecs de l'adresse.
 */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_MAX_IP_FAILURES = 50;
export const LOGIN_WINDOW_MIN = 15;

const failureKeys = (email: string, ip: string | undefined): string[] => {
  const p = ipPrefix(ip);
  return [`email:${sha256(email)}`, ...(p ? [`ip:${p}`] : [])];
};

async function assertNotThrottled(db: Db, email: string, ip: string | undefined, now: Date): Promise<void> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MIN * 60_000);
  const [byEmail, byIp] = failureKeys(email, ip);
  const rows = await db
    .selectFrom('login_failure')
    .select(['key', (eb) => eb.fn.countAll<number>().as('n')])
    .where('key', 'in', [byEmail!, ...(byIp ? [byIp] : [])])
    .where('at', '>', since)
    .groupBy('key')
    .execute();
  const count = (k: string | undefined) => Number(rows.find((r) => r.key === k)?.n ?? 0);
  if (count(byEmail) >= LOGIN_MAX_FAILURES || count(byIp) >= LOGIN_MAX_IP_FAILURES)
    throw new GameError('LOGIN_THROTTLED', { minutes: LOGIN_WINDOW_MIN });
}

async function recordFailure(db: Db, email: string, ip: string | undefined): Promise<void> {
  await db
    .insertInto('login_failure')
    .values(failureKeys(email, ip).map((key) => ({ key })))
    .execute();
}

/** Hash factice : la vérification prend le même temps qu'un compte existe ou non. */
let dummyHash: Promise<string> | undefined;

export interface NewSession {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

export async function login(db: Db, raw: unknown, meta: { ip?: string | undefined; userAgent?: string | undefined }): Promise<NewSession> {
  const parsed = LoginInput.safeParse(raw);
  if (!parsed.success) throw new GameError('BAD_CREDENTIALS');
  await assertNotThrottled(db, parsed.data.email, meta.ip, new Date());
  try {
    const s = await checkLogin(db, parsed.data, meta);
    await db
      .deleteFrom('login_failure')
      .where('key', '=', `email:${sha256(parsed.data.email)}`)
      .execute();
    return s;
  } catch (e) {
    if (e instanceof GameError && (e.code === 'BAD_CREDENTIALS' || e.code === 'TOTP_INVALID'))
      await recordFailure(db, parsed.data.email, meta.ip);
    throw e;
  }
}

async function checkLogin(
  db: Db,
  input: z.output<typeof LoginInput>,
  meta: { ip?: string | undefined; userAgent?: string | undefined },
): Promise<NewSession> {
  const parsed = { data: input };
  const acc = await db
    .selectFrom('account')
    .selectAll()
    .where('email', '=', parsed.data.email)
    .where('status', '<>', 'deleted')
    .executeTakeFirst();
  dummyHash ??= hash('mot de passe factice', ARGON);
  const ok = await verify(acc?.password_hash ?? (await dummyHash), parsed.data.password);
  if (!acc || !ok) throw new GameError('BAD_CREDENTIALS');
  // Une suspension arrivée à son terme se lève à la connexion, sans attendre la tâche du worker.
  if (acc.status === 'suspended' && (await liftExpiredSuspensions(db, acc.id)) === 1) acc.status = 'active';
  if (acc.status !== 'active') throw new GameError('ACCOUNT_SUSPENDED');
  // Double authentification (guide 13.4) : le mot de passe est juste, il faut encore le code du moment.
  if (acc.totp_secret) {
    if (!parsed.data.code) throw new GameError('TOTP_REQUIRED');
    await useTotp(db, acc.id, acc.totp_secret, parsed.data.code, acc.totp_last_step);
  }
  return createSession(db, acc.id, meta);
}

/** Consomme un code : il doit être juste et d'un pas plus récent que le dernier accepté (pas de rejeu). */
async function useTotp(db: Db, accountId: number, secret: string, code: string, lastStep: number | null): Promise<void> {
  const step = matchTotp(secret, code, new Date(), lastStep);
  if (step === null) throw new GameError('TOTP_INVALID');
  // Deux connexions simultanées avec le même code : une seule passe.
  const r = await db
    .updateTable('account')
    .set({ totp_last_step: step })
    .where('id', '=', accountId)
    .where((eb) => eb.or([eb('totp_last_step', 'is', null), eb('totp_last_step', '<', step)]))
    .executeTakeFirst();
  if (!Number(r.numUpdatedRows)) throw new GameError('TOTP_INVALID');
}

// ---------------------------------------------------------------------------------------------------------
// Double authentification (TOTP). Ouverte à tous ; exigée du personnel de modération (REQUIRE_STAFF_2FA).

export interface TotpSetup {
  /** Vrai si la double authentification est active. */
  enabled: boolean;
  /** Pendant l'activation : secret à saisir dans l'application, et son adresse otpauth://. */
  secret?: string;
  uri?: string;
}

async function playerOfAccount(db: Db, accountId: number): Promise<number> {
  const p = await db.selectFrom('player').select('id').where('account_id', '=', accountId).executeTakeFirstOrThrow();
  return p.id;
}

/** État de la 2FA d'un compte, sans rien changer. */
export async function totpState(db: Db, accountId: number): Promise<TotpSetup> {
  const a = await db
    .selectFrom('account')
    .select(['totp_secret', 'totp_pending', 'email'])
    .where('id', '=', accountId)
    .executeTakeFirstOrThrow();
  if (a.totp_secret) return { enabled: true };
  if (a.totp_pending) return { enabled: false, secret: a.totp_pending, uri: totpUri(a.totp_pending, a.email) };
  return { enabled: false };
}

/** Commence l'activation : propose un secret (le même tant qu'il n'est pas confirmé). */
export async function startTotp(db: Db, accountId: number): Promise<TotpSetup> {
  const a = await db
    .selectFrom('account')
    .select(['totp_secret', 'totp_pending', 'email'])
    .where('id', '=', accountId)
    .executeTakeFirstOrThrow();
  if (a.totp_secret) throw new GameError('TOTP_ALREADY_ON');
  const secret = a.totp_pending ?? newTotpSecret();
  if (!a.totp_pending) await db.updateTable('account').set({ totp_pending: secret }).where('id', '=', accountId).execute();
  return { enabled: false, secret, uri: totpUri(secret, a.email) };
}

/** Termine l'activation avec un premier code juste ; les autres sessions du compte sont fermées. */
export async function confirmTotp(db: Db, accountId: number, code: string, keepSession?: string): Promise<void> {
  const a = await db.selectFrom('account').select(['totp_secret', 'totp_pending']).where('id', '=', accountId).executeTakeFirstOrThrow();
  if (a.totp_secret) throw new GameError('TOTP_ALREADY_ON');
  if (!a.totp_pending) throw new GameError('TOTP_INVALID');
  const step = matchTotp(a.totp_pending, code, new Date());
  if (step === null) throw new GameError('TOTP_INVALID');
  const pid = await playerOfAccount(db, accountId);
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('account')
      .set({ totp_secret: a.totp_pending, totp_pending: null, totp_last_step: step, updated_at: new Date() })
      .where('id', '=', accountId)
      .where('totp_secret', 'is', null)
      .execute();
    let del = tx.deleteFrom('session').where('account_id', '=', accountId);
    if (keepSession) del = del.where('id', '<>', keepSession);
    await del.execute();
    await tx.insertInto('admin_action').values({ actor_id: pid, action: 'account.totp_on', target_id: pid, data: '{}' }).execute();
  });
}

/** Désactive la 2FA ; il faut un code du moment (une session volée ne suffit pas). */
export async function disableTotp(db: Db, accountId: number, code: string): Promise<void> {
  const a = await db.selectFrom('account').select(['totp_secret', 'totp_last_step']).where('id', '=', accountId).executeTakeFirstOrThrow();
  if (!a.totp_secret) {
    // Activation commencée puis abandonnée : on oublie le secret proposé.
    await db.updateTable('account').set({ totp_pending: null }).where('id', '=', accountId).execute();
    return;
  }
  await useTotp(db, accountId, a.totp_secret, code, a.totp_last_step);
  const pid = await playerOfAccount(db, accountId);
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('account')
      .set({ totp_secret: null, totp_pending: null, totp_last_step: null, updated_at: new Date() })
      .where('id', '=', accountId)
      .execute();
    await tx.insertInto('admin_action').values({ actor_id: pid, action: 'account.totp_off', target_id: pid, data: '{}' }).execute();
  });
}

export async function createSession(
  db: Db,
  accountId: number,
  meta: { ip?: string | undefined; userAgent?: string | undefined },
): Promise<NewSession> {
  const token = newToken();
  const csrfToken = newToken();
  const now = new Date();
  const expiresAt = addDays(now, SESSION_DAYS);
  await db
    .insertInto('session')
    .values({
      id: sha256(token),
      account_id: accountId,
      csrf_token: csrfToken,
      expires_at: expiresAt,
      last_seen_at: now,
      ip_prefix: ipPrefix(meta.ip),
      user_agent: meta.userAgent?.slice(0, 300) ?? null,
    })
    .execute();
  // Se connecter, c'est être vu (présence, invitations de donjon) : sans attendre la première minute de session.
  await db.updateTable('player').set({ last_seen_at: now }).where('account_id', '=', accountId).execute();
  return { token, csrfToken, expiresAt };
}

export interface AuthContext {
  session: Session;
  account: Pick<Account, 'id' | 'email' | 'role' | 'status' | 'email_verified_at'> & { totp: boolean };
  player: Pick<Player, 'id' | 'pseudo' | 'pos_kind' | 'pos_region'>;
}

/** Retrouve la session d'un cookie ; prolonge l'expiration au plus une fois par minute. */
export async function getAuth(db: Db, token: string | undefined): Promise<AuthContext | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const row = await db
    .selectFrom('session')
    .innerJoin('account', 'account.id', 'session.account_id')
    .innerJoin('player', 'player.account_id', 'account.id')
    .select([
      'session.id as session_id',
      'session.account_id',
      'session.csrf_token',
      'session.expires_at',
      'session.last_seen_at',
      'session.ip_prefix',
      'session.user_agent',
      'session.created_at',
      'account.email',
      'account.role',
      'account.status',
      'account.email_verified_at',
      'account.totp_secret',
      'player.id as player_id',
      'player.pseudo',
      'player.pos_kind',
      'player.pos_region',
    ])
    .where('session.id', '=', id)
    .executeTakeFirst();
  const now = new Date();
  if (!row || row.expires_at <= now || row.status !== 'active') return null;
  if (now.getTime() - row.last_seen_at.getTime() > 60_000) {
    await db
      .updateTable('session')
      .set({ last_seen_at: now, expires_at: addDays(now, SESSION_DAYS) })
      .where('id', '=', id)
      .execute();
    await db.updateTable('player').set({ last_seen_at: now }).where('id', '=', row.player_id).execute();
  }
  return {
    session: {
      id,
      account_id: row.account_id,
      csrf_token: row.csrf_token,
      expires_at: row.expires_at,
      last_seen_at: row.last_seen_at,
      ip_prefix: row.ip_prefix,
      user_agent: row.user_agent,
      created_at: row.created_at,
    },
    account: {
      id: row.account_id,
      email: row.email,
      role: row.role,
      status: row.status,
      email_verified_at: row.email_verified_at,
      totp: row.totp_secret !== null,
    },
    player: { id: row.player_id, pseudo: row.pseudo, pos_kind: row.pos_kind, pos_region: row.pos_region },
  };
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.deleteFrom('session').where('id', '=', sha256(token)).execute();
}

export async function purgeExpiredSessions(db: Db): Promise<number> {
  const r = await db.deleteFrom('session').where('expires_at', '<', new Date()).executeTakeFirst();
  await db.deleteFrom('login_failure').where('at', '<', addDays(new Date(), -1)).execute();
  await db.deleteFrom('email_verification').where('expires_at', '<', addDays(new Date(), -7)).execute();
  return Number(r.numDeletedRows);
}
