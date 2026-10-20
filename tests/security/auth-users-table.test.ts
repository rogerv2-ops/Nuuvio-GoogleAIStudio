/**
 * Punto 12 de la auditoria: `auth_users` deja de ser un blob JSON en
 * `app_settings` y pasa a ser una tabla con operaciones SQL puntuales.
 *
 * El defecto que se arregla: cada alta de usuario, cambio de contrasena,
 * activacion/desactivacion de MFA y consumo de codigo de respaldo reescribia
 * el ARRAY COMPLETO (`saveSetting("auth_users", list)`). Con dos peticiones
 * concurrentes, una se pisaba y una actualizacion se perdia. El caso mas
 * sensible: un alta concurrente con un cambio de MFA.
 *
 * Estos tests comprueban lo que importa:
 *  1. El blob ya no se escribe (el codigo no lo menciona).
 *  2. El CRUD funciona contra la tabla (crear, entrar, cambiar clave, editar, borrar).
 *  3. Altas CONCURRENTES: antes se perdian; ahora todas sobreviven.
 *  4. El codigo de respaldo se consume de forma ATOMICA: usado dos veces, la
 *     segunda falla (antes, dos peticiones simultaneas lo admitian las dos).
 *
 * NOTA sobre los logins: el servidor limita `/api/auth/login` a 10 intentos
 * por IP cada 5 minutos y bloquea la cuenta a los 5 fallos. En el runner todas
 * las peticiones salen de la misma IP, asi que este archivo:
 *   - manda su propio `X-Forwarded-For` (una IP de documentacion, RFC 5737) para
 *     no comer el cupo de logins del resto de la suite, y
 *   - usa un admin DESCARTABLE para el MFA, para que el intento fallido (que es
 *     parte del test) no vaya a la cuenta real ni la bloquee.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN } from "./_helpers.ts";
import { codigoTotp } from "../../src/utils/totp.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const SERVER = leerTextoServidor();
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

/** IP de documentacion (TEST-NET-3, RFC 5737): este archivo tiene su propio cupo de logins. */
const IP_TEST = "203.0.113.7";

function headersExtra(): Record<string, string> {
  return { "X-Forwarded-For": IP_TEST };
}

/** Login que devuelve el token de sesion (o la cookie) o null. */
async function loginTest(email: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headersExtra() },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j && j.token) return String(j.token);
    const setCookie = res.headers.get("set-cookie");
    const cookie = setCookie ? setCookie.split(";")[0].trim() : "";
    return cookie || null;
  } catch {
    return null;
  }
}

/** Una sola sesion de admin para todo el archivo. */
let adminToken: string | null = null;
async function sesionAdmin(): Promise<string | null> {
  if (adminToken) return adminToken;
  if (!ADMIN.email) return null;
  adminToken = await loginTest(ADMIN.email, ADMIN.password);
  if (!adminToken) {
    console.warn(
      "[auth-users] El login del admin fallo. Lo mas probable: el limite de " +
        "/api/auth/login (10 intentos por IP cada 5 minutos) se agoto. Reinicia el " +
        "servidor o espera 5 minutos."
    );
  }
  return adminToken;
}

