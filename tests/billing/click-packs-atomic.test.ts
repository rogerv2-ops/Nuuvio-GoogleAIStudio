/**
 * T4 / punto 3 de docs/auditoria-2026-10-19.md
 *
 * El débito de clics vivía en un `Map` en memoria y se persistía reescribiendo
 * el array completo (`saveSetting("click_packs_list", ...)`). Dos clics
 * concurrentes leían el mismo array, cada uno restaba en su copia y el último
 * write pisaba al otro: se perdía un débito. En producción eso ya pasó (3 clics
 * facturables, 2 descuentos persistidos).
 *
 * Este test NO usa la capa HTTP: habla con un Postgres real, porque la garantía
 * que hay que probar es una propiedad del SQL (atomicidad), no de JavaScript.
 * Un mock no puede demostrar atomicidad.
 *
 * Requiere una base descartable. NO apuntar a producción:
 *
 *   docker run -d --rm --name yuddit-test-pg -p 127.0.0.1:5432:5432 \
 *     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=yuddit_test postgres:16-alpine
 *   bun test tests/billing
 *
 * Se saltea solo si no hay base. Una suite verde sin base significa cero tests
 * ejecutados, así que el runner imprime si se salteó.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { sql } from "drizzle-orm";

const CONFIG = {
  host: process.env.TEST_SQL_HOST || "127.0.0.1",
  user: process.env.TEST_SQL_USER || "postgres",
  password: process.env.TEST_SQL_PASSWORD || "test",
  database: process.env.TEST_SQL_DB_NAME || "yuddit_test",
};

process.env.SQL_HOST = CONFIG.host;
process.env.SQL_USER = CONFIG.user;
process.env.SQL_PASSWORD = CONFIG.password;
process.env.SQL_DB_NAME = CONFIG.database;

let db: any;
let repo: typeof import("../../src/db/repo.ts");
let disponible = false;

try {
  const indice = await import("../../src/db/index.ts");
  db = indice.db;
  await db.execute(sql`select 1`);
  disponible = true;
} catch (err) {
  disponible = false;
}

if (!disponible) {
  console.warn(
    `[billing] SALTADO: no hay Postgres en ${CONFIG.host}/${CONFIG.database}. ` +
      "Ver el encabezado del archivo para levantarlo. Cero tests ejecutados.",
  );
}

async function prepararTabla() {
  await db.execute(sql`drop table if exists click_packs`);
  await db.execute(sql`
    create table click_packs (
      id text primary key,
      comercio_id text not null,
      total_clics integer not null,
      saldo_clics integer not null,
      precio_unitario numeric not null,
      monto_total numeric not null,
      estado text not null default 'activo',
      comprado_en text not null,
      created_at timestamp default now(),
      updated_at timestamp default now()
    )
  `);
}

async function insertarPack(p: {
  id: string;
  comercioId: string;
  total: number;
  saldo: number;
  compradoEn: string;
}) {
  await db.execute(sql`
    insert into click_packs
      (id, comercio_id, total_clics, saldo_clics, precio_unitario, monto_total, estado, comprado_en)
    values
      (${p.id}, ${p.comercioId}, ${p.total}, ${p.saldo}, '1.2', '120', 'activo', ${p.compradoEn})
  `);
}

async function saldoDe(id: string): Promise<number> {
  const r: any = await db.execute(sql`select saldo_clics from click_packs where id = ${id}`);
  const filas = r?.rows ?? r;
  return Number(filas[0].saldo_clics);
}

beforeAll(async () => {
  if (!disponible) return;
  await prepararTabla();
  repo = await import("../../src/db/repo.ts");
});

describe.skipIf(!disponible)("débito atómico de clics (T4)", () => {
  test("descuenta uno y devuelve el saldo restante", async () => {
    await prepararTabla();
    await insertarPack({ id: "p1", comercioId: "m1", total: 5, saldo: 5, compradoEn: "2026-01-01T00:00:00Z" });

    const r = await repo.debitarClicAtomico("m1");

    expect(r.exito).toBe(true);
    expect(r.saldoRestante).toBe(4);
    expect(await saldoDe("p1")).toBe(4);
  });

  test("NO sobrevende: 20 débitos concurrentes sobre 1 clic -> exactamente 1 éxito, saldo 0", async () => {
    await prepararTabla();
    await insertarPack({ id: "p1", comercioId: "m1", total: 1, saldo: 1, compradoEn: "2026-01-01T00:00:00Z" });

    const resultados = await Promise.all(
      Array.from({ length: 20 }, () => repo.debitarClicAtomico("m1")),
    );
    const exitos = resultados.filter((r: any) => r.exito).length;

    expect(exitos).toBe(1);
    expect(await saldoDe("p1")).toBe(0);
  });

  test("20 concurrentes sobre 5 clics -> exactamente 5 éxitos, saldo 0, nunca negativo", async () => {
    await prepararTabla();
    await insertarPack({ id: "p1", comercioId: "m1", total: 5, saldo: 5, compradoEn: "2026-01-01T00:00:00Z" });

    const resultados = await Promise.all(
      Array.from({ length: 20 }, () => repo.debitarClicAtomico("m1")),
    );
    const exitos = resultados.filter((r: any) => r.exito).length;
    const saldo = await saldoDe("p1");

    expect(exitos).toBe(5);
    expect(saldo).toBe(0);
    expect(saldo).toBeGreaterThanOrEqual(0);
  });

  test("varios packs: 20 concurrentes sobre 2 packs de 1 clic -> exactamente 2 exitos", async () => {
    await prepararTabla();
    await insertarPack({ id: "p1", comercioId: "m1", total: 1, saldo: 1, compradoEn: "2026-01-01T00:00:00Z" });
    await insertarPack({ id: "p2", comercioId: "m1", total: 1, saldo: 1, compradoEn: "2026-02-01T00:00:00Z" });

    const resultados = await Promise.all(
      Array.from({ length: 20 }, () => repo.debitarClicAtomico("m1")),
    );
    const exitos = resultados.filter((r: any) => r.exito).length;

    expect(exitos).toBe(2);
    expect(await saldoDe("p1")).toBe(0);
    expect(await saldoDe("p2")).toBe(0);
  });

  test("pack agotado: no debita y devuelve exito=false", async () => {    await prepararTabla();
    await insertarPack({ id: "p1", comercioId: "m1", total: 5, saldo: 0, compradoEn: "2026-01-01T00:00:00Z" });

    const r = await repo.debitarClicAtomico("m1");

    expect(r.exito).toBe(false);
    expect(await saldoDe("p1")).toBe(0);
  });

  test("consume primero el pack más viejo con saldo", async () => {
    await prepararTabla();
    await insertarPack({ id: "viejo", comercioId: "m1", total: 1, saldo: 1, compradoEn: "2026-01-01T00:00:00Z" });
    await insertarPack({ id: "nuevo", comercioId: "m1", total: 10, saldo: 10, compradoEn: "2026-06-01T00:00:00Z" });

    const r = await repo.debitarClicAtomico("m1");

    expect(r.exito).toBe(true);
    expect(r.packId).toBe("viejo");
    expect(await saldoDe("viejo")).toBe(0);
    expect(await saldoDe("nuevo")).toBe(10);
  });

  test("sembrar es idempotente: dos llamadas no duplican packs", async () => {
    await prepararTabla();
    const lista = [
      { id: "p1", comercioId: "m1", totalClics: 100, saldoClics: 80, precioUnitario: 1.2, montoTotal: 120, estado: "activo", compradoEn: "2026-10-01T10:00:00Z" },
    ];

    expect(await repo.sembrarClickPacksSiVacio(lista)).toBe(true);
    expect(await repo.sembrarClickPacksSiVacio(lista)).toBe(false);

    const r: any = await db.execute(sql`select count(*)::int as n from click_packs`);
    expect((r?.rows ?? r)[0].n).toBe(1);
    expect(await saldoDe("p1")).toBe(80);
  });

  test("listarClickPacks devuelve el shape de ClickPack con numeros, no strings", async () => {
    await prepararTabla();
    await insertarPack({ id: "p1", comercioId: "m1", total: 50, saldo: 34, compradoEn: "2026-10-05T09:00:00Z" });

    const packs = await repo.listarClickPacks();

    expect(packs).toHaveLength(1);
    expect(packs[0].comercioId).toBe("m1");
    expect(packs[0].saldoClics).toBe(34);
    expect(typeof packs[0].precioUnitario).toBe("number");
    expect(packs[0].precioUnitario).toBe(1.2);
  });
});
