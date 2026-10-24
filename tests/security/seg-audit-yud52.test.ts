/**
 * YUD-52: contrato de los fixes R1, R2 y R5 de la auditoría de seguridad.
 *
 * Hallazgos cubiertos (reporte del auditor en YUD-52):
 *  R1 - /api/ai/generate, /api/ai/test, /api/gemini/generate-video y
 *       /api/gemini/video-status eran llamables sin sesión: gastan cuota de
 *       APIs de pago y permiten abuso de generación. Ahora exigen rol admin.
 *  R2 - /api/email/send-verification devolvía el verificationLink + token
 *       para CUALQUIER correo, verificara o no existiera el registro: con
 *       eso un tercero podía "verificar" el correo de otra persona. Ahora
 *       solo se despacha si existe un registro de audiencia PENDIENTE con
 *       ese correo (índice ciego HMAC) y ese mismo token; en caso contrario
 *       la respuesta es genérica y sin enlace (sin oráculo de existencia).
 *  R5 - GET /api/comercios listaba el padrón comercial completo sin sesión.
 *       Ahora exige rol admin.
 *
 * Qué vigila cada bloque:
 *  - anónimo -> 401, rol comercio -> 403, admin -> pasa el guard (no 401/403);
 *  - send-verification con correo/token desconocidos -> ok genérico, SIN
 *    verificationLink en la respuesta;
 *  - send-verification en el camino legítimo (registro pendiente real con
 *    ese token) -> SÍ devuelve el enlace (contrato del flujo de registro).
 *
 * Nota: los "pasa el guard" no validan la lógica interna de cada endpoint
 * (pueden responder 400/500 por payload vacío o falta de credenciales de IA
 * en CI); el contrato de seguridad es solo la barrera de autorización.
 */
import { test, expect, describe } from "bun:test";
import { servidorOnline, login, get, post, ADMIN, COMERCIO } from "./_helpers.ts";

const online = await servidorOnline();
const hayAdmin = !!ADMIN.email && !!ADMIN.password;
const hayComercio = !!COMERCIO.email && !!COMERCIO.password;

const RUTAS_IA = [
  "/api/ai/generate",
  "/api/ai/test",
  "/api/gemini/generate-video",
  "/api/gemini/video-status",
];

describe("YUD-52 R1: rutas de IA/video solo admin", () => {
  for (const ruta of RUTAS_IA) {
    test.skipIf(!online)(`anónimo recibe 401 en ${ruta}`, async () => {
      const r = await post(ruta, {});
      expect(r.status).toBe(401);
    });
    test.skipIf(!online || !hayComercio)(`rol comercio recibe 403 en ${ruta}`, async () => {
      const sesion = await login(COMERCIO.email, COMERCIO.password);
      expect(sesion).not.toBeNull();
      const r = await post(ruta, {}, sesion);
      expect(r.status).toBe(403);
    });
    test.skipIf(!online || !hayAdmin)(`admin pasa el guard en ${ruta}`, async () => {
      const sesion = await login(ADMIN.email, ADMIN.password);
      expect(sesion).not.toBeNull();
      const r = await post(ruta, {}, sesion);
      expect([401, 403]).not.toContain(r.status);
    });
  }
});

describe("YUD-52 R5: GET /api/comercios solo admin", () => {
  test.skipIf(!online)("anónimo recibe 401", async () => {
    const r = await get("/api/comercios");
    expect(r.status).toBe(401);
  });
  test.skipIf(!online || !hayComercio)("rol comercio recibe 403", async () => {
    const sesion = await login(COMERCIO.email, COMERCIO.password);
    const r = await get("/api/comercios", sesion);
    expect(r.status).toBe(403);
  });
  test.skipIf(!online || !hayAdmin)("admin recibe 200", async () => {
    const sesion = await login(ADMIN.email, ADMIN.password);
    const r = await get("/api/comercios", sesion);
    expect(r.status).toBe(200);
  });
});

describe("YUD-52 R2: send-verification no filtra enlaces de verificación", () => {
  test.skipIf(!online)("correo/token desconocidos: respuesta genérica sin enlace", async () => {
    const correo = `ci-r2-desconocido-${Date.now()}@ci.yuddit.test`;
    const r = await post("/api/email/send-verification", {
      email: correo,
      verificationToken: `tok-inexistente-${Date.now()}`,
    });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.simulated).toBe(true);
    expect(j.verificationLink).toBeUndefined();
    expect(j.whatsappLink).toBeUndefined();
  });

  test.skipIf(!online)("registro pendiente real: sí entrega el enlace (camino legítimo)", async () => {
    const correo = `ci-r2-legit-${Date.now()}@ci.yuddit.test`;
    const token = `ci-tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sync = await post("/api/audience/sync-user", {
      id: `ci_yud52_${Date.now()}`,
      email: correo,
      nombre: "CI",
      apellido: "R2",
      verificationToken: token,
    });
    expect(sync.status).toBe(200);
    const r = await post("/api/email/send-verification", {
      email: correo,
      verificationToken: token,
    });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(String(j.verificationLink || "")).toContain(token);
  }, 15000);

  test.skipIf(!online)("token pendiente pero OTRO token en la petición: sin enlace", async () => {
    const correo = `ci-r2-mixto-${Date.now()}@ci.yuddit.test`;
    const token = `ci-tok-mixto-${Date.now()}`;
    const sync = await post("/api/audience/sync-user", {
      id: `ci_yud52_m_${Date.now()}`,
      email: correo,
      nombre: "CI",
      apellido: "R2M",
      verificationToken: token,
    });
    expect(sync.status).toBe(200);
    const r = await post("/api/email/send-verification", {
      email: correo,
      verificationToken: `${token}-alterado`,
    });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.simulated).toBe(true);
    expect(j.verificationLink).toBeUndefined();
  });
});
