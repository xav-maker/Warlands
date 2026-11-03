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
  /** Kit de départ remis (README 8.1) ; null tant que le joueur n'a pas commencé. */
  started_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  content_version: ColumnType<string | null, string | null | undefined, string | null>;
  stat_fights: ColumnType<number, number | undefined, number>;
  stat_wins: ColumnType<number, number | undefined, number>;
  stat_deaths: ColumnType<number, number | undefined, number>;
  /** Régions dont le gardien a déjà été vaincu (objet de première victoire). */
  guardians: ColumnType<string[], string[] | undefined, string[]>;
  /** Indice de la région la plus lointaine atteinte (affichage seulement, README 3.3). */
  unlocked: ColumnType<number, number | undefined, number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export type TroopContainer = 'BARRACKS' | 'SQUAD' | 'GRAVE';
export type StackContainer = 'BAG' | 'BANK' | 'PENDING_LOOT';
export type InstanceContainer = StackContainer | 'EQUIPPED' | 'GRAVE' | 'SYSTEM';

export interface TroopTable {
  id: Generated<number>;
  player_id: number;
  type: string;
  form: string;
  level: number;
  xp: ColumnType<number, number | undefined, number>;
  container: TroopContainer;
  rank: number;
  sort: ColumnType<number, number | undefined, number>;
  disabled_skills: ColumnType<string[], string[] | undefined, string[]>;
  loaned: ColumnType<boolean, boolean | undefined, boolean>;
  died_at: Date | null;
  lock_version: ColumnType<number, number | undefined, number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface TroopUnitTable {
  troop_id: number;
  n: number;
  hp: number;
  mana: number;
  dead: ColumnType<boolean, boolean | undefined, boolean>;
}

export interface ItemStackTable {
  id: Generated<number>;
  player_id: number;
  container: StackContainer;
  item: string;
  qty: number;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface ItemInstanceTable {
  id: Generated<number>;
  player_id: number | null;
  container: InstanceContainer;
  troop_id: number | null;
  unit_n: number | null;
  slot: string | null;
  base: string;
  roll: number;
  stats: ColumnType<{ k: string; v: number; type?: string }[], string, string>;
  origin: 'loot' | 'craft' | 'merchant' | 'quest' | 'dungeon' | 'start';
  content_version: string;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface AssetMoveTable {
  id: Generated<number>;
  player_id: number | null;
  kind: 'stack' | 'instance' | 'troop';
  item: string | null;
  instance_id: number | null;
  troop_id: number | null;
  qty: ColumnType<number, number | undefined, never>;
  from_container: string;
  to_container: string;
  reason: string;
  created_at: CreatedAt;
}

export interface GoldAccountTable {
  id: Generated<number>;
  player_id: number | null;
  code: string | null;
  balance: ColumnType<number, number | undefined, number>;
  created_at: CreatedAt;
}

export interface GoldEntryTable {
  id: Generated<number>;
  tx: string;
  account_id: number;
  amount: number;
  reason: string;
  created_at: CreatedAt;
}

export interface ExpeditionTable {
  player_id: number;
  route: string;
  direction: number;
  cleared: boolean[];
  started_at: Date;
}

export interface EncounterTable {
  id: Generated<number>;
  player_id: number;
  route: string;
  step: number;
  side: ColumnType<unknown, string, string>;
  rare: string | null;
  guardian: boolean;
  seed: number;
  status: 'visible' | 'fought' | 'gone';
  created_at: CreatedAt;
}

export interface BattleTable {
  id: Generated<number>;
  player_id: number;
  kind: 'route' | 'guardian' | 'dungeon';
  route: string;
  step: number;
  encounter_id: number | null;
  seed: number;
  engine_version: string;
  content_version: string;
  input: ColumnType<unknown, string, never>;
  result: ColumnType<unknown, string, never>;
  /** Journal JSON compressé en gzip. */
  log: ColumnType<Buffer, Buffer, never>;
  duration: number;
  won: boolean;
  created_at: CreatedAt;
}

export interface BattleParticipantTable {
  battle_id: number;
  player_id: number;
  rewards: ColumnType<unknown, string, never>;
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
  troop: TroopTable;
  troop_unit: TroopUnitTable;
  item_stack: ItemStackTable;
  item_instance: ItemInstanceTable;
  asset_move: AssetMoveTable;
  gold_account: GoldAccountTable;
  gold_entry: GoldEntryTable;
  expedition: ExpeditionTable;
  encounter: EncounterTable;
  battle: BattleTable;
  battle_participant: BattleParticipantTable;
}

export type Account = Selectable<AccountTable>;
export type NewAccount = Insertable<AccountTable>;
export type Session = Selectable<SessionTable>;
export type Player = Selectable<PlayerTable>;
export type NewPlayer = Insertable<PlayerTable>;
export type PlayerUpdate = Updateable<PlayerTable>;
export type Troop = Selectable<TroopTable>;
export type TroopUnit = Selectable<TroopUnitTable>;
export type Encounter = Selectable<EncounterTable>;
export type Expedition = Selectable<ExpeditionTable>;
