import { test, expect, describe } from "bun:test";
import {
  generarSecretoTotp,
  codigoTotp,
  verificarTotp,
  otpauthUrl,
  generarCodigosRespaldo,
  hashCodigoRespaldo,
} from "../../src/utils/totp.ts";

// Secreto de los vectores de prueba del RFC 6238 (SHA1): ASCII "12345678901234567890".
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("Fase 3 - nucleo TOTP (RFC 6238)", () => {
  test("coincide con los vectores oficiales del RFC (SHA1, 8 digitos)", () => {
    const vectores: Array<[number, string]> = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
      [20000000000, "65353130"],
    ];
    for (const [t, esperado] of vectores) {
      expect(codigoTotp(RFC_SECRET, t * 1000, 30, 8)).toBe(esperado);
    }
  });

  test("genera y verifica un codigo propio", () => {
    const secret = generarSecretoTotp();
    const ahora = Date.now();
    const code = codigoTotp(secret, ahora);
    expect(code).toMatch(/^\d{6}$/);
    expect(verificarTotp(secret, code, ahora)).toBe(true);
  });

  test("tolerancia de ±1 paso por reloj desfasado", () => {
    const secret = generarSecretoTotp();
    const ahora = Date.now();
    const previo = codigoTotp(secret, ahora - 30 * 1000);
    expect(verificarTotp(secret, previo, ahora)).toBe(true);
    const viejo = codigoTotp(secret, ahora - 10 * 30 * 1000);
    expect(verificarTotp(secret, viejo, ahora)).toBe(false);
  });

  test("rechaza codigos invalidos", () => {
    const secret = generarSecretoTotp();
    expect(verificarTotp(secret, "000000", Date.now())).toBe(false);
    expect(verificarTotp(secret, "abc", Date.now())).toBe(false);
    expect(verificarTotp(secret, "", Date.now())).toBe(false);
  });

  test("otpauthUrl incluye secret/issuer/parametros", () => {
    const url = otpauthUrl("ABCDEF", "admin@vuuy.pe", "vuuy");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("secret=ABCDEF");
    expect(url).toContain("issuer=vuuy");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });

  test("codigos de respaldo unicos y hash estable/normalizado", () => {
    const codes = generarCodigosRespaldo(8);
    expect(codes.length).toBe(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    const h1 = hashCodigoRespaldo(codes[0]);
    const h2 = hashCodigoRespaldo(codes[0].toLowerCase().replace("-", " "));
    expect(h1).toBe(h2);
    expect(h1).not.toBe(hashCodigoRespaldo(codes[1]));
  });
});
