var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});import{db}from"./index.ts";import{appSettings,offers,banners,audienceUsers,emailLogs,registrationLogs,clickLogs,securityLogs,sessions,authUsers,loginFailures,geoTerritorios}from"./schema.ts";import{eq,desc,and,or,gte,notInArray,sql}from"drizzle-orm";import{cifrarCampo,descifrarCampo,indiceCiego,estaCifrado,piiHabilitado}from"../utils/pii.ts";async function getSetting(key,defaultValue){try{const rows=await db.select().from(appSettings).where(eq(appSettings.key,key));if(rows.length>0&&rows[0].value){return JSON.parse(rows[0].value)}return defaultValue}catch(error){console.error(`[DB Repo] Error al obtener setting '${key}':`,error);return defaultValue}}__name(getSetting,"getSetting");async function saveSetting(key,value){try{const valString=JSON.stringify(value);await db.insert(appSettings).values({key,value:valString,updatedAt:new Date}).onConflictDoUpdate({target:appSettings.key,set:{value:valString,updatedAt:new Date}})}catch(error){console.error(`[DB Repo] Error al guardar setting '${key}':`,error);throw new Error(`Failed to save setting '${key}'`,{cause:error})}}__name(saveSetting,"saveSetting");async function getAllOffers(){try{const rows=await db.select().from(offers);return rows.map(r=>({...r,precioNormal:Number(r.precioNormal),precioOferta:Number(r.precioOferta),lat:Number(r.lat),lng:Number(r.lng),likes:r.likes||0,vistas:r.vistas||0,clics:r.clics||0,leadsCalificados:r.leadsCalificados||0}))}catch(error){console.error("[DB Repo] Error al obtener ofertas:",error);return[]}}__name(getAllOffers,"getAllOffers");async function replaceOffers(offersList){try{const _oids=offersList.map(o=>o.id);if(_oids.length>0){await db.delete(offers).where(notInArray(offers.id,_oids))}else{await db.delete(offers)}}catch(error){console.error("[DB Repo] Error limpiando ofertas obsoletas:",error)}return await syncOffers(offersList)}__name(replaceOffers,"replaceOffers");async function syncOffers(offersList){try{for(const o of offersList){await db.insert(offers).values({id:o.id,codigoUrl:o.codigoUrl||`oferta-${o.id}`,comercioId:o.comercioId||"comercio-default",comercioNombre:o.comercioNombre||"Comercio Yuddit",comercioWhatsapp:o.comercioWhatsapp||"51987654321",titulo:o.titulo||"",descripcion:o.descripcion||"",tipo:o.tipo||"descuento_porcentaje",precioNormal:String(o.precioNormal??0),precioOferta:String(o.precioOferta??0),stock:o.stock??null,categoria:o.categoria||"Gastronom\xEDa y Caf\xE9",distrito:o.distrito||"Miraflores",provincia:o.provincia||"Lima",lat:String(o.lat??-12.12),lng:String(o.lng??-77.03),imagenes:o.imagenes||[],venceEn:o.venceEn||new Date(Date.now()+30*864e5).toISOString(),estado:o.estado||"activa",likes:o.likes||0,vistas:o.vistas||0,clics:o.clics||0,leadsCalificados:o.leadsCalificados||0,videoUrl:o.videoUrl||null,creadaEn:o.creadaEn||new Date().toISOString(),updatedAt:new Date}).onConflictDoUpdate({target:offers.id,set:{titulo:o.titulo||"",descripcion:o.descripcion||"",precioNormal:String(o.precioNormal??0),precioOferta:String(o.precioOferta??0),stock:o.stock??null,categoria:o.categoria||"",distrito:o.distrito||"",provincia:o.provincia||"",lat:String(o.lat??-12.12),lng:String(o.lng??-77.03),imagenes:o.imagenes||[],venceEn:o.venceEn||new Date().toISOString(),estado:o.estado||"activa",likes:o.likes||0,vistas:o.vistas||0,clics:o.clics||0,leadsCalificados:o.leadsCalificados||0,videoUrl:o.videoUrl||null,updatedAt:new Date}})}}catch(error){console.error("[DB Repo] Error sincronizando ofertas:",error);throw new Error("Failed to sync offers",{cause:error})}}__name(syncOffers,"syncOffers");async function getAllBanners(){try{const rows=await db.select().from(banners);return rows}catch(error){console.error("[DB Repo] Error al obtener banners:",error);return[]}}__name(getAllBanners,"getAllBanners");async function syncBanners(bannerList){try{const _bids=bannerList.map(b=>b.id);if(_bids.length>0){await db.delete(banners).where(notInArray(banners.id,_bids))}else{await db.delete(banners)}for(const b of bannerList){await db.insert(banners).values({id:b.id,titulo:b.titulo,subtitulo:b.subtitulo,imagenUrl:b.imagenUrl,enlaceUrl:b.enlaceUrl||null,activado:b.activado!==false,orden:b.orden||1}).onConflictDoUpdate({target:banners.id,set:{titulo:b.titulo,subtitulo:b.subtitulo,imagenUrl:b.imagenUrl,enlaceUrl:b.enlaceUrl||null,activado:b.activado!==false,orden:b.orden||1}})}}catch(error){console.error("[DB Repo] Error sincronizando banners:",error);throw new Error("Failed to sync banners",{cause:error})}}__name(syncBanners,"syncBanners");/**
 * Identidad de la audiencia: el CORREO es opcional.
 *
 * Antes: `email` era NOT NULL y, cuando el usuario no traia correo (que es el
 * caso de TODO el que entra por WhatsApp), el sistema fabricaba uno con el
 * formato `<id de usuario>@<dominio de yuddit>`. Ese correo no existia, no se
 * podia verificar y contaminaba el panel (parecia real), las metricas de
 * "verificacion" (todo usuario de WhatsApp contaba como PENDIENTE, con tasa
 * de conversion 0%) y el borrado en el panel (usaba el correo falso como
 * llave de limpieza).
 *
 * Ahora el numero de WhatsApp ES la identidad. Un usuario `usr_wa_*` no
 * tiene correo y jams se le inventa uno. Para el resto, el correo es el que
 * la persona dio (registro web), cifrado como PII.
 */
