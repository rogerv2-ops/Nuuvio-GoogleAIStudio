import { test, expect, describe } from "bun:test";
import { servidorOnline, post, oferta, FIXTURE } from "./_helpers.ts";

// T025: "Me Gusta" informativo -> incrementa y persiste likes, NO factura.
// Usa una oferta dedicada (ofr_test_like) para no cruzarse con el test de CPC.
const online = await servidorOnline();
const fixOk = online && !!(await oferta(FIXTURE.offerLike));

describe.skipIf(!fixOk)("Me Gusta /api/ofertas/:id/like (T025)", () => {
  test("dos likes incrementan el contador", async () => {
    const before = await oferta(FIXTURE.offerLike);

    const r1 = await post(`/api/ofertas/${FIXTURE.offerLike}/like`, {}, null);
    expect(r1.status).toBe(200);
    const j1: any = await r1.json();
    expect(j1.ok).toBe(true);
    expect(j1.likes).toBe(before.likes + 1);

    const r2 = await post(`/api/ofertas/${FIXTURE.offerLike}/like`, {}, null);
    const j2: any = await r2.json();
    expect(j2.likes).toBe(before.likes + 2);

    // Persistido (visible via /api/ofertas)
    const after = await oferta(FIXTURE.offerLike);
    expect(after.likes).toBe(before.likes + 2);
  });

  test("un like NO factura: clics y leads no cambian", async () => {
    const before = await oferta(FIXTURE.offerLike);
    await (await post(`/api/ofertas/${FIXTURE.offerLike}/like`, {}, null)).json();
    const after = await oferta(FIXTURE.offerLike);
    expect(after.clics).toBe(before.clics);
    expect(after.leadsCalificados).toBe(before.leadsCalificados);
  });

  test("oferta inexistente: no rompe (404 o likes 0)", async () => {
    const r = await post(`/api/ofertas/ofr_no_existe/like`, {}, null);
    expect([404, 200]).toContain(r.status);
    await r.body?.cancel();
  });
});
