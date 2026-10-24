/**
 * Capa de datos — audiencia (la persona del otro lado): alta, identidad por telefono, PII y borrado.
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{audienceUsers,emailLogs,registrationLogs,clickLogs}from"../schema.ts";
import{eq,or,and,gte,isNotNull,sql}from"drizzle-orm";
import{cifrarCampo,descifrarCampo,indiceCiego,estaCifrado,piiHabilitado}from"../../utils/pii.ts";
import{inMemoryRegLogs}from"./logs.ts";

/**
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
    // El CODIGO del distrito y de la provincia: el nombre solo no
    // identifica un lugar (en el Peru hay 99 nombres de distrito
    // repetidos, "Santa Rosa" aparece 10 veces).
    distritoCodigo: user.distritoCodigo || null,
    provinciaCodigo: user.provinciaCodigo || null,
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
    // El CODIGO del distrito y de la provincia: el nombre solo no
    // identifica un lugar (en el Peru hay 99 nombres de distrito
    // repetidos, "Santa Rosa" aparece 10 veces).
    distritoCodigo: user.distritoCodigo || null,
    provinciaCodigo: user.provinciaCodigo || null,
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
}}__name(upsertAudienceUser,"upsertAudienceUser");

async function upsertAudienceUserSafe(user){
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
    // El CODIGO del distrito y de la provincia: el nombre solo no
    // identifica un lugar (en el Peru hay 99 nombres de distrito
    // repetidos, "Santa Rosa" aparece 10 veces).
    distritoCodigo: user.distritoCodigo || null,
    provinciaCodigo: user.provinciaCodigo || null,
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
    // El CODIGO del distrito y de la provincia: el nombre solo no
    // identifica un lugar (en el Peru hay 99 nombres de distrito
    // repetidos, "Santa Rosa" aparece 10 veces).
    distritoCodigo: user.distritoCodigo || null,
    provinciaCodigo: user.provinciaCodigo || null,
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
}__name(upsertAudienceUserSafe,"upsertAudienceUserSafe");

function normalizePhoneForMatching(raw){if(!raw)return{digits:"",core9:""};let digits=raw.replace(/\D/g,"");if(digits.startsWith("00"))digits=digits.slice(2);if(digits.startsWith("5151")&&digits.length>=13){digits=digits.slice(2)}if(digits.startsWith("0")&&digits.length===10){digits=digits.slice(1)}const core9=digits.length>=9?digits.slice(-9):digits;return{digits,core9}}__name(normalizePhoneForMatching,"normalizePhoneForMatching");

function phonesMatch(phoneA,phoneB){const normA=normalizePhoneForMatching(phoneA);const normB=normalizePhoneForMatching(phoneB);if(!normA.digits||!normB.digits)return false;if(normA.digits===normB.digits)return true;if(normA.digits.endsWith(normB.digits)||normB.digits.endsWith(normA.digits))return true;if(normA.core9.length>=7&&normA.core9===normB.core9)return true;return false}__name(phonesMatch,"phonesMatch");

async function findAudienceUserByPhone(phone){try{const norm=normalizePhoneForMatching(phone);if(!norm.digits)return null;const allUsers=await getAllAudienceUsers();const found=allUsers.find(u=>{if(!u.telefono)return false;return phonesMatch(u.telefono,phone)});return found||null}catch(error){console.error("[DB Repo] Error buscando usuario por tel\xE9fono:",error);return null}}__name(findAudienceUserByPhone,"findAudienceUserByPhone");

async function getAllAudienceUsers(){try{const rows=await db.select().from(audienceUsers);return rows.map(r=>({...r,email:descifrarCampo(r.email),nombre:descifrarCampo(r.nombre),apellido:descifrarCampo(r.apellido),telefono:descifrarCampo(r.telefono)}))}catch(error){console.error("[DB Repo] Error consultando audience users:",error);return[]}}__name(getAllAudienceUsers,"getAllAudienceUsers");

async function migrarPiiAudiencia(){try{if(!piiHabilitado())return;const rows=await db.select().from(audienceUsers);let hechas=0;for(const r of rows){const set:any={};if(r.email&&!estaCifrado(r.email)){set.email=cifrarCampo(r.email)}if(!r.emailIdx&&r.email){set.emailIdx=indiceCiego(descifrarCampo(r.email))}if(r.nombre&&!estaCifrado(r.nombre)){set.nombre=cifrarCampo(r.nombre)}if(r.apellido&&!estaCifrado(r.apellido)){set.apellido=cifrarCampo(r.apellido)}if(r.telefono&&!estaCifrado(r.telefono)){set.telefono=cifrarCampo(r.telefono)}if(!r.telefonoIdx&&r.telefono){const _t=descifrarCampo(r.telefono);const _norm=normalizePhoneForMatching(_t);set.telefonoIdx=indiceCiego(_norm.core9||_norm.digits||_t)}if(Object.keys(set).length===0)continue;await db.update(audienceUsers).set(set).where(eq(audienceUsers.id,r.id));hechas++}console.log(`[PII] Migracion de audiencia: ${hechas} fila(s) cifradas de ${rows.length}.`)}catch(err){console.error("[PII] Error en migracion de audiencia (se reintentara en el proximo arranque):",err)}}
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

async function seedAudienceUsersIfEmpty(seedList){try{const existing=await getAllAudienceUsers();if(existing.length===0&&seedList.length>0){console.log(`[DB Repo] Sembrando ${seedList.length} usuarios de audiencia en Cloud SQL...`);for(const u of seedList){await upsertAudienceUser(u)}console.log(`[DB Repo] ${seedList.length} usuarios de audiencia sembrados en Cloud SQL exitosamente.`)}}catch(error){console.error("[DB Repo] Error sembrando audience users en Cloud SQL:",error)}}__name(seedAudienceUsersIfEmpty,"seedAudienceUsersIfEmpty");

async function checkAudienceUserUniqueness(email,phone){try{const cleanEmail=(email||"").trim().toLowerCase();const rows=await getAllAudienceUsers();let isEmailDuplicate=false;let isPhoneDuplicate=false;for(const r of rows){if(cleanEmail&&r.email&&r.email.trim().toLowerCase()===cleanEmail){isEmailDuplicate=true}if(phone&&r.telefono&&phonesMatch(r.telefono,phone)){isPhoneDuplicate=true}}return{exists:isEmailDuplicate||isPhoneDuplicate,isEmailDuplicate,isPhoneDuplicate}}catch(error){console.error("[DB Repo] Error al verificar unicidad de usuario:",error);return{exists:false,isEmailDuplicate:false,isPhoneDuplicate:false}}}__name(checkAudienceUserUniqueness,"checkAudienceUserUniqueness");

/**
 * Purga total de un usuario de audiencia.
 *
 * La identidad de un usuario de WhatsApp es su NUMERO, no su correo (el
 * correo es null). Por eso la purga tiene que saber borrar por telefono:
 * antes solo miraba `id` y `email`, y con `email` en null el rastro de
 * auditoria (registration_logs, que guarda el telefono) quedaba vivo.
 *
 * Prioridad: `id` > `email` > `telefono`.
 */
