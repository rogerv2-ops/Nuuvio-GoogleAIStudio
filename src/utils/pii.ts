import crypto from "node:crypto";

/**
 * Cifrado de PII en reposo (Fase 5).
 * AES-256-GCM con clave en VUUV_PII_KEY (32 bytes en hex o base64). Fail-closed.
 * Formato del sobre: `enc:v1:<iv b64url>:<tag b64url>:<ct b64url>`.
 * Índice ciego: HMAC-SHA256(clave, valor normalizado) para búsquedas sin descifrar.
 */

const PREFIJO = "enc:v1:";
let cachedRaw = "";
let cachedKey: Buffer | null = null;
let avisoClaveEmitido = false;

function clavePii(): Buffer {
  const raw = String(process.env.VUUV_PII_KEY || "").trim();
  if (!raw) {
    if (!avisoClaveEmitido) {
      console.error(
        "[PII] CRITICO: falta VUUV_PII_KEY. No se puede cifrar/descifrar PII de audiencia (fail-closed)."
      );
      avisoClaveEmitido = true;
    }
    throw new Error("PII_KEY_UNAVAILABLE: configura VUUV_PII_KEY (32 bytes en hex o base64).");
  }
  if (cachedKey && cachedRaw === raw) return cachedKey;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PII_KEY_UNAVAILABLE: VUUV_PII_KEY debe ser de 32 bytes (hex 64 o base64).");
  cachedRaw = raw;
  cachedKey = key;
  return key;
}

export function esErrorClavePii(err: unknown): boolean {
  return !!(err && String((err as Error).message || "").startsWith("PII_KEY_UNAVAILABLE"));
}

/** Indica si un valor ya está cifrado con el sobre de esta app. */
export function estaCifrado(valor: unknown): boolean {
  return typeof valor === "string" && valor.startsWith(PREFIJO);
}

/** Cifra un valor de texto. Vacio/null pasa sin cambios. Lanza si falta la clave. */
export function cifrarCampo(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return (valor ?? null) as any;
  const key = clavePii();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(valor), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIJO + iv.toString("base64url") + ":" + tag.toString("base64url") + ":" + ct.toString("base64url");
}

/** Descifra un valor. Texto plano (pre-migracion) se devuelve tal cual. Vacio/null pasa sin cambios. */
export function descifrarCampo(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return (valor ?? null) as any;
  if (!estaCifrado(valor)) return valor;
  const key = clavePii();
  const partes = String(valor).split(":");
  const iv = Buffer.from(partes[2], "base64url");
  const tag = Buffer.from(partes[3], "base64url");
  const ct = Buffer.from(partes[4], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Índice ciego determinista para búsquedas por igualdad (sin descifrar). */
export function indiceCiego(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const key = clavePii();
  return crypto.createHmac("sha256", key).update(String(valor).trim().toLowerCase()).digest("hex");
}
