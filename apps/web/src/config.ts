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
  SMTP_URL: z.string().min(1),
  MAIL_FROM: z.string().min(3),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_VERSION: z.string().default('dev'),
});

export type Config = z.output<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Sur Render, l'adresse publique du service est fournie par RENDER_EXTERNAL_URL : APP_URL n'est alors
  // à renseigner que pour un domaine personnalisé.
  const r = Env.safeParse({ ...env, APP_URL: env.APP_URL || env.RENDER_EXTERNAL_URL });
  if (!r.success) {
    const fields = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuration invalide : ${fields}`);
  }
  return r.data;
}
