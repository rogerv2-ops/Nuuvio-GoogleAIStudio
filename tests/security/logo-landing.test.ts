/**
 * Logo de la landing configurable desde la seccion de Banners.
 *
 * QUE VIGILA
 *
 * El dueno pidio (2026-10-21) poder subir el logo de la landing desde la
 * configuracion de banners y fijar su tamano de forma PROPORCIONAL. El logo se
 * guarda en app_settings (clave `landing_logo`) y viaja en el payload publico
 * de `/api/banners`, que es el que la landing ya consume.
 *
 * Reglas que este archivo protege:
 *   L1. `/api/banners` entrega `logo` con `imagenUrl` y `altoPx` (alto unico:
 *       el ancho lo calcula el navegador, asi nunca se deforma).
 *   L2. Sin sesion de admin no se puede cambiar (es configuracion del sitio).
 *   L3. El alto se limita a un rango util: un valor absurdo no rompe la
 *       cabecera de la landing.
 *   L4. Un `data:` sin subir no se acepta: el cliente debe esperar la subida
 *       (misma razon que en los banners: un data URL vive en el navegador de
 *       quien lo subio y el resto del mundo ve una imagen rota).
 *   L5. El `iconUrl` (favicon) viaja junto al logo, se guarda y sobrevive a un
 *       guardado del logo que no lo menciona (la UI lo reenvia siempre).
 *   L6. Un `iconUrl` en `data:` tambien se rechaza.
 */
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { servidorOnline, get, post, login, ADMIN } from "./_helpers.ts";

const online = await servidorOnline();
const conCredenciales = !!ADMIN.email && !!ADMIN.password;

const ALTO_MIN = 24;
const ALTO_MAX = 160;

async function leerBanners(): Promise<{ banners: any[]; logo: any }> {
  const res = await get("/api/banners", null);
  const j: any = await res.json();
  return { banners: Array.isArray(j?.banners) ? j.banners : [], logo: j?.logo };
}

describe.skipIf(!online || !conCredenciales)("Logo de la landing", () => {
  let token: string | null = null;
  let logoOriginal: any = null;

  beforeAll(async () => {
    token = await login(ADMIN.email, ADMIN.password);
    const actual = await leerBanners();
    logoOriginal = actual.logo ?? { imagenUrl: "", altoPx: 40 };
  });

  afterAll(async () => {
    if (!token) return;
    const actual = await leerBanners();
    await post("/api/banners/sync", { banners: actual.banners, logo: logoOriginal }, token);
  });

  test("L1: /api/banners entrega el logo junto con los banners", async () => {
    const { logo } = await leerBanners();
    expect(logo).toBeDefined();
    expect(typeof logo.imagenUrl).toBe("string");
    expect(typeof logo.altoPx).toBe("number");
    expect(logo.altoPx).toBeGreaterThanOrEqual(ALTO_MIN);
    expect(logo.altoPx).toBeLessThanOrEqual(ALTO_MAX);
  });

  test("L2: sin sesion no se puede cambiar el logo", async () => {
    const antes = await leerBanners();
    const res = await post(
      "/api/banners/sync",
      { banners: antes.banners, logo: { imagenUrl: "/logo-sin-sesion.svg", altoPx: 52 } },
      null
    );
    expect(res.status).toBe(401);
    const despues = await leerBanners();
    expect(despues.logo).toEqual(antes.logo);
  });

  test("L3: el alto se guarda y se limita a un rango util", async () => {
    const { banners } = await leerBanners();

    const alto = await post(
      "/api/banners/sync",
      { banners, logo: { imagenUrl: "/logo-prueba.svg", altoPx: 9999 } },
      token
    );
    expect(alto.status).toBe(200);
    let actual = await leerBanners();
    expect(actual.logo.imagenUrl).toBe("/logo-prueba.svg");
    expect(actual.logo.altoPx).toBe(ALTO_MAX);

    await post(
      "/api/banners/sync",
      { banners: actual.banners, logo: { imagenUrl: "/logo-prueba.svg", altoPx: 1 } },
      token
    );
    actual = await leerBanners();
    expect(actual.logo.altoPx).toBe(ALTO_MIN);
  });

  test("L4: un data URL sin subir se rechaza", async () => {
    const { banners } = await leerBanners();
    const res = await post(
      "/api/banners/sync",
      { banners, logo: { imagenUrl: "data:image/png;base64,iVBORw0KGgo=", altoPx: 48 } },
      token
    );
    expect(res.status).toBe(400);
  });

  test("L5: /api/banners entrega el icono del sitio junto al logo", async () => {
    const { logo } = await leerBanners();
    expect(logo).toBeDefined();
    expect(typeof logo.iconUrl).toBe("string");
  });

  test("L6: el icono se guarda y sobrevive a guardar el logo sin mencionarlo", async () => {
    const { banners } = await leerBanners();

    const guardado = await post(
      "/api/banners/sync",
      { banners, logo: { imagenUrl: "/logo-prueba.svg", altoPx: 48, iconUrl: "/icono-prueba.webp" } },
      token
    );
    expect(guardado.status).toBe(200);
    let actual = await leerBanners();
    expect(actual.logo.iconUrl).toBe("/icono-prueba.webp");

    // La UI reenvia el objeto logo completo al guardar: el icono no se pierde.
    await post(
      "/api/banners/sync",
      { banners: actual.banners, logo: { imagenUrl: "/logo-prueba.svg", altoPx: 56, iconUrl: actual.logo.iconUrl } },
      token
    );
    actual = await leerBanners();
    expect(actual.logo.iconUrl).toBe("/icono-prueba.webp");
    expect(actual.logo.altoPx).toBe(56);
  });

  test("L7: un iconUrl en data URL se rechaza", async () => {
    const { banners, logo } = await leerBanners();
    const res = await post(
      "/api/banners/sync",
      {
        banners,
        logo: { ...logo, iconUrl: "data:image/png;base64,iVBORw0KGgo=" }
      },
      token
    );
    expect(res.status).toBe(400);
  });

  test("L8: guardar el logo sin la clave iconUrl NO borra el icono publicado", async () => {
    const { banners } = await leerBanners();
    await post(
      "/api/banners/sync",
      { banners, logo: { imagenUrl: "/logo-prueba.svg", altoPx: 48, iconUrl: "/icono-prueba.webp" } },
      token
    );

    // Un navegador viejo reenvia el logo sin saber del icono: no debe pisarlo.
    const res = await post(
      "/api/banners/sync",
      { banners, logo: { imagenUrl: "/logo-prueba.svg", altoPx: 48 } },
      token
    );
    expect(res.status).toBe(200);
    const actual = await leerBanners();
    expect(actual.logo.iconUrl).toBe("/icono-prueba.webp");
  });
});
