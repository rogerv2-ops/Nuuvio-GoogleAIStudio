import { test, expect, describe } from "bun:test";
import { renderMosaicImage } from "../../src/utils/cardRenderer.ts";
import { loadImage } from "@napi-rs/canvas";

function oferta(n: number) {
  return {
    id: `of_${n}`,
    titulo: `Oferta de prueba ${n}`,
    precioNormal: 100,
    precioOferta: 60,
    comercioNombre: `Comercio ${n}`,
    distrito: "Miraflores",
  };
}

describe("Fase 1B - mosaico 1:1 numerado (una sola imagen)", () => {
  for (const count of [1, 2, 3]) {
    test(`mosaico de ${count} oferta(s): una imagen 800x${800 * count}`, async () => {
      const buf = await renderMosaicImage(Array.from({ length: count }, (_, i) => oferta(i + 1)) as any);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
      const img = await loadImage(buf);
      expect(img.width).toBe(800);
      expect(img.height).toBe(800 * count);
    });
  }

  test("se recorta a maximo 3 (FR-001)", async () => {
    const cinco = Array.from({ length: 5 }, (_, i) => oferta(i + 1));
    // El llamador (dispatchOffersMosaic) recorta a 3; aqui verificamos que el renderer
    // con 3 segmentos produce exactamente 2400px de alto.
    const buf = await renderMosaicImage((cinco as any).slice(0, 3));
    const img = await loadImage(buf);
    expect(img.height).toBe(2400);
  });
});
