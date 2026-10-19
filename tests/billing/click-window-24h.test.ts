/**
 * T6 / punto 2 de docs/auditoria-2026-10-19.md
 *
 * "Bajo dos peticiones concurrentes con el mismo (oferta_id, telefono), se
 * factura una sola vez."
 *
 * El defecto: `registerOfferClick` hace un SELECT (¿hubo clic facturable en las
 * últimas 24 h?) y DESPUÉS un INSERT. Entre las dos sentencias hay una ventana:
 * dos clics simultáneos del mismo teléfono a la misma oferta ven los dos la
 * ventana libre, los dos devuelven `facturable: true`, y el llamador debita el
 * pack dos veces. El saldo del comercio baja por un clic que se cobró una sola.
 *
 * NO se arregla con un índice único en (oferta_id, telefono): la ventana es
 * móvil de 24 h, así que ese índice bloquearía el segundo cobro legítimo para
 * siempre. Y un índice parcial no puede llevar `now()` en el predicado, porque
 * los predicados de índice tienen que ser inmutables. Por eso el arreglo es
 * serializar por (oferta, teléfono) dentro de una transacción.
 *
 * Este test NO usa la capa HTTP: la garantía a probar es una propiedad de la
 * concurrencia contra la base, no de JavaScript. Un mock no puede demostrarla.
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
    `[ventana24h] SALTADO: no hay Postgres en ${CONFIG.host}/${CONFIG.database}. ` +
      "Ver el encabezado del archivo para levantarlo. Cero tests ejecutados.",
  );
}

async function prepararTabla() {
  await db.execute(sql`drop table if exists click_logs`);
  await db.execute(sql`
    create table click_logs (
      id text primary key,
      oferta_id text not null,
      comercio_id text not null,
      usuario_telefono text not null,
      codigo_canje text not null,
      facturable boolean default true,
      creado_en timestamp default now()
    )
  `);
}

async function filasFacturablesDe(ofertaId: string, telefono: string): Promise<number> {
  const r: any = await db.execute(sql`
    select count(*)::int as n from click_logs
     where oferta_id = ${ofertaId}
       and usuario_telefono = ${telefono}
       and facturable = true
  `);
  const filas = r?.rows ?? r;
  return Number(filas[0].n);
}

/** Inserta un clic facturable viejo, para simular que la ventana ya se usó. */
async function insertarClicViejo(ofertaId: string, telefono: string, horasAtras: number) {
  await db.execute(sql`
    insert into click_logs
      (id, oferta_id, comercio_id, usuario_telefono, codigo_canje, facturable, creado_en)
    values
      (${`clk_viejo_${Math.random().toString(36).slice(2, 8)}`}, ${ofertaId}, 'm1',
       ${telefono}, 'NV-VIEJO', true, now() - (${horasAtras} || ' hours')::interval)
  `);
}

beforeAll(async () => {
  if (!disponible) return;
  await prepararTabla();
  repo = await import("../../src/db/repo.ts");
});

describe.skipIf(!disponible)("ventana de facturación de 24 h (T6)", () => {
  test("20 clics concurrentes del mismo teléfono a la misma oferta -> exactamente 1 facturable", async () => {
    await prepararTabla();
    const ofertaId = "of_race";
    const telefono = "51999000111";

    const resultados = await Promise.all(
      Array.from({ length: 20 }, () =>
        repo.registerOfferClick({
          ofertaId,
          comercioId: "m1",
          usuarioTelefono: telefono,
          saldoDisponible: true,
        }),
      ),
    );

    const facturables = resultados.filter((r: any) => r.facturable).length;
    expect(facturables).toBe(1);
    expect(await filasFacturablesDe(ofertaId, telefono)).toBe(1);
  });

  test("la ventana se reabre pasadas las 24 h (el arreglo no bloquea el cobro legítimo)", async () => {
    await prepararTabla();
    const ofertaId = "of_reabre";
    const telefono = "51999000222";

    await insertarClicViejo(ofertaId, telefono, 25);

    const r = await repo.registerOfferClick({
      ofertaId,
      comercioId: "m1",
      usuarioTelefono: telefono,
      saldoDisponible: true,
    });

    expect(r.facturable).toBe(true);
    expect(await filasFacturablesDe(ofertaId, telefono)).toBe(2);
  });

  test("dentro de las 24 h no vuelve a facturar", async () => {
    await prepararTabla();
    const ofertaId = "of_dentro";
    const telefono = "51999000333";

    await insertarClicViejo(ofertaId, telefono, 23);

    const r = await repo.registerOfferClick({
      ofertaId,
      comercioId: "m1",
      usuarioTelefono: telefono,
      saldoDisponible: true,
    });

    expect(r.facturable).toBe(false);
    expect(await filasFacturablesDe(ofertaId, telefono)).toBe(1);
  });

  test("teléfonos distintos no se estorban entre sí", async () => {
    await prepararTabla();
    const ofertaId = "of_tels";

    const resultados = await Promise.all([
      repo.registerOfferClick({ ofertaId, comercioId: "m1", usuarioTelefono: "51999000444", saldoDisponible: true }),
      repo.registerOfferClick({ ofertaId, comercioId: "m1", usuarioTelefono: "51999000555", saldoDisponible: true }),
      repo.registerOfferClick({ ofertaId, comercioId: "m1", usuarioTelefono: "51999000666", saldoDisponible: true }),
    ]);

    expect(resultados.filter((r: any) => r.facturable).length).toBe(3);
  });

  test("sin saldo disponible no factura, aunque la ventana esté libre", async () => {
    await prepararTabla();
    const r = await repo.registerOfferClick({
      ofertaId: "of_sinsaldo",
      comercioId: "m1",
      usuarioTelefono: "51999000777",
      saldoDisponible: false,
    });

    expect(r.facturable).toBe(false);
  });

  test("una oferta distinta con el mismo teléfono sí factura", async () => {
    await prepararTabla();
    const telefono = "51999000888";

    const a = await repo.registerOfferClick({ ofertaId: "of_a", comercioId: "m1", usuarioTelefono: telefono, saldoDisponible: true });
    const b = await repo.registerOfferClick({ ofertaId: "of_b", comercioId: "m1", usuarioTelefono: telefono, saldoDisponible: true });

    expect(a.facturable).toBe(true);
    expect(b.facturable).toBe(true);
  });
});
