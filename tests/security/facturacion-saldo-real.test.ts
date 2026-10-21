/**
 * El saldo de clics del comercio se lee de la BASE, no de una semilla.
 *
 * Que paso (2026-10-21, medido por el dueno revisando el panel):
 * la tabla `click_packs` de produccion decia 80 / 70 / 34 clics y la
 * pantalla decia 81 / 72 / 34.
 *
 * La causa: `facturacionModule` no puede tocar la base desde el navegador
 * (guarda deliberada: si importara el Pool de Postgres en el bundle, la SPA
 * quedaria en blanco y el sitio entero muriera). Sin una fuente de verdad en
 * el navegador, su cache se quedaba con la SEMILLA de
 * `src/data/seedData.ts` y el panel mostraba un saldo que no era el del
 * comercio.
 *
 * Consecuencia de negocio: el comercio veia un saldo equivocado (y el admin
 * tambien, en "Campanas y Cobro"). Con un saldo inventado no se sabe cuanto
 * se vendio ni cuanto queda.
 *
 * Estos tests son de CONTRATO HTTP contra el servidor real.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";
import pg from "pg";

const ROOT = path.resolve(import.meta.dir, "../..");

const SQL = {
  host: process.env.SQL_HOST || "127.0.0.1",
  user: process.env.SQL_USER || "postgres",
  password: process.env.SQL_PASSWORD || "test",
  database: process.env.SQL_DB_NAME || "yuddit_test",
};

async function hayBase(): Promise<boolean> {
  const client = new pg.Client(SQL);
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);
const conBase = await hayBase();

describe("Facturacion: el saldo se lee de la base", () => {
  test("F1: existe el endpoint que devuelve los packs", () => {
    const SERVER = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
    const RUTAS = fs.readFileSync(path.join(ROOT, "src/routes/facturacion.ts"), "utf8");
    expect(RUTAS).toContain("/api/facturacion/packs");
    expect(SERVER).toContain("registrarRutasFacturacion");
  });

  test("F2: el navegador NO siembra el saldo (la semilla es solo del servidor)", () => {
    const MODULO = fs.readFileSync(path.join(ROOT, "src/modules/facturacion.ts"), "utf8");
    // En el navegador el cache arranca vacio y se llena desde la API.
    expect(MODULO).toContain("estaEnNavegador");
    expect(MODULO).toContain("recargarCacheDesdeApi");
    // Y si la API falla, el cache queda vacio: NO conserva la semilla, porque
    // un saldo inventado es peor que un saldo en cero.
    expect(MODULO).toContain("this.packs.clear()");
    expect(MODULO).toContain("_cargado = false");
  });

  test.skipIf(!online || !hayAdmin || !conBase)(
    "F3: el endpoint devuelve EXACTAMENTE el saldo de la tabla click_packs",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const enBase = await client.query(
          "select id, comercio_id, saldo_clics, estado from click_packs order by id",
        );

        const res = await get("/api/facturacion/packs", token);
        expect(res.status).toBe(200);
        const cuerpo: any = await res.json();
        expect(cuerpo.ok).toBe(true);
        expect(cuerpo.origen).toBe("base");
        expect(Array.isArray(cuerpo.packs)).toBe(true);

        const packs = cuerpo.packs as any[];
        expect(packs.length).toBe(enBase.rows.length);

        for (const fila of enBase.rows) {
          const pack = packs.find((p: any) => p.id === fila.id);
          expect(pack, `falta el pack ${fila.id}`).toBeTruthy();
          // El numero que se muestra tiene que ser EL de la base.
          expect(Number(pack.saldoClics)).toBe(Number(fila.saldo_clics));
        }

        // Y el saldo total es la suma de los packs activos, sin invenciones.
        const esperado = enBase.rows
          .filter((f: any) => f.estado === "activo")
          .reduce((acc: number, f: any) => acc + Number(f.saldo_clics), 0);
        expect(Number(cuerpo.saldoTotal)).toBe(esperado);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );

  test.skipIf(!online || !hayAdmin)(
    "F4: sin sesion no se puede ver ningun saldo",
    async () => {
      const res = await fetch(`${BASE}/api/facturacion/packs`);
      expect(res.status).toBe(401);
    },
  );
});
