import nodemailer from 'nodemailer';
import type { Mailer } from '@cr/domain';
import type { SmtpOptions } from './config.ts';

export function smtpMailer(smtp: SmtpOptions, from: string): Mailer {
  const transport = nodemailer.createTransport(smtp);
  return {
    async send(mail) {
      await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}
