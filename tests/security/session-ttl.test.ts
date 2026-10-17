import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  ttlMsParaRol,
  AUTH_IDLE_TTL_MS,
  AUTH_TOKEN_TTL_MS,
} from "../../src/utils/securityGuards.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
const CLIENT = fs.readFileSync(path.join(ROOT, "src/core/security.ts"), "utf8");

describe("Inactividad - TTL de sesion por rol", () => {
  test("admin y comercio expiran a los 5 min (token renovable)", () => {
    expect(AUTH_IDLE_TTL_MS).toBe(5 * 60 * 1000);
    expect(ttlMsParaRol("admin")).toBe(AUTH_IDLE_TTL_MS);
    expect(ttlMsParaRol("comercio")).toBe(AUTH_IDLE_TTL_MS);
  });

  test("operador conserva la ventana larga", () => {
    expect(ttlMsParaRol("operador")).toBe(AUTH_TOKEN_TTL_MS);
  });

  test("el servidor expone /api/auth/refresh (no publico)", () => {
    expect(SERVER).toContain('app.post("/api/auth/refresh"');
    const i = SERVER.indexOf("function esRutaPublica");
    const j = SERVER.indexOf("return false}", i);
    expect(SERVER.slice(i, j).includes("/api/auth/refresh")).toBe(false);
  });

  test("el cliente cierra a los 5 min sin actividad y renueva mientras hay actividad", () => {
    expect(CLIENT).toContain("5 * 60 * 1000");
    expect(CLIENT).toContain("/api/auth/refresh");
    expect(CLIENT).toContain("cerrarPorInactividad");
    expect(CLIENT).toContain("renovarSesionSiNecesario");
    expect(CLIENT).toContain("vuuy_auth_activity_v1");
  });
});
