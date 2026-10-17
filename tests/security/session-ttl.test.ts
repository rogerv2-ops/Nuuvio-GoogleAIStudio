import { test, expect, describe } from "bun:test";
import {
  ttlMsParaRol,
  AUTH_TOKEN_TTL_ADMIN_MS,
  AUTH_TOKEN_TTL_MS,
} from "../../src/utils/securityGuards.ts";

describe("M3 - TTL de sesion por rol", () => {
  test("admin tiene ventana corta (<= 8h, > 0)", () => {
    expect(ttlMsParaRol("admin")).toBe(AUTH_TOKEN_TTL_ADMIN_MS);
    expect(AUTH_TOKEN_TTL_ADMIN_MS).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
    expect(AUTH_TOKEN_TTL_ADMIN_MS).toBeGreaterThan(0);
  });

  test("roles no-admin conservan la ventana larga", () => {
    expect(ttlMsParaRol("comercio")).toBe(AUTH_TOKEN_TTL_MS);
    expect(ttlMsParaRol("operador")).toBe(AUTH_TOKEN_TTL_MS);
    expect(ttlMsParaRol(undefined)).toBe(AUTH_TOKEN_TTL_MS);
  });

  test("la sesion admin es estrictamente mas corta que la no-admin", () => {
    expect(ttlMsParaRol("admin")).toBeLessThan(ttlMsParaRol("comercio"));
  });
});
