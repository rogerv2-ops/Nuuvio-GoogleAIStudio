import { test, expect, describe } from "bun:test";
import path from "node:path";
import {
  ipEsPrivada,
  esHostProveedorIaPermitido,
  resolverRutaSegura,
  validarRangeCabecera,
  compararHmacHex,
  normalizarTelefono,
  esIntencionOfertas,
} from "../../src/utils/securityGuards.ts";

describe("ipEsPrivada", () => {
  test("bloquea rangos privados/loopback/link-local", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.5",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      undefined,
      "",
      "no-es-ip",
    ]) {
      expect(ipEsPrivada(ip as any)).toBe(true);
    }
  });
  test("permite IPs publicas", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "190.117.1.1", "2606:4700::1111"]) {
      expect(ipEsPrivada(ip)).toBe(false);
    }
  });
});

describe("esHostProveedorIaPermitido", () => {
  test("acepta hosts oficiales por proveedor", () => {
    expect(esHostProveedorIaPermitido("gemini", "https://generativelanguage.googleapis.com/v1")).toBe(true);
    expect(esHostProveedorIaPermitido("openai", "https://api.openai.com/v1")).toBe(true);
    expect(esHostProveedorIaPermitido("anthropic", "https://api.anthropic.com")).toBe(true);
    expect(esHostProveedorIaPermitido("openrouter", "https://openrouter.ai/api/v1")).toBe(true);
  });
  test("sin baseUrl se permite (usa default del proveedor)", () => {
    expect(esHostProveedorIaPermitido("gemini", undefined)).toBe(true);
    expect(esHostProveedorIaPermitido("gemini", "")).toBe(true);
  });
  test("rechaza hosts arbitrarios/SSRF", () => {
    expect(esHostProveedorIaPermitido("gemini", "http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(esHostProveedorIaPermitido("gemini", "http://localhost:8080")).toBe(false);
    expect(esHostProveedorIaPermitido("gemini", "https://evil.com")).toBe(false);
    expect(esHostProveedorIaPermitido("openai", "https://generativelanguage.googleapis.com")).toBe(false);
    expect(esHostProveedorIaPermitido("desconocido", "https://api.openai.com")).toBe(false);
  });
});

describe("resolverRutaSegura", () => {
  const base = path.resolve("/var/app/videos");
  test("resuelve dentro del directorio", () => {
    expect(resolverRutaSegura(base, "clip.mp4")).toBe(path.resolve(base, "clip.mp4"));
    expect(resolverRutaSegura(base, "sub/clip.mp4")).toBe(path.resolve(base, "sub/clip.mp4"));
  });
  test("bloquea traversal y rutas absolutas", () => {
    expect(resolverRutaSegura(base, "../../etc/passwd")).toBeNull();
    expect(resolverRutaSegura(base, "..%2f..%2fetc")).not.toBeNull();
    expect(resolverRutaSegura(base, "/etc/passwd")).toBeNull();
  });
});

describe("validarRangeCabecera", () => {
  test("sin cabecera devuelve none", () => {
    expect(validarRangeCabecera(undefined, 1000)).toEqual({ ok: true, none: true });
  });
  test("rango normal", () => {
    expect(validarRangeCabecera("bytes=0-499", 1000)).toEqual({ ok: true, start: 0, end: 499 });
  });
  test("rango abierto hasta el final", () => {
    expect(validarRangeCabecera("bytes=500-", 1000)).toEqual({ ok: true, start: 500, end: 999 });
  });
  test("sufijo desde el final", () => {
    expect(validarRangeCabecera("bytes=-100", 1000)).toEqual({ ok: true, start: 900, end: 999 });
  });
  test("rechaza rangos invalidos", () => {
    expect(validarRangeCabecera("bytes=abc", 1000).ok).toBe(false);
    expect(validarRangeCabecera("bytes=1000-", 1000).ok).toBe(false);
    expect(validarRangeCabecera("bytes=800-100", 1000).ok).toBe(false);
    expect(validarRangeCabecera("items=0-1", 1000).ok).toBe(false);
    expect(validarRangeCabecera("bytes=-", 1000).ok).toBe(false);
  });
});

describe("compararHmacHex", () => {
  test("iguales", () => {
    const h = "a".repeat(64);
    expect(compararHmacHex(h, h)).toBe(true);
  });
  test("distintos/longitud distinta/vacio", () => {
    expect(compararHmacHex("a".repeat(64), "b".repeat(64))).toBe(false);
    expect(compararHmacHex("a".repeat(64), "a".repeat(32))).toBe(false);
    expect(compararHmacHex("", "")).toBe(false);
  });
});

describe("normalizarTelefono", () => {
  test("agrega prefijo Peru", () => {
    expect(normalizarTelefono("987654321")).toBe("51987654321");
    expect(normalizarTelefono("+51 987 654 321")).toBe("51987654321");
    expect(normalizarTelefono("51987654321")).toBe("51987654321");
    expect(normalizarTelefono("0051 987654321")).toBe("51987654321");
    expect(normalizarTelefono("")).toBe("");
    expect(normalizarTelefono(undefined)).toBe("");
  });
});

describe("esIntencionOfertas", () => {
  test("detecta pedidos explicitos de ofertas", () => {
    for (const t of ["ofertas", "OFERTAS", "quiero ofertas", "hay ofertas", "más ofertas", "ver ofertas", "promociones", "descuentos"]) {
      expect(esIntencionOfertas(t)).toBe(true);
    }
  });
  test("no confunde subcadenas genericas", () => {
    for (const t of ["hola", "transferencia", "oferta de trabajo", "mi oferta academica", "informacion", ""]) {
      expect(esIntencionOfertas(t)).toBe(false);
    }
  });
});
