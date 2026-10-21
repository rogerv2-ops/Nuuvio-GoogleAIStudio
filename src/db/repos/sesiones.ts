/**
 * Capa de datos — sesiones de usuario (auth_sessions) y su purga.
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{sessions}from"../schema.ts";
import{eq,desc,and,sql}from"drizzle-orm";

async function insertSession(s){try{await db.insert(sessions).values({id:s.id,usuarioId:String(s.usuarioId),email:String(s.email),rol:String(s.rol),origen:s.origen?String(s.origen).slice(0,300):null,expiresAt:s.expiresAt})}catch(err){console.error("[DB Repo] Error insertando sesion:",err);throw err}}
__name(insertSession,"insertSession");

async function getSession(id){try{const rows=await db.select().from(sessions).where(eq(sessions.id,id));return rows[0]||null}catch(err){console.error("[DB Repo] Error obteniendo sesion:",err);return null}}
__name(getSession,"getSession");

async function revokeSession(id){try{await db.update(sessions).set({revokedAt:new Date}).where(eq(sessions.id,id))}catch(err){console.error("[DB Repo] Error revocando sesion:",err)}}
__name(revokeSession,"revokeSession");

async function revokeSessionsByUser(usuarioId){try{await db.update(sessions).set({revokedAt:new Date}).where(and(eq(sessions.usuarioId,String(usuarioId)),sql`${sessions.revokedAt} is null`))}catch(err){console.error("[DB Repo] Error revocando sesiones del usuario:",err)}}
__name(revokeSessionsByUser,"revokeSessionsByUser");

async function listSessionsByUser(usuarioId){try{const rows=await db.select().from(sessions).where(and(eq(sessions.usuarioId,String(usuarioId)),sql`${sessions.revokedAt} is null`)).orderBy(desc(sessions.createdAt));return rows.map(r=>({id:r.id,usuarioId:r.usuarioId,email:r.email,rol:r.rol,origen:r.origen,createdAt:r.createdAt,expiresAt:r.expiresAt}))}catch(err){console.error("[DB Repo] Error listando sesiones:",err);return[]}}
__name(listSessionsByUser,"listSessionsByUser");

async function purgeExpiredSessions(){try{await db.delete(sessions).where(sql`${sessions.expiresAt} < now() - interval '1 day'`)}catch(err){console.error("[DB Repo] Error purgando sesiones expiradas:",err)}}
__name(purgeExpiredSessions,"purgeExpiredSessions");

export{insertSession,getSession,revokeSession,revokeSessionsByUser,listSessionsByUser,purgeExpiredSessions};
