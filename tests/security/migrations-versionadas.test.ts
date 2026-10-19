/**
 * Punto 5 de la auditoria: el esquema se aplica con MIGRACIONES versionadas
 * y revisadas, no con `drizzle-kit push` en cada arranque.
 *
 * Que vigila:
 *  1. El entrypoint ya no hace `push`: hace `migrate`.
 *  2. Las migraciones estan versionadas en el repo (journal + archivos).
 *  3. La migracion base cubre TODAS las tablas del esquema (si alguien agrega
 *     una tabla al esquema y no genera la migracion, esto se entera).
 *  4. Sobre una base nueva, `drizzle-kit migrate` crea el esquema completo.
 *
 * El punto 4 necesita una base: se usa la del runner de CI (SQL_*). Si no
 * hay, se salta avisando.
 */
import { test, expect, describe } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dir, "../..");
const ENTRYPOINT = fs.readFileSync(path.join(ROOT, "docker-entrypoint.sh"), "utf8");
const SCHEMA = fs.readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
const MIGRATIONS = path.join(ROOT, "src/db/migrations");
const JOURNAL = path.join(MIGRATIONS, "meta/_journal.json");

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
    await client.end().catch(() => {});
  }
}

const conBase = await hayBase();
if (!conBase) {
  console.warn(
    "[migrations] SALTADO: no hay Postgres en " + SQL.host + "/" + SQL.database +
      ". La prueba de migracion sobre base nueva no corrio."
  );
}

describe("migraciones versionadas (punto 5)", () => {
  test("el entrypoint YA NO hace push: hace migrate", () => {
    // Se miran solo las lineas que se EJECUTAN: el comentario del entrypoint
    // menciona el `push` viejo para explicar el cambio.
    const ejecutable = ENTRYPOINT.split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(ejecutable).toContain("drizzle-kit migrate");
    expect(ejecutable).not.toContain("drizzle-kit push");
    // el `yes ""` era para responder el prompt de `push`; con `migrate` no
    // hay prompt, asi que no debe quedar.
    expect(ejecutable).not.toContain('yes ""');
  });

  test("las migraciones estan versionadas en el repo", () => {
    expect(fs.existsSync(JOURNAL)).toBe(true);
    const journal = JSON.parse(fs.readFileSync(JOURNAL, "utf8"));
    expect(Array.isArray(journal.entries)).toBe(true);
    expect(journal.entries.length).toBeGreaterThan(0);
    for (const entry of journal.entries) {
      const archivo = path.join(MIGRATIONS, `${entry.tag}.sql`);
      expect(fs.existsSync(archivo), `falta el archivo de la migracion ${entry.tag}`).toBe(true);
    }
  });

  test("la migracion base cubre TODAS las tablas del esquema", () => {
    // Si alguien agrega una tabla al esquema y no genera la migracion, este
    // test falla: la tabla quedaria sin crearse en un entorno nuevo.
    const tablasEsquema = [...SCHEMA.matchAll(/pgTable\("([^"]+)"/g)].map((m) => m[1]);
    expect(tablasEsquema.length).toBeGreaterThan(0);

    const sqlMigraciones = fs
      .readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => fs.readFileSync(path.join(MIGRATIONS, f), "utf8"))
      .join("\n");
    const tablasMigracion = [...sqlMigraciones.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi)].map(
      (m) => m[1]
    );

    const faltantes = tablasEsquema.filter((t) => !tablasMigracion.includes(t));
    expect(faltantes, "tablas del esquema sin migracion: " + faltantes.join(", ")).toEqual([]);
  });
});

describe.skipIf(!conBase)("migraciones versionadas - sobre una base nueva", () => {
  test("drizzle-kit migrate crea el esquema completo en una base vacia", async () => {
    const nombre = "yuddit_migrate_test_" + Date.now();
    const admin = new pg.Client({ ...SQL, database: "postgres" });
    await admin.connect();
    await admin.query(`drop database if exists "${nombre}"`);
    await admin.query(`create database "${nombre}"`);
    await admin.end();

    try {
      execFileSync(
        path.join(ROOT, "node_modules/.bin/drizzle-kit"),
        ["migrate", "--config=src/db/drizzle.config.ts"],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, ...SQL, SQL_DB_NAME: nombre },
          stdio: "pipe",
        }
      );

      const client = new pg.Client({ ...SQL, database: nombre });
      await client.connect();
      const tablas = await client.query(
        `select tablename from pg_tables where schemaname='public' order by tablename`
      );
      const registradas = await client.query(
        `select count(*)::int as n from drizzle.__drizzle_migrations`
      );
      await client.end();

      const nombres = tablas.rows.map((r) => r.tablename);
      // el esquema completo: las 13 tablas del esquema
      for (const esperada of ["app_settings", "auth_users", "click_packs", "click_logs", "offers", "sessions"]) {
        expect(nombres, "falta la tabla " + esperada).toContain(esperada);
      }
      expect(tablas.rowCount).toBeGreaterThanOrEqual(13);
      // y la migracion quedo registrada
      expect(registradas.rows[0].n).toBeGreaterThanOrEqual(1);
    } finally {
      const admin = new pg.Client({ ...SQL, database: "postgres" });
      await admin.connect();
      await admin.query(`drop database if exists "${nombre}"`);
      await admin.end();
    }
  }, 60000);
});
