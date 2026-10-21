/**
 * Capa de datos — registros de auditoria: email_logs, registration_logs, chat_logs y security_logs.
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{emailLogs,registrationLogs,securityLogs,chatLogs}from"../schema.ts";
import{eq,desc}from"drizzle-orm";

async function insertEmailLog(logItem){try{await db.insert(emailLogs).values({id:logItem.id||`elog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,toEmail:logItem.to||"",subject:logItem.subject||"",provider:logItem.provider||"simulated",status:logItem.status||"simulado",timestamp:logItem.timestamp||new Date().toISOString(),verificationToken:logItem.verificationToken||null,verificationLink:logItem.verificationLink||null,whatsappLink:logItem.whatsappLink||null,error:logItem.error||null})}catch(error){console.error("[DB Repo] Error guardando log de correo:",error)}}__name(insertEmailLog,"insertEmailLog");

async function getRecentEmailLogs(limitCount=50){try{const rows=await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(limitCount);return rows.map(r=>({id:r.id,to:r.toEmail,subject:r.subject,provider:r.provider,status:r.status,timestamp:r.timestamp,verificationToken:r.verificationToken,verificationLink:r.verificationLink,whatsappLink:r.whatsappLink,error:r.error}))}catch(error){console.error("[DB Repo] Error obteniendo logs de correo:",error);return[]}}__name(getRecentEmailLogs,"getRecentEmailLogs");

const inMemoryRegLogs=[];

async function insertRegistrationLog(logData){const item={id:`reglog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,email:(logData.email||"").trim().toLowerCase(),telefono:logData.telefono||"",nombre:logData.nombre||"",status:logData.status,resultDetails:logData.resultDetails||(logData.status==="success"?"Registro completado exitosamente":"Error en el proceso de registro"),timestamp:new Date().toISOString()};inMemoryRegLogs.unshift(item);if(inMemoryRegLogs.length>200)inMemoryRegLogs.pop();try{await db.insert(registrationLogs).values({id:item.id,email:item.email,telefono:item.telefono,nombre:item.nombre,status:item.status,resultDetails:item.resultDetails,timestamp:item.timestamp})}catch(error){console.error("[DB Repo] Error guardando log de registro en PostgreSQL:",error)}}__name(insertRegistrationLog,"insertRegistrationLog");

async function getRecentRegistrationLogs(limitCount=100){try{const rows=await db.select().from(registrationLogs).orderBy(desc(registrationLogs.createdAt)).limit(limitCount);if(rows.length>0){return rows.map(r=>({id:r.id,email:r.email,telefono:r.telefono||"",nombre:r.nombre||"",status:r.status,resultDetails:r.resultDetails||"",timestamp:r.timestamp,createdAt:r.createdAt}))}}catch(error){console.error("[DB Repo] Error consultando logs de registro en DB, usando fallback:",error)}return inMemoryRegLogs.slice(0,limitCount)}__name(getRecentRegistrationLogs,"getRecentRegistrationLogs");

async function deleteRegistrationLog(idOrEmail){const query=idOrEmail.trim();try{await db.delete(registrationLogs).where(eq(registrationLogs.id,query));if(query.includes("@")){await db.delete(registrationLogs).where(eq(registrationLogs.email,query.toLowerCase()))}}catch(error){console.error("[DB Repo] Error eliminando log de registro:",error)}for(let i=inMemoryRegLogs.length-1;i>=0;i--){if(inMemoryRegLogs[i]?.id===query||inMemoryRegLogs[i]?.email===query.toLowerCase()){inMemoryRegLogs.splice(i,1)}}return true}__name(deleteRegistrationLog,"deleteRegistrationLog");

async function clearAllRegistrationLogs(){try{await db.delete(registrationLogs)}catch(error){console.error("[DB Repo] Error limpiando todos los registrationLogs:",error)}inMemoryRegLogs.length=0;return true}__name(clearAllRegistrationLogs,"clearAllRegistrationLogs");

async function insertChatLog(e){try{await db.insert(chatLogs).values({id:e.id||`clog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,canal:e.canal||"waha",direccion:e.direccion||"entrante",telefono:String(e.telefono||""),contenido:String(e.contenido||"").slice(0,4000),estado:e.estado||"recibido",detalles:String(e.detalles||"").slice(0,2000),timestamp:e.timestamp||new Date().toISOString()})}catch(err){console.error("[DB Repo] Error guardando chat log:",err)}}
__name(insertChatLog,"insertChatLog");

async function getRecentChatLogs(l){try{const rows=await db.select().from(chatLogs).orderBy(desc(chatLogs.createdAt)).limit(l||200);if(rows.length>0)return rows.map(r=>({id:r.id,canal:r.canal,direccion:r.direccion,telefono:r.telefono,contenido:r.contenido,estado:r.estado,detalles:r.detalles||"",timestamp:r.timestamp}));return[]}catch(err){console.error("[DB Repo] Error obteniendo chat logs:",err);return[]}}
__name(getRecentChatLogs,"getRecentChatLogs");

async function insertSecurityLog(e){try{await db.insert(securityLogs).values({id:e.id||`sec_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,operadorId:String(e.operadorId||"sistema_seguridad"),operadorNombre:String(e.operadorNombre||"Sistema"),accion:String(e.accion||"evento"),entidad:String(e.entidad||"seguridad"),entidadId:String(e.entidadId||"-"),detalles:String(e.detalles||"")})}catch(err){console.error("[DB Repo] Error guardando security log:",err)}}
__name(insertSecurityLog,"insertSecurityLog");

async function getRecentSecurityLogs(l){try{const rows=await db.select().from(securityLogs).orderBy(desc(securityLogs.createdAt)).limit(l||100);return rows.map(r=>({id:r.id,operadorId:r.operadorId,operadorNombre:r.operadorNombre,accion:r.accion,entidad:r.entidad,entidadId:r.entidadId,detalles:r.detalles,createdAt:r.createdAt}))}catch(err){console.error("[DB Repo] Error obteniendo security logs:",err);return[]}}
__name(getRecentSecurityLogs,"getRecentSecurityLogs");

export{insertEmailLog,getRecentEmailLogs,insertRegistrationLog,getRecentRegistrationLogs,deleteRegistrationLog,clearAllRegistrationLogs,insertChatLog,getRecentChatLogs,insertSecurityLog,getRecentSecurityLogs,inMemoryRegLogs};
