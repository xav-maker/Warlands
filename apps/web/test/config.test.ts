import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';

const base = { DATABASE_URL: 'postgres://x', SMTP_URL: 'smtp://x', MAIL_FROM: 'a <a@b.c>' };

describe('loadConfig', () => {
  it('prend APP_URL quand elle est fournie', () => {
    const c = loadConfig({ ...base, APP_URL: 'https://jeu.example/', RENDER_EXTERNAL_URL: 'https://x.onrender.com' });
    expect(c.APP_URL).toBe('https://jeu.example');
  });

  it("se rabat sur l'adresse publique de Render", () => {
    expect(loadConfig({ ...base, RENDER_EXTERNAL_URL: 'https://x.onrender.com' }).APP_URL).toBe('https://x.onrender.com');
  });

  it('refuse une configuration sans adresse', () => {
    expect(() => loadConfig(base)).toThrow('APP_URL');
  });

  it('expose la version déployée', () => {
    expect(loadConfig({ ...base, APP_URL: 'http://l' }).APP_VERSION).toBe('dev');
    expect(loadConfig({ ...base, APP_URL: 'http://l', APP_VERSION: 'abc' }).APP_VERSION).toBe('abc');
  });
});

describe('serveur d’e-mail', () => {
  const env = { DATABASE_URL: 'postgres://x', MAIL_FROM: 'a <a@b.c>', APP_URL: 'http://l' };

  it('se configure par variables séparées, sans rien encoder', () => {
    const c = loadConfig({ ...env, SMTP_HOST: 'smtp-relay.brevo.com', SMTP_USER: 'c15@smtp-brevo.com', SMTP_PASS: 'cl:é/@' });
    expect(c.smtp).toEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'c15@smtp-brevo.com', pass: 'cl:é/@' },
    });
  });

  it('passe en TLS direct sur le port 465', () => {
    expect(loadConfig({ ...env, SMTP_HOST: 'h', SMTP_PORT: '465' }).smtp).toEqual({ host: 'h', port: 465, secure: true });
  });

  it('accepte encore SMTP_URL, identifiant encodé', () => {
    const c = loadConfig({ ...env, SMTP_URL: 'smtp://c15%40smtp-brevo.com:k3y@smtp-relay.brevo.com:587' });
    expect(c.smtp).toEqual({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: 'c15@smtp-brevo.com', pass: 'k3y' } });
    expect(loadConfig({ ...env, SMTP_URL: 'smtp://localhost:1025' }).smtp).toEqual({ host: 'localhost', port: 1025, secure: false });
  });

  it('préfère SMTP_HOST à SMTP_URL', () => {
    expect(loadConfig({ ...env, SMTP_HOST: 'h', SMTP_URL: 'smtp://autre:25' }).smtp.host).toBe('h');
  });

  it('ne recopie jamais le secret dans l’erreur', () => {
    const secret = 'xsmtpsib-SECRET';
    const bad = `smtp://c15:${secret}%40smtp-relay.brevo.com:587`;
    expect(() => loadConfig({ ...env, SMTP_URL: bad })).toThrow('SMTP_URL n’est pas une URL');
    try {
      loadConfig({ ...env, SMTP_URL: bad });
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });

  it('exige un serveur', () => {
    expect(() => loadConfig(env)).toThrow('SMTP_HOST (ou SMTP_URL) manquant');
  });
});
