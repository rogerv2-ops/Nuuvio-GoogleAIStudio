/**
 * Guardas de seguridad puras y testeables (sin efectos de red).
 * Usadas por server.ts (backend) y por tests/security/*.
 * No importar desde el bundle del navegador.
 */
import crypto from "node:crypto";
import path from "node:path";

/** true si la IP es privada/reservada/loopback/link-local (IPv4 o IPv6). */
export function ipEsPrivada(ip: string | undefined | null): boolean {
  if (!ip) return true;
  let a = String(ip).trim().toLowerCase();
  if (a.startsWith("::ffff:")) a = a.slice(7);
  if (a.includes(":")) {
    if (a === "::1" || a === "::") return true;
    const first = a.slice(0, 3);
    if (first === "fc0" || first === "fd0" || first === "fc" || first === "fd") return true;
    if (a.startsWith("fc") || a.startsWith("fd")) return true;
    if (a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb")) return true;
    return false;
  }
  const p = a.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [x, y] = p;
  if (x === 0 || x === 10 || x === 127) return true;
  if (x === 169 && y === 254) return true;
  if (x === 172 && y >= 16 && y <= 31) return true;
  if (x === 192 && y === 168) return true;
  if (x === 100 && y >= 64 && y <= 127) return true;
  if (x === 192 && y === 0) return true;
  if (x === 198 && (y === 18 || y === 19)) return true;
  if (x >= 224) return true;
  return false;
}

/** Allowlist de hosts por proveedor de IA para `baseUrl`. */
const IA_HOSTS: Record<string, string> = {
  gemini: "generativelanguage.googleapis.com",
  openai: "api.openai.com",
  anthropic: "api.anthropic.com",
  openrouter: "openrouter.ai",
};

export function esHostProveedorIaPermitido(providerId: string, baseUrl?: string | null): boolean {
  if (!baseUrl) return true;
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    return false;
  }
  const allow = IA_HOSTS[providerId];
  if (!allow) return false;
  return u.hostname === allow || u.hostname.endsWith("." + allow);
}

/** Resuelve `nombre` dentro de `baseDir`; null si escapa del directorio. */
export function resolverRutaSegura(baseDir: string, nombre: string): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, nombre);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

export interface ResultadoRange {
  ok: boolean;
  none?: boolean;
  start?: number;
  end?: number;
}

/** Valida `Range: bytes=<start>-<end>` contra `fileSize`. */
export function validarRangeCabecera(rangeHeader: string | undefined | null, fileSize: number): ResultadoRange {
  if (!rangeHeader) return { ok: true, none: true };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!m) return { ok: false };
  const startStr = m[1];
  const endStr = m[2];
  if (startStr === "" && endStr === "") return { ok: false };
  let start: number;
  let end: number;
  if (startStr === "") {
    const suffix = parseInt(endStr, 10);
    if (Number.isNaN(suffix) || suffix <= 0) return { ok: false };
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === "" ? fileSize - 1 : parseInt(endStr, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return { ok: false };
    if (start < 0 || end < start || start >= fileSize) return { ok: false };
    if (end >= fileSize) end = fileSize - 1;
  }
  return { ok: true, start, end };
}

/** Comparación timing-safe de dos HMAC en hexadecimal. */
export function compararHmacHex(a: string, b: string): boolean {
  try {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Normaliza un teléfono a dígitos canónicos de Perú (51XXXXXXXXX). */
export function normalizarTelefono(raw: string | undefined | null): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("9")) d = "51" + d;
  return d;
}

const FRASES_INTENCION_OFERTAS = [
  "que ofertas hay",
  "hay ofertas",
  "hay alguna oferta",
  "muestra ofertas",
  "muestrame ofertas",
  "ver ofertas",
  "mas ofertas",
  "quiero ofertas",
  "dame ofertas",
  "ofertas cerca",
  "ofertas cercanas",
  "ofertas",
  "una oferta",
  "dame una oferta",
  "promociones",
  "promos",
  "descuentos",
];

/** Intención precisa de "pedir ofertas" (evita subcadenas genéricas). */
export function esIntencionOfertas(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  if (t === "oferta") return true;
  return FRASES_INTENCION_OFERTAS.some((f) => {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(?:^|[^a-z0-9])" + escaped + "(?:[^a-z0-9]|$)").test(t);
  });
}
