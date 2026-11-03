import { describe, expect, it } from 'vitest';
import { smtpMailer } from '../src/mailer.ts';

describe('smtpMailer', () => {
  it('n’échoue pas quand le serveur d’e-mail est injoignable, et le journalise', async () => {
    const errors: string[] = [];
    const m = smtpMailer({ host: '127.0.0.1', port: 9, secure: false }, 'x <x@example.com>', { error: (_o, msg) => void errors.push(msg) });
    await expect(m.send({ to: 'a@example.org', subject: 'Essai', text: 'secret' })).resolves.toBeUndefined();
    expect(errors).toEqual(['e-mail non envoyé']);
  });
});
