var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});import{db}from"./index.ts";import{appSettings,offers,banners,audienceUsers,emailLogs,registrationLogs,clickLogs,securityLogs,sessions}from"./schema.ts";import{eq,desc,and,or,gte,notInArray,sql}from"drizzle-orm";import{cifrarCampo,descifrarCampo,indiceCiego,estaCifrado,piiHabilitado}from"../utils/pii.ts";async function getSetting(key,defaultValue){try{const rows=await db.select().from(appSettings).where(eq(appSettings.key,key));if(rows.length>0&&rows[0].value){return JSON.parse(rows[0].value)}return defaultValue}catch(error){console.error(`[DB Repo] Error al obtener setting '${key}':`,error);return defaultValue}}__name(getSetting,"getSetting");async function saveSetting(key,value){try{const valString=JSON.stringify(value);await db.insert(appSettings).values({key,value:valString,updatedAt:new Date}).onConflictDoUpdate({target:appSettings.key,set:{value:valString,updatedAt:new Date}})}catch(error){console.error(`[DB Repo] Error al guardar setting '${key}':`,error);throw new Error(`Failed to save setting '${key}'`,{cause:error})}}__name(saveSetting,"saveSetting");async function getAllOffers(){try{const rows=await db.select().from(offers);return rows.map(r=>({...r,precioNormal:Number(r.precioNormal),precioOferta:Number(r.precioOferta),lat:Number(r.lat),lng:Number(r.lng),likes:r.likes||0,vistas:r.vistas||0,clics:r.clics||0,leadsCalificados:r.leadsCalificados||0}))}catch(error){console.error("[DB Repo] Error al obtener ofertas:",error);return[]}}__name(getAllOffers,"getAllOffers");async function replaceOffers(offersList){try{const _oids=offersList.map(o=>o.id);if(_oids.length>0){await db.delete(offers).where(notInArray(offers.id,_oids))}else{await db.delete(offers)}}catch(error){console.error("[DB Repo] Error limpiando ofertas obsoletas:",error)}return await syncOffers(offersList)}__name(replaceOffers,"replaceOffers");async function syncOffers(offersList){try{for(const o of offersList){await db.insert(offers).values({id:o.id,codigoUrl:o.codigoUrl||`oferta-${o.id}`,comercioId:o.comercioId||"comercio-default",comercioNombre:o.comercioNombre||"Comercio Yuddit",comercioWhatsapp:o.comercioWhatsapp||"51987654321",titulo:o.titulo||"",descripcion:o.descripcion||"",tipo:o.tipo||"descuento_porcentaje",precioNormal:String(o.precioNormal??0),precioOferta:String(o.precioOferta??0),stock:o.stock??null,categoria:o.categoria||"Gastronom\xEDa y Caf\xE9",distrito:o.distrito||"Miraflores",provincia:o.provincia||"Lima",lat:String(o.lat??-12.12),lng:String(o.lng??-77.03),imagenes:o.imagenes||[],venceEn:o.venceEn||new Date(Date.now()+30*864e5).toISOString(),estado:o.estado||"activa",likes:o.likes||0,vistas:o.vistas||0,clics:o.clics||0,leadsCalificados:o.leadsCalificados||0,videoUrl:o.videoUrl||null,creadaEn:o.creadaEn||new Date().toISOString(),updatedAt:new Date}).onConflictDoUpdate({target:offers.id,set:{titulo:o.titulo||"",descripcion:o.descripcion||"",precioNormal:String(o.precioNormal??0),precioOferta:String(o.precioOferta??0),stock:o.stock??null,categoria:o.categoria||"",distrito:o.distrito||"",provincia:o.provincia||"",lat:String(o.lat??-12.12),lng:String(o.lng??-77.03),imagenes:o.imagenes||[],venceEn:o.venceEn||new Date().toISOString(),estado:o.estado||"activa",likes:o.likes||0,vistas:o.vistas||0,clics:o.clics||0,leadsCalificados:o.leadsCalificados||0,videoUrl:o.videoUrl||null,updatedAt:new Date}})}}catch(error){console.error("[DB Repo] Error sincronizando ofertas:",error);throw new Error("Failed to sync offers",{cause:error})}}__name(syncOffers,"syncOffers");async function getAllBanners(){try{const rows=await db.select().from(banners);return rows}catch(error){console.error("[DB Repo] Error al obtener banners:",error);return[]}}__name(getAllBanners,"getAllBanners");async function syncBanners(bannerList){try{const _bids=bannerList.map(b=>b.id);if(_bids.length>0){await db.delete(banners).where(notInArray(banners.id,_bids))}else{await db.delete(banners)}for(const b of bannerList){await db.insert(banners).values({id:b.id,titulo:b.titulo,subtitulo:b.subtitulo,imagenUrl:b.imagenUrl,enlaceUrl:b.enlaceUrl||null,activado:b.activado!==false,orden:b.orden||1}).onConflictDoUpdate({target:banners.id,set:{titulo:b.titulo,subtitulo:b.subtitulo,imagenUrl:b.imagenUrl,enlaceUrl:b.enlaceUrl||null,activado:b.activado!==false,orden:b.orden||1}})}}catch(error){console.error("[DB Repo] Error sincronizando banners:",error);throw new Error("Failed to sync banners",{cause:error})}}__name(syncBanners,"syncBanners");async function upsertAudienceUser(user){try{
  const safeEmail = (user.email && user.email.trim()) ? user.email.trim() : `${user.id}@whatsapp.yuddit.com`;
  const insertVals: any = {
    id: user.id,
    email: safeEmail,
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
  if (user.email && user.email.trim()) {
    updateSet.email = user.email.trim();
  }
  await db.insert(audienceUsers).values(insertVals).onConflictDoUpdate({
    target: audienceUsers.id,
    set: updateSet
  });
}catch(error){
  console.error("[DB Repo] Error guardando audience user:", error);
  throw new Error("Failed to upsert audience user", { cause: error });
}}__name(upsertAudienceUser,"upsertAudienceUser");async function upsertAudienceUserSafe(user){
  try {
    const safeEmail = (user.email && user.email.trim()) ? user.email.trim() : `${user.id}@whatsapp.yuddit.com`;
    const insertVals: any = {
      id: user.id,
      email: cifrarCampo(safeEmail),
      emailIdx: indiceCiego(safeEmail),
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
    if (user.email && user.email.trim()) {
      updateSet.email = cifrarCampo(user.email.trim());
      updateSet.emailIdx = indiceCiego(user.email.trim());
    }
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
async function seedAudienceUsersIfEmpty(seedList){try{const existing=await getAllAudienceUsers();if(existing.length===0&&seedList.length>0){console.log(`[DB Repo] Sembrando ${seedList.length} usuarios de audiencia en Cloud SQL...`);for(const u of seedList){await upsertAudienceUser(u)}console.log(`[DB Repo] ${seedList.length} usuarios de audiencia sembrados en Cloud SQL exitosamente.`)}}catch(error){console.error("[DB Repo] Error sembrando audience users en Cloud SQL:",error)}}__name(seedAudienceUsersIfEmpty,"seedAudienceUsersIfEmpty");async function insertEmailLog(logItem){try{await db.insert(emailLogs).values({id:logItem.id||`elog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,toEmail:logItem.to||"",subject:logItem.subject||"",provider:logItem.provider||"simulated",status:logItem.status||"simulado",timestamp:logItem.timestamp||new Date().toISOString(),verificationToken:logItem.verificationToken||null,verificationLink:logItem.verificationLink||null,whatsappLink:logItem.whatsappLink||null,error:logItem.error||null})}catch(error){console.error("[DB Repo] Error guardando log de correo:",error)}}__name(insertEmailLog,"insertEmailLog");async function getRecentEmailLogs(limitCount=50){try{const rows=await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(limitCount);return rows.map(r=>({id:r.id,to:r.toEmail,subject:r.subject,provider:r.provider,status:r.status,timestamp:r.timestamp,verificationToken:r.verificationToken,verificationLink:r.verificationLink,whatsappLink:r.whatsappLink,error:r.error}))}catch(error){console.error("[DB Repo] Error obteniendo logs de correo:",error);return[]}}__name(getRecentEmailLogs,"getRecentEmailLogs");async function checkAudienceUserUniqueness(email,phone){try{const cleanEmail=(email||"").trim().toLowerCase();const rows=await getAllAudienceUsers();let isEmailDuplicate=false;let isPhoneDuplicate=false;for(const r of rows){if(cleanEmail&&r.email&&r.email.trim().toLowerCase()===cleanEmail){isEmailDuplicate=true}if(phone&&r.telefono&&phonesMatch(r.telefono,phone)){isPhoneDuplicate=true}}return{exists:isEmailDuplicate||isPhoneDuplicate,isEmailDuplicate,isPhoneDuplicate}}catch(error){console.error("[DB Repo] Error al verificar unicidad de usuario:",error);return{exists:false,isEmailDuplicate:false,isPhoneDuplicate:false}}}__name(checkAudienceUserUniqueness,"checkAudienceUserUniqueness");const inMemoryRegLogs=[];async function insertRegistrationLog(logData){const item={id:`reglog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,email:(logData.email||"").trim().toLowerCase(),telefono:logData.telefono||"",nombre:logData.nombre||"",status:logData.status,resultDetails:logData.resultDetails||(logData.status==="success"?"Registro completado exitosamente":"Error en el proceso de registro"),timestamp:new Date().toISOString()};inMemoryRegLogs.unshift(item);if(inMemoryRegLogs.length>200)inMemoryRegLogs.pop();try{await db.insert(registrationLogs).values({id:item.id,email:item.email,telefono:item.telefono,nombre:item.nombre,status:item.status,resultDetails:item.resultDetails,timestamp:item.timestamp})}catch(error){console.error("[DB Repo] Error guardando log de registro en PostgreSQL:",error)}}__name(insertRegistrationLog,"insertRegistrationLog");async function getRecentRegistrationLogs(limitCount=100){try{const rows=await db.select().from(registrationLogs).orderBy(desc(registrationLogs.createdAt)).limit(limitCount);if(rows.length>0){return rows.map(r=>({id:r.id,email:r.email,telefono:r.telefono||"",nombre:r.nombre||"",status:r.status,resultDetails:r.resultDetails||"",timestamp:r.timestamp,createdAt:r.createdAt}))}}catch(error){console.error("[DB Repo] Error consultando logs de registro en DB, usando fallback:",error)}return inMemoryRegLogs.slice(0,limitCount)}__name(getRecentRegistrationLogs,"getRecentRegistrationLogs");async function deleteAndPurgeUser(params){let userDeleted=false;let emailLogsDeleted=false;let regLogsDeleted=false;const targetId=params.id?params.id.trim():"";const targetEmail=params.email?params.email.trim().toLowerCase():"";try{if(targetId){await db.delete(audienceUsers).where(eq(audienceUsers.id,targetId));userDeleted=true}else if(targetEmail){const _idx=indiceCiego(targetEmail);await db.delete(audienceUsers).where(_idx?or(eq(audienceUsers.emailIdx,_idx),eq(audienceUsers.email,targetEmail)):eq(audienceUsers.email,targetEmail));userDeleted=true}}catch(error){console.error("[DB Repo] Error borrando usuario de DB:",error)}if(targetEmail){try{await db.delete(emailLogs).where(eq(emailLogs.toEmail,targetEmail));emailLogsDeleted=true}catch(error){console.error("[DB Repo] Error borrando emailLogs:",error)}try{await db.delete(registrationLogs).where(eq(registrationLogs.email,targetEmail));regLogsDeleted=true}catch(error){console.error("[DB Repo] Error borrando registrationLogs:",error)}for(let i=inMemoryRegLogs.length-1;i>=0;i--){if(inMemoryRegLogs[i]?.email===targetEmail){inMemoryRegLogs.splice(i,1)}}}return{userDeleted,emailLogsDeleted,regLogsDeleted}}__name(deleteAndPurgeUser,"deleteAndPurgeUser");async function deleteRegistrationLog(idOrEmail){const query=idOrEmail.trim();try{await db.delete(registrationLogs).where(eq(registrationLogs.id,query));if(query.includes("@")){await db.delete(registrationLogs).where(eq(registrationLogs.email,query.toLowerCase()))}}catch(error){console.error("[DB Repo] Error eliminando log de registro:",error)}for(let i=inMemoryRegLogs.length-1;i>=0;i--){if(inMemoryRegLogs[i]?.id===query||inMemoryRegLogs[i]?.email===query.toLowerCase()){inMemoryRegLogs.splice(i,1)}}return true}__name(deleteRegistrationLog,"deleteRegistrationLog");async function clearAllRegistrationLogs(){try{await db.delete(registrationLogs)}catch(error){console.error("[DB Repo] Error limpiando todos los registrationLogs:",error)}inMemoryRegLogs.length=0;return true}__name(clearAllRegistrationLogs,"clearAllRegistrationLogs");const inMemoryClickLogs=[];async function registerOfferClick(arg1: any, arg2?: string, arg3?: string): Promise<{ facturable: boolean; codigoCanje: string }> {
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

  // Busca en clickLogs si existe un clic de ese teléfono para esa oferta en las últimas 24h
  let existeClicEn24h = false;
  let ventanaVerificada = false;
  try {
    const rows = await db
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
    existeClicEn24h = !!(rows && rows.length > 0);
    ventanaVerificada = true;
  } catch (err) {
    console.error("[DB Repo] Error consultando clickLogs en PostgreSQL (no se factura):", err);
  }

  // Facturable solo si no hubo clic facturable en 24h y el comercio tiene saldo.
  // La ventana se ancla al último clic facturable; los no facturables no la reinician.
  // Fail-closed: si falla la lectura no se puede afirmar que la ventana esté libre,
  // así que no se factura. Nunca facturar por encima de un error de base de datos.
  const facturable = ventanaVerificada && !existeClicEn24h && saldoDisponible;
  // Codigo de canje unico global: NV- + 6 chars de alfabeto sin ambiguos (32^6 ~ 1.07e9).
  const _codAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random6 = "";
  for (let _i = 0; _i < 6; _i++) random6 += _codAlphabet[Math.floor(Math.random() * _codAlphabet.length)];
  const codigoCanje = `NV-${random6}`;
  const id = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let registroPersistido = false;
  try {
    await db.insert(clickLogs).values({
      id,
      ofertaId,
      comercioId,
      usuarioTelefono: cleanPhone,
      codigoCanje,
      facturable,
      creadoEn: now
    } as any);
    registroPersistido = true;
  } catch (dbErr) {
    console.error("[DB Repo] Error insertando registro en clickLogs:", dbErr);
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
export{getPersistedMerchants,savePersistedMerchants,getPersistedKanban,savePersistedKanban,checkAudienceUserUniqueness,clearAllRegistrationLogs,deleteAndPurgeUser,deleteRegistrationLog,findAudienceUserByPhone,getAllAudienceUsers,getAllBanners,getAllOffers,getRecentEmailLogs,getRecentRegistrationLogs,getSetting,insertEmailLog,insertRegistrationLog,normalizePhoneForMatching,phonesMatch,registerOfferClick,registerQualifiedLead,incrementOfferLikes,saveSetting,seedAudienceUsersIfEmpty,replaceOffers,syncBanners,syncOffers,upsertAudienceUser,upsertAudienceUserSafe};
import{chatLogs}from"./schema.ts";
async function insertChatLog(e){try{await db.insert(chatLogs).values({id:e.id||`clog_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,canal:e.canal||"waha",direccion:e.direccion||"entrante",telefono:String(e.telefono||""),contenido:String(e.contenido||"").slice(0,4000),estado:e.estado||"recibido",detalles:String(e.detalles||"").slice(0,2000),timestamp:e.timestamp||new Date().toISOString()})}catch(err){console.error("[DB Repo] Error guardando chat log:",err)}}
__name(insertChatLog,"insertChatLog");
async function getRecentChatLogs(l){try{const rows=await db.select().from(chatLogs).orderBy(desc(chatLogs.createdAt)).limit(l||200);if(rows.length>0)return rows.map(r=>({id:r.id,canal:r.canal,direccion:r.direccion,telefono:r.telefono,contenido:r.contenido,estado:r.estado,detalles:r.detalles||"",timestamp:r.timestamp}));return[]}catch(err){console.error("[DB Repo] Error obteniendo chat logs:",err);return[]}}
__name(getRecentChatLogs,"getRecentChatLogs");
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
export{insertChatLog,getRecentChatLogs,insertSecurityLog,getRecentSecurityLogs,insertSession,getSession,revokeSession,revokeSessionsByUser,listSessionsByUser,purgeExpiredSessions,migrarPiiAudiencia};
