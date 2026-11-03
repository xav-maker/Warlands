import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb, type TestDb } from '@cr/testing';
import { GameError } from '@cr/shared';
import { checkPseudo, getAuth, ipPrefix, login, logout, memoryMailer, signup, verifyEmail, START_REGION } from '../src/index.ts';

let t: TestDb;
beforeAll(async () => void (t = await startTestDb()));
afterAll(async () => t?.stop());

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof GameError) return e.code;
    throw e;
  }
};

describe('pseudo', () => {
  it('normalise les espaces et accepte lettres accentuées, chiffres, tiret', () => {
    expect(checkPseudo('  Élise  du-Val 2 ')).toBe('Élise du-Val 2');
  });
  it.each(['ab', 'a'.repeat(21), '-abc', 'abc-', 'a<b>c', 'ab_c'])('refuse « %s »', (p) => {
    expect(() => checkPseudo(p)).toThrowError(expect.objectContaining({ code: 'PSEUDO_INVALID' }));
  });
  it.each(['Admin', 'le-Modérateur', 'S y s t è m e'])('refuse le pseudo réservé « %s »', (p) => {
    expect(() => checkPseudo(p)).toThrowError(GameError);
  });
});

describe('ipPrefix', () => {
  it('tronque IPv4 et IPv6', () => {
    expect(ipPrefix('203.0.113.42')).toBe('203.0.113.0/24');
    expect(ipPrefix('::ffff:203.0.113.42')).toBe('203.0.113.0/24');
    expect(ipPrefix('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48');
  });
});

describe('inscription, vérification, connexion', () => {
  const mailer = memoryMailer();
  const deps = () => ({ db: t.db, mailer, appUrl: 'http://test' });
  const base = { email: 'Ana@Example.org', pseudo: 'Ana', password: 'correct horse battery', acceptTos: true };

  it('crée le compte, le joueur en ville de départ avec une graine, et envoie un lien', async () => {
    expect(await signup(deps(), base)).toEqual({ created: true });
    const acc = await t.db.selectFrom('account').selectAll().where('email', '=', 'ana@example.org').executeTakeFirstOrThrow();
    expect(acc.password_hash.startsWith('$argon2id$')).toBe(true);
    const p = await t.db.selectFrom('player').selectAll().where('account_id', '=', acc.id).executeTakeFirstOrThrow();
    expect(p).toMatchObject({ pseudo: 'Ana', pos_kind: 'city', pos_region: START_REGION });
    expect(p.seed).toBeGreaterThanOrEqual(0);
    expect(p.seed).toBeLessThan(2 ** 32);
    expect(mailer.sent.at(-1)?.text).toContain('http://test/verifier?t=');
  });

  it("ne révèle pas qu'un e-mail existe : même réponse, et le titulaire est prévenu", async () => {
    const before = mailer.sent.length;
    expect(await signup(deps(), { ...base, pseudo: 'Autre' })).toEqual({ created: false });
    expect(mailer.sent.length).toBe(before + 1);
    expect(mailer.sent.at(-1)?.subject).toContain('tentative');
    expect(await t.db.selectFrom('player').select('id').where('pseudo', '=', 'Autre').executeTakeFirst()).toBeUndefined();
  });

  it('refuse un pseudo pris (insensible à la casse) et un mot de passe court', async () => {
    expect(await code(signup(deps(), { ...base, email: 'b@example.org', pseudo: 'ANA' }))).toBe('PSEUDO_TAKEN');
    expect(await code(signup(deps(), { ...base, email: 'c@example.org', pseudo: 'Cid', password: 'court' }))).toBe('PASSWORD_TOO_SHORT');
    expect(await code(signup(deps(), { ...base, email: 'd@example.org', pseudo: 'Dan', acceptTos: false }))).toBe('INVALID_INPUT');
  });

  it("vérifie l'e-mail une seule fois", async () => {
    const link = mailer.sent.find((m) => m.subject.includes('vérifiez'))!.text;
    const token = decodeURIComponent(/t=([^\s]+)/.exec(link)![1]!);
    await verifyEmail(t.db, token);
    expect(await code(verifyEmail(t.db, token))).toBe('VERIFY_TOKEN_INVALID');
    expect(await code(verifyEmail(t.db, 'faux'))).toBe('VERIFY_TOKEN_INVALID');
    const acc = await t.db
      .selectFrom('account')
      .select('email_verified_at')
      .where('email', '=', 'ana@example.org')
      .executeTakeFirstOrThrow();
    expect(acc.email_verified_at).toBeInstanceOf(Date);
  });

  it('connecte, retrouve la session, puis déconnecte', async () => {
    expect(await code(login(t.db, { email: 'ana@example.org', password: 'mauvais' }, {}))).toBe('BAD_CREDENTIALS');
    expect(await code(login(t.db, { email: 'inconnu@example.org', password: 'x' }, {}))).toBe('BAD_CREDENTIALS');
    const s = await login(t.db, { email: ' ANA@example.org ', password: base.password }, { ip: '198.51.100.7', userAgent: 'vitest' });
    const auth = await getAuth(t.db, s.token);
    expect(auth?.player.pseudo).toBe('Ana');
    expect(auth?.session.csrf_token).toBe(s.csrfToken);
    const row = await t.db.selectFrom('session').selectAll().executeTakeFirstOrThrow();
    expect(row.id).not.toBe(s.token); // seul le hash du jeton est stocké
    expect(row.ip_prefix).toBe('198.51.100.0/24');
    await logout(t.db, s.token);
    expect(await getAuth(t.db, s.token)).toBeNull();
  });

  it('refuse la connexion à un compte suspendu', async () => {
    await t.db.updateTable('account').set({ status: 'suspended' }).where('email', '=', 'ana@example.org').execute();
    expect(await code(login(t.db, { email: 'ana@example.org', password: base.password }, {}))).toBe('ACCOUNT_SUSPENDED');
    await t.db.updateTable('account').set({ status: 'active' }).where('email', '=', 'ana@example.org').execute();
  });
});