function emailDeAudiencia(user): string | null {
  const id = String(user?.id || "");
  // Alta por WhatsApp: el bot jamas conoce el correo de la persona.
  if (id.startsWith("usr_wa_")) return null;
  const bruto = user?.email ? String(user.email).trim() : "";
  return bruto ? bruto : null;
}
async function upsertAudienceUser(user){try{
  const safeEmail = emailDeAudiencia(user);
  const insertVals: any = {
    id: user.id,
    email: safeEmail ? cifrarCampo(safeEmail) : null,
    emailIdx: safeEmail ? indiceCiego(safeEmail) : null,
    nombre: cifrarCampo(user.nombre || "Usuario"),
    apellido: cifrarCampo(user.apellido || null),
    telefono: user.telefono ? cifrarCampo(user.telefono) : null,
    telefonoIdx: user.telefono ? indiceCiego(normalizePhoneForMatching(user.telefono).core9 || user.telefono) : null,
    distrito: user.distrito || null,
    provincia: user.provincia || null,
    ciudad: user.ciudad || null,
    emailVerificado: !!user.emailVerificado,
    verificationToken: user.verificationToken || null,
    codigoRef: user.codigoRef || null,
    puntosSaldo: user.puntosSaldo || 0,
    estado: user.estado || "activo",
    categoriasInteres: Array.isArray(user.categoriasInteres) ? user.categoriasInteres : [],
    consentimientos: user.consentimientos || {},
    utm: user.utm || {},
    registradoEn: user.registradoEn || new Date().toISOString()
  };
  const updateSet: any = {
    nombre: cifrarCampo(user.nombre || "Usuario"),
    apellido: cifrarCampo(user.apellido || null),
    telefono: user.telefono ? cifrarCampo(user.telefono) : null,
    telefonoIdx: user.telefono ? indiceCiego(normalizePhoneForMatching(user.telefono).core9 || user.telefono) : null,
    distrito: user.distrito || null,
    provincia: user.provincia || null,
    ciudad: user.ciudad || null,
    emailVerificado: !!user.emailVerificado,
    verificationToken: user.verificationToken || null,
    codigoRef: user.codigoRef || null,
    puntosSaldo: user.puntosSaldo || 0,
    estado: user.estado || "activo",
    categoriasInteres: Array.isArray(user.categoriasInteres) ? user.categoriasInteres : [],
    consentimientos: user.consentimientos || {},
    utm: user.utm || {}
  };
  // El correo se escribe SIEMPRE (tambien como null): si el usuario es de
  // WhatsApp, el update tiene que BORRAR un correo inventado que quedo de
  // antes, no dejarlo pegado.
  updateSet.email = safeEmail ? cifrarCampo(safeEmail) : null;
  updateSet.emailIdx = safeEmail ? indiceCiego(safeEmail) : null;
  await db.insert(audienceUsers).values(insertVals).onConflictDoUpdate({
    target: audienceUsers.id,
    set: updateSet
  });
}catch(error){
  console.error("[DB Repo] Error guardando audience user:", error);
  throw new Error("Failed to upsert audience user", { cause: error });
}}__name(upsertAudienceUser,"upsertAudienceUser");async function upsertAudienceUserSafe(user){
  try {
    const safeEmail = emailDeAudiencia(user);
    const insertVals: any = {
      id: user.id,
      email: safeEmail ? cifrarCampo(safeEmail) : null,
      emailIdx: safeEmail ? indiceCiego(safeEmail) : null,
      nombre: user.nombre || "Usuario",
      apellido: user.apellido || null,
      telefono: user.telefono || null,
      distrito: user.distrito || null,
      provincia: user.provincia || null,
      ciudad: user.ciudad || null,
      emailVerificado: !!user.emailVerificado,
      verificationToken: user.verificationToken || null,
      codigoRef: user.codigoRef || null,
      puntosSaldo: 0,
      estado: user.estado || "pendiente",
      categoriasInteres: Array.isArray(user.categoriasInteres) ? user.categoriasInteres : [],
      consentimientos: {},
      utm: user.utm || {},
      registradoEn: new Date().toISOString()
    };
    const updateSet: any = {
      nombre: user.nombre || "Usuario",
      apellido: user.apellido || null,
      telefono: user.telefono || null,
      distrito: user.distrito || null,
      provincia: user.provincia || null,
      ciudad: user.ciudad || null,
      emailVerificado: !!user.emailVerificado,
      verificationToken: user.verificationToken || null,
      codigoRef: user.codigoRef || null,
      estado: user.estado || "pendiente",
      categoriasInteres: Array.isArray(user.categoriasInteres) ? user.categoriasInteres : [],
      utm: user.utm || {}
    };
    updateSet.email = safeEmail ? cifrarCampo(safeEmail) : null;
    updateSet.emailIdx = safeEmail ? indiceCiego(safeEmail) : null;
    await db.insert(audienceUsers).values(insertVals).onConflictDoUpdate({
      target: audienceUsers.id,
      set: updateSet
    });
  } catch (error) {
    console.error("[DB Repo] Error guardando audience user (safe):", error);
    throw new Error("Failed to upsert audience user (safe)", { cause: error });
  }
}__name(upsertAudienceUserSafe,"upsertAudienceUserSafe");function normalizePhoneForMatching(raw){if(!raw)return{digits:"",core9:""};let digits=raw.replace(/\D/g,"");if(digits.startsWith("00"))digits=digits.slice(2);if(digits.startsWith("5151")&&digits.length>=13){digits=digits.slice(2)}if(digits.startsWith("0")&&digits.length===10){digits=digits.slice(1)}const core9=digits.length>=9?digits.slice(-9):digits;return{digits,core9}}__name(normalizePhoneForMatching,"normalizePhoneForMatching");function phonesMatch(phoneA,phoneB){const normA=normalizePhoneForMatching(phoneA);const normB=normalizePhoneForMatching(phoneB);if(!normA.digits||!normB.digits)return false;if(normA.digits===normB.digits)return true;if(normA.digits.endsWith(normB.digits)||normB.digits.endsWith(normA.digits))return true;if(normA.core9.length>=7&&normA.core9===normB.core9)return true;return false}__name(phonesMatch,"phonesMatch");async function findAudienceUserByPhone(phone){try{const norm=normalizePhoneForMatching(phone);if(!norm.digits)return null;const allUsers=await getAllAudienceUsers();const found=allUsers.find(u=>{if(!u.telefono)return false;return phonesMatch(u.telefono,phone)});return found||null}catch(error){console.error("[DB Repo] Error buscando usuario por tel\xE9fono:",error);return null}}__name(findAudienceUserByPhone,"findAudienceUserByPhone");async function getAllAudienceUsers(){try{const rows=await db.select().from(audienceUsers);return rows.map(r=>({...r,email:descifrarCampo(r.email),nombre:descifrarCampo(r.nombre),apellido:descifrarCampo(r.apellido),telefono:descifrarCampo(r.telefono)}))}catch(error){console.error("[DB Repo] Error consultando audience users:",error);return[]}}__name(getAllAudienceUsers,"getAllAudienceUsers");async function migrarPiiAudiencia(){try{if(!piiHabilitado())return;const rows=await db.select().from(audienceUsers);let hechas=0;for(const r of rows){const set:any={};if(r.email&&!estaCifrado(r.email)){set.email=cifrarCampo(r.email)}if(!r.emailIdx&&r.email){set.emailIdx=indiceCiego(descifrarCampo(r.email))}if(r.nombre&&!estaCifrado(r.nombre)){set.nombre=cifrarCampo(r.nombre)}if(r.apellido&&!estaCifrado(r.apellido)){set.apellido=cifrarCampo(r.apellido)}if(r.telefono&&!estaCifrado(r.telefono)){set.telefono=cifrarCampo(r.telefono)}if(!r.telefonoIdx&&r.telefono){const _t=descifrarCampo(r.telefono);const _norm=normalizePhoneForMatching(_t);set.telefonoIdx=indiceCiego(_norm.core9||_norm.digits||_t)}if(Object.keys(set).length===0)continue;await db.update(audienceUsers).set(set).where(eq(audienceUsers.id,r.id));hechas++}console.log(`[PII] Migracion de audiencia: ${hechas} fila(s) cifradas de ${rows.length}.`)}catch(err){console.error("[PII] Error en migracion de audiencia (se reintentara en el proximo arranque):",err)}}
__name(migrarPiiAudiencia,"migrarPiiAudiencia");
/**
 * Normaliza la identidad de la audiencia: el NUMERO es la identidad.
 *
 * Los usuarios que entraron por WhatsApp quedaron guardados con un correo
 * inventado (`<id>@<dominio>`) porque la columna era NOT NULL. Ese correo no
 * existia, no se podia verificar y hacia que el panel y las metricas
 * mintieran. Como la columna ahora permite null, esta funcion deja la fila
 * con la identidad real: el telefono.
 *
 * Solo toca filas `usr_wa_*` (el espacio de ids del bot, que nunca conoce el
 * correo de la persona). Los usuarios del registro web conservan su correo.
 *
 * Es idempotente: se puede correr las veces que haga falta.
 */
