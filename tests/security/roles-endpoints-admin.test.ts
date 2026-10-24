import { test, expect, describe } from "bun:test";
import { servidorOnline, login, get, post, ADMIN, COMERCIO } from "./_helpers.ts";

const online = await servidorOnline();

/**
 * Auditoria 2026-10-24 (YUD-35, YUD-36, YUD-34): estos endpoints GET/POST
 * exponen estado sensible del bot (qrDataUrl/pairingCode), historiales con
 * PII y configuracion de correo, o activan ofertas. Antes no pedian rol
 * admin: cualquier sesion (incluido rol comercio) podia usarlos.
 *
 * Contrato: sin sesion -> 401; con sesion de comercio -> 403; con admin -> no 401/403.
 */
const RUTAS_SOLO_ADMIN = [
  ["GET", "/api/waha/session/status"],
  ["GET", "/api/whatsapp/logs"],
  ["GET", "/api/email/config"],
  ["GET", "/api/email/logs"],
] as const;

describe.skipIf(!online)("Roles - endpoints sensibles solo admin", () => {
  test("sin sesion devuelven 401", async () => {
    for (const [method, path] of RUTAS_SOLO_ADMIN) {
      const res = method === "GET" ? await get(path, null) : await post(path, {}, null);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  test("sesion de comercio recibe 403 (no es admin)", async () => {
    const token = await login(COMERCIO.email, COMERCIO.password);
    expect(token, "login de comercio sembrado en CI").not.toBeNull();
    for (const [method, path] of RUTAS_SOLO_ADMIN) {
      const res = method === "GET" ? await get(path, token) : await post(path, {}, token);
      expect(res.status, `${method} ${path} con rol comercio`).toBe(403);
    }
    const activar = await post("/api/ofertas/activar", { ofertaId: "of_inexistente", operador: "test" }, token);
    expect(activar.status, "POST /api/ofertas/activar con rol comercio").toBe(403);
  });

  test("sesion de admin no recibe 401/403", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token, "login de admin sembrado en CI").not.toBeNull();
    for (const [method, path] of RUTAS_SOLO_ADMIN) {
      const res = method === "GET" ? await get(path, token) : await post(path, {}, token);
      expect([401, 403], `${method} ${path} con rol admin`).not.toContain(res.status);
    }
    const activar = await post("/api/ofertas/activar", { ofertaId: "of_inexistente", operador: "test" }, token);
    expect(activar.status, "POST /api/ofertas/activar con admin sobre oferta inexistente").toBe(404);
  });
});
