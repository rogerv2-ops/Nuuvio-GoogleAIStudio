#!/usr/bin/env node
/**
 * Migra los usuarios de `app_settings.auth_users` (blob JSON) a la tabla
 * `auth_users` (punto 12 de la auditoria).
 *
 * POR QUE ES UN SCRIPT Y NO SOLO CODIGO DEL SERVIDOR: la app tambnien migra al
 * arrancar (por si arranca en un entorno nuevo), pero en PRODUCCION conviene
 * hacerlo a mano, antes de desplegar el codigo, y verificar el resultado. Si
 * la migracion falla a medio camino, el blob sigue intacto y la app puede
 * seguir leyendo los usuarios de ahi (modo degradado).
 *
 * Es idempotente: se puede correr las veces que haga falta. No borra el blob:
 * queda congelado como respaldo (igual que \`click_packs_list\`).
 *
 * Uso:
 *   SQL_HOST=... SQL_USER=... SQL_PASSWORD=... SQL_DB_NAME=... \
 *     bun scripts/migrate-auth-users.mjs
 *
 * Opciones:
 *   --dry-run   solo muestra que habria que migrar, no escribe.
 */
import pg from "pg";

const { Client } = pg;

const host = process.env.SQL_HOST || "127.0.0.1";
const user = process.env.SQL_USER || "postgres";
const password = process.env.SQL_PASSWORD || "test";
const database = process.env.SQL_DB_NAME || "nuuviopsg";
const dryRun = process.argv.includes("--dry-run");

const client = new Client({ host, user, password, database });

function normalizar(u) {
  return {
    email: String(u.email || "").toLowerCase().trim(),
    nombre: String(u.nombre || ""),
    password_salt: String(u.passwordSalt || ""),
    password_hash: String(u.passwordHash || ""),
    rol: String(u.rol || "admin"),
    usuario_id: u.usuarioId ? String(u.usuarioId) : null,
    merchant_id: u.merchantId ? String(u.merchantId) : null,
    descripcion: u.descripcion ? String(u.descripcion) : null,
    totp_secret: u.totpSecret ? String(u.totpSecret) : null,
    totp_habilitado: !!u.totpHabilitado,
    totp_backup_hashes: Array.isArray(u.totpBackupHashes) ? u.totpBackupHashes : [],
    totp_activado_en: u.totpActivadoEn ? String(u.totpActivadoEn) : null,
  };
}

try {
  await client.connect();

  const existeTabla = await client.query(
    `select 1 from information_schema.tables where table_schema='public' and table_name='auth_users'`
  );
  if (!existeTabla.rowCount) {
    console.error(
      "[migracion] La tabla auth_users NO existe. Apliques el esquema primero " +
        "(drizzle-kit push) y volve a correr este script."
    );
    process.exit(2);
  }

  const blob = await client.query(`select value from app_settings where key='auth_users'`);
  const usuarios = blob.rowCount ? JSON.parse(blob.rows[0].value) : [];
  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    console.log("[migracion] No hay usuarios en el blob: nada que migrar.");
    process.exit(0);
  }

  const yaEnTabla = await client.query(`select email from auth_users`);
  const yaMigrados = new Set(yaEnTabla.rows.map((r) => r.email));

  console.log(`[migracion] ${usuarios.length} usuario(s) en el blob, ${yaMigrados.size} ya en la tabla.`);
  for (const u of usuarios) {
    const n = normalizar(u);
    const estado = yaMigrados.has(n.email) ? "ya estaba" : "se migra";
    console.log(`  - ${n.email} (${n.rol}) -> ${estado}`);
    if (dryRun) continue;
    if (yaMigrados.has(n.email)) continue;
    await client.query(
      `insert into auth_users
         (id, email, nombre, password_salt, password_hash, rol, usuario_id, merchant_id,
          descripcion, totp_secret, totp_habilitado, totp_backup_hashes, totp_activado_en, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13, now())
       on conflict (email) do nothing`,
      [
        "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        n.email, n.nombre, n.password_salt, n.password_hash, n.rol, n.usuario_id, n.merchant_id,
        n.descripcion, n.totp_secret, n.totp_habilitado, JSON.stringify(n.totp_backup_hashes), n.totp_activado_en,
      ]
    );
  }

  if (dryRun) {
    console.log("[migracion] --dry-run: no se escribio nada.");
    process.exit(0);
  }

  // Verificacion: las filas de la tabla tienen los mismos hashes que el blob.
  const finales = await client.query(
    `select email, rol, password_hash, password_salt from auth_users order by email`
  );
  const porEmail = new Map(finales.rows.map((r) => [r.email, r]));
  let ok = true;
  for (const u of usuarios) {
    const n = normalizar(u);
    const fila = porEmail.get(n.email);
    if (!fila) {
      console.error(`  ERROR: ${n.email} no quedo en la tabla.`);
      ok = false;
      continue;
    }
    if (fila.password_hash !== n.password_hash || fila.password_salt !== n.password_salt) {
      console.error(`  ERROR: ${n.email} tiene OTRA clave que el blob.`);
      ok = false;
    }
  }
  console.log(`[migracion] ${finales.rowCount} usuario(s) en la tabla.`);
  console.log(ok ? "[migracion] OK: mismos usuarios y mismas claves." : "[migracion] FALLO: revisar arriba.");
  console.log("[migracion] El blob app_settings.auth_users queda congelado como respaldo.");
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(`[migracion] Error: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
