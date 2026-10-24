// Rutas del embudo de registro (audience) (extraidas verbatim de server.ts, punto 10 de la auditoria).
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{getAllAudienceUsers,deleteAndPurgeUser,upsertAudienceUser,upsertAudienceUserSafe,checkAudienceUserUniqueness,normalizePhoneForMatching,insertRegistrationLog,getRecentRegistrationLogs,deleteRegistrationLog,clearAllRegistrationLogs,buscarAudienceUsersPorEmailIdx,buscarAudienceUserPorTokenVerificacion,insertarAudiencePendiente,renovarTokenVerificacionAudience,marcarEmailVerificadoAudience,consumirTokenVerificacionAudience,tokenVerificacionVigente}from"../db/repo.ts";import{indiceCiego}from"../utils/pii.ts";

let _rateLimit:any;function rateLimit(...args:any[]){return _rateLimit(...args)}
function registrarRutasAudience(app:any,ctx:any):void{_rateLimit=ctx.rateLimit;const requireAdmin=ctx.requireAdmin;
app.get("/api/audience/users",requireAdmin,async(_req,res)=>{try{const users=await getAllAudienceUsers();res.json({ok:true,users})}catch(err){console.error("[Cloud SQL] Error consultando usuarios:",err);res.status(500).json({ok:false,error:"Error obteniendo usuarios de la base de datos"})}});app.post("/api/audience/sync-user",rateLimit("audience",30,60000),async(req,res)=>{try{const body=req.body||{};if(!body.id||!body.email){return res.status(400).json({ok:false,error:"Datos de usuario inv\xE1lidos (id y email requeridos)"})}
    const id=String(body.id);
    const emailNorm=String(body.email).trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)){return res.status(400).json({ok:false,error:"Correo electr\xF3nico inv\xE1lido"})}
    // YUD-52 R2 (cierre): el token de verificacion lo genera SOLO el servidor
    // en el alta nueva; jamas se acepta del cliente ni se devuelve por API.
    // El alta publica es INSERT-ONLY: un id existente NO se muta por esta via
    // (perfil, correo, token, estado y verificacion quedan intactos), asi un
    // id publico conocido no permite editar el perfil ni la identidad ajenos.
    const emailIdx=indiceCiego(emailNorm);
    const existentes=emailIdx?await buscarAudienceUsersPorEmailIdx(emailIdx):[];
    const ajena=existentes.find(u=>u&&u.id!==id);
    if(ajena){return res.status(409).json({ok:false,error:"El correo electr\xF3nico ya existe en la base de datos"})}
    const propia=existentes.find(u=>u&&u.id===id);
    if(propia){return res.json({ok:true,userId:id})}
    let telefono=body.telefono;
    if(telefono){const norm=normalizePhoneForMatching(telefono);if(norm.digits.length===9){telefono=`+51 ${norm.digits}`}else if(norm.digits.startsWith("51")&&norm.digits.length===11){telefono=`+51 ${norm.digits.slice(2)}`}}
    const verificationToken=crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
    const _ins=await insertarAudiencePendiente({id,email:emailNorm,nombre:body.nombre,apellido:body.apellido,telefono:telefono||null,distrito:body.distrito,provincia:body.provincia,ciudad:body.ciudad,categoriasInteres:body.categoriasInteres,utm:body.utm,verificationToken,codigoRef:body.codigoRef||null});
    if(_ins&&_ins.duplicado){return res.status(409).json({ok:false,error:"El correo electr\xF3nico ya existe en la base de datos"})}
    await insertRegistrationLog({email:emailNorm,telefono:telefono||"",nombre:`${body.nombre||""} ${body.apellido||""}`.trim(),status:"success",resultDetails:"Usuario registrado exitosamente y sincronizado en Cloud SQL"});
    return res.json({ok:true,userId:id})}catch(err){console.error("[Cloud SQL] Error sincronizando usuario:",err);res.status(500).json({ok:false,error:"Error guardando el registro"})}});app.post("/api/audience/check-uniqueness",rateLimit("audience",30,60000),async(req,res)=>{try{const{email,telefono,nombre}=req.body;if(!email&&!telefono){return res.status(400).json({ok:false,error:"Se requiere correo electr\xF3nico o n\xFAmero de WhatsApp"})}const checkResult=await checkAudienceUserUniqueness(email||"",telefono||"");if(checkResult.exists){let detalle="Bloqueado por duplicidad: ";if(checkResult.isEmailDuplicate&&checkResult.isPhoneDuplicate){detalle+="Correo y WhatsApp ya existen en la base de datos"}else if(checkResult.isEmailDuplicate){detalle+="El correo electr\xF3nico ya existe en la base de datos"}else{detalle+="El n\xFAmero de WhatsApp ya existe en la base de datos"}await insertRegistrationLog({email:email||"sin-email",telefono:telefono||"",nombre:nombre||"",status:"error",resultDetails:detalle})}return res.json({ok:true,...checkResult})}catch(err){console.error("[Cloud SQL] Error verificando unicidad:",err);res.status(500).json({ok:false,error:"Error al validar los datos"})}});app.post("/api/audience/log-registration",rateLimit("audience",60,60000),async(req,res)=>{try{const{email,telefono,nombre,status,resultDetails}=req.body;if(!email||!status){return res.status(400).json({ok:false,error:"email y status son requeridos"})}await insertRegistrationLog({email,telefono,nombre,status:status==="success"?"success":"error",resultDetails});res.json({ok:true})}catch(err){res.status(500).json({ok:false,error:"Error interno"})}});app.get("/api/audience/registration-logs",requireAdmin,async(req,res)=>{try{const limit=req.query.limit?parseInt(req.query.limit):100;const logs=await getRecentRegistrationLogs(limit);res.json({ok:true,logs})}catch(err){console.error("[Cloud SQL] Error obteniendo logs de registro:",err);res.status(500).json({ok:false,error:"Error al consultar logs de auditor\xEDa"})}});app.delete("/api/audience/users/:id",requireAdmin,async(req,res)=>{try{const id=req.params.id;const email=req.query.email||req.body?.email;const telefono=req.query.telefono||req.body?.telefono;const result=await deleteAndPurgeUser({id,email,telefono});return res.json({ok:true,mensaje:"Usuario y todos sus rastros fueron eliminados permanentemente",...result})}catch(err){console.error("[Cloud SQL] Error al purgar usuario:",err);res.status(500).json({ok:false,error:"Error al purgar el registro"})}});app.post("/api/audience/purge-user",requireAdmin,async(req,res)=>{try{const{id,email,telefono}=req.body||{};if(!id&&!email&&!telefono){return res.status(400).json({ok:false,error:"Se requiere id, email o telefono para purgar"})}const result=await deleteAndPurgeUser({id,email,telefono});return res.json({ok:true,mensaje:"Usuario y rastros de prueba eliminados correctamente",...result})}catch(err){console.error("[Cloud SQL] Error al purgar usuario:",err);res.status(500).json({ok:false,error:"Error al purgar el registro"})}});app.delete("/api/audience/registration-logs/:id",requireAdmin,async(req,res)=>{try{const id=req.params.id;await deleteRegistrationLog(id);return res.json({ok:true,mensaje:"Log de registro eliminado"})}catch(err){res.status(500).json({ok:false,error:"Error interno"})}});app.post("/api/audience/clear-all-registration-logs",requireAdmin,async(_req,res)=>{try{await clearAllRegistrationLogs();return res.json({ok:true,mensaje:"Todos los logs de auditor\xEDa de registro fueron eliminados"})}catch(err){res.status(500).json({ok:false,error:"Error interno"})}});app.get("/api/verify-email",rateLimit("emailverify",20,60000),async(req,res)=>{try{const token=req.query.verify_token||req.query.token;if(!token){return res.redirect("/bienvenida?verify_error=missing_token")}
    // Consumo ATOMICO en un solo UPDATE condicionado (token + sello servidor
    // + vigencia + no verificado): dos clics concurrentes no verifican dos
    // veces. Tokens legacy (sin sello de servidor) no verifican: salen como
    // expirado/invalido y el titular pide reenvio (token nuevo de servidor).
    const _cv=await consumirTokenVerificacionAudience(String(token));
    if(_cv.consumido){return res.redirect(`/bienvenida?verify_token=${encodeURIComponent(String(token))}`)}
    if(_cv.expirado){return res.redirect("/bienvenida?verify_error=expired_token")}
    return res.redirect("/bienvenida?verify_error=invalid_token")}catch(err){console.error("Error en /api/verify-email:",err);return res.redirect("/bienvenida?verify_error=server_error")}});app.get("/api/audience/verify-token",rateLimit("audience",60,60000),async(req,res)=>{try{const token=req.query.token||req.query.verify_token;if(!token){return res.status(400).json({ok:false,error:"Token de verificaci\xF3n requerido"})}
    // Mismo contrato que /api/verify-email: selectivo, un solo uso, con
    // vencimiento y consumo atomico. Respuesta {ok:true} SIN datos del
    // registro: este endpoint publico no devuelve correo, telefono, distrito
    // ni ningun otro campo del usuario (R2 residual del auditor).
    const _c=await consumirTokenVerificacionAudience(String(token));
    if(_c.consumido){return res.json({ok:true})}
    if(_c.expirado){return res.status(410).json({ok:false,error:"Token de verificaci\xF3n vencido"})}
    return res.status(404).json({ok:false,error:"Token de verificaci\xF3n no encontrado o inv\xE1lido"})}catch(err){console.error("Error en /api/audience/verify-token:",err);res.status(500).json({ok:false,error:"Error al procesar la verificaci\xF3n"})}});
}

export{registrarRutasAudience};
