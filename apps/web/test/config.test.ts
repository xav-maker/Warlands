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
