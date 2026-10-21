/**
 * Los KPIs del panel se miden en la BASE, no se inventan.
 *
 * Que se midio (2026-10-21, revisando el panel del dueno): el modulo de
 * analitica calculaba los KPI con `coreEvents` (eventos EN MEMORIA del
 * navegador) y con minimos inventados puestos a mano:
 *
 *   usuariosRegistrados: Math.max(usuarios, 240)
 *   totalVistasOfertas:  Math.max(mostradas, 625)
 *   totalClicsContactar: Math.max(clics, 85)
 *   ventasConfirmadas:   Math.max(ventas, 12)
 *   ctrPromedioGlobal:   ctr > 0 ? ctr : 13.6
 *   comerciosActivos:    4
 *   ofertasActivas:      4
 *   tiempoMedianoValidacionHoras: 2.5
 *
 * Con la base VACIA el panel se veia lleno. En produccion se medio: la base
 * tenia 0 usuarios, 0 vistas y 0 ventas, y el panel mostraba 240, 625 y 12.
 *
 * Ahora los mide el servidor y lo que no se puede medir es `null` (la
 * pantalla dice "sin medir"). Este test comprueba que lo que devuelve el
 * endpoint COINCIDE con lo que hay en la base.
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, get } from "./_helpers.ts";
import pg from "pg";

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

describe("Analitica: los KPIs del panel dicen la verdad", () => {
  test.skipIf(!online || !hayAdmin || !conBase)(
    "K1: los KPIs globales coinciden EXACTAMENTE con la base",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const r = await client.query(`
          select
            (select count(*)::int from click_logs) as clics,
            (select count(*)::int from click_logs where facturable = true) as leads,
            (select count(*)::int from audience_users) as usuarios,
            (select count(*)::int from offers) as ofertas,
            (select count(*)::int from offers where estado = 'activa') as ofertas_activas
        `);
        const fila = r.rows[0];

        const res = await get("/api/analitica/kpis", token);
        expect(res.status).toBe(200);
        const cuerpo: any = await res.json();
        expect(cuerpo.ok).toBe(true);
        expect(cuerpo.alcance).toBe("global");
        const m = cuerpo.metricas;

        // Que el panel diga lo que hay, no un minimo inventado.
        expect(Number(m.totalClicsContactar)).toBe(Number(fila.clics));
        expect(Number(m.leadsCalificados)).toBe(Number(fila.leads));
        expect(Number(m.usuariosRegistrados)).toBe(Number(fila.usuarios));
        expect(Number(m.ofertasActivas)).toBeLessThanOrEqual(Number(fila.ofertas_activas));
        expect(Number(m.ofertasActivas)).toBeGreaterThanOrEqual(0);

        // Lo que NO se puede medir es null, no un numero inventado.
        expect(m.ventasConfirmadas).toBeNull();
        expect(m.tiempoMedianoValidacionHoras).toBeNull();
        // Las vistas no se incrementan en ningun lado: o hay vistas, o null.
        if (Number(m.totalVistasOfertas) === 0) expect(m.totalVistasOfertas).toBeNull();
        if (m.ctrPromedioGlobal !== null) expect(m.ctrPromedioGlobal).toBeGreaterThanOrEqual(0);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );

  test.skipIf(!online || !hayAdmin)(
    "K2: sin sesion no se ve ningun KPI",
    async () => {
      const res = await fetch(`${BASE}/api/analitica/kpis`);
      expect(res.status).toBe(401);
    },
  );

  test.skipIf(!online || !hayAdmin)(
    "K3: los KPIs de un comercio se piden con su id",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      const res = await get("/api/analitica/kpis?comercioId=merch_01", token);
      expect(res.status).toBe(200);
      const cuerpo: any = await res.json();
      expect(cuerpo.ok).toBe(true);
      expect(cuerpo.alcance).toBe("comercio");
      expect(cuerpo.metricas.comercioId).toBe("merch_01");
      expect(Number(cuerpo.metricas.clicsTotales ?? cuerpo.metricas.totalClicsContactar)).toBeGreaterThanOrEqual(0);
    },
  );

  test("K4: el modulo del panel NO tiene minimos inventados", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raiz = path.resolve(import.meta.dir, "../..");
    const modulo = fs.readFileSync(path.join(raiz, "src/modules/analitica.ts"), "utf8");

    // Ningun KPI con un minimo inventado.
    expect(modulo).not.toMatch(/Math\.max\(\s*\w+\s*,\s*\d+\s*\)/);
    expect(modulo).not.toMatch(/\|\|\s*\d{2,}\s*[,}]/);
    // Y se leen del servidor.
    expect(modulo).toContain("/api/analitica/kpis");
    expect(modulo).not.toContain("coreEvents.consultar");
  });
});
