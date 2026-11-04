import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url().transform((u) => u.replace(/\/$/, '')),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  SESSION_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // E-mail : SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS), sinon SMTP_URL (voir smtpOptions).
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_URL: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_VERSION: z.string().default('dev'),
  // Chat, messages, amis et boutiques réservés aux comptes dont l'e-mail est vérifié (guide 13.1). À mettre à
  // « false » seulement tant que l'envoi d'e-mails ne fonctionne pas ; `verify-email` vérifie un compte à la main.
  REQUIRE_VERIFIED_EMAIL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Outils de test (escouade de niveau 30) : préproduction seulement, jamais en production.
  ENABLE_TEST_TOOLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export interface SmtpOptions {
  host: string;
  port: number;
  /** TLS dès la connexion (port 465) ; sinon STARTTLS si le serveur le propose. */
  secure: boolean;
  auth?: { user: string; pass: string };
}

export type Config = Omit<z.output<typeof Env>, 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS' | 'SMTP_URL'> & { smtp: SmtpOptions };

/**
 * Serveur d'e-mail. Les variables séparées évitent d'encoder l'identifiant et le mot de passe dans une URL
 * (un « @ » dans l'identifiant doit y devenir « %40 »). Aucun message d'erreur ne reprend leur valeur.
 */
function smtpOptions(e: z.output<typeof Env>): SmtpOptions {
  if (e.SMTP_HOST) {
    const auth = e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS ?? '' } : undefined;
    return { host: e.SMTP_HOST, port: e.SMTP_PORT, secure: e.SMTP_PORT === 465, ...(auth ? { auth } : {}) };
  }
  if (!e.SMTP_URL) throw new Error('Configuration invalide : SMTP_HOST (ou SMTP_URL) manquant');
  let u: URL;
  try {
    u = new URL(e.SMTP_URL);
  } catch {
    throw new Error(
      'Configuration invalide : SMTP_URL n’est pas une URL (smtp://identifiant:mot-de-passe@serveur:port ; un « @ » dans l’identifiant s’écrit %40). Plus simple : SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS.',
    );
  }
  if (u.protocol !== 'smtp:' && u.protocol !== 'smtps:')
    throw new Error('Configuration invalide : SMTP_URL doit commencer par smtp:// ou smtps://');
  const secure = u.protocol === 'smtps:';
  const port = u.port ? Number(u.port) : secure ? 465 : 587;
  const auth = u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined;
  return { host: u.hostname, port, secure: secure || port === 465, ...(auth ? { auth } : {}) };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Sur Render, l'adresse publique du service est fournie par RENDER_EXTERNAL_URL : APP_URL n'est alors
  // à renseigner que pour un domaine personnalisé.
  const r = Env.safeParse({ ...env, APP_URL: env.APP_URL || env.RENDER_EXTERNAL_URL });
  if (!r.success) {
    const fields = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuration invalide : ${fields}`);
  }
  const { SMTP_HOST: _h, SMTP_PORT: _p, SMTP_USER: _u, SMTP_PASS: _s, SMTP_URL: _url, ...rest } = r.data;
  return { ...rest, smtp: smtpOptions(r.data) };
}
