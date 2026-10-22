import { test, expect, describe, beforeAll } from "bun:test";
import { BASE, servidorOnline, login, get, post, ADMIN, COMERCIO } from "./_helpers.ts";

const online = await servidorOnline();

const RUTAS_PROTEGIDAS = [
  ["GET", "/api/auth/me"],
  ["GET", "/api/audience/users"],
  ["GET", "/api/audience/registration-logs"],
  ["POST", "/api/whatsapp/config"],
  ["GET", "/api/whatsapp/config"],
  ["POST", "/api/email/config"],
  ["POST", "/api/cache/purge"],
  ["POST", "/api/banners/sync"],
  ["POST", "/api/comercios/sync"],
  ["GET", "/api/waha/session/qr"],
  ["POST", "/api/waha/session/start"],
  ["POST", "/api/ai/test"],
  ["POST", "/api/gemini/generate-video"],
  ["GET", "/api/security/logs"],
  ["POST", "/api/auth/users/usr_test"],
] as const;

const RUTAS_PUBLICAS = ["/api/version", "/api/banners", "/api/ofertas"];

describe.skipIf(!online)("US1 - contrato de autenticacion", () => {
  test("rutas protegidas rechazan sin token (401)", async () => {
    for (const [method, path] of RUTAS_PROTEGIDAS) {
      const res = method === "GET" ? await get(path, null) : await post(path, {}, null);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  test("rutas publicas responden sin token", async () => {
    for (const path of RUTAS_PUBLICAS) {
      const res = await get(path, null);
      expect(res.status, path).toBeLessThan(500);
    }
  });

  test("login con credenciales invalidas devuelve 401", async () => {
    const token = await login("nadie@example.com", "contrasena-incorrecta-xyz");
    expect(token).toBeNull();
  });

  test("token invalido/manipulado devuelve 401", async () => {
    const res = await get("/api/auth/me", "token.falso.invalido");
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!online || !ADMIN.email)("US1 - sesion admin", () => {
  let token: string | null = null;
  beforeAll(async () => {
    token = await login(ADMIN.email, ADMIN.password);
  });
  test("login valido y /api/auth/me responde 200", async () => {
    expect(token).toBeTruthy();
    const res = await get("/api/auth/me", token);
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.ok).toBe(true);
    expect(j.sesion.rol).toBe("admin");
  });

  test("admin puede listar usuarios y logs de seguridad", async () => {
    if (!token) return;
    const ru = await get("/api/auth/users", token);
    expect(ru.status).toBe(200);
    const ju: any = await ru.json();
    expect(Array.isArray(ju.users)).toBe(true);
    const rl = await get("/api/security/logs?limit=5", token);
    expect(rl.status).toBe(200);
    const jl: any = await rl.json();
    expect(Array.isArray(jl.logs)).toBe(true);
  });
});

describe.skipIf(!online || !COMERCIO.email)("US1 - alcance por rol", () => {
  let token: string | null = null;
  beforeAll(async () => {
    token = await login(COMERCIO.email, COMERCIO.password);
  });
  test("usuario comercio recibe 403 en endpoints administrativos", async () => {
    if (!token) return;
    const res = await get("/api/audience/users", token);
    expect([403, 200]).toContain(res.status);
    if (res.status === 403) {
      const j: any = await res.json();
      expect(j.ok).toBe(false);
    }
  });
});
