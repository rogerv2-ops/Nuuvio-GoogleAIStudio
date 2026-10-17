import { test, expect, describe } from "bun:test";
import { servidorOnline, login, post, oferta, ADMIN, FIXTURE, MOSAIC_PHONE } from "./_helpers.ts";

// T016 / US1: el bot despacha el mosaico en UN solo mensaje (imagen+caption),
// hasta 3 ofertas, excluyendo comercios sin saldo.
const online = await servidorOnline();
const token = online ? await login(ADMIN.email, ADMIN.password) : null;
const ofertaOk = online && !!(await oferta(FIXTURE.offerFacturable));

describe.skipIf(!token || !ofertaOk)("US1 mosaico (T016/E2E)", () => {
  test("simulate-incoming: un mensaje imagen_con_caption con <=3 ofertas y links /c/", async () => {
    const res = await post(
      "/api/whatsapp/simulate-incoming",
      { telefono: MOSAIC_PHONE, texto: "ofertas en Miraflores", pushName: "Test Mosaico" },
      token
    );
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(Array.isArray(j.respuestas)).toBe(true);

    const imagenes = (j.respuestas || []).filter(
      (r: any) => r.tipo === "imagen_con_caption"
    );
    expect(imagenes.length).toBe(1);

    const caption: string = imagenes[0].texto || "";
    const links = [...caption.matchAll(/\/c\/([A-Za-z0-9_]+)\?u=/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links.length).toBeLessThanOrEqual(3);

    // La unica oferta de Miraflores con saldo sembrada debe aparecer.
    expect(links).toContain(FIXTURE.offerFacturable);
    // ofr_00 es de Miraflores pero su comercio no tiene saldo -> excluida.
    expect(links).not.toContain("ofr_00");
  });
});
