/**
 * Punto 8 de la auditoria: el bloqueo por intentos fallidos de login ya no
 * vive en la memoria del proceso.
 *
 * Antes: un `Map` en memoria. Con dos instancias del servidor, cada una
 * contaba por su cuenta (el bloqueo se eludia alternando instancias) y un
 * reinicio lo borraba. Ahora el contador esta en Postgres (tabla
 * `login_failures`), asi que es el mismo para todas las instancias y
 * sobrevive a los reinicios.
 *
 * Lo que se comprueba aca:
 *  1. A los 5 intentos fallidos, la cuenta queda bloqueada (423).
 *  2. El contador esta en la BASE, no en memoria.
 *  3. El bloqueo es por correo: otra cuenta no se ve afectada.
 *  4. Un login correcto borra el contador.
 *
 * El test manda su propio `X-Forwarded-For` porque `/api/auth/login` esta
 * limitado a 10 intentos por IP cada 5 minutos y en el runner todas las
 * peticiones salen de la misma IP.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const SERVER = leerTextoServidor();
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const IP_TEST = "203.0.113.66";

const SQL = {
  host: process.env.SQL_HOST || "127.0.0.1",
  user: process.env.SQL_USER || "postgres",
  password: process.env.SQL_PASSWORD || "test",
  database: process.env.SQL_DB_NAME || "yuddit_test",
};

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

async function login(email: string, password: string, ip = IP_TEST) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function contador(email: string): Promise<{ count: number; locked: boolean } | null> {
  const client = new pg.Client(SQL);
  try {
    await client.connect();
    const r = await client.query(
      `select failed_count, (locked_until > 0) as bloqueado from login_failures where email = $1`,
      [email.toLowerCase()]
    );
    if (!r.rowCount) return null;
    return { count: Number(r.rows[0].failed_count), locked: !!r.rows[0].bloqueado };
  } finally {
    await client.end().catch(() => {});
  }
}

const conBase = await hayBase();
if (!conBase) {
  console.warn(
    "[lockout] SALTADO: no hay Postgres en " + SQL.host + "/" + SQL.database +
      ". La prueba del bloqueo persistente no corrio."
  );
}

describe("bloqueo por intentos fallidos - el contador no esta en memoria", () => {
  test("el servidor consulta y escribe el contador en la base, no en un Map", () => {
    expect(SERVER).toContain("getLoginFailureDb");
    expect(SERVER).toContain("registrarLoginFallidoDb");
    expect(SERVER).toContain("limpiarLoginFallidoDb");
    // el Map queda solo como respaldo si la base no responde
    expect(SERVER).toContain("loginFailState");
  });
});

describe.skipIf(!conBase)("bloqueo por intentos fallidos - contra la base", () => {
  // IP FIJA Y DISTINTA POR TEST. Antes cada test elegia una al azar entre
  // 200: dos tests podían sacar la misma y compartian el bucket de "login"
  // (10 intentos / 5 min / IP). Con 6-7 logins cada uno, dos tests en la
  // misma IP sumaban 13 y el segundo recibia 429 en vez del 423 esperado:
  // un test que fallaba por azar, no por el codigo. Se vio en produccion de
  // tests el 2026-10-21 (IP 198.51.100.89).
  const IP_TEST_A = "198.51.100.11";
  const IP_TEST_B = "198.51.100.12";
  const IP_TEST_C = "198.51.100.13";

  test("a los 5 intentos la cuenta queda bloqueada y el contador esta en la base", async () => {
    const email = `lockout_${Date.now()}@ci.test`;
    const ip = IP_TEST_A;

    for (let i = 1; i <= 4; i++) {
      const r = await login(email, "clave-mala", ip);
      expect(r.status, `intento ${i}`).toBe(401);
    }
    const antes = await contador(email);
    expect(antes?.count, "el contador deberia llevar 4 intentos").toBe(4);

    const quinto = await login(email, "clave-mala", ip);
    expect(quinto.status).toBe(423);
    expect(quinto.data?.bloqueado).toBe(true);
    expect(Number(quinto.data?.segundosRestantes)).toBeGreaterThan(0);

    const despues = await contador(email);
    expect(despues?.locked, "la cuenta deberia quedar bloqueada en la base").toBe(true);

    // y el bloqueo sigue vigente
    const sexto = await login(email, "clave-mala", ip);
    expect(sexto.status).toBe(423);
  });

  test("el bloqueo es por correo: otra cuenta no se ve afectada", async () => {
    const email = `lockout_otro_${Date.now()}@ci.test`;
    const ip = IP_TEST_B;
    for (let i = 0; i < 5; i++) await login(email, "clave-mala", ip);
    expect((await login(email, "clave-mala", ip)).status).toBe(423);

    // un correo que nunca fallo entra normal (no esta bloqueado)
    const otro = await login("nadie@ejemplo-inexistente.test", "lo-que-sea", ip);
    expect(otro.status).toBe(401);
    expect(otro.data?.bloqueado).toBeFalsy();
  });

  test("un login correcto borra el contador", async () => {
    const admin = process.env.VUUV_ADMIN_EMAIL;
    const adminPass = process.env.VUUV_ADMIN_PASSWORD;
    if (!admin || !adminPass) return;
    const ip = IP_TEST_C;

    // tres intentos fallidos con la clave correcta...
    for (let i = 0; i < 3; i++) {
      const r = await login(admin, "clave-equivocada", ip);
      expect(r.status).toBe(401);
    }
    expect((await contador(admin))?.count).toBe(3);

    // ...y ahora la clave correcta: el contador se borra
    const ok = await login(admin, adminPass, ip);
    expect(ok.status).toBe(200);
    expect(await contador(admin)).toBeNull();
  });
});
