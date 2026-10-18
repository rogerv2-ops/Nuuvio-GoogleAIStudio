import crypto from "node:crypto";

/**
 * Cifrado de PII en reposo (Fase 5).
 * AES-256-GCM con clave en VUUV_PII_KEY (32 bytes en hex o base64).
 * Modo fail-open controlado: si la clave no esta disponible, el cifrado queda
 * DESHABILITADO (se guarda/lee texto plano) con un aviso CRITICO, para no romper
 * el registro. Al definir VUUV_PII_KEY y reiniciar, se activa y migra lo existente.
 * Formato del sobre: `enc:v1:<iv b64url>:<tag b64url>:<ct b64url>`.
 */

const PREFIJO = "enc:v1:";
let cachedRaw = "";
let cachedKey: Buffer | null = null;
let avisoClaveEmitido = false;

function clavePii(): Buffer | null {
  const raw = String(process.env.VUUV_PII_KEY || "").trim();
  if (!raw) {
    if (!avisoClaveEmitido) {
      console.error(
        "[PII] CRITICO: falta VUUV_PII_KEY. Cifrado de PII DESHABILITADO (texto plano). Define VUUV_PII_KEY y reinicia para activarlo."
      );
      avisoClaveEmitido = true;
    }
    return null;
  }
  if (cachedKey && cachedRaw === raw) return cachedKey;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.error("[PII] VUUV_PII_KEY invalida (se requieren 32 bytes en hex o base64); cifrado DESHABILITADO.");
    return null;
  }
  cachedRaw = raw;
  cachedKey = key;
  return key;
}

/** Indica si el cifrado de PII esta activo (hay clave valida). */
export function piiHabilitado(): boolean {
  return !!clavePii();
}

/** Compatibilidad: ya no se lanza por clave ausente (modo fail-open). */
export function esErrorClavePii(err: unknown): boolean {
  return !!(err && String((err as Error).message || "").startsWith("PII_KEY_UNAVAILABLE"));
}

/** Indica si un valor ya esta cifrado con el sobre de esta app. */
export function estaCifrado(valor: unknown): boolean {
  return typeof valor === "string" && valor.startsWith(PREFIJO);
}

/** Cifra un valor de texto. Sin clave, devuelve el texto plano. Vacio/null pasa sin cambios. */
export function cifrarCampo(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return (valor ?? null) as any;
  const key = clavePii();
  if (!key) return valor;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(valor), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIJO + iv.toString("base64url") + ":" + tag.toString("base64url") + ":" + ct.toString("base64url");
}

/** Descifra un valor. Texto plano pasa igual. Cifrado sin clave se devuelve crudo con aviso. */
export function descifrarCampo(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return (valor ?? null) as any;
  if (!estaCifrado(valor)) return valor;
  const key = clavePii();
  if (!key) {
    console.error("[PII] Hay datos cifrados pero falta VUUV_PII_KEY; no se pueden descifrar.");
    return valor;
  }
  const partes = String(valor).split(":");
  const iv = Buffer.from(partes[2], "base64url");
  const tag = Buffer.from(partes[3], "base64url");
  const ct = Buffer.from(partes[4], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Indice ciego determinista para busquedas por igualdad (sin descifrar). Sin clave, null. */
export function indiceCiego(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const key = clavePii();
  if (!key) return null;
  return crypto.createHmac("sha256", key).update(String(valor).trim().toLowerCase()).digest("hex");
}
