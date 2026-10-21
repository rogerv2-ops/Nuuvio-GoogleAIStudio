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

  test("R5: el fondo naranja del precio CRECE con el texto (no se desborda)", async () => {
    // El ancho del tag de precio estaba FIJO en 175 px: con la letra un 30%
    // mas grande, "S/ 9875.00" se salia de su caja. Ahora el fondo se
    // calcula a partir del texto medido.
    const corto = await renderOfferCardImage({ ...OFERTA, id: "of_precio_corto", precioNormal: 38, precioOferta: 24 } as any);
    const largo = await renderOfferCardImage({ ...OFERTA, id: "of_precio_largo", precioNormal: 12500, precioOferta: 9875 } as any);

    const anchoNaranja = async (buf: Buffer) => {
      const img = await loadImage(buf);
      const c = createCanvas(img.width, img.height);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;
      let minX = img.width;
      let maxX = 0;
      let n = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          // #FF5722: rojo alto, verde medio, azul bajo
          if (d[i + 3] > 200 && d[i] > 220 && d[i + 1] > 60 && d[i + 1] < 120 && d[i + 2] < 70) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            n++;
          }
        }
      }
      return { ancho: maxX - minX, pixeles: n };
    };

    const a = await anchoNaranja(corto);
    const b = await anchoNaranja(largo);
    expect(a.pixeles).toBeGreaterThan(1000);
    expect(b.pixeles).toBeGreaterThan(1000);
    // El fondo del precio largo es MAS ANCHO: crece con el texto.
    expect(b.ancho).toBeGreaterThan(a.ancho + 20);
  });

  test("R6: el nombre del comercio NO choca con la insignia de distrito", async () => {
    // Con la letra mas grande, un nombre largo se metia debajo de la
    // insignia. El nombre se acota al espacio disponible.
    const buf = await renderOfferCardImage({
      ...OFERTA,
      id: "of_nombre_largo",
      comercioNombre: "Comercializadora de Cafes de Especialidad del Peru SAC",
      distrito: "San Bartolo",
    } as any);
    const img = await loadImage(buf);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;

    // En la franja del pie: el texto del comercio es BLANCO y la insignia de
    // distrito tiene borde DORADO. El texto blanco no puede llegar al borde
    // dorado.
    const y0 = img.height - 70;
    let bordeDoradoX = img.width;
    let textoBlancoMaxX = 0;
    for (let y = y0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (d[i + 3] < 40) continue;
        // dorado #FBBF24
        if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 120) {
          if (x < bordeDoradoX) bordeDoradoX = x;
        }
        // blanco del texto
        if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) {
          if (x > textoBlancoMaxX) textoBlancoMaxX = x;
        }
      }
    }
    expect(bordeDoradoX).toBeLessThan(img.width);
    // El texto del comercio queda a la izquierda de la insignia.
    expect(textoBlancoMaxX).toBeLessThan(bordeDoradoX);
  });

  test("R7: el titulo de la oferta NO cambia de tamano", () => {
    // El dueno: "incrementa el tamano de todos los texto menos el titulo de
    // la oferta". El titulo sigue en 32 px.
    const fuente = fs.readFileSync(new URL("../../src/utils/cardRenderer.ts", import.meta.url), "utf8");
    expect(fuente).toContain("ctx.font = `900 32px ${familiaTitulo()}`;");
    // Y el resto de los textos SI crecen (escala 1.3).
    expect(fuente).toContain("const ESCALA_TEXTO = 1.3;");
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
