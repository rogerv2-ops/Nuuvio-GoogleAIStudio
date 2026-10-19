import { test, expect, describe, mock, beforeEach } from "bun:test";

/**
 * Punto 1 de docs/auditoria-2026-10-19.md.
 *
 * `registerOfferClick` decide si un clic es facturable. Antes de este test, un error
 * de base de datos dejaba la decisión en "facturable": el SELECT fallaba, `existeClicEn24h`
 * quedaba en false y el clic se cobraba igual. Peor: si fallaba el INSERT, la función
 * devolvía `facturable: true` sin haber dejado fila en click_logs, con lo cual la ventana
 * de 24 h tampoco existía y el mismo teléfono podía volver a facturarse.
 *
 * Se aísla la DB mockeando `src/db/index.ts` para poder inducir el fallo de cada consulta.
 */

type Modo = "ok" | "failSelect" | "failInsert";

let modo: Modo = "ok";
let filasSelect: any[] = [];
let insertados: any[] = [];

mock.module("../../src/db/index.ts", () => ({
  createPool: () => ({ on: () => {} }),
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          if (modo === "failSelect") throw new Error("DB caida (select)");
          return filasSelect;
        },
      }),
    }),
    insert: () => ({
      values: async (v: any) => {
        if (modo === "failInsert") throw new Error("DB caida (insert)");
        insertados.push(v);
      },
    }),
  },
}));

const { registerOfferClick } = await import("../../src/db/repo.ts");

const CLIC = {
  ofertaId: "ofr_test_failclosed",
  comercioId: "merch_test_failclosed",
  usuarioTelefono: "51999000011",
  saldoDisponible: true,
};

describe("registerOfferClick - facturacion fail-closed", () => {
  beforeEach(() => {
    modo = "ok";
    filasSelect = [];
    insertados = [];
  });

  test("sin fallo y sin clic previo: el clic es facturable", async () => {
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(true);
    expect(insertados.length).toBe(1);
  });

  test("si falla la lectura de la ventana de 24h, NO se factura", async () => {
    modo = "failSelect";
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
  });

  test("si falla la escritura en click_logs, NO se factura", async () => {
    modo = "failInsert";
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
  });

  test("con un clic facturable dentro de la ventana de 24h, NO se factura", async () => {
    filasSelect = [{ id: "clk_previo" }];
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
  });

  test("sin saldo disponible, NO se factura", async () => {
    const r = await registerOfferClick({ ...CLIC, saldoDisponible: false });
    expect(r.facturable).toBe(false);
  });

  test("siempre devuelve un codigo de canje NV- de 6 caracteres", async () => {
    const r = await registerOfferClick(CLIC);
    expect(r.codigoCanje).toMatch(/^NV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});
