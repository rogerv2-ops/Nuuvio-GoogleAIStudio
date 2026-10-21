/**
 * El activador de provincias del panel de gestion.
 *
 * Lo pidio el dueno (2026-10-21): "necesito un activador de provincias en el
 * panel de gestion, para ir activando a medida que yuddit se expande, pero
 * solo por provincias es necesario".
 *
 * Por que la unidad es la PROVINCIA y no el distrito:
 *  - La zona de SERVICIO de Yuddit es la provincia (el distrito es la
 *    ubicacion de la persona dentro de una provincia activa).
 *  - En el Peru hay 99 nombres de distrito repetidos ("Santa Rosa" x10,
 *    "Miraflores" x4), asi que la clave real es el codigo ubigeo.
 *
 * Y la razon de fondo del interruptor: "Lima primero" tiene que ser un
 * DATO que el negocio enciende, no una suposicion escrita en el codigo.
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, post } from "./_helpers.ts";
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

describe("Zonas: el activador de provincias", () => {
  test.skipIf(!online)("Z1: el listado de provincias es publico y trae la jerarquia", async () => {
    const r = await fetch(`${BASE}/api/geo/provincias`);
    expect(r.status).toBe(200);
    const cuerpo: any = await r.json();
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.provincias.length).toBe(196);
    // Cada provincia dice de que departamento es y cuantos distritos tiene.
    const conDatos = cuerpo.provincias.filter(
      (p: any) => p.departamentoNombre && typeof p.totalDistritos === "number",
    );
    expect(conDatos.length).toBe(196);
  });

  test.skipIf(!online || !hayAdmin)(
    "Z2: activar una provincia la enciende y desactivarla la apaga",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      // Una provincia que NO es la de Lima, para no tocar la zona en curso.
      const codigo = "040100"; // Arequipa, provincia

      const activar = await post(
        "/api/geo/provincias/activar",
        { codigo, activo: true },
        token,
      );
      expect(activar.status).toBe(200);
      const cuerpo: any = await activar.json();
      expect(cuerpo.ok).toBe(true);
      expect(cuerpo.activo).toBe(true);
      expect(cuerpo.mensaje).toContain("Arequipa");

      const listar = await fetch(`${BASE}/api/geo/provincias`);
      const provincias: any = await listar.json();
      const Arequipa = provincias.provincias.find((p: any) => p.codigo === codigo);
      expect(Arequipa.activo).toBe(true);
      // Y sus distritos son los de su provincia (jerarquia provincia ->
      // distrito, sin coordenadas).
      expect(Arequipa.totalDistritos).toBeGreaterThan(0);

      // Y se apaga otra vez.
      const desactivar = await post(
        "/api/geo/provincias/activar",
        { codigo, activo: false },
        token,
      );
      expect(desactivar.status).toBe(200);
      const despues: any = await desactivar.json();
      expect(despues.activo).toBe(false);
    },
  );

  test.skipIf(!online)("Z3: activar una provincia exige sesion de administrador", async () => {
    const r = await fetch(`${BASE}/api/geo/provincias/activar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: "040100", activo: true }),
    });
    expect(r.status).toBe(401);
  });

  test.skipIf(!online || !hayAdmin)("Z4: un codigo de provincia invalido se rechaza", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const r = await post("/api/geo/provincias/activar", { codigo: "no-existe", activo: true }, token);
    expect(r.status).toBe(400);
  });

  test.skipIf(!conBase)(
    "Z5: en la base, SOLO las provincias se activan (nunca un distrito suelto)",
    async () => {
      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const distritos = await client.query(
          "select count(*)::int as n from geo_territorios where nivel = 'distrito' and activo = true",
        );
        expect(Number(distritos.rows[0].n)).toBe(0);

        const provincias = await client.query(
          "select count(*)::int as n from geo_territorios where nivel = 'provincia' and activo = true",
        );
        expect(Number(provincias.rows[0].n)).toBeGreaterThan(0);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );
});