/** La sesion puede venir como cookie (`vuuy_sesion=...`) o como token Bearer. */
function authHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...headersExtra() };
  if (!token) return headers;
  if (token.startsWith("vuuy_sesion=")) headers.Cookie = token;
  else headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function jsonPost(path: string, body: any, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function jsonPut(path: string, body: any, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function jsonDelete(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function listarUsuarios(token: string): Promise<any[]> {
  const res = await fetch(`${BASE}/api/auth/users`, { headers: authHeaders(token) });
  const data: any = await res.json().catch(() => null);
  // la API responde {ok:true, users:[...]}
  return Array.isArray(data?.users) ? data.users : Array.isArray(data?.usuarios) ? data.usuarios : [];
}

describe("auth_users - la tabla es la fuente de verdad", () => {
  test("el blob app_settings.auth_users ya no se escribe", () => {
    // Si esto vuelve a aparecer, el read-modify-write del blob volvio.
    expect(SERVER).not.toContain('saveSetting("auth_users"');
    expect(SERVER).toContain("actualizarAuthUser");
    expect(SERVER).toContain("crearAuthUser");
    expect(SERVER).toContain("eliminarAuthUser");
    expect(SERVER).toContain("consumirHashRespaldo");
  });
});

describe.skipIf(!ADMIN.email)("auth_users - CRUD contra la tabla", () => {
  test("crear, entrar, cambiar la clave, editar y borrar", async () => {
    const token = await sesionAdmin();
    expect(token, "el login del admin fallo (ver el aviso del runner)").toBeTruthy();
    if (!token) return;

    const email = `tabla_${Date.now()}@ci.test`;
    const clave = "ClaveDePrueba123";

    // 1) crear
    const creado = await jsonPost(
      "/api/auth/users",
      { email, password: clave, nombre: "Usuario Tabla", rol: "operador" },
      token
    );
    expect(creado.status).toBe(200);
    expect(creado.data?.ok).toBe(true);

    // 2) cambiar la clave y entrar con la nueva (prueba de que la fila de la
    //    tabla tiene el hash y el salt correctos)
    const cambio = await jsonPost("/api/auth/password", { email, password: "ClaveNueva456" }, token);
    expect(cambio.status).toBe(200);
    expect(await loginTest(email, "ClaveNueva456")).toBeTruthy();

    // 3) editar la credencial
    const edicion = await jsonPut(
      `/api/auth/users/${encodeURIComponent(email)}`,
      { nombre: "Nombre Editado", rol: "comercio", merchantId: "merch_02" },
      token
    );
    expect(edicion.status).toBe(200);
    const usuarios = await listarUsuarios(token);
    const encontrado = usuarios.find((u) => String(u.email).toLowerCase() === email);
    expect(encontrado).toBeTruthy();
    expect(encontrado?.nombre).toBe("Nombre Editado");
    expect(encontrado?.rol).toBe("comercio");

    // 4) borrar y comprobar que ya no esta. Se mira la lista y no se hace un
    //    login nuevo: el login esta limitado por IP.
    const borrado = await jsonDelete(`/api/auth/users/${encodeURIComponent(email)}`, token);
    expect(borrado.status).toBe(200);
    const trasBorrar = await listarUsuarios(token);
    expect(trasBorrar.find((u) => String(u.email).toLowerCase() === email)).toBeUndefined();
  });

  test("altas CONCURRENTES: ninguna se pierde (antes se perdian)", async () => {
    const token = await sesionAdmin();
    expect(token, "el login del admin fallo (ver el aviso del runner)").toBeTruthy();
    if (!token) return;

    const marca = Date.now();
    const correos = Array.from({ length: 5 }, (_, i) => `conc_${marca}_${i}@ci.test`);

    // 5 altas al mismo tiempo. Con el blob, cada una reescribia el array
    // completo y se perdian varias.
    const resultados = await Promise.all(
      correos.map((email) =>
        jsonPost(
          "/api/auth/users",
          { email, password: "ClaveConcurrente1", nombre: "Conc " + email, rol: "operador" },
          token
        )
      )
    );
    for (const r of resultados) expect(r.status).toBe(200);

    const usuarios = await listarUsuarios(token);
    const emails = new Set(usuarios.map((u) => String(u.email).toLowerCase()));
    const perdidos = correos.filter((e) => !emails.has(e));
    expect(perdidos, "se perdieron altas concurrentes: " + perdidos.join(", ")).toEqual([]);

    // limpiar
    for (const email of correos) {
      await jsonDelete(`/api/auth/users/${encodeURIComponent(email)}`, token);
    }
  });
});

describe.skipIf(!ADMIN.email)("auth_users - MFA y consumo atomico del codigo de respaldo", () => {
  test("un codigo de respaldo se usa una sola vez, aunque se repita", async () => {
    const token = await sesionAdmin();
    expect(token, "el login del admin fallo (ver el aviso del runner)").toBeTruthy();
    if (!token) return;

    // Se usa un admin DESCARTABLE: el test incluye un intento fallido (el
    // mismo codigo de respaldo dos veces) y no queremos que eso cuente para
    // la cuenta real ni la bloquee.
    const email = `mfa_${Date.now()}@ci.test`;
    const clave = "ClaveMfaPrueba1";
    const creado = await jsonPost(
      "/api/auth/users",
      { email, password: clave, nombre: "Admin MFA descartable", rol: "admin" },
      token
    );
    expect(creado.status).toBe(200);

    const sesionPropia = await loginTest(email, clave);
    expect(sesionPropia).toBeTruthy();
    if (!sesionPropia) return;

    let secret = "";
    try {
      // 1) generar el secreto y activar el segundo factor
      const setup = await jsonPost("/api/auth/mfa/setup", {}, sesionPropia);
      expect(setup.status).toBe(200);
      secret = String(setup.data?.secret || "");
      expect(secret.length).toBeGreaterThan(10);

      const activacion = await jsonPost("/api/auth/mfa/activate", { codigo: codigoTotp(secret) }, sesionPropia);
      expect(activacion.status).toBe(200);
      const respaldos: string[] = Array.isArray(activacion.data?.codigosRespaldo)
        ? activacion.data.codigosRespaldo
        : [];
      expect(respaldos.length).toBeGreaterThan(0);
      const codigo = respaldos[0];

      // 2) pedir el segundo factor y entrar con el codigo de respaldo
      const pedir = await jsonPost("/api/auth/login", { email, password: clave });
      expect(pedir.data?.mfaRequerido).toBe(true);
      const mfaToken = String(pedir.data?.mfaToken || "");
      expect(mfaToken.length).toBeGreaterThan(10);

      const primerUso = await jsonPost("/api/auth/login/mfa", { mfaToken, codigo });
      expect(primerUso.status).toBe(200);
      expect(primerUso.data?.ok).toBe(true);

      // 3) el MISMO codigo otra vez: tiene que fallar (el consumo es atomico)
      const segundoUso = await jsonPost("/api/auth/login/mfa", { mfaToken, codigo });
      expect(segundoUso.status).toBe(401);
      expect(segundoUso.data?.ok).toBe(false);
    } finally {
      // 4) dejar el segundo factor como estaba y borrar el usuario descartable
      if (secret) await jsonPost("/api/auth/mfa/disable", { codigo: codigoTotp(secret) }, sesionPropia);
      await jsonDelete(`/api/auth/users/${encodeURIComponent(email)}`, token);
    }
  });
});
