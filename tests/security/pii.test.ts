import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import {
  cifrarCampo,
  descifrarCampo,
  indiceCiego,
  estaCifrado,
  esErrorClavePii,
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

  test("fail-closed sin clave", () => {
    const guardada = process.env.VUUV_PII_KEY;
    delete process.env.VUUV_PII_KEY;
    try {
      let capturado: unknown = null;
      try {
        cifrarCampo("x");
      } catch (e) {
        capturado = e;
      }
      expect(capturado).not.toBe(null);
      expect(esErrorClavePii(capturado)).toBe(true);
    } finally {
      process.env.VUUV_PII_KEY = guardada;
    }
  });
});
