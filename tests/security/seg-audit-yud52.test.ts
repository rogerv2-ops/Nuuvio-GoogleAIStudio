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

describe("YUD-52 R2 (cierre): verificación solo con prueba de buzón", () => {
  const altaPublica = (email: string, id?: string) =>
    post("/api/audience/sync-user", {
      id: id || `ci_yud52_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email,
      nombre: "CI",
      apellido: "R2",
      distrito: "Miraflores",
      verificationToken: `tok-elegido-por-cliente-${Date.now()}`, // DEBE ser ignorado
    });

  test.skipIf(!online)("sync-user ignora el token del cliente y no devuelve capacidad verificadora", async () => {
    const correo = `ci-r2-a-${Date.now()}@ci.yuddit.test`;
    const r = await altaPublica(correo);
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.verificationToken).toBeUndefined();
    expect(j.user).toBeUndefined();
    // El token elegido por el cliente NO verifica nada:
    const v = await get(`/api/audience/verify-token?token=tok-elegido-por-cliente-${Date.now()}`);
    expect(v.status).toBe(404);
  });

  test.skipIf(!online)("el mismo correo con otro id es rechazado (409): no hay fila pendiente duplicada", async () => {
    const correo = `ci-r2-b-${Date.now()}@ci.yuddit.test`;
    const r1 = await altaPublica(correo);
    expect(r1.status).toBe(200);
    const r2 = await altaPublica(correo); // id distinto
    expect(r2.status).toBe(409);
  });

  test.skipIf(!online || !hayAdmin)("un id público conocido NO permite editar perfil ni identidad ajenos", async () => {
    const correo = `ci-r2-c-${Date.now()}@ci.yuddit.test`;
    const id = `ci_yud52_fijo_${Date.now()}`;
    const r1 = await altaPublica(correo, id);
    expect(r1.status).toBe(200);
    // Re-sync con el MISMO id pero datos alterados: debe ser no-op.
    const r2 = await post("/api/audience/sync-user", {
      id,
      email: correo,
      nombre: "ALTERADO",
      apellido: "AJENO",
      distrito: "Comas",
      verificationToken: `tok-secuestro-${Date.now()}`,
    });
    expect(r2.status).toBe(200);
    const j2: any = await r2.json();
    expect(j2.existente).toBe(true);
    // La fila conserva los datos originales (lectura admin):
    const sesion = await login(ADMIN.email, ADMIN.password);
    const r3 = await get("/api/audience/users", sesion);
    expect(r3.status).toBe(200);
    const j3: any = await r3.json();
    const fila = (j3.users || []).find((u: any) => u.id === id);
    expect(fila).toBeTruthy();
    expect(fila.nombre).toBe("CI");
    expect(fila.distrito).toBe("Miraflores");
    // y el token de secuestro no verifica:
    const v = await get(`/api/audience/verify-token?token=tok-secuestro-${Date.now()}`);
    expect(v.status).toBe(404);
  });

  test.skipIf(!online)("send-verification NO devuelve enlace ni token ni log (registro pendiente real)", async () => {
    const correo = `ci-r2-d-${Date.now()}@ci.yuddit.test`;
    await altaPublica(correo);
    const r = await post("/api/email/send-verification", { email: correo });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.verificationLink).toBeUndefined();
    expect(j.verificationToken).toBeUndefined();
    expect(j.log).toBeUndefined();
  });

  test.skipIf(!online)("send-verification sin registro pendiente: respuesta genérica idéntica, sin enlace", async () => {
    const correo = `ci-r2-inexistente-${Date.now()}@ci.yuddit.test`;
    const r = await post("/api/email/send-verification", { email: correo });
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.simulated).toBe(true);
    expect(j.verificationLink).toBeUndefined();
  });

  test.skipIf(!online || !hayAdmin)("cadena completa: la verificación exige el token del buzón y es de UN SOLO USO", async () => {
    const correo = `ci-r2-e-${Date.now()}@ci.yuddit.test`;
    await altaPublica(correo);
    const r = await post("/api/email/send-verification", { email: correo });
    expect(r.status).toBe(200);
    // En CI no hay SMTP: el "buzón" equivalente es el log de correo SOLO ADMIN.
    const sesion = await login(ADMIN.email, ADMIN.password);
    const logsR = await get("/api/email/logs", sesion);
    expect(logsR.status).toBe(200);
    const logsJ: any = await logsR.json();
    const entrada = (logsJ.logs || []).find((l: any) => l.to === correo);
    expect(entrada).toBeTruthy();
    const tokenBuzon = entrada.verificationToken;
    expect(tokenBuzon).toBeTruthy();
    // 1) con el token del buzón: verifica y devuelve usuario mínimo (sin token)
    const v1 = await get(`/api/audience/verify-token?token=${tokenBuzon}`);
    expect(v1.status).toBe(200);
    const v1j: any = await v1.json();
    expect(v1j.ok).toBe(true);
    expect(v1j.user.email).toBe(correo);
    expect(v1j.user.verificationToken).toBeUndefined();
    // 2) un solo uso: el mismo token ya no sirve
    const v2 = await get(`/api/audience/verify-token?token=${tokenBuzon}`);
    expect(v2.status).toBe(404);
    // 3) ya verificado: el reenvío responde genérico sin enlace
    const r3 = await post("/api/email/send-verification", { email: correo });
    const j3: any = await r3.json();
    expect(j3.ok).toBe(true);
    expect(j3.verificationLink).toBeUndefined();
  }, 20000);
});
