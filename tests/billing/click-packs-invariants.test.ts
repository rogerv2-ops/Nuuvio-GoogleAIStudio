/**
 * T4 / S3 — invariantes del débito atómico.
 *
 * Estas sondas las escribió un verificador independiente que NO implementó el
 * cambio (ver `odd/tasks/auditoria-12-puntos.md`, L11). Se commitean como tests
 * de regresión porque cubren las propiedades que un revisor futuro tiene que
 * poder romper a propósito para darse cuenta:
 *
 *  - el saldo NUNCA queda negativo, y la suma de saldos = inicial − éxitos;
 *  - el guard del `UPDATE` es load-bearing (se prueba la versión SIN guard y se
 *    afirma que sí sobregira: si algún día Postgres cambiara ese comportamiento,
 *    este test avisa en vez de dejar el guard como ruido);
 *  - el reintento de `debitarClicAtomico` no pierde débitos que sí tenían saldo;
 *  - la migración siembra solo si la tabla está vacía y nunca pisa saldos reales;
 *  - el cache de lectura nunca queda por encima del SQL;
 *  - `comprarPack` devuelve una promesa, así que sus llamadores DEBEN esperarla
 *    (la capa React no la typechequea `tsc`; ver el `include` de `tsconfig.json`).
 *
 * Requiere un Postgres descartable. NO apuntar a producción:
 *
 *   docker run -d --rm --name yuddit-test-pg -p 127.0.0.1:5432:5432 \
 *     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=yuddit_test postgres:16-alpine
 *   bun test tests/billing
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { sql } from "drizzle-orm";

process.env.SQL_HOST ??= process.env.TEST_SQL_HOST ?? "127.0.0.1";
process.env.SQL_USER ??= process.env.TEST_SQL_USER ?? "postgres";
process.env.SQL_PASSWORD ??= process.env.TEST_SQL_PASSWORD ?? "test";
process.env.SQL_DB_NAME ??= process.env.TEST_SQL_DB_NAME ?? "yuddit_test";

let db: any;
let repo: any;
let disponible = false;

try {
  db = (await import("../../src/db/index.ts")).db;
  await db.execute(sql`select 1`);
  disponible = true;
} catch {
  console.warn("[billing] SALTADO: sin Postgres alcanzable. Cero tests ejecutados.");
}

const filas = (r: any) => r?.rows ?? r;

async function crearTabla() {
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

async function insertarPack(id: string, comercio: string, total: number, saldo: number, fecha: string) {
  await db.execute(sql`
    insert into click_packs (id, comercio_id, total_clics, saldo_clics, precio_unitario, monto_total, estado, comprado_en)
    values (${id}, ${comercio}, ${total}, ${saldo}, '1.2', '120', 'activo', ${fecha})
  `);
}

async function tabla(): Promise<Record<string, number>> {
  const saldos: Record<string, number> = {};
  for (const f of filas(await db.execute(sql`select id, saldo_clics from click_packs`))) {
    saldos[f.id] = Number(f.saldo_clics);
  }
  return saldos;
}

async function cantidadNegativos(): Promise<number> {
  return Number(filas(await db.execute(sql`select count(*)::int n from click_packs where saldo_clics < 0`))[0].n);
}

const BLOB = {
  id: "pack_01",
  comercioId: "merch_01",
  totalClics: 100,
  saldoClics: 80,
  precioUnitario: 1.2,
  montoTotal: 120,
  estado: "activo",
  compradoEn: "2026-10-01T10:00:00Z",
};

beforeAll(async () => {
  if (disponible) repo = await import("../../src/db/repo.ts");
});

describe.skipIf(!disponible)("S3 — invariantes del débito atómico", () => {
  test("INVARIANTE: ningún saldo negativo y suma = inicial − éxitos (3 packs, 40 concurrentes)", async () => {
    await crearTabla();
    await insertarPack("a", "m1", 3, 3, "2026-01-01T00:00:00Z");
    await insertarPack("b", "m1", 2, 2, "2026-02-01T00:00:00Z");
    await insertarPack("c", "m1", 1, 1, "2026-03-01T00:00:00Z");

    const r: any[] = await Promise.all(Array.from({ length: 40 }, () => repo.debitarClicAtomico("m1")));
    const exitos = r.filter(x => x.exito).length;
    const saldos = await tabla();

    expect(exitos).toBe(6);
    expect(Object.values(saldos).reduce((x, y) => x + y, 0)).toBe(6 - exitos);
    expect(await cantidadNegativos()).toBe(0);
  });

  test("el guard del UPDATE es load-bearing: SIN él el saldo sí queda negativo", async () => {
    await crearTabla();
    await insertarPack("p1", "m1", 5, 5, "2026-01-01T00:00:00Z");

    // Réplica exacta de la versión ingenua (sin el `AND saldo_clics > 0` externo).
    const sinGuard = sql`
      UPDATE click_packs SET saldo_clics = saldo_clics - 1, updated_at = now()
       WHERE id = (
         SELECT id FROM click_packs
          WHERE comercio_id = 'm1' AND saldo_clics > 0
          ORDER BY comprado_en ASC, id ASC
          LIMIT 1
       )
      RETURNING id, saldo_clics`;

    const res: any[] = await Promise.all(Array.from({ length: 20 }, () => db.execute(sinGuard)));
    const afectadas = res.filter(x => filas(x).length > 0).length;

    expect(afectadas).toBeGreaterThan(5);
    expect((await tabla()).p1).toBeLessThan(0);
  });

  test("el reintento no pierde débitos con saldo: k packs de 1 clic, 30 concurrentes", async () => {
    for (const k of [3, 8]) {
      await crearTabla();
      for (let i = 0; i < k; i++) await insertarPack(`p${i}`, "m1", 1, 1, `2026-01-0${i + 1}T00:00:00Z`);

      const r: any[] = await Promise.all(Array.from({ length: 30 }, () => repo.debitarClicAtomico("m1")));

      expect(r.filter(x => x.exito).length).toBe(k);
      expect(await cantidadNegativos()).toBe(0);
    }
  });

  test("migración: siembra solo si está vacía y nunca pisa saldos reales", async () => {
    const { facturacionModule } = await import("../../src/modules/facturacion.ts");

    await crearTabla();
    await facturacionModule.inicializar([BLOB] as any);
    expect(await tabla()).toEqual({ pack_01: 80 });

    // Con la tabla ya poblada, el blob legacy NO debe pisar el saldo real.
    await crearTabla();
    await insertarPack("pack_01", "merch_01", 100, 5, "2026-10-01T10:00:00Z");
    await facturacionModule.inicializar([BLOB] as any);
    expect(await tabla()).toEqual({ pack_01: 5 });

    // Dos arranques concurrentes no duplican.
    await crearTabla();
    await Promise.all([facturacionModule.inicializar([BLOB] as any), facturacionModule.inicializar([BLOB] as any)]);
    expect(Object.keys(await tabla()).length).toBe(1);
  });

  test("la siembra es todo-o-nada: una entrada inválida no deja la migración a medias", async () => {
    await crearTabla();
    const mala: any[] = [
      { ...BLOB, id: "ok1" },
      { ...BLOB, id: "mala", saldoClics: null },
      { ...BLOB, id: "ok2" },
    ];

    expect(await repo.sembrarClickPacksSiVacio(mala)).toBe(false);
    expect(Object.keys(await tabla()).length).toBe(0);
    // Y el reintento con datos válidos funciona.
    expect(await repo.sembrarClickPacksSiVacio([BLOB])).toBe(true);
    expect(await tabla()).toEqual({ pack_01: 80 });
  });

  test("el cache de lectura nunca queda por encima del SQL", async () => {
    const { facturacionModule } = await import("../../src/modules/facturacion.ts");

    await crearTabla();
    await facturacionModule.inicializar([BLOB] as any);
    const r: any[] = await Promise.all(
      Array.from({ length: 20 }, () => facturacionModule.debitarClic("merch_01")),
    );
    const enSql = (await tabla()).pack_01;

    expect(enSql).toBe(80 - r.filter(x => x.exito).length);

    const enCache = Number(facturacionModule.listarTodosLosPacks()[0].saldoClics);
    expect(enCache).toBeLessThanOrEqual(enSql);
  });

  test("CONTRATO: comprarPack es async, así que sus llamadores deben esperarla", async () => {
    const { facturacionModule } = await import("../../src/modules/facturacion.ts");

    await crearTabla();
    const promesa: any = facturacionModule.comprarPack({
      comercioId: "merch_01",
      cantidadClics: 100,
      metodoPago: "yape_plin",
    } as any);

    // Si esto deja de ser una promesa, la capa React (que `tsc` NO revisa, ver
    // `include` en tsconfig.json) puede volver a leer campos de la promesa.
    expect(typeof promesa?.then).toBe("function");
    expect((await promesa).totalClics).toBe(100);
  });
});
