/**
 * GET /api/whatsapp/config NO puede devolver secretos (hallazgo R1-001 de la
 * revision nativa del PR #40).
 *
 * Que pasaba: el endpoint devolvia `waConfig` COMPLETO, asi que cualquier
 * sesion autenticada -incluido el rol comercio, que pasa el gate global de
 * /api- recibia `metaConfig.accessToken` (META_WA_TOKEN), `metaConfig.verifyToken`
 * (META_WA_VERIFY_TOKEN) y `wahaConfig.apiKey` (WAHA_API_KEY). El POST del mismo
 * path si tenia `requireAdmin`.
 *
 * Que se exige ahora, en tres capas:
 *   1. Autorizacion: el GET es de administracion (requireAdmin).
 *   2. Minimo privilegio en la SALIDA: se devuelve solo lo que el panel necesita
 *      ver, con banderas `has*` en vez del valor del secreto.
 *   3. Secretos "write-only": guardar con el campo vacio NO borra el secreto
 *      guardado (si no, el panel borraria el token al abrir y guardar).
 *
 * OJO CON EL ALCANCE: la prueba de "write-only" escribe un marcador en
 * `metaConfig.accessToken` (inerte mientras `modoActivo` sea "waha") y NO puede
 * restaurar el valor anterior, porque justamente ya no se puede leer. En el CI
 * y en las corridas locales la base se recrea antes de correr, asi que el
 * marcador se va con ella; apuntar esta suite a un servidor con datos REALES
 * reemplazaria el token de Meta de verdad. Por eso `tests/security` se corre
 * contra un servidor levantado para la ocasion, nunca contra produccion.
 */
import { test, expect, describe, beforeAll } from "bun:test";
import { servidorOnline, login, get, post, ADMIN, COMERCIO } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online || !ADMIN.email)("R1-001 - GET /api/whatsapp/config no expone secretos", () => {
  let token: string | null = null;

  beforeAll(async () => {
    token = await login(ADMIN.email, ADMIN.password);
  });

  test("la respuesta no trae accessToken, verifyToken ni apiKey", async () => {
    const res = await get("/api/whatsapp/config", token);
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.ok).toBe(true);

    expect(j.config).toBeTruthy();
    // Los secretos no viajan, ni vacios: la clave no existe.
    expect(j.config.metaConfig.accessToken).toBeUndefined();
    expect(j.config.metaConfig.verifyToken).toBeUndefined();
    expect(j.config.wahaConfig.apiKey).toBeUndefined();

    // Lo que el panel necesita para no pisar lo guardado: saber SI hay secreto.
    expect(typeof j.config.metaConfig.hasAccessToken).toBe("boolean");
    expect(typeof j.config.metaConfig.hasVerifyToken).toBe("boolean");
    expect(typeof j.config.wahaConfig.hasApiKey).toBe("boolean");

    // Lo que el panel si usa sigue estando.
    expect(typeof j.config.modoActivo).toBe("string");
    expect(typeof j.config.metaConfig.phoneNumberId).toBe("string");
    expect(typeof j.config.wahaConfig.endpointUrl).toBe("string");
  });

  test("el secreto no aparece como valor en ninguna clave del JSON crudo", async () => {
    const res = await get("/api/whatsapp/config", token);
    const texto = await res.text();
    // Ni el valor bajo su clave, ni una copia con otro nombre.
    expect(texto).not.toMatch(/"accessToken"\s*:\s*"[^"]+"/);
    expect(texto).not.toMatch(/"verifyToken"\s*:\s*"[^"]+"/);
    expect(texto).not.toMatch(/"apiKey"\s*:\s*"[^"]+"/);
  });

  test("un secreto guardado se conserva al guardar con el campo vacio", async () => {
    const marca = "token-de-prueba-r1-001-" + Date.now();
    const guardado = await post(
      "/api/whatsapp/config",
      { metaConfig: { accessToken: marca } },
      token
    );
    expect(guardado.status).toBe(200);

    // La RESPUESTA del POST tampoco puede devolverlo (antes devolvia waConfig entero).
    const textoGuardado = await guardado.text();
    expect(textoGuardado).not.toContain(marca);
    expect(textoGuardado).not.toMatch(/"accessToken"\s*:\s*"[^"]+"/);
    expect(textoGuardado).not.toMatch(/"verifyToken"\s*:\s*"[^"]+"/);
    expect(textoGuardado).not.toMatch(/"apiKey"\s*:\s*"[^"]+"/);

    const trasGuardar: any = await (await get("/api/whatsapp/config", token)).json();
    expect(trasGuardar.config.metaConfig.hasAccessToken).toBe(true);
    expect(JSON.stringify(trasGuardar)).not.toContain(marca);

    // El panel manda los tres campos vacios cuando el admin no los cambia: eso
    // NO borra ninguno (cada uno se conserva por su lado en el servidor).
    const vacio = await post(
      "/api/whatsapp/config",
      { metaConfig: { accessToken: "", verifyToken: "" }, wahaConfig: { apiKey: "" } },
      token
    );
    expect(vacio.status).toBe(200);

    const trasVacio: any = await (await get("/api/whatsapp/config", token)).json();
    expect(trasVacio.config.metaConfig.hasAccessToken).toBe(trasGuardar.config.metaConfig.hasAccessToken);
    expect(trasVacio.config.metaConfig.hasVerifyToken).toBe(trasGuardar.config.metaConfig.hasVerifyToken);
    expect(trasVacio.config.wahaConfig.hasApiKey).toBe(trasGuardar.config.wahaConfig.hasApiKey);
    expect(JSON.stringify(trasVacio)).not.toContain(marca);
  });

  test("la respuesta no se cachea", async () => {
    const res = await get("/api/whatsapp/config", token);
    expect(String(res.headers.get("cache-control") || "")).toContain("no-store");
  });
});

describe.skipIf(!online)("R1-001 - GET /api/whatsapp/config exige administrador", () => {
  test("sin token responde 401", async () => {
    const res = await get("/api/whatsapp/config", null);
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!online || !COMERCIO.email)("R1-001 - el rol comercio no lee la configuracion de WhatsApp", () => {
  let token: string | null = null;

  beforeAll(async () => {
    token = await login(COMERCIO.email, COMERCIO.password);
  });

  test("comercio recibe 403 (antes recibia los tokens)", async () => {
    // Si habia credenciales y el login fallo, esto TIENE que fallar: un test
    // que retorna sin afirmar nada pasaria sin haber probado la autorizacion.
    expect(token).toBeTruthy();
    if (!token) return;
    const res = await get("/api/whatsapp/config", token);
    expect(res.status).toBe(403);
    const j: any = await res.json();
    expect(j.ok).toBe(false);
  });
});
