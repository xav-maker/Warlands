import nodemailer from 'nodemailer';
import type { Mailer } from '@cr/domain';
import type { SmtpOptions } from './config.ts';

export interface MailLog {
  error(obj: Record<string, unknown>, msg: string): void;
}

/**
 * Envoi par SMTP. Un e-mail qui ne part pas (fournisseur en panne, configuration fausse) ne fait pas échouer
 * l'action du joueur : l'inscription aboutit, l'erreur est journalisée (sans le contenu du message), et le
 * joueur peut redemander l'e-mail de vérification.
 */
export function smtpMailer(smtp: SmtpOptions, from: string, log: MailLog = { error: (o, m) => console.error(m, o) }): Mailer {
  const transport = nodemailer.createTransport({ ...smtp, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  return {
    async send(mail) {
      try {
        await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
      } catch (err) {
        log.error(
          { err: { code: (err as { code?: string }).code, message: (err as Error).message }, subject: mail.subject },
          'e-mail non envoyé',
        );
      }
    },
  };
}
