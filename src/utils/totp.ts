import crypto from "node:crypto";

/**
 * Núcleo TOTP (RFC 6238) y códigos de respaldo. Funciones puras y testables.
 * Solo se usa en el servidor (server.ts) y en pruebas; nunca en el bundle del navegador.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = String(input || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secreto base32 aleatorio (por defecto 20 bytes = 160 bits). */
export function generarSecretoTotp(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** Código TOTP de 6 dígitos para un instante dado (paso de 30s, HMAC-SHA1). */
export function codigoTotp(secret: string, timeMs: number = Date.now(), stepSec = 30, digits = 6): string {
  const counter = Math.floor(timeMs / 1000 / stepSec);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** Verifica un código TOTP permitiendo ±window pasos de tolerancia (reloj desfasado). */
export function verificarTotp(secret: string, codigo: string, timeMs: number = Date.now(), window = 1): boolean {
  const c = String(codigo || "").replace(/\D/g, "");
  if (c.length !== 6) return false;
  for (let i = -window; i <= window; i++) {
    const candidato = codigoTotp(secret, timeMs + i * 30 * 1000);
    if (candidato.length === c.length && crypto.timingSafeEqual(Buffer.from(candidato), Buffer.from(c))) {
      return true;
    }
  }
  return false;
}

/** URI otpauth:// para que la app autenticadora (Google Authenticator, Authy) la lea. */
export function otpauthUrl(secret: string, cuenta: string, emisor = "Yuudit"): string {
  const label = encodeURIComponent(`${emisor}:${cuenta}`);
  const params = new URLSearchParams({
    secret,
    issuer: emisor,
    algorithm: "SHA1",
    digits: "6",
    period: "30"
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Códigos de respaldo de un solo uso, formato XXXX-XXXX. */
export function generarCodigosRespaldo(cantidad = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

/** Hash estable de un código de respaldo (para guardarlos sin texto plano). */
export function hashCodigoRespaldo(codigo: string): string {
  return crypto
    .createHash("sha256")
    .update(String(codigo || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .digest("hex");
}
