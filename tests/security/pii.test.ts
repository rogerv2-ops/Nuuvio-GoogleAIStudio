import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import {
  cifrarCampo,
  descifrarCampo,
  indiceCiego,
  estaCifrado,
  piiHabilitado,
} from "../../src/utils/pii.ts";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Fase 5 - cifrado PII (AES-256-GCM) + indice ciego HMAC", () => {
  const prev = process.env.VUUV_PII_KEY;
  beforeAll(() => {
    process.env.VUUV_PII_KEY = KEY;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.VUUV_PII_KEY;
    else process.env.VUUV_PII_KEY = prev;
  });

  test("roundtrip cifra y descifra", () => {
    const enc = cifrarCampo("rogerv2@gmail.com");
    expect(estaCifrado(enc)).toBe(true);
    expect(String(enc).startsWith("enc:v1:")).toBe(true);
    expect(descifrarCampo(enc)).toBe("rogerv2@gmail.com");
  });

  test("cifrado no determinista (IV aleatorio)", () => {
    const a = cifrarCampo("+51 999 888 777");
    const b = cifrarCampo("+51 999 888 777");
    expect(a).not.toBe(b);
    expect(descifrarCampo(a)).toBe(descifrarCampo(b));
  });

  test("texto plano pasa igual; vacios se conservan", () => {
    expect(descifrarCampo("sin cifrar")).toBe("sin cifrar");
    expect(cifrarCampo("")).toBe("");
    expect(descifrarCampo(null)).toBe(null);
  });

  test("indice ciego determinista y case-insensitive", () => {
    const i1 = indiceCiego("RogerV2@Gmail.com");
    const i2 = indiceCiego("rogerv2@gmail.com ");
    expect(i1).toBe(i2);
    expect(String(i1)).toMatch(/^[0-9a-f]{64}$/);
    expect(indiceCiego("")).toBe(null);
  });

  test("fail-open sin clave: opera en texto plano y sin indice", () => {
    const guardada = process.env.VUUV_PII_KEY;
    delete process.env.VUUV_PII_KEY;
    try {
      expect(piiHabilitado()).toBe(false);
      const enc = cifrarCampo("dato@x.com");
      expect(enc).toBe("dato@x.com");
      expect(estaCifrado(enc)).toBe(false);
      expect(descifrarCampo("dato@x.com")).toBe("dato@x.com");
      expect(indiceCiego("dato@x.com")).toBe(null);
    } finally {
      process.env.VUUV_PII_KEY = guardada;
    }
  });
});