async function normalizarEmailsAudiencia(){try{const rows=await db.select({id:audienceUsers.id,email:audienceUsers.email,emailIdx:audienceUsers.emailIdx}).from(audienceUsers);let n=0;for(const r of rows){if(!String(r.id||"").startsWith("usr_wa_"))continue;if(r.email===null&&r.emailIdx===null)continue;const _set:any={email:null,emailIdx:null};await db.update(audienceUsers).set(_set).where(eq(audienceUsers.id,r.id));n++}if(n>0)console.log(`[Audience] ${n} usuario(s) de WhatsApp normalizados: su identidad es el numero (correo eliminado).`)}catch(e){console.warn("[Audience] No se pudieron normalizar los correos de audiencia (se reintenta en el proximo arranque):",e)}}
__name(normalizarEmailsAudiencia,"normalizarEmailsAudiencia");
/**
 * Atribuye un codigo de canje (NV-XXXXXX) a una persona concreta.
 *
 * El codigo lo genera el clic en la web (`/api/whatsapp/contacto`), donde se
 * registra como "anonimo" y NO facturable: aun no se sabia de quien era.
 * Cuando la persona escribe al bot, el bot ya sabe su numero, asi que el
 * clic se puede atribuir al comercio real.
 *
 * NO debita saldo del pack: el debito sigue siendo del enlace firmado
 * (`/c/:id?u=<tel>&s=<hmac>`), que es el unico camino que factura
 * (regla del antifraude). Esto solo COMPLETA la atribucion.
 *
 * Devuelve el comercio y la oferta acreditados, o null si no hay nada que
 * atribuir.
 */