async function deleteAndPurgeUser(params){let userDeleted=false;let emailLogsDeleted=false;let regLogsDeleted=false;const targetId=params.id?params.id.trim():"";const targetEmail=params.email?params.email.trim().toLowerCase():"";const targetPhone=params.telefono?String(params.telefono).trim():"";try{if(targetId){await db.delete(audienceUsers).where(eq(audienceUsers.id,targetId));userDeleted=true}else if(targetEmail){const _idx=indiceCiego(targetEmail);await db.delete(audienceUsers).where(_idx?or(eq(audienceUsers.emailIdx,_idx),eq(audienceUsers.email,targetEmail)):eq(audienceUsers.email,targetEmail));userDeleted=true}else if(targetPhone){const _norm=normalizePhoneForMatching(targetPhone);const _tIdx=indiceCiego(_norm.core9||_norm.digits||targetPhone);if(_tIdx){await db.delete(audienceUsers).where(eq(audienceUsers.telefonoIdx,_tIdx));userDeleted=true}else{const _digits=_norm.digits;await db.delete(audienceUsers).where(sql`regexp_replace(coalesce(${audienceUsers.telefono},''), '\\D', '', 'g') = ${_digits}`);userDeleted=true}}}catch(error){console.error("[DB Repo] Error borrando usuario de DB:",error)}if(targetEmail){try{await db.delete(emailLogs).where(eq(emailLogs.toEmail,targetEmail));emailLogsDeleted=true}catch(error){console.error("[DB Repo] Error borrando emailLogs:",error)}}if(targetEmail||targetPhone){try{if(targetEmail){await db.delete(registrationLogs).where(eq(registrationLogs.email,targetEmail))}else{const _norm=normalizePhoneForMatching(targetPhone);await db.delete(registrationLogs).where(sql`regexp_replace(coalesce(${registrationLogs.telefono},''), '\\D', '', 'g') = ${_norm.digits}`)}regLogsDeleted=true}catch(error){console.error("[DB Repo] Error borrando registrationLogs:",error)}for(let i=inMemoryRegLogs.length-1;i>=0;i--){if((targetEmail&&inMemoryRegLogs[i]?.email===targetEmail)||(targetPhone&&String(inMemoryRegLogs[i]?.telefono||"").replace(/\D/g,"")===normalizePhoneForMatching(targetPhone).digits)){inMemoryRegLogs.splice(i,1)}}}return{userDeleted,emailLogsDeleted,regLogsDeleted}}__name(deleteAndPurgeUser,"deleteAndPurgeUser");


