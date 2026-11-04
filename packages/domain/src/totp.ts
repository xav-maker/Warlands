/**
 * Mots de passe à usage unique fondés sur le temps (TOTP, RFC 6238) : HMAC-SHA1, pas de 30 secondes, 6 chiffres,
 * les paramètres que lisent toutes les applications d'authentification. Sert à la double authentification du
 * personnel de modération et d'administration (guide 13.4). Aucune dépendance : `node:crypto` seulement.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('base32 invalide');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secret neuf de 160 bits, en base32 (ce que l'on saisit dans l'application). */
export const newTotpSecret = (): string => base32Encode(randomBytes(20));

/** Numéro du pas de temps d'un instant. */
export const totpStep = (at: Date): number => Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);

/** Code à 6 chiffres d'un pas donné (RFC 4226, troncature dynamique). */
export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const off = mac[mac.length - 1]! & 15;
  const bin = ((mac[off]! & 0x7f) << 24) | (mac[off + 1]! << 16) | (mac[off + 2]! << 8) | mac[off + 3]!;
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export const totpCode = (secret: string, at: Date): string => hotp(secret, totpStep(at));

/**
 * Vérifie un code saisi, avec une tolérance d'un pas avant et après (décalage d'horloge). Renvoie le pas reconnu,
 * pour refuser ensuite tout code d'un pas déjà utilisé (rejeu), ou null.
 */
export function matchTotp(secret: string, code: string, at: Date, lastStep: number | null = null): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const now = totpStep(at);
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(c))) return step;
  }
  return null;
}

/** Adresse `otpauth://` que lisent les applications d'authentification (saisie manuelle ou code QR). */
export function totpUri(secret: string, account: string, issuer = 'Les Cinq Régions'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}
