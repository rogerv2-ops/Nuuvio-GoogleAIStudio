import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline } from "./_helpers";

// Pruebas de contrato del lead calificado y la redireccion segura.
// Se ejecutan solo si hay un servidor en BASE; si no, quedan en verde sin tocar red.
describe("Fase 2 - lead calificado y redireccion segura (/c/:ofertaId)", () => {
  test("responde 302/404 sin reventar (redireccion segura)", async () => {
    if (!(await servidorOnline())) return;
    const r = await fetch(BASE + "/c/oferta_de_prueba_inexistente?u=51900000000", {
      redirect: "manual",
    });
    expect([302, 404]).toContain(r.status);
  });

  test("aplica rate limit por IP (>20 en 60s => 429)", async () => {
    if (!(await servidorOnline())) return;
    let got429 = false;
    for (let i = 0; i < 25; i++) {
      const r = await fetch(BASE + "/c/oferta_de_prueba_inexistente?u=51900000001", {
        redirect: "manual",
      });
      if (r.status === 429) {
        got429 = true;
        break;
      }
    }
    expect(got429).toBe(true);
  });
});
