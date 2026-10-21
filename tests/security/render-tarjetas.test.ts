/**
 * Las tarjetas que el bot manda por WhatsApp tienen que llevar TEXTO.
 *
 * Que reporto el dueno (2026-10-21): "la renderizacion de las 3 imagenes y
 * las de una oferta sola esta mal... no esta incluyendo los textos, se
 * renderizan las 3 imagenes, pero sin textos, sin titulo, sin precio antes/
 * despues, sin distrito, sin nombre de comercio".
 *
 * LA CAUSA
 *
 * @napi-rs/canvas dibuja con canvas. Sin una fuente cargada, `fillText` NO
 * DIBUJA NADA y no lanza error: la imagen sale con los recuadros y los logos
 * pero VACIA de texto. La imagen de produccion corria con 0 fuentes
 * instaladas (el Dockerfile base no trae ninguna), y por eso las tarjetas
 * llegaban sin un solo texto.
 *
 * Estos tests cubren el lado del CODIGO (que el render dibuje texto). El
 * lado de la IMAGEN (que el Dockerfile instale fuentes) lo vigila el CI:
 * el job "Build de la imagen de produccion" levanta la imagen y comprueba
 * que puede dibujar texto.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { renderOfferCardImage, renderMosaicImage, familiaTitulo } from "../../src/utils/cardRenderer.ts";

const OFERTA = {
  id: "of_test_render",
  titulo: "Bowl Acai Organico + Cafe Pasado",
  precioNormal: 38,
  precioOferta: 24,
  comercioNombre: "La Bodega Verde",
  distrito: "Barranco",
  imagenes: [],
  categoria: "Gastronomia",
  venceEn: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
};

/** Cuenta los pixeles oscuros: la tinta del texto dibujado. */
async function pixelesDeTinta(buf: Buffer): Promise<{ total: number; oscuros: number }> {
  const img = await loadImage(buf);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  let oscuros = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 40 && d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110) oscuros++;
  }
  return { total: d.length / 4, oscuros };
}

describe("Render de tarjetas: el texto tiene que estar", () => {
  test("R1: hay fuentes disponibles y la familia del render existe", () => {
    // Si esto falla, el render sale sin texto (y sin error).
    expect(GlobalFonts.families.length).toBeGreaterThan(0);
    expect(["YudditTitulo", "sans-serif"]).toContain(familiaTitulo());
  });

  test("R2: la tarjeta de UNA oferta dibuja texto", async () => {
    const buf = await renderOfferCardImage(OFERTA as any);
    const { total, oscuros } = await pixelesDeTinta(buf);
    expect(total).toBeGreaterThan(1000);
    // El titulo, los precios, el comercio y el distrito son tinta: sin
    // fuentes, esto queda en cero (o casi).
    expect(oscuros).toBeGreaterThan(200);
  });

  test("R3: el mosaico de 3 ofertas dibuja texto", async () => {
    const buf = await renderMosaicImage([
      OFERTA as any,
      { ...OFERTA, id: "of_test_render_2", titulo: "Pack 2x1 Cafe Geisha" } as any,
      { ...OFERTA, id: "of_test_render_3", titulo: "Duo de Baos con Cerveza" } as any,
    ]);
    const { total, oscuros } = await pixelesDeTinta(buf);
    expect(total).toBeGreaterThan(1000);
    expect(oscuros).toBeGreaterThan(200);
  });

  test("R4: el render registra su propia fuente (no depende de 'sans-serif')", () => {
    const fuente = fs.readFileSync(
      new URL("../../src/utils/cardRenderer.ts", import.meta.url),
      "utf8",
    );
    // Se registra una fuente con nombre propio y se usa en todos los ctx.font.
    expect(fuente).toContain("GlobalFonts.registerFromPath");
    expect(fuente).toContain("familiaTitulo()");
    // Y el fallback: si no hay fuentes, el render no se rompe.
    expect(fuente).toContain('GlobalFonts.has(FAMILIA_TITULO) ? FAMILIA_TITULO : "sans-serif"');
  });
});
