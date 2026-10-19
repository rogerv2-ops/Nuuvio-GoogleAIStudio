#!/usr/bin/env node
/**
 * Siembra un numero de bot de prueba en la base del runner.
 *
 * POR QUE EXISTE: `GET /api/whatsapp/contacto` responde **503** cuando el
 * bot no tiene numero configurado (es el comportamiento correcto: no se puede
 * abrir un chat sin destino). En el runner de CI la base arranca vacia, asi
 * que sin este sembrado los tests de contacto se caian.
 *
 * Ojo con el precedente: esto no es "arreglar el test para que pase". El
 * numero se siembra **antes** de levantar el servidor, porque la app lo lee
 * al arrancar (`initDatabaseState` -> `getSetting("whatsapp_config")`).
 *
 * El numero es ficticio y solo vive en la base efimera del runner.
 */
import pg from "pg";

const { Client } = pg;

const host = process.env.SQL_HOST || "127.0.0.1";
const user = process.env.SQL_USER || "postgres";
const password = process.env.SQL_PASSWORD || "test";
const database = process.env.SQL_DB_NAME || "yuddit_ci_app";
const numero = process.env.CI_BOT_PHONE || "51987654321";

const config = {
  modoActivo: "waha",
  numeroTelefono: numero,
  metaConfig: {},
  wahaConfig: {},
};

const client = new Client({ host, user, password, database });

try {
  await client.connect();
  await client.query(
    `insert into app_settings (key, value, updated_at)
     values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    ["whatsapp_config", JSON.stringify(config)],
  );
  console.log(`[ci] bot de prueba sembrado con el numero ${numero}`);
} catch (err) {
  console.error(`[ci] no se pudo sembrar el numero del bot: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