async function atribuirCodigoDeCanje(codigo, telefono){
  const cod=String(codigo||"").trim().toUpperCase();
  const tel=String(telefono||"").replace(/\D/g,"");
  if(!cod||!tel)return null;
  try{
    const rows=await db.select().from(clickLogs).where(eq(clickLogs.codigoCanje,cod)).limit(1);
    const fila=rows&&rows[0];
    if(!fila)return null;
    // Ya atribuido a una persona: no se acredita dos veces.
    if(fila.usuarioTelefono&&fila.usuarioTelefono!=="anonimo")return null;
    await db.update(clickLogs).set({usuarioTelefono:tel}).where(eq(clickLogs.id,fila.id));
    console.log(`[Audience] Codigo ${cod} atribuido a ${tel} (comercio ${fila.comercioId}).`);
    return {comercioId:fila.comercioId,ofertaId:fila.ofertaId,codigoCanje:cod,telefono:tel};
  }catch(error){console.error("[DB Repo] Error atribuyendo codigo de canje:",error);return null}
}
__name(atribuirCodigoDeCanje,"atribuirCodigoDeCanje");
async function seedAudienceUsersIfEmpty(seedList){try{const existing=await getAllAudienceUsers();if(existing.length===0&&seedList.length>0){console.log(`[DB Repo] Sembrando ${seedList.length} usuarios de audiencia en Cloud SQL...`);for(const u of seedList){await upsertAudienceUser(u)}console.log(`[DB Repo] ${seedList.length} usuarios de audiencia sembrados en Cloud SQL exitosamente.`)}}catch(error){console.error("[DB Repo] Error sembrando audience users en Cloud SQL:",error)}}__name(seedAudienceUsersIfEmpty,"seedAudienceUsersIfEmpty");async function insertEmailLog(logItem){try{await db.insert(emailLogs).values({id:logItem.id||`elog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,toEmail:logItem.to||"",subject:logItem.subject||"",provider:logItem.provider||"simulated",status:logItem.status||"simulado",timestamp:logItem.timestamp||new Date().toISOString(),verificationToken:logItem.verificationToken||null,verificationLink:logItem.verificationLink||null,whatsappLink:logItem.whatsappLink||null,error:logItem.error||null})}catch(error){console.error("[DB Repo] Error guardando log de correo:",error)}}__name(insertEmailLog,"insertEmailLog");async function getRecentEmailLogs(limitCount=50){try{const rows=await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(limitCount);return rows.map(r=>({id:r.id,to:r.toEmail,subject:r.subject,provider:r.provider,status:r.status,timestamp:r.timestamp,verificationToken:r.verificationToken,verificationLink:r.verificationLink,whatsappLink:r.whatsappLink,error:r.error}))}catch(error){console.error("[DB Repo] Error obteniendo logs de correo:",error);return[]}}__name(getRecentEmailLogs,"getRecentEmailLogs");async function checkAudienceUserUniqueness(email,phone){try{const cleanEmail=(email||"").trim().toLowerCase();const rows=await getAllAudienceUsers();let isEmailDuplicate=false;let isPhoneDuplicate=false;for(const r of rows){if(cleanEmail&&r.email&&r.email.trim().toLowerCase()===cleanEmail){isEmailDuplicate=true}if(phone&&r.telefono&&phonesMatch(r.telefono,phone)){isPhoneDuplicate=true}}return{exists:isEmailDuplicate||isPhoneDuplicate,isEmailDuplicate,isPhoneDuplicate}}catch(error){console.error("[DB Repo] Error al verificar unicidad de usuario:",error);return{exists:false,isEmailDuplicate:false,isPhoneDuplicate:false}}}__name(checkAudienceUserUniqueness,"checkAudienceUserUniqueness");const inMemoryRegLogs=[];async function insertRegistrationLog(logData){const item={id:`reglog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,email:(logData.email||"").trim().toLowerCase(),telefono:logData.telefono||"",nombre:logData.nombre||"",status:logData.status,resultDetails:logData.resultDetails||(logData.status==="success"?"Registro completado exitosamente":"Error en el proceso de registro"),timestamp:new Date().toISOString()};inMemoryRegLogs.unshift(item);if(inMemoryRegLogs.length>200)inMemoryRegLogs.pop();try{await db.insert(registrationLogs).values({id:item.id,email:item.email,telefono:item.telefono,nombre:item.nombre,status:item.status,resultDetails:item.resultDetails,timestamp:item.timestamp})}catch(error){console.error("[DB Repo] Error guardando log de registro en PostgreSQL:",error)}}__name(insertRegistrationLog,"insertRegistrationLog");async function getRecentRegistrationLogs(limitCount=100){try{const rows=await db.select().from(registrationLogs).orderBy(desc(registrationLogs.createdAt)).limit(limitCount);if(rows.length>0){return rows.map(r=>({id:r.id,email:r.email,telefono:r.telefono||"",nombre:r.nombre||"",status:r.status,resultDetails:r.resultDetails||"",timestamp:r.timestamp,createdAt:r.createdAt}))}}catch(error){console.error("[DB Repo] Error consultando logs de registro en DB, usando fallback:",error)}return inMemoryRegLogs.slice(0,limitCount)}__name(getRecentRegistrationLogs,"getRecentRegistrationLogs");/**
 * Purga total de un usuario de audiencia.
 *
 * La identidad de un usuario de WhatsApp es su NUMERO, no su correo (el
 * correo es null). Por eso la purga tiene que saber borrar por telefono:
 * antes solo miraba `id` y `email`, y con `email` en null el rastro de
 * auditoria (registration_logs, que guarda el telefono) quedaba vivo.
 *
 * Prioridad: `id` > `email` > `telefono`.
 */
async function deleteAndPurgeUser(params){let userDeleted=false;let emailLogsDeleted=false;let regLogsDeleted=false;const targetId=params.id?params.id.trim():"";const targetEmail=params.email?params.email.trim().toLowerCase():"";const targetPhone=params.telefono?String(params.telefono).trim():"";try{if(targetId){await db.delete(audienceUsers).where(eq(audienceUsers.id,targetId));userDeleted=true}else if(targetEmail){const _idx=indiceCiego(targetEmail);await db.delete(audienceUsers).where(_idx?or(eq(audienceUsers.emailIdx,_idx),eq(audienceUsers.email,targetEmail)):eq(audienceUsers.email,targetEmail));userDeleted=true}else if(targetPhone){const _norm=normalizePhoneForMatching(targetPhone);const _tIdx=indiceCiego(_norm.core9||_norm.digits||targetPhone);if(_tIdx){await db.delete(audienceUsers).where(eq(audienceUsers.telefonoIdx,_tIdx));userDeleted=true}else{const _digits=_norm.digits;await db.delete(audienceUsers).where(sql`regexp_replace(coalesce(${audienceUsers.telefono},''), '\\D', '', 'g') = ${_digits}`);userDeleted=true}}}catch(error){console.error("[DB Repo] Error borrando usuario de DB:",error)}if(targetEmail){try{await db.delete(emailLogs).where(eq(emailLogs.toEmail,targetEmail));emailLogsDeleted=true}catch(error){console.error("[DB Repo] Error borrando emailLogs:",error)}}if(targetEmail||targetPhone){try{if(targetEmail){await db.delete(registrationLogs).where(eq(registrationLogs.email,targetEmail))}else{const _norm=normalizePhoneForMatching(targetPhone);await db.delete(registrationLogs).where(sql`regexp_replace(coalesce(${registrationLogs.telefono},''), '\\D', '', 'g') = ${_norm.digits}`)}regLogsDeleted=true}catch(error){console.error("[DB Repo] Error borrando registrationLogs:",error)}for(let i=inMemoryRegLogs.length-1;i>=0;i--){if((targetEmail&&inMemoryRegLogs[i]?.email===targetEmail)||(targetPhone&&String(inMemoryRegLogs[i]?.telefono||"").replace(/\D/g,"")===normalizePhoneForMatching(targetPhone).digits)){inMemoryRegLogs.splice(i,1)}}}return{userDeleted,emailLogsDeleted,regLogsDeleted}}__name(deleteAndPurgeUser,"deleteAndPurgeUser");async function deleteRegistrationLog(idOrEmail){const query=idOrEmail.trim();try{await db.delete(registrationLogs).where(eq(registrationLogs.id,query));if(query.includes("@")){await db.delete(registrationLogs).where(eq(registrationLogs.email,query.toLowerCase()))}}catch(error){console.error("[DB Repo] Error eliminando log de registro:",error)}for(let i=inMemoryRegLogs.length-1;i>=0;i--){if(inMemoryRegLogs[i]?.id===query||inMemoryRegLogs[i]?.email===query.toLowerCase()){inMemoryRegLogs.splice(i,1)}}return true}__name(deleteRegistrationLog,"deleteRegistrationLog");async function clearAllRegistrationLogs(){try{await db.delete(registrationLogs)}catch(error){console.error("[DB Repo] Error limpiando todos los registrationLogs:",error)}inMemoryRegLogs.length=0;return true}__name(clearAllRegistrationLogs,"clearAllRegistrationLogs");const inMemoryClickLogs=[];async function registerOfferClick(arg1: any, arg2?: string, arg3?: string): Promise<{ facturable: boolean; codigoCanje: string }> {
  let ofertaId = "";
  let comercioId = "";
  let telefono = "";

  let saldoDisponible = true;
  if (typeof arg1 === "object" && arg1 !== null) {
    ofertaId = arg1.ofertaId || "";
    comercioId = arg1.comercioId || "merch_01";
    telefono = arg1.usuarioTelefono || arg1.telefono || "anonimo";
    saldoDisponible = arg1.saldoDisponible !== false;
  } else {
    ofertaId = String(arg1 || "");
    comercioId = String(arg2 || "merch_01");
    telefono = String(arg3 || "anonimo");
  }

  const now = new Date();
  const hace24Horas = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cleanPhone = telefono.replace(/\D/g, "") || telefono || "anonimo";

  // Codigo de canje unico global: NV- + 6 chars de alfabeto sin ambiguos (32^6 ~ 1.07e9).
  const _codAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random6 = "";
  for (let _i = 0; _i < 6; _i++) random6 += _codAlphabet[Math.floor(Math.random() * _codAlphabet.length)];
  const codigoCanje = `NV-${random6}`;
  const id = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Consultar la ventana de 24h y dejar el registro son UNA sola operación.
  //
  // Antes eran un SELECT y después un INSERT, con una ventana entre los dos: dos
  // clics concurrentes del mismo (oferta, teléfono) veían los dos la ventana libre,
  // los dos devolvían facturable:true, y el llamador debitaba el pack dos veces.
  // Medido antes del arreglo: 12 de 20 clics concurrentes facturaban.
  //
  // No alcanza con un índice único en (oferta_id, telefono): la ventana es móvil de
  // 24h, así que ese índice bloquearía para siempre el segundo cobro legítimo. Y un
  // índice parcial no puede llevar now() en el predicado, porque los predicados de
  // índice tienen que ser inmutables.
  //
  // El lock es por (oferta, teléfono): serializa solo los clics que compiten por la
  // misma ventana. Teléfonos distintos u ofertas distintas no se esperan entre sí.
  // Con el lock ya tomado, el SELECT ve lo que el otro clic commiteó, y el INSERT
  // ocurre dentro de la misma transacción.
  //
  // Fail-closed: si algo falla no se commitea ni la decisión ni el registro, así que
  // no se factura. Nunca facturar por encima de un error de base de datos.
  let facturable = false;
  let registroPersistido = false;
  try {
    facturable = await db.transaction(async (tx: any) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"clic:" + ofertaId + ":" + cleanPhone})::bigint)`
      );
      const rows = await tx
        .select()
        .from(clickLogs)
        .where(
          and(
            eq(clickLogs.ofertaId, ofertaId),
            eq(clickLogs.usuarioTelefono, cleanPhone),
            eq(clickLogs.facturable, true),
            gte(clickLogs.creadoEn, hace24Horas)
          )
        );
      // La ventana se ancla al último clic facturable; los no facturables no la reinician.
      const existeClicEn24h = !!(rows && rows.length > 0);
      const debeFacturar = !existeClicEn24h && saldoDisponible;
      await tx.insert(clickLogs).values({
        id,
        ofertaId,
        comercioId,
        usuarioTelefono: cleanPhone,
        codigoCanje,
        facturable: debeFacturar,
        creadoEn: now
      } as any);
      return debeFacturar;
    });
    registroPersistido = true;
  } catch (dbErr) {
    console.error("[DB Repo] Error registrando el clic en click_logs (no se factura):", dbErr);
  }

  if (!registroPersistido) {
    // Sin fila en click_logs no existe ventana de 24h: facturar acá sería cobrar sin
    // registro y habilitar un segundo cobro al mismo teléfono. Fail-closed.
    return { facturable: false, codigoCanje };
  }

  return { facturable, codigoCanje };
}__name(registerOfferClick,"registerOfferClick");
async function registerQualifiedLead(arg1, arg2, arg3) {
  return registerOfferClick(arg1, arg2, arg3);
}
__name(registerQualifiedLead, "registerQualifiedLead");
async function incrementOfferLikes(ofertaId) {
  try {
    const rows = await db
      .update(offers)
      .set({ likes: sql`coalesce(${offers.likes}, 0) + 1` })
      .where(eq(offers.id, ofertaId))
      .returning({ likes: offers.likes });
    if (rows && rows.length > 0) {
      return Number(rows[0].likes || 0);
    }
  } catch (error) {
    console.error("[DB Repo] Error incrementando likes:", error);
  }
  return null;
}
__name(incrementOfferLikes, "incrementOfferLikes");
async function getPersistedMerchants() {
  return await getSetting("merchants_list", null);
}
__name(getPersistedMerchants, "getPersistedMerchants");

async function savePersistedMerchants(merchantsList) {
  await saveSetting("merchants_list", merchantsList);
}
__name(savePersistedMerchants, "savePersistedMerchants");

async function getPersistedKanban() {
  return await getSetting("merchants_kanban", null);
}
__name(getPersistedKanban, "getPersistedKanban");

async function savePersistedKanban(kanbanList) {
  await saveSetting("merchants_kanban", kanbanList);
}
__name(savePersistedKanban, "savePersistedKanban");
export{getPersistedMerchants,savePersistedMerchants,getPersistedKanban,savePersistedKanban,checkAudienceUserUniqueness,atribuirCodigoDeCanje,clearAllRegistrationLogs,deleteAndPurgeUser,deleteRegistrationLog,findAudienceUserByPhone,getAllAudienceUsers,getAllBanners,getAllOffers,getRecentEmailLogs,getRecentRegistrationLogs,getSetting,insertEmailLog,insertRegistrationLog,normalizePhoneForMatching,phonesMatch,registerOfferClick,registerQualifiedLead,incrementOfferLikes,saveSetting,seedAudienceUsersIfEmpty,replaceOffers,syncBanners,syncOffers,upsertAudienceUser,upsertAudienceUserSafe};
import{chatLogs}from"./schema.ts";
async function insertChatLog(e){try{await db.insert(chatLogs).values({id:e.id||`clog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,canal:e.canal||"waha",direccion:e.direccion||"entrante",telefono:String(e.telefono||""),contenido:String(e.contenido||"").slice(0,4000),estado:e.estado||"recibido",detalles:String(e.detalles||"").slice(0,2000),timestamp:e.timestamp||new Date().toISOString()})}catch(err){console.error("[DB Repo] Error guardando chat log:",err)}}
__name(insertChatLog,"insertChatLog");
async function getRecentChatLogs(l){try{const rows=await db.select().from(chatLogs).orderBy(desc(chatLogs.createdAt)).limit(l||200);if(rows.length>0)return rows.map(r=>({id:r.id,canal:r.canal,direccion:r.direccion,telefono:r.telefono,contenido:r.contenido,estado:r.estado,detalles:r.detalles||"",timestamp:r.timestamp}));return[]}catch(err){console.error("[DB Repo] Error obteniendo chat logs:",err);return[]}}
__name(getRecentChatLogs,"getRecentChatLogs");
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
async function insertSecurityLog(e){try{await db.insert(securityLogs).values({id:e.id||`sec_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,operadorId:String(e.operadorId||"sistema_seguridad"),operadorNombre:String(e.operadorNombre||"Sistema"),accion:String(e.accion||"evento"),entidad:String(e.entidad||"seguridad"),entidadId:String(e.entidadId||"-"),detalles:String(e.detalles||"")})}catch(err){console.error("[DB Repo] Error guardando security log:",err)}}
__name(insertSecurityLog,"insertSecurityLog");
async function getRecentSecurityLogs(l){try{const rows=await db.select().from(securityLogs).orderBy(desc(securityLogs.createdAt)).limit(l||100);return rows.map(r=>({id:r.id,operadorId:r.operadorId,operadorNombre:r.operadorNombre,accion:r.accion,entidad:r.entidad,entidadId:r.entidadId,detalles:r.detalles,createdAt:r.createdAt}))}catch(err){console.error("[DB Repo] Error obteniendo security logs:",err);return[]}}
__name(getRecentSecurityLogs,"getRecentSecurityLogs");
import{clickPacks}from"./schema.ts";import type{ClickPack}from"../types";
async function listarClickPacks():Promise<ClickPack[]>{const rows=await db.select().from(clickPacks).orderBy(clickPacks.compradoEn,clickPacks.id);return rows.map(r=>({id:r.id,comercioId:r.comercioId,totalClics:r.totalClics,saldoClics:r.saldoClics,precioUnitario:Number(r.precioUnitario),montoTotal:Number(r.montoTotal),estado:r.estado==="agotado"?"agotado":"activo",compradoEn:r.compradoEn}))}__name(listarClickPacks,"listarClickPacks");
async function sembrarClickPacksSiVacio(lista){try{const ya=await db.select({id:clickPacks.id}).from(clickPacks).limit(1);if(ya.length>0)return false;if(!Array.isArray(lista)||lista.length===0)return false;await db.transaction(async(tx)=>{for(const p of lista){await tx.execute(sql`insert into click_packs (id,comercio_id,total_clics,saldo_clics,precio_unitario,monto_total,estado,comprado_en) values (${p.id},${p.comercioId},${p.totalClics},${p.saldoClics},${String(p.precioUnitario)},${String(p.montoTotal)},${p.estado||"activo"},${p.compradoEn||new Date().toISOString()}) on conflict (id) do nothing`)}});return true}catch(err){console.error("[Cloud SQL] Error sembrando packs de clics (transaccion revertida; se reintenta en el proximo arranque):",err);return false}}__name(sembrarClickPacksSiVacio,"sembrarClickPacksSiVacio");
async function insertarClickPack(pack){await db.execute(sql`insert into click_packs (id,comercio_id,total_clics,saldo_clics,precio_unitario,monto_total,estado,comprado_en) values (${pack.id},${pack.comercioId},${pack.totalClics},${pack.saldoClics},${String(pack.precioUnitario)},${String(pack.montoTotal)},${pack.estado||"activo"},${pack.compradoEn||new Date().toISOString()}) on conflict (id) do update set saldo_clics=${pack.saldoClics},estado=${pack.estado||"activo"},updated_at=now()`)}__name(insertarClickPack,"insertarClickPack");
async function debitarClicAtomico(comercioId){const consulta=sql`
    UPDATE click_packs
       SET saldo_clics = saldo_clics - 1,
           estado = CASE WHEN saldo_clics - 1 <= 0 THEN 'agotado' ELSE estado END,
           updated_at = now()
     WHERE id = (
       SELECT id FROM click_packs
        WHERE comercio_id = ${comercioId} AND saldo_clics > 0
        ORDER BY comprado_en ASC, id ASC
        LIMIT 1
     )
       AND saldo_clics > 0
    RETURNING id, saldo_clics`;for(let intento=0;intento<2;intento++){const resultado=await db.execute(consulta);const filas=(resultado&&resultado.rows)?resultado.rows:(Array.isArray(resultado)?resultado:[]);if(filas.length>0){return{exito:true,saldoRestante:Number(filas[0].saldo_clics),packId:filas[0].id}}}return{exito:false,saldoRestante:0,packId:null}}__name(debitarClicAtomico,"debitarClicAtomico");

/**
 * Sincroniza el catalogo geografico (UBIGEGO del INEI) en la tabla
 * `geo_territorios`.
 *
 * Es idempotente: hace UPSERT por codigo, asi que se puede volver a correr
 * con un listado mas nuevo sin duplicar ni perder nada. NO toca la columna
 * `activo` (que decide si el negocio opera ahi): esa la decide el negocio,
 * no el catalogo.
 */
async function sincronizarTerritorios(lista) {
  try {
    if (!Array.isArray(lista) || lista.length === 0) {
      return { ok: false, sembrados: 0, error: "lista vacia" };
    }
    await db.transaction(async (tx) => {
      for (const t of lista) {
        await tx
          .insert(geoTerritorios)
          .values({
            codigo: t.codigo,
            nombre: t.nombre,
            nivel: t.nivel,
            codigoPadre: t.codigoPadre || null,
            departamento: t.departamento,
            provincia: t.provincia,
            activo: false,
            // `any`: mismo problema de Drizzle 0.38 con columnas nullable.
          } as any)
          .onConflictDoUpdate({
            target: geoTerritorios.codigo,
            // `any`: Drizzle 0.38 no tipa bien el `set` cuando la tabla tiene
            // columnas nullable (mismo patron que el resto de este archivo).
            set: {
              nombre: t.nombre,
              nivel: t.nivel,
              codigoPadre: t.codigoPadre || null,
              departamento: t.departamento,
              provincia: t.provincia,
              updatedAt: new Date(),
            } as any,
          });
      }
    });
    return { ok: true, sembrados: lista.length };
  } catch (error) {
    console.error("[DB Repo] Error sincronizando el catalogo geografico:", error);
    return { ok: false, sembrados: 0, error: String((error && error.message) || error) };
  }
}
__name(sincronizarTerritorios, "sincronizarTerritorios");

/**
 * Lee el catalogo geografico. Filtros opcionales: `nivel` ("departamento",
 * "provincia", "distrito"), `departamento` y `provincia` (codigos de 2
 * digitos), `codigoPadre` y `soloActivos`.
 */
async function listarTerritorios(filtros) {
  try {
    const condiciones = [];
    if (filtros && filtros.nivel) condiciones.push(eq(geoTerritorios.nivel, String(filtros.nivel)));
    if (filtros && filtros.departamento) condiciones.push(eq(geoTerritorios.departamento, String(filtros.departamento)));
    if (filtros && filtros.provincia) condiciones.push(eq(geoTerritorios.provincia, String(filtros.provincia)));
    if (filtros && filtros.codigoPadre) condiciones.push(eq(geoTerritorios.codigoPadre, String(filtros.codigoPadre)));
    if (filtros && filtros.soloActivos) condiciones.push(eq(geoTerritorios.activo, true));
    const consulta = condiciones.length
      ? db.select().from(geoTerritorios).where(and(...condiciones))
      : db.select().from(geoTerritorios);
    const filas = await consulta;
    return filas.map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      nivel: r.nivel,
      codigoPadre: r.codigoPadre,
      departamento: r.departamento,
      provincia: r.provincia,
      activo: r.activo === true,
    }));
  } catch (error) {
    console.error("[DB Repo] Error consultando el catalogo geografico:", error);
    return [];
  }
}
__name(listarTerritorios, "listarTerritorios");

/**
 * Marca como ACTIVAS las provincias indicadas (y desactiva las demas).
 *
 * La unidad de negocio es la PROVINCIA: Yuddit abre una provincia cuando
 * entra en esa zona, y el panel de gestion va activando una a una a medida
 * que se expande. El distrito es la UBICACION de la persona dentro de la
 * provincia activa, no la zona de servicio.
 *
 * La columna `activo` de los distritos se deja en false a proposito: lo
 * que decide si un distrito se sirve es su provincia.
 */
async function activarProvincias(codigos) {
  try {
    if (!Array.isArray(codigos) || codigos.length === 0) {
      return { ok: true, activados: 0 };
    }
    const lista = codigos.map((c) => String(c).trim()).filter(Boolean);
    // Las provincias se activan; el resto se desactiva. Asi el panel puede
    // encender y apagar sin dejar residuos. Los distritos NUNCA se activan
    // solos: lo que decide si un distrito se sirve es su provincia.
    await db.execute(sql`update geo_territorios set activo = false, updated_at = now() where nivel <> 'provincia'`);
    await db.execute(sql`update geo_territorios set activo = false, updated_at = now() where nivel = 'provincia'`);
    if (lista.length > 0) {
      await db.execute(
        sql`update geo_territorios set activo = true, updated_at = now() where nivel = 'provincia' and codigo in (${sql.join(
          lista,
          sql`, `,
        )})`,
      );
    }
    const n = await db.execute(
      sql`select count(*)::int as n from geo_territorios where nivel = 'provincia' and activo = true`,
    );
    const filas = n && n.rows ? n.rows : [];
    return { ok: true, activados: filas.length ? Number(filas[0].n) : 0 };
  } catch (error) {
    console.error("[DB Repo] Error activando provincias:", error);
    return { ok: false, activados: 0 };
  }
}
__name(activarProvincias, "activarProvincias");

/**
 * METRICAS DEL PANEL, medidas en la base.
 *
 * Antes, los KPIs del panel se calculaban con `coreEvents` (eventos EN
 * MEMORIA del navegador) y con minimos inventados: el panel mostraba 240
 * usuarios, 625 vistas, 12 ventas y 13,6% de CTR con la base vacia.
 *
 * Aca se mide lo que HAY. Lo que no se puede medir (las ventas
 * confirmadas: no hay tabla que las registre) se devuelve como `null` para
 * que la pantalla pueda decir "sin medir" en vez de inventar un numero.
 */
async function obtenerMetricasGlobales() {
  try {
    const ahoraIso = new Date().toISOString();
    const hace7diasIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const r = await db.execute(sql`
      select
        (select count(*)::int from offers where estado = 'activa' and vence_en > ${ahoraIso}) as ofertas_activas,
        (select count(*)::int from offers) as ofertas_total,
        (select coalesce(sum(vistas), 0)::int from offers) as vistas_ofertas,
        (select count(*)::int from click_logs) as clics,
        (select count(*)::int from click_logs where facturable = true) as leads,
        (select count(*)::int from click_logs where facturable = true and creado_en >= ${hace7diasIso}) as leads_semana,
        (select count(*)::int from audience_users) as usuarios,
        (select count(*)::int from audience_users where estado = 'activo') as usuarios_activos,
        (select count(*)::int from chat_logs) as chats,
        (select count(*)::int from click_packs) as packs,
        (select coalesce(sum(saldo_clics), 0)::int from click_packs) as saldo_clics
    `);
    const fila: any = (r && r.rows && r.rows[0]) || {};

    // Los comercios viven en `app_settings.merchants_list` (JSON).
    const lista = await getSetting("merchants_list", []);
    const comercios = Array.isArray(lista) ? lista : [];
    const comerciosActivos = comercios.filter((m: any) => m && m.estado === "activo").length;

    const clics = Number(fila.clics || 0);
    const vistas = Number(fila.vistas_ofertas || 0);
    return {
      ofertasActivas: Number(fila.ofertas_activas || 0),
      ofertasTotal: Number(fila.ofertas_total || 0),
      // Las vistas NO se incrementan en ningun lado todavia: no se miden.
      totalVistasOfertas: vistas > 0 ? vistas : null,
      totalClicsContactar: clics,
      northStarLeadsSemanales: Number(fila.leads_semana || 0),
      leadsCalificados: Number(fila.leads || 0),
      // El CTR solo existe si hay vistas medidas.
      ctrPromedioGlobal: vistas > 0 ? Number(((clics / vistas) * 100).toFixed(1)) : null,
      // Las ventas confirmadas no tienen tabla: no se miden.
      ventasConfirmadas: null,
      comerciosActivos,
      comerciosTotales: comercios.length,
      usuariosRegistrados: Number(fila.usuarios || 0),
      usuariosActivos: Number(fila.usuarios_activos || 0),
      chats: Number(fila.chats || 0),
      packs: Number(fila.packs || 0),
      saldoClics: Number(fila.saldo_clics || 0),
      // El tiempo de validacion no se registra en ninguna parte.
      tiempoMedianoValidacionHoras: null,
    };
  } catch (error) {
    console.error("[DB Repo] Error calculando las metricas del panel:", error);
    return null;
  }
}
__name(obtenerMetricasGlobales, "obtenerMetricasGlobales");

/** Las mismas metricas, pero de un solo comercio. */
async function obtenerMetricasComercio(comercioId) {
  try {
    const id = String(comercioId || "").trim();
    if (!id) return null;
    const ahoraIso = new Date().toISOString();
    const r = await db.execute(sql`
      select
        (select count(*)::int from offers where comercio_id = ${id} and estado = 'activa' and vence_en > ${ahoraIso}) as ofertas_activas,
        (select coalesce(sum(vistas), 0)::int from offers where comercio_id = ${id}) as vistas_ofertas,
        (select count(*)::int from click_logs where comercio_id = ${id}) as clics,
        (select count(*)::int from click_logs where comercio_id = ${id} and facturable = true) as leads,
        (select coalesce(sum(saldo_clics), 0)::int from click_packs where comercio_id = ${id}) as saldo_clics
    `);
    const fila: any = (r && r.rows && r.rows[0]) || {};
    const clics = Number(fila.clics || 0);
    const vistas = Number(fila.vistas_ofertas || 0);
    return {
      comercioId: id,
      ofertasActivas: Number(fila.ofertas_activas || 0),
      totalVistasOfertas: vistas > 0 ? vistas : null,
      totalClicsContactar: clics,
      northStarLeadsSemanales: Number(fila.leads || 0),
      leadsCalificados: Number(fila.leads || 0),
      ctrPromedioGlobal: vistas > 0 ? Number(((clics / vistas) * 100).toFixed(1)) : null,
      ventasConfirmadas: null,
      saldoClics: Number(fila.saldo_clics || 0),
      // El gasto en soles: lo que el comercio debe a la plataforma por los
      // clics que leVendieron (el precio unitario del pack).
      gastoTotalSoles: 0,
    };
  } catch (error) {
    console.error("[DB Repo] Error calculando las metricas de un comercio:", error);
    return null;
  }
}
__name(obtenerMetricasComercio, "obtenerMetricasComercio");

/**
 * Activa o desactiva UNA provincia (toggle del panel de gestion).
 *
 * La zona de servicio de Yuddit es la provincia: el distrito es la ubicacion
 * de la persona dentro de una provincia activa.
 */
async function establecerProvinciaActiva(codigo, activo) {
  try {
    const c = String(codigo || "").trim();
    if (!c) return { ok: false, error: "falta el codigo" };
    const res = await db.execute(
      sql`update geo_territorios set activo = ${activo === true}, updated_at = now() where nivel = 'provincia' and codigo = ${c}`,
    );
    return { ok: true, filas: res && res.rowCount !== undefined ? res.rowCount : 0 };
  } catch (error) {
    console.error("[DB Repo] Error cambiando el estado de una provincia:", error);
    return { ok: false, error: String((error && error.message) || error) };
  }
}
__name(establecerProvinciaActiva, "establecerProvinciaActiva");

/** Cuenta los territorios por nivel (para verificar la siembra). */
async function contarTerritorios() {
  try {
    const filas = await db
      .select({ nivel: geoTerritorios.nivel, c: sql`count(*)::int` })
      .from(geoTerritorios)
      .groupBy(geoTerritorios.nivel);
    const out = {};
    for (const f of filas) out[f.nivel] = Number(f.c);
    return out;
  } catch (error) {
    console.error("[DB Repo] Error contando el catalogo geografico:", error);
    return {};
  }
}
__name(contarTerritorios, "contarTerritorios");

export{insertChatLog,getRecentChatLogs,insertSecurityLog,getRecentSecurityLogs,insertSession,getSession,revokeSession,revokeSessionsByUser,listSessionsByUser,purgeExpiredSessions,migrarPiiAudiencia,normalizarEmailsAudiencia,getLoginFailureDb,registrarLoginFallidoDb,limpiarLoginFallidoDb,getAuthUsersDb,insertAuthUserDb,updateAuthUserDb,deleteAuthUserDb,consumeTotpBackupHashDb,migrateAuthUsersABTablaDb,listarClickPacks,sembrarClickPacksSiVacio,insertarClickPack,debitarClicAtomico,sincronizarTerritorios,listarTerritorios,contarTerritorios,activarProvincias,establecerProvinciaActiva,obtenerMetricasGlobales,obtenerMetricasComercio};
