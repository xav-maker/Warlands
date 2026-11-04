/**
 * Double authentification (guide 13.4) : TOTP conforme à la RFC 6238, activation, connexion avec code,
 * refus du rejeu, désactivation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb, type TestDb } from '@cr/testing';
import {
  base32Decode,
  base32Encode,
  confirmTotp,
  createSession,
  disableTotp,
  getAuth,
  login,
  matchTotp,
  memoryMailer,
  newTotpSecret,
  signup,
  startTotp,
  totpCode,
  totpState,
  totpStep,
  totpUri,
} from '../src/index.ts';

/** Secret des vecteurs de la RFC 6238 (annexe B) : « 12345678901234567890 » en ASCII. */
const RFC = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('suit les vecteurs de la RFC 6238 (SHA-1, 6 derniers chiffres)', () => {
    expect(RFC).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totpCode(RFC, new Date(59_000))).toBe('287082');
    expect(totpCode(RFC, new Date(1_111_111_109_000))).toBe('081804');
    expect(totpCode(RFC, new Date(1_234_567_890_000))).toBe('005924');
    expect(totpCode(RFC, new Date(2_000_000_000_000))).toBe('279037');
  });

  it('encode et décode le base32 sans perte', () => {
    for (const s of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'])
      expect(base32Decode(base32Encode(Buffer.from(s))).toString()).toBe(s);
    expect(base32Decode('gezd gnbv')).toEqual(base32Decode('GEZDGNBV'));
    expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('accepte un pas d’écart, pas deux, et refuse un pas déjà utilisé', () => {
    const at = new Date(1_700_000_000_000);
    const step = totpStep(at);
    const prev = totpCode(RFC, new Date(at.getTime() - 30_000));
    expect(matchTotp(RFC, totpCode(RFC, at), at)).toBe(step);
    expect(matchTotp(RFC, prev, at)).toBe(step - 1);
    expect(matchTotp(RFC, totpCode(RFC, new Date(at.getTime() - 60_000)), at)).toBeNull();
    expect(matchTotp(RFC, totpCode(RFC, at), at, step)).toBeNull();
    expect(matchTotp(RFC, '12345', at)).toBeNull();
    expect(matchTotp(RFC, 'abcdef', at)).toBeNull();
  });

  it('donne une adresse otpauth lisible par les applications', () => {
    expect(totpUri(RFC, 'a@b.fr')).toBe(
      'otpauth://totp/Les%20Cinq%20R%C3%A9gions%3Aa%40b.fr?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Les%20Cinq%20R%C3%A9gions&algorithm=SHA1&digits=6&period=30',
    );
  });
});

describe('double authentification du compte', () => {
  let t: TestDb;
  beforeAll(async () => void (t = await startTestDb()));
  afterAll(async () => t?.stop());

  const email = 'deux@example.org';
  const password = 'motdepasse-long';
  let accountId = 0;
  const err = async (p: Promise<unknown>) => p.then(() => 'ok').catch((e: { code?: string }) => e.code ?? String(e));

  it('active la 2FA par un premier code juste, et ferme les autres sessions', async () => {
    await signup({ db: t.db, mailer: memoryMailer(), appUrl: 'http://test' }, { email, pseudo: 'Deux', password, acceptTos: true });
    accountId = (await t.db.selectFrom('account').select('id').where('email', '=', email).executeTakeFirstOrThrow()).id;
    const other = await createSession(t.db, accountId, {});
    const mine = await login(t.db, { email, password }, {});
    const myId = (await getAuth(t.db, mine.token))!.session.id;

    expect(await totpState(t.db, accountId)).toEqual({ enabled: false });
    const setup = await startTotp(t.db, accountId);
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect((await startTotp(t.db, accountId)).secret).toBe(setup.secret); // même secret tant qu'il n'est pas confirmé
    expect((await getAuth(t.db, mine.token))!.account.totp).toBe(false);

    expect(await err(confirmTotp(t.db, accountId, '000000', myId))).toBe('TOTP_INVALID');
    await confirmTotp(t.db, accountId, totpCode(setup.secret!, new Date()), myId);
    expect(await totpState(t.db, accountId)).toEqual({ enabled: true });
    expect((await getAuth(t.db, mine.token))!.account.totp).toBe(true);
    expect(await getAuth(t.db, other.token)).toBeNull();
    expect(await err(startTotp(t.db, accountId))).toBe('TOTP_ALREADY_ON');
    const log = await t.db.selectFrom('admin_action').select('action').where('action', 'like', 'account.totp%').execute();
    expect(log.map((l) => l.action)).toContain('account.totp_on');
  });

  it('exige le code à la connexion, et refuse son rejeu', async () => {
    const secret = (await t.db.selectFrom('account').select('totp_secret').where('id', '=', accountId).executeTakeFirstOrThrow())
      .totp_secret!;
    expect(await err(login(t.db, { email, password }, {}))).toBe('TOTP_REQUIRED');
    expect(await err(login(t.db, { email, password: 'mauvais-mot-de-passe' }, {}))).toBe('BAD_CREDENTIALS'); // le mot de passe d'abord
    expect(await err(login(t.db, { email, password, code: '000000' }, {}))).toBe('TOTP_INVALID');
    // Le code de confirmation vient d'être consommé : le pas suivant seulement.
    const next = totpCode(secret, new Date(Date.now() + 30_000));
    expect(await err(login(t.db, { email, password, code: next }, {}))).toBe('ok');
    expect(await err(login(t.db, { email, password, code: next }, {}))).toBe('TOTP_INVALID');
  });

  it('désactive la 2FA seulement avec un code valable', async () => {
    const secret = (await t.db.selectFrom('account').select('totp_secret').where('id', '=', accountId).executeTakeFirstOrThrow())
      .totp_secret!;
    expect(await err(disableTotp(t.db, accountId, '123456'))).toBe('TOTP_INVALID');
    // Seul un pas plus récent que le dernier utilisé passe (connexion précédente au pas suivant) : on recule l'horloge enregistrée.
    await t.db
      .updateTable('account')
      .set({ totp_last_step: totpStep(new Date()) - 5 })
      .where('id', '=', accountId)
      .execute();
    await disableTotp(t.db, accountId, totpCode(secret, new Date()));
    expect(await totpState(t.db, accountId)).toEqual({ enabled: false });
    expect(await err(login(t.db, { email, password }, {}))).toBe('ok');
  });
});
