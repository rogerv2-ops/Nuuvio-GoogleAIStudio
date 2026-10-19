#!/usr/bin/env node
/**
 * Crea la base de datos descartable que usan los tests de facturacion.
 *
 * Por que hace falta: los tests de `tests/billing` miden propiedades de SQL
 * (atomicidad del debito, ventana de 24 h), y para eso necesitan una base
 * REAL, no un mock. Esos tests hacen `drop table if exists click_packs` y la
 * vuelven a crear con su propia forma. Si corrieran contra la misma base que
 * la app, dejarian la tabla `click_packs` con una forma que la app no
 * entiende y el arranque de `facturacion` se caeria.
 *
 * Entonces: la app usa `SQL_DB_NAME` y los tests de billing usan
 * `TEST_SQL_DB_NAME`. Esta base se crea en un Postgres efimero (el del
 * servicio de CI), nunca es la de produccion.
 *
 * Se conecta con el cliente `pg` que ya es dependencia del proyecto, asi que
 * no hace falta `psql` en la imagen del runner.
 */
import pg from "pg";

const { Client } = pg;

const host = process.env.TEST_SQL_HOST || "127.0.0.1";
const user = process.env.TEST_SQL_USER || "postgres";
const password = process.env.TEST_SQL_PASSWORD || "test";
const database = process.env.TEST_SQL_DB_NAME || "yuddit_billing";
const adminDatabase = process.env.TEST_SQL_ADMIN_DB || "postgres";

if (database === adminDatabase) {
  console.error(
    `[ci] la base de tests (${database}) no puede ser la base de administracion (${adminDatabase}).`
  );
  process.exit(2);
}

const client = new Client({ host, user, password, database: adminDatabase });

try {
  await client.connect();
  const existe = await client.query("select 1 from pg_database where datname = $1", [
    database,
  ]);
  if (existe.rowCount === 0) {
    await client.query(`create database "${database}"`);
    console.log(`[ci] base de datos creada: ${database}`);
  } else {
    console.log(`[ci] base de datos ya existia: ${database}`);
  }
} catch (err) {
  console.error(`[ci] no se pudo preparar la base de tests: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
