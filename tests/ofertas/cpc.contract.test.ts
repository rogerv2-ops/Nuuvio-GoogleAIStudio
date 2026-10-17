import { test, expect, describe } from "bun:test";
import { servidorOnline, clicGet, oferta, FIXTURE, BASE } from "./_helpers.ts";

// T017: contrato de GET /c/:ofertaId (CPC, ventana 24h, saldo, 404, rate limit).
const online = await servidorOnline();
const fixOk =
  online &&
  !!(await oferta(FIXTURE.offerFacturable)) &&
  !!(await oferta(FIXTURE.offerSinSaldo));

const U1 = FIXTURE.phonePrefix + "01";
const U2 = FIXTURE.phonePrefix + "02";
const U3 = FIXTURE.phonePrefix + "03";

describe.skipIf(!fixOk)("CPC /c/:ofertaId (T017)", () => {
  test("clic de oferta con saldo: 302 + codigo NV + suma clic y lead", async () => {
    const before = await oferta(FIXTURE.offerFacturable);
    const res = await clicGet(FIXTURE.offerFacturable, U1);
    expect(res.status).toBe(302);

    const loc = res.headers.get("location") || "";
    expect(loc.startsWith("https://api.whatsapp.com/send?phone=")).toBe(true);
    const texto = decodeURIComponent((loc.split("&text=")[1] || "").replace(/\+/g, " "));
    expect(texto).toContain(before.titulo);
    expect(texto).toMatch(/#NV-\d+/);

    const after = await oferta(FIXTURE.offerFacturable);
    expect(after.clics).toBe(before.clics + 1);
    expect(after.leadsCalificados).toBe(before.leadsCalificados + 1);
  });

  test("segundo clic <24h del mismo telefono: no facturable (sin nuevo lead)", async () => {
    const before = await oferta(FIXTURE.offerFacturable);
    const res = await clicGet(FIXTURE.offerFacturable, U1);
    expect(res.status).toBe(302);
    const after = await oferta(FIXTURE.offerFacturable);
    expect(after.clics).toBe(before.clics + 1);
    expect(after.leadsCalificados).toBe(before.leadsCalificados);
  });

  test("otro telefono <24h: vuelve a ser facturable", async () => {
    const before = await oferta(FIXTURE.offerFacturable);
    const res = await clicGet(FIXTURE.offerFacturable, U2);
    expect(res.status).toBe(302);
    const after = await oferta(FIXTURE.offerFacturable);
    expect(after.leadsCalificados).toBe(before.leadsCalificados + 1);
  });

  test("oferta de comercio sin saldo: no facturable (sin nuevo lead)", async () => {
    const before = await oferta(FIXTURE.offerSinSaldo);
    const res = await clicGet(FIXTURE.offerSinSaldo, U3);
    expect(res.status).toBe(302);
    const after = await oferta(FIXTURE.offerSinSaldo);
    expect(after.clics).toBe(before.clics + 1);
    expect(after.leadsCalificados).toBe(before.leadsCalificados);
  });

  test("oferta inexistente: 404", async () => {
    const res = await clicGet("ofr_no_existe", FIXTURE.phonePrefix + "04");
    expect(res.status).toBe(404);
  });

  test("rate limit del bucket clicks: aparece un 429 en rafaga", async () => {
    let vistos429 = 0;
    for (let i = 0; i < 25; i++) {
      const r = await fetch(`${BASE}/c/ofr_no_existe?u=${FIXTURE.phonePrefix}9${i}`, {
        redirect: "manual",
      });
      if (r.status === 429) vistos429++;
      await r.body?.cancel();
    }
    expect(vistos429).toBeGreaterThanOrEqual(1);
  });
});
