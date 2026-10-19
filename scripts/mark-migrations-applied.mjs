#!/usr/bin/env node
/**
 * Marca las migraciones de `src/db/migrations` como YA APLICADAS en una base
 * que todavia tiene el esquema puesto con `drizzle-kit push`.
 *
 * POR QUE EXISTE: hoy el esquema de produccion se puso con `push`, que no
 * deja registro de que se aplico. Cuando se passa a migraciones versionadas,
 * la migracion base (que crea las tablas) intentaria crearlas de nuevo y
 * fallaria. La salida: insertar en `drizzle.__drizzle_migrations` la fila de
 * la migracion base, con el `created_at` que dice el journal.
 *
 * COMO DECIDE DRIZZLE: el migrator lee SOLO la ultima fila aplicada
 * (`order by created_at desc limit 1`) y aplica toda migracion cuyo
 * `folderMillis` (el `when` del journal) sea MAYOR. No compara el hash. Por
 * eso, con la base marcada, la migracion base no se aplica y las siguientes
 * si.
 *
 * SEGURIDAD: antes de marcar nada, el script comprueba que las tablas de la
 * migracion EXISTEN de verdad. Si no existen, se aborta: marcar una
 * migracion sobre una base vacia dejaria el esquema sin crear para siempre.
 *
 * Uso:
 *   SQL_HOST=... SQL_USER=... SQL_PASSWORD=... SQL_DB_NAME=... \
 *     bun scripts/mark-migrations-applied.mjs [--dry-run]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "src/db/migrations");
const JOURNAL = path.join(MIGRATIONS_DIR, "meta/_journal.json");

const host = process.env.SQL_HOST || "127.0.0.1";
const user = process.env.SQL_USER || "postgres";
const password = process.env.SQL_PASSWORD || "test";
const database = process.env.SQL_DB_NAME || "nuuviopsg";
const dryRun = process.argv.includes("--dry-run");

if (!fs.existsSync(JOURNAL)) {
  console.error(`[migrations] No existe ${JOURNAL}. Genera las migraciones con:`);
  console.error("  bunx drizzle-kit generate --config=src/db/drizzle.config.ts");
  process.exit(2);
}

const journal = JSON.parse(fs.readFileSync(JOURNAL, "utf8"));
const entries = journal.entries || [];

const client = new Client({ host, user, password, database });

/** Tablas que crea cada archivo de migracion (para verificar que existen). */
function tablasDe(sql) {
  const out = [];
  const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi;
  let m = null;
  while ((m = re.exec(sql)) !== null) out.push(m[1]);
  return out;
}

try {
  await client.connect();

  console.log(`[migrations] ${entries.length} migracion(es) en el journal.`);

  // 1) Verificar que el esquema esta de verdad en la base.
  const existentes = new Set();
  const faltantes = [];
  for (const entry of entries) {
    const file = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    const sql = fs.readFileSync(file, "utf8");
    for (const tabla of tablasDe(sql)) {
      const r = await client.query(
        `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
        [tabla]
      );
      if (r.rowCount) existentes.add(tabla);
      else faltantes.push(tabla);
    }
  }

  if (faltantes.length > 0) {
    console.error(
      "[migrations] FALLO: estas tablas no existen en la base, asi que NO se puede marcar " +
        "la migracion como aplicada (quedaria el esquema sin crear para siempre): " +
        faltantes.join(", ")
    );
    process.exit(1);
  }
  console.log("[migrations] El esquema esta en la base: se puede marcar la migracion.");

  // 2) Estado actual de la tabla de migraciones.
  await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
       id SERIAL PRIMARY KEY,
       hash text NOT NULL,
       created_at bigint
     )`
  );
  const aplicadas = await client.query(
    `select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc`
  );
  console.log(`[migrations] Migraciones ya registradas: ${aplicadas.rowCount}.`);

  // 3) Marcar las que falten (el migrator solo mira la ultima por created_at).
  const ultima = aplicadas.rowCount
    ? Number(aplicadas.rows[aplicadas.rowCount - 1].created_at)
    : 0;

  for (const entry of entries) {
    if (Number(entry.when) <= ultima) {
      console.log(`  - ${entry.tag}: ya esta aplicada (when ${entry.when})`);
      continue;
    }
    const file = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    const sql = fs.readFileSync(file, "utf8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex");
    if (dryRun) {
      console.log(
        `  - ${entry.tag}: se marcaria como aplicada (hash ${hash.slice(0, 12)}…, when ${entry.when})`
      );
      continue;
    }
    await client.query(
      `insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)`,
      [hash, Number(entry.when)]
    );
    console.log(
      `  - ${entry.tag}: marcada como aplicada (hash ${hash.slice(0, 12)}…, when ${entry.when})`
    );
  }

  if (dryRun) {
    console.log("[migrations] --dry-run: no se escribio nada.");
    process.exit(0);
  }

  const final = await client.query(
    `select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc`
  );
  console.log(`[migrations] Ahora hay ${final.rowCount} migracion(es) registradas.`);
  console.log("[migrations] Listo: el proximo deploy aplicara solo las migraciones nuevas.");
} catch (err) {
  console.error(`[migrations] Error: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
