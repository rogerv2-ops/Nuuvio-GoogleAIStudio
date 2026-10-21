/**
 * Capa de datos — ajustes clave/valor de la tabla app_settings.
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{appSettings}from"../schema.ts";
import{eq}from"drizzle-orm";

async function getSetting(key,defaultValue){try{const rows=await db.select().from(appSettings).where(eq(appSettings.key,key));if(rows.length>0&&rows[0].value){return JSON.parse(rows[0].value)}return defaultValue}catch(error){console.error(`[DB Repo] Error al obtener setting '${key}':`,error);return defaultValue}}__name(getSetting,"getSetting");

async function saveSetting(key,value){try{const valString=JSON.stringify(value);await db.insert(appSettings).values({key,value:valString,updatedAt:new Date}).onConflictDoUpdate({target:appSettings.key,set:{value:valString,updatedAt:new Date}})}catch(error){console.error(`[DB Repo] Error al guardar setting '${key}':`,error);throw new Error(`Failed to save setting '${key}'`,{cause:error})}}__name(saveSetting,"saveSetting");

export{getSetting,saveSetting};
