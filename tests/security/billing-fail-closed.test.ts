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

type Modo = "ok" | "failLock" | "failSelect" | "failInsert" | "failTransaction";

let modo: Modo = "ok";
let filasSelect: any[] = [];
let insertados: any[] = [];

/**
 * El mock tiene que reflejar la forma REAL de `src/db/index.ts`, incluida la
 * transacción. Si se queda atrás, `db.transaction` deja de existir, el
 * `TypeError` cae en el mismo `catch` que un fallo de base y los casos
 * "NO se factura" pasan por el motivo equivocado: el test se pone verde sin
 * haber ejercitado el camino real. Por eso cada caso de fallo también afirma
 * que NO se insertó nada, no solo que `facturable` es false.
 */
function capaFalsa() {
  return {
    execute: async () => {
      if (modo === "failLock") throw new Error("DB caida (lock)");
      return { rows: [] };
    },
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
  };
}

mock.module("../../src/db/index.ts", () => ({
  createPool: () => ({ on: () => {} }),
  db: {
    ...capaFalsa(),
    transaction: async (fn: any) => {
      if (modo === "failTransaction") throw new Error("DB caida (begin)");
      // La transacción recibe su propio handle, como en la capa real.
      return await fn(capaFalsa());
    },
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

  test("si falla la lectura de la ventana de 24h, NO se factura y no queda registro", async () => {
    modo = "failSelect";
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
    expect(insertados.length).toBe(0);
  });

  test("si falla la escritura en click_logs, NO se factura y no queda registro", async () => {
    modo = "failInsert";
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
    expect(insertados.length).toBe(0);
  });

  test("si falla la toma del lock de la ventana, NO se factura y no queda registro", async () => {
    modo = "failLock";
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
    expect(insertados.length).toBe(0);
  });

  test("si falla la transacción, NO se factura y no queda registro", async () => {
    modo = "failTransaction";
    const r = await registerOfferClick(CLIC);
    expect(r.facturable).toBe(false);
    expect(insertados.length).toBe(0);
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
