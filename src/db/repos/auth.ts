/**
 * Capa de datos — usuarios de autenticacion y bloqueo por intentos fallidos (auth_users, login_failures).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{authUsers,loginFailures}from"../schema.ts";
import{eq,and,sql}from"drizzle-orm";

/* ---------- auth_users: tabla propia (punto 12 de la auditoria) ----------
 * Antes: los usuarios vivian en el blob JSON `app_settings.auth_users` y cada
 * alta, cambio de clave o consumo de codigo de respaldo reescribia el array
 * ENTERO (read-modify-write). Con dos peticiones concurrentes, una se perdia.
 * Ahora: cada cambio es una sentencia SQL puntual sobre la fila del usuario.
 * La forma de los objetos que devuelve `getAuthUsersDb` es la MISMA que la del
 * blob, para que el resto del codigo no cambie.
 */
function authUserDesdeFila(r){return{id:r.id,email:r.email,nombre:r.nombre,passwordSalt:r.passwordSalt,passwordHash:r.passwordHash,rol:r.rol,usuarioId:r.usuarioId||undefined,merchantId:r.merchantId||undefined,descripcion:r.descripcion||undefined,totpSecret:r.totpSecret||null,totpHabilitado:!!r.totpHabilitado,totpBackupHashes:Array.isArray(r.totpBackupHashes)?r.totpBackupHashes:[],totpActivadoEn:r.totpActivadoEn||undefined}}
__name(authUserDesdeFila,"authUserDesdeFila");

/* ---------- bloqueo por intentos fallidos de login (punto 8 de la auditoria) ----------
 * Antes vivia en un Map en memoria del proceso: con dos instancias, cada una
 * contava por su cuenta (el bloqueo se eludia alternando instancias) y un
 * reinicio lo borraba. Ahora el contador esta en Postgres, asi que es el mismo
 * para todas las instancias y sobrevive a los reinicios.
 * `failed_count` y `locked_until` se actualizan en UNA sentencia (upsert), asi
 * que dos intentos fallidos simultaneos no se pisan entre si.
 */
async function getLoginFailureDb(email){const clean=String(email||"").toLowerCase().trim();const rows=await db.select().from(loginFailures).where(eq(loginFailures.email,clean));return rows[0]||null}
__name(getLoginFailureDb,"getLoginFailureDb");

async function registrarLoginFallidoDb(email,maxIntentos,bloqueoHasta){const clean=String(email||"").toLowerCase().trim();const rows=await db.execute(sql`insert into login_failures (email, failed_count, locked_until, updated_at) values (${clean}, 1, 0, now()) on conflict (email) do update set failed_count = case when ${loginFailures.failedCount} + 1 >= ${Number(maxIntentos)} then 0 else ${loginFailures.failedCount} + 1 end, locked_until = case when ${loginFailures.failedCount} + 1 >= ${Number(maxIntentos)} then ${Number(bloqueoHasta)} else ${loginFailures.lockedUntil} end, updated_at = now() returning failed_count, locked_until`);const arr=(rows as any)?.rows??rows;const fila=arr&&arr.length?arr[0]:null;return{failed_count:Number((fila&&(fila.failed_count??fila.failedCount))||0),locked_until:Number((fila&&(fila.locked_until??fila.lockedUntil))||0)}}
__name(registrarLoginFallidoDb,"registrarLoginFallidoDb");

async function limpiarLoginFallidoDb(email){const clean=String(email||"").toLowerCase().trim();await db.delete(loginFailures).where(eq(loginFailures.email,clean))}
__name(limpiarLoginFallidoDb,"limpiarLoginFallidoDb");

async function getAuthUsersDb(){const rows=await db.select().from(authUsers).orderBy(authUsers.createdAt);return rows.map(authUserDesdeFila)}
__name(getAuthUsersDb,"getAuthUsersDb");

