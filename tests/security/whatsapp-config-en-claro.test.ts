/**
 * `POST /api/whatsapp/config` NO puede guardar los secretos en claro.
 *
 * Que pasaba: el handler hacia `saveSetting("whatsapp_config", waConfig)`, o sea
 * `JSON.stringify` del objeto COMPLETO (con `metaConfig.accessToken`,
 * `metaConfig.verifyToken` y `wahaConfig.apiKey`) a la columna `value` de
 * `app_settings`. Cualquiera con acceso a la base -un backup, un `select`, una
 * copia de staging, el propio panel de Coolify- se llevaba los tokens usables.
 * Cerrar el GET (R1-001) tapo la puerta HTTP, no la del almacenamiento.
 *
 * Que se exige ahora: en la fila no queda texto plano. Con `VUUV_PII_KEY` los
 * secretos se guardan cifrados (`enc:v1:`); sin clave NO se guardan (quedan en
 * memoria y el entorno sigue siendo la fuente de verdad). Nunca texto plano:
 * guardar el secreto en claro es justo el bug.
 *
 * OJO CON EL ALCANCE: la prueba escribe un marcador en `metaConfig.accessToken`
 * y no lo puede restaurar, porque el valor ya no se puede leer. En CI y en las
 * corridas locales la base se recrea antes de correr, asi que el marcador se va
 * con ella. `tests/security` se corre contra un servidor levantado para la
 * ocasion, nunca contra produccion.
 */
import { test, expect, describe, beforeAll } from "bun:test";
import pg from "pg";
import { servidorOnline, login, post, ADMIN } from "./_helpers.ts";

const SQL = {
  host: process.env.SQL_HOST || "127.0.0.1",
  port: Number(process.env.SQL_PORT || 5432),
  user: process.env.SQL_USER || "postgres",
  password: process.env.SQL_PASSWORD || "",
  database: process.env.SQL_DB_NAME || "yuddit_test",
};

const PREFIJO_CIFRADO = "enc:v1:";

async function hayBase(): Promise<boolean> {
  const client = new pg.Client(SQL);
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

/** Lee la fila cruda de `app_settings` (el texto tal cual quedo guardado). */
async function filaCrudaWhatsappConfig(): Promise<string | null> {
  const client = new pg.Client(SQL);
  try {
    await client.connect();
    const r = await client.query("select value from app_settings where key = $1", ["whatsapp_config"]);
    return r.rows.length ? String(r.rows[0].value) : null;
  } finally {
    await client.end().catch(() => {});
  }
}

const online = await servidorOnline();
const conBase = await hayBase();

if (!conBase) {
  console.warn(
    `[whatsapp-config-en-claro] SALTADO: no hay Postgres en ${SQL.host}/${SQL.database}. ` +
      "La prueba de que los secretos no quedan en claro no corrio."
  );
}

describe.skipIf(!online || !ADMIN.email || !conBase)("los secretos de WhatsApp no se guardan en claro", () => {
  let token: string | null = null;

  beforeAll(async () => {
    token = await login(ADMIN.email, ADMIN.password);
  });

  test("el POST no deja el accessToken en texto plano en app_settings", async () => {
    expect(token).toBeTruthy();
    if (!token) return;

    const marca = "token-en-claro-persistencia-" + Date.now();
    const res = await post("/api/whatsapp/config", { metaConfig: { accessToken: marca } }, token);
    expect(res.status).toBe(200);

    const crudo = await filaCrudaWhatsappConfig();
    expect(crudo).toBeTruthy();
    if (!crudo) return;

    // 1. El valor NO esta en la fila, ni escapado ni en otro campo.
    expect(crudo).not.toContain(marca);

    // 2. Si el secreto se persistio, es un sobre cifrado, no el valor.
    const fila = JSON.parse(crudo);
    const guardado = fila?.metaConfig?.accessToken;
    if (guardado !== undefined && guardado !== "") {
      expect(String(guardado).startsWith(PREFIJO_CIFRADO)).toBe(true);
    }

    // 3. El resto de la configuracion SI se persiste: si no, el arreglo seria
    //    "no guardar nada" y el panel perderia todo en cada reinicio.
    expect(typeof fila?.modoActivo).toBe("string");
    expect(fila?.metaConfig).toBeTruthy();

    // 4. Con clave de PII configurada, se cifra: no se descarta el secreto.
    if (String(process.env.VUUV_PII_KEY || "").trim()) {
      expect(String(guardado || "").startsWith(PREFIJO_CIFRADO)).toBe(true);
    }
  });

  test("la configuracion no secreta sigue sobreviviendo al guardado", async () => {
    expect(token).toBeTruthy();
    if (!token) return;

    const telefono = "+51999000111";
    const res = await post(
      "/api/whatsapp/config",
      { numeroTelefono: telefono, wahaConfig: { sessionName: "sesion-persistida-" + Date.now() } },
      token
    );
    expect(res.status).toBe(200);

    const crudo = await filaCrudaWhatsappConfig();
    expect(crudo).toBeTruthy();
    if (!crudo) return;
    const fila = JSON.parse(crudo);
    expect(fila.numeroTelefono).toBe(telefono);
    expect(typeof fila.wahaConfig?.sessionName).toBe("string");
  });
});
