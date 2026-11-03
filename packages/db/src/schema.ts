import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/** Colonne horodatée remplie par la base (`default now()`). */
type CreatedAt = ColumnType<Date, Date | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | undefined, Date>;

export type AccountRole = 'player' | 'moderator' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'banned' | 'deleted';
export type PositionKind = 'city' | 'route' | 'dungeon';

export interface AccountTable {
  id: Generated<number>;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  role: ColumnType<AccountRole, AccountRole | undefined, AccountRole>;
  status: ColumnType<AccountStatus, AccountStatus | undefined, AccountStatus>;
  totp_secret: string | null;
  tos_version: string;
  tos_accepted_at: Date;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface SessionTable {
  /** SHA-256 du jeton du cookie : le jeton lui-même n'est jamais stocké. */
  id: string;
  account_id: number;
  csrf_token: string;
  expires_at: Date;
  last_seen_at: Date;
  ip_prefix: string | null;
  user_agent: string | null;
  created_at: CreatedAt;
}

export interface EmailVerificationTable {
  /** SHA-256 du jeton envoyé par e-mail. */
  token_hash: string;
  account_id: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: CreatedAt;
}

export interface PlayerTable {
  id: Generated<number>;
  account_id: number;
  pseudo: string;
  /** Graine secrète 32 bits (README 26). Ne quitte jamais le serveur. */
  seed: number;
  pos_kind: ColumnType<PositionKind, PositionKind | undefined, PositionKind>;
  pos_region: string;
  pos_route: string | null;
  pos_direction: number | null;
  pos_step: number | null;
  pos_dungeon_run: number | null;
  watch_until: Date | null;
  dungeon_available: ColumnType<boolean, boolean | undefined, boolean>;
  last_seen_at: Date | null;
  lock_version: ColumnType<number, number | undefined, number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface IdempotencyKeyTable {
  player_id: number;
  key: string;
  command: string;
  request_hash: string;
  response: unknown;
  created_at: CreatedAt;
}

export interface Database {
  account: AccountTable;
  session: SessionTable;
  email_verification: EmailVerificationTable;
  player: PlayerTable;
  idempotency_key: IdempotencyKeyTable;
}

export type Account = Selectable<AccountTable>;
export type NewAccount = Insertable<AccountTable>;
export type Session = Selectable<SessionTable>;
export type Player = Selectable<PlayerTable>;
export type NewPlayer = Insertable<PlayerTable>;
export type PlayerUpdate = Updateable<PlayerTable>;
