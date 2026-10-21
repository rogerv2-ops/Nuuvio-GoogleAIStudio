/**
 * Color de fondo de la landing configurable desde la seccion de Banners.
 *
 * QUE VIGILA
 *
 * El dueno pidio (2026-10-21) que el color de fondo de la landing no este fijo
 * en el codigo: se configura debajo del logo, en Banners. Se guarda en
 * app_settings (clave `landing_fondo`) y viaja en el payload publico de
 * `/api/banners`, que es el que la landing ya consume.
 *
 * Reglas que este archivo protege:
 *   F1. `/api/banners` entrega `fondo` como color hexadecimal `#rrggbb`.
 *   F2. Sin sesion de admin no se puede cambiar (es configuracion del sitio).
 *   F3. Un color valido se guarda y se lee igual; se normaliza a minusculas y
 *       la forma corta (`#abc`) se expande a `#aabbcc`.
 *   F4. Un valor que no es un color se rechaza con 400 y no pisa el publicado
 *       (un color invalido dejaria la landing sin fondo legible).
 */
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { servidorOnline, get, post, login, ADMIN } from "./_helpers.ts";

const online = await servidorOnline();
const conCredenciales = !!ADMIN.email && !!ADMIN.password;

const COLOR_HEX = /^#[0-9a-f]{6}$/;

async function leerBanners(): Promise<{ banners: any[]; fondo: any }> {
  const res = await get("/api/banners", null);
  const j: any = await res.json();
  return { banners: Array.isArray(j?.banners) ? j.banners : [], fondo: j?.fondo };
}

describe.skipIf(!online || !conCredenciales)("Fondo de la landing", () => {
  let token: string | null = null;
  let fondoOriginal: string | null = null;

  beforeAll(async () => {
    token = await login(ADMIN.email, ADMIN.password);
    const actual = await leerBanners();
    fondoOriginal = typeof actual.fondo === "string" ? actual.fondo : null;
  });

  afterAll(async () => {
    if (!token || !fondoOriginal) return;
    const actual = await leerBanners();
    await post("/api/banners/sync", { banners: actual.banners, fondo: fondoOriginal }, token);
  });

  test("F1: /api/banners entrega el color de fondo de la landing", async () => {
    const { fondo } = await leerBanners();
    expect(typeof fondo).toBe("string");
    expect(fondo).toMatch(COLOR_HEX);
  });

  test("F2: sin sesion no se puede cambiar el fondo", async () => {
    const antes = await leerBanners();
    const res = await post("/api/banners/sync", { banners: antes.banners, fondo: "#123456" }, null);
    expect(res.status).toBe(401);
    const despues = await leerBanners();
    expect(despues.fondo).toBe(antes.fondo);
  });

  test("F3: un color valido se guarda y se normaliza", async () => {
    const { banners } = await leerBanners();

    const mayusculas = await post("/api/banners/sync", { banners, fondo: "#AABBCC" }, token);
    expect(mayusculas.status).toBe(200);
    let actual = await leerBanners();
    expect(actual.fondo).toBe("#aabbcc");

    await post("/api/banners/sync", { banners: actual.banners, fondo: "#0f0" }, token);
    actual = await leerBanners();
    expect(actual.fondo).toBe("#00ff00");
  });

  test("F4: un valor que no es color se rechaza y no pisa el publicado", async () => {
    const antes = await leerBanners();

    for (const invalido of ["rojo", "#12345", "rgb(1,2,3)", ""]) {
      const res = await post("/api/banners/sync", { banners: antes.banners, fondo: invalido }, token);
      expect(res.status).toBe(400);
      const despues = await leerBanners();
      expect(despues.fondo).toBe(antes.fondo);
    }
  });
});