function authUserValores(u){return{id:String(u.id||("usr_"+Date.now()+"_"+Math.random().toString(36).slice(2,7))),email:String(u.email||"").toLowerCase().trim(),nombre:String(u.nombre||""),passwordSalt:String(u.passwordSalt||""),passwordHash:String(u.passwordHash||""),rol:String(u.rol||"admin"),usuarioId:u.usuarioId?String(u.usuarioId):null,merchantId:u.merchantId?String(u.merchantId):null,descripcion:u.descripcion?String(u.descripcion):null,totpSecret:u.totpSecret?String(u.totpSecret):null,totpHabilitado:!!u.totpHabilitado,totpBackupHashes:Array.isArray(u.totpBackupHashes)?u.totpBackupHashes:[],totpActivadoEn:u.totpActivadoEn?String(u.totpActivadoEn):null,updatedAt:new Date()}}
__name(authUserValores,"authUserValores");

async function insertAuthUserDb(u){const vals=authUserValores(u);await db.insert(authUsers).values(vals);return vals.id}
__name(insertAuthUserDb,"insertAuthUserDb");

async function updateAuthUserDb(email,cambios){const clean=String(email||"").toLowerCase().trim();const values:any={updatedAt:new Date()};if("nombre" in cambios)values.nombre=cambios.nombre==null?null:String(cambios.nombre);if("rol" in cambios)values.rol=cambios.rol==null?null:String(cambios.rol);if("usuarioId" in cambios)values.usuarioId=cambios.usuarioId==null?null:String(cambios.usuarioId);if("merchantId" in cambios)values.merchantId=cambios.merchantId==null?null:String(cambios.merchantId);if("descripcion" in cambios)values.descripcion=cambios.descripcion==null?null:String(cambios.descripcion);if("passwordSalt" in cambios)values.passwordSalt=cambios.passwordSalt==null?null:String(cambios.passwordSalt);if("passwordHash" in cambios)values.passwordHash=cambios.passwordHash==null?null:String(cambios.passwordHash);if("totpSecret" in cambios)values.totpSecret=cambios.totpSecret==null?null:String(cambios.totpSecret);if("totpHabilitado" in cambios)values.totpHabilitado=!!cambios.totpHabilitado;if("totpBackupHashes" in cambios)values.totpBackupHashes=Array.isArray(cambios.totpBackupHashes)?cambios.totpBackupHashes:[];if("totpActivadoEn" in cambios)values.totpActivadoEn=cambios.totpActivadoEn==null?null:String(cambios.totpActivadoEn);const rows=await db.update(authUsers).set(values).where(eq(authUsers.email,clean)).returning({id:authUsers.id});return !!(rows&&rows.length>0)}
__name(updateAuthUserDb,"updateAuthUserDb");

async function deleteAuthUserDb(email){const clean=String(email||"").toLowerCase().trim();const rows=await db.delete(authUsers).where(eq(authUsers.email,clean)).returning({id:authUsers.id});return !!(rows&&rows.length>0)}
__name(deleteAuthUserDb,"deleteAuthUserDb");

async function consumeTotpBackupHashDb(email,hash){const clean=String(email||"").toLowerCase().trim();const objetivo=JSON.stringify(String(hash||""));const rows=await db.execute(sql`update auth_users set totp_backup_hashes=coalesce(totp_backup_hashes,'[]'::jsonb)-${String(hash||"")}, updated_at=now() where email=${clean} and coalesce(totp_backup_hashes,'[]'::jsonb) @> ${objetivo}::jsonb returning id`);const arr=(rows as any)?.rows??rows;return !!(arr&&arr.length>0)}
__name(consumeTotpBackupHashDb,"consumeTotpBackupHashDb");

async function migrateAuthUsersABTablaDb(lista){if(!Array.isArray(lista)||lista.length===0)return 0;let n=0;try{await db.transaction(async(tx:any)=>{for(const u of lista){await tx.insert(authUsers).values(authUserValores(u)).onConflictDoNothing();n++}});return n}catch(error){console.error("[DB Repo] Error migrando auth_users a la tabla:",error);return 0}}
__name(migrateAuthUsersABTablaDb,"migrateAuthUsersABTablaDb");

export{getLoginFailureDb,registrarLoginFallidoDb,limpiarLoginFallidoDb,getAuthUsersDb,insertAuthUserDb,updateAuthUserDb,deleteAuthUserDb,consumeTotpBackupHashDb,migrateAuthUsersABTablaDb};
