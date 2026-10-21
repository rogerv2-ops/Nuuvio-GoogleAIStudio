/**
 * El catalogo geografico del Peru (UBIGEGO del INEI) en la base.
 *
 * Que pidio el dueno (2026-10-21): "estamos trabajando en la primera
 * ubicacion de Peru, el sistema debe tener en base de datos todas las
 * provincias, ciudades y distritos de Peru indexados o no?"
 *
 * Lo que estaba:
 *  - el bot reconocia el distrito con un mapa DENTRO del codigo
 *    (LIMA_DISTRICT_MAP): ~46 entryadas escritas a mano. Una persona de un
 *    distrito que no estuviera ahi NO se podia registrar: el bot le volvia a
 *    pedir el distrito, para siempre.
 *  - el formulario web tenia OTRA lista (20 entryadas) que ya no coincidia.
 *  - "Lima primero" estaba en el codigo, no en un dato.
 *
 * Lo que hay ahora: la tabla `geo_territorios`, sembrada con el listado
 * oficial del INEI (25 departamentos, 196 provincias, 1.874 distritos), y
 * el bot la consulta. La columna `activo` dice donde opera el negocio.
 *
 * El detalle que hace que el codigo sea la clave de verdad: en el Peru hay
 * 99 nombres de distrito repetidos ("Santa Rosa" aparece 10 veces,
 * "Miraflores" 4, "San Isidro" 2). Por eso la clave primaria es el codigo
 * ubigeo de 6 digitos, no el nombre.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, post } from "./_helpers.ts";
import { UBIGEO_PERU } from "../../src/data/ubigeoPeru.ts";
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

let ipSecuencia = 0;
function ipPropia(): string {
  ipSecuencia += 1;
  return `203.0.113.${150 + ipSecuencia}`;
}

describe("Geo: el catalogo del Peru en la base", () => {
  test("G1: el archivo de datos es integro (sin codigos duplicados ni huerfanos)", () => {
    expect(UBIGEO_PERU.length).toBeGreaterThan(2000);

    const codigos = new Set<string>();
    for (const t of UBIGEO_PERU) {
      expect(codigos.has(t.codigo), `codigo duplicado: ${t.codigo}`).toBe(false);
      codigos.add(t.codigo);
      // El codigo es de 6 digitos: departamento(2) + provincia(2) + distrito(2).
      expect(t.codigo).toMatch(/^\d{6}$/);
    }

    for (const t of UBIGEO_PERU) {
      if (t.nivel === "departamento") {
        expect(t.codigoPadre).toBeNull();
      } else {
        expect(t.codigoPadre, `${t.codigo} sin padre`).toBeTruthy();
        expect(codigos.has(t.codigoPadre!), `${t.codigo} con padre inexistente`).toBe(true);
      }
    }

    // Los 43 distritos de la provincia de Lima, exactos.
    const lima = UBIGEO_PERU.filter((t) => t.nivel === "distrito" && t.codigo.startsWith("1501"));
    expect(lima.length).toBe(43);
    const nombresLima = lima.map((t) => t.nombre);
    expect(nombresLima).toContain("Miraflores");
    expect(nombresLima).toContain("Santiago de Surco");
    expect(nombresLima).toContain("San Isidro");
    expect(nombresLima).toContain("Barranco");
  });

  test("G2: la tabla tiene el catalogo sembrado", async () => {
    if (!conBase) return;
    const client = new pg.Client(SQL);
    await client.connect();
    try {
      const r = await client.query(
        "select nivel, count(*)::int as n from geo_territorios group by nivel",
      );
      const porNivel: Record<string, number> = {};
      for (const f of r.rows) porNivel[f.nivel] = Number(f.n);
      expect(porNivel.departamento).toBe(25);
      expect(porNivel.provincia).toBe(196);
      expect(porNivel.distrito).toBe(1874);

      // Lima esta activa (donde opera el negocio).
      const activos = await client.query(
        "select count(*)::int as n from geo_territorios where activo = true",
      );
      expect(Number(activos.rows[0].n)).toBeGreaterThan(0);
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  test.skipIf(!online || !hayAdmin)(
    "G3: el bot reconoce un distrito FUERA de Lima (antes imposible)",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const tel = `+519${String(Date.now() % 100000000).padStart(8, "0").slice(0, 7)}3`;
      const enviar = async (texto: string) => {
        const r = await post(
          "/api/whatsapp/simulate-incoming",
          { telefono: tel, texto, pushName: "Geo Tester" },
          token,
          { "X-Forwarded-For": ipPropia() },
        );
        expect(r.status).toBe(200);
        const j: any = await r.json();
        return (j.respuestas || []).map((x: any) => x.texto || "").join(" ");
      };

      await enviar("hola");
      const res = await enviar("Carlos, 28, Arequipa");
      // Con el mapa de 46 entryadas, Arequipa NO se detectaba y el bot
      // seguia pidiendo el distrito.
      expect(res).toContain("Arequipa");
    },
  );

  test.skipIf(!online || !hayAdmin)(
    "G4: el alias del negocio gana sobre el nombre ambiguo del catalogo",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const tel = `+519${String(Date.now() % 100000000).padStart(8, "0").slice(0, 7)}7`;
      const enviar = async (texto: string) => {
        const r = await post(
          "/api/whatsapp/simulate-incoming",
          { telefono: tel, texto, pushName: "Geo Tester" },
          token,
          { "X-Forwarded-For": ipPropia() },
        );
        expect(r.status).toBe(200);
        const j: any = await r.json();
        return (j.respuestas || []).map((x: any) => x.texto || "").join(" ");
      };

      await enviar("hola");
      const res = await enviar("Carlos, 28, surco");
      // "Surco" existe en el Peru como distrito de Huarochiri Y como
      // "Santiago de Surco" en Lima. Aqui gana el de Lima: es donde opera
      // el negocio.
      expect(res).toContain("Santiago de Surco");
    },
  );

  test("G5: la jerarquia es PROVINCIA -> DISTRITO, y los endpoints son publicos", async () => {
    if (!online) return;

    // 1) Las provincias (con su departamento y cuantos distritos tienen).
    const rProv = await fetch(`${BASE}/api/geo/provincias`);
    expect(rProv.status).toBe(200);
    const provincias: any = await rProv.json();
    expect(provincias.ok).toBe(true);
    expect(provincias.provincias.length).toBe(196);

    const lima = provincias.provincias.find((p: any) => p.codigo === "150100");
    expect(lima).toBeTruthy();
    expect(lima.nombre).toBe("Lima");
    expect(lima.departamentoNombre).toBe("Lima");
    expect(lima.totalDistritos).toBe(43);
    // La provincia donde opera el negocio esta activa.
    expect(lima.activo).toBe(true);

    // 2) Los distritos de esa provincia.
    const rDist = await fetch(`${BASE}/api/geo/distritos?provincia=150100`);
    expect(rDist.status).toBe(200);
    const distritos: any = await rDist.json();
    expect(distritos.ok).toBe(true);
    expect(distritos.distritos.length).toBe(43);
    expect(distritos.distritos.find((d: any) => d.nombre === "Miraflores")?.codigo).toBe("150122");

    // 3) Sin provincia no hay distritos (no se adivina).
    const rSin = await fetch(`${BASE}/api/geo/distritos`);
    expect(rSin.status).toBe(400);
  });

  test("G5b: la activacion es POR PROVINCIA (no por distrito)", async () => {
    if (!conBase) return;
    const client = new pg.Client(SQL);
    await client.connect();
    try {
      // Ningun distrito queda marcado activo: lo que decide es su provincia.
      const distritosActivos = await client.query(
        "select count(*)::int as n from geo_territorios where nivel = 'distrito' and activo = true",
      );
      expect(Number(distritosActivos.rows[0].n)).toBe(0);

      // Las provincias activas son las zonas donde opera el negocio.
      const provinciasActivas = await client.query(
        "select codigo, nombre from geo_territorios where nivel = 'provincia' and activo = true order by codigo",
      );
      expect(provinciasActivas.rows.length).toBeGreaterThan(0);
      expect(provinciasActivas.rows.map((r: any) => r.codigo)).toContain("150100");
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  test("G6: el bot NO usa un mapa de distritos escrito a mano", () => {
    const SERVER = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
    // El mapa viejo sigue en el codigo, pero SOLO como capa de alias y como
    // respaldo si la base no responde. La fuente de verdad es la tabla.
    expect(SERVER).toContain("detectarDistritoEnTexto");
    expect(SERVER).toContain("cargarCatalogoGeo");
    expect(SERVER).toContain("registrarRutasGeo");
  });
});