/**
 * YUD-52 R2 (cierre): verificacion de correo con prueba de buzon.
 *
 * Antes: el token lo ELEGIA el cliente y viajaba en el alta publica
 * (sync-user), sync-user devolvia el registro completo (con token) y
 * cualquier re-sync podia sobrescribir correo/token/estado de otra fila.
 * Poseer el token no probaba control del buzon.
 *
 * Ahora:
 * - el token SOLO lo genera el servidor en el alta nueva; nunca se acepta
 *   del cliente ni se devuelve por API,
 * - el alta publica es INSERT-ONLY: un id existente no se muta por esa via
 *   (perfil, correo, token, estado y verificacion quedan intactos),
 * - el token viaja unicamente por correo; los lookups son selectivos por
 *   email_idx / verification_token (indexados), no full-scan,
 * - el token es de UN SOLO USO y VENCE (VENTANA_TOKEN_VERIFICACION_MS): al
 *   verificar se consume; si vencio, el reenvio genera uno nuevo en servidor.
 */
const VENTANA_TOKEN_VERIFICACION_MS = 48 * 3600 * 1000;

function generarTokenVerificacion(): string {
  // crypto global (Node 19+/Bun): 256 bits de entropia.
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}__name(generarTokenVerificacion,"generarTokenVerificacion");

function tokenVerificacionVigente(u): boolean {
  // SOLO cuentan tokens con sello de servidor (verificationTokenCreadoEn).
  // Filas legacy (token elegido por el cliente, sin sello) NO verifican: el
  // titular pide reenvio y el servidor emite token nuevo con sello propio.
  if (!u || !u.verificationToken || !u.verificationTokenCreadoEn) return false;
  const base = Date.parse(String(u.verificationTokenCreadoEn));
  if (!Number.isFinite(base)) return false;
  return Date.now() - base <= VENTANA_TOKEN_VERIFICACION_MS;
}__name(tokenVerificacionVigente,"tokenVerificacionVigente");

/** Lookup selectivo por indice ciego del correo (sin full-scan ni descifrado masivo). */
async function buscarAudienceUsersPorEmailIdx(emailIdx) {
  if (!emailIdx) return [];
  try {
    return await db.select().from(audienceUsers).where(eq(audienceUsers.emailIdx, emailIdx));
  } catch (error) {
    console.error("[DB Repo] Error buscando audiencia por email_idx:", error);
    throw new Error("Failed to query audience by email_idx", { cause: error });
  }
}__name(buscarAudienceUsersPorEmailIdx,"buscarAudienceUsersPorEmailIdx");

/** Lookup selectivo por token de verificacion (alta entropia, indexado). */
async function buscarAudienceUserPorTokenVerificacion(token) {
  const t = String(token || "").trim();
  if (!t) return null;
  try {
    const rows = await db.select().from(audienceUsers).where(eq(audienceUsers.verificationToken, t));
    return rows[0] || null;
  } catch (error) {
    console.error("[DB Repo] Error buscando audiencia por token:", error);
    throw new Error("Failed to query audience by verification token", { cause: error });
  }
}__name(buscarAudienceUserPorTokenVerificacion,"buscarAudienceUserPorTokenVerificacion");

/** Alta nueva de audiencia pendiente: INSERT puro (nunca upsert) con token de
 * servidor. Defensa de concurrencia SIN constraint UNIQUE (pendiente de
 * auditoria de datos): advisory lock por email_idx dentro de la transaccion
 * serializa altas del mismo correo; si ya existe, no inserta ni toca la fila
 * (devuelve {duplicado:true}; jamas borra ni fusiona registros). */
async function insertarAudiencePendiente(user) {
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
      distritoCodigo: user.distritoCodigo || null,
      provinciaCodigo: user.provinciaCodigo || null,
      provincia: user.provincia || null,
      ciudad: user.ciudad || null,
      emailVerificado: false,
      verificationToken: user.verificationToken,
      verificationTokenCreadoEn: new Date().toISOString(),
      codigoRef: user.codigoRef || null,
      puntosSaldo: 0,
      estado: "pendiente",
      categoriasInteres: Array.isArray(user.categoriasInteres) ? user.categoriasInteres : [],
      consentimientos: {},
      utm: user.utm || {},
      registradoEn: new Date().toISOString()
    };
    return await db.transaction(async (tx) => {
      const emailIdx = insertVals.emailIdx;
      if (emailIdx) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${emailIdx}))`);
        const dup = await tx.select({ id: audienceUsers.id }).from(audienceUsers).where(eq(audienceUsers.emailIdx, emailIdx));
        if (dup.length > 0) return { duplicado: true };
      }
      await tx.insert(audienceUsers).values(insertVals);
      return { duplicado: false };
    });
  } catch (error) {
    console.error("[DB Repo] Error insertando audience pendiente:", error);
    throw new Error("Failed to insert pending audience user", { cause: error });
  }
}__name(insertarAudiencePendiente,"insertarAudiencePendiente");

/** Reenvio: regenera token en servidor cuando el actual falta o vencio. Devuelve el token nuevo. */
async function renovarTokenVerificacionAudience(id) {
  const token = generarTokenVerificacion();
  try {
    const updateSet: any = { verificationToken: token, verificationTokenCreadoEn: new Date().toISOString() };
    await db.update(audienceUsers).set(updateSet).where(eq(audienceUsers.id, id));
    return token;
  } catch (error) {
    console.error("[DB Repo] Error renovando token de verificacion:", error);
    throw new Error("Failed to renew verification token", { cause: error });
  }
}__name(renovarTokenVerificacionAudience,"renovarTokenVerificacionAudience");

/** Consumo ATOMICO del token: un solo UPDATE con TODAS las condiciones
 * (token + sello servidor + vigencia + no verificado). Dos verificaciones
 * concurrentes del mismo token: solo una actualiza; la otra recibe 0 filas.
 * Devuelve {consumido} y, si no consumio, {expirado} segun exista aun la
 * fila con ese token (para 410 vs 404; los tokens son inadivinables). */
async function consumirTokenVerificacionAudience(token) {
  const t = String(token || "").trim();
  if (!t) return { consumido: false, expirado: false };
  const corte = new Date(Date.now() - VENTANA_TOKEN_VERIFICACION_MS).toISOString();
  try {
    const updateSet: any = { emailVerificado: true, estado: "activo", verificationToken: null, verificationTokenCreadoEn: null };
    const rows = await db.update(audienceUsers).set(updateSet)
      .where(and(
        eq(audienceUsers.verificationToken, t),
        isNotNull(audienceUsers.verificationTokenCreadoEn),
        gte(audienceUsers.verificationTokenCreadoEn, corte),
        eq(audienceUsers.emailVerificado, false)
      ))
      .returning({ id: audienceUsers.id });
    if (rows.length > 0) return { consumido: true, expirado: false };
    const fila = await buscarAudienceUserPorTokenVerificacion(t);
    return { consumido: false, expirado: Boolean(fila) };
  } catch (error) {
    console.error("[DB Repo] Error consumiendo token de verificacion:", error);
    throw new Error("Failed to consume verification token", { cause: error });
  }
}__name(consumirTokenVerificacionAudience,"consumirTokenVerificacionAudience");

/** Verificacion efectiva: marca y CONSUME el token (un solo uso). */
async function marcarEmailVerificadoAudience(id) {
  try {
    const updateSet: any = { emailVerificado: true, estado: "activo", verificationToken: null, verificationTokenCreadoEn: null };
    await db.update(audienceUsers).set(updateSet).where(eq(audienceUsers.id, id));
  } catch (error) {
    console.error("[DB Repo] Error marcando email verificado:", error);
    throw new Error("Failed to mark audience email verified", { cause: error });
  }
}__name(marcarEmailVerificadoAudience,"marcarEmailVerificadoAudience");

export{upsertAudienceUser,upsertAudienceUserSafe,normalizePhoneForMatching,phonesMatch,findAudienceUserByPhone,getAllAudienceUsers,migrarPiiAudiencia,normalizarEmailsAudiencia,atribuirCodigoDeCanje,seedAudienceUsersIfEmpty,checkAudienceUserUniqueness,deleteAndPurgeUser,buscarAudienceUsersPorEmailIdx,buscarAudienceUserPorTokenVerificacion,insertarAudiencePendiente,renovarTokenVerificacionAudience,marcarEmailVerificadoAudience,consumirTokenVerificacionAudience,tokenVerificacionVigente,VENTANA_TOKEN_VERIFICACION_MS};
