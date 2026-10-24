/**
 * Re-export de compatibilidad de la capa de datos.
 *
 * La implementacion vive en src/db/repos/<dominio>.ts desde el 2026-10-21 (antes este
 * archivo tenia 71 funciones de 12 dominios mezcladas). Este archivo conserva EXACTAMENTE
 * los mismos 71 nombres exportados para que server.ts, las rutas y los tests no cambien.
 *
 * Siguiente paso (no en este cambio): que cada consumidor importe del modulo de su dominio
 * y retirar este puente.
 */
export{getSetting,saveSetting}from"./repos/ajustes.ts";
export{getPersistedMerchants,savePersistedMerchants,getPersistedKanban,savePersistedKanban,getPersistedKanbanColumns,savePersistedKanbanColumns}from"./repos/comercios.ts";
export{getAllOffers,replaceOffers,syncOffers,getAllBanners,syncBanners}from"./repos/catalogo.ts";
export{upsertAudienceUser,upsertAudienceUserSafe,normalizePhoneForMatching,phonesMatch,findAudienceUserByPhone,getAllAudienceUsers,migrarPiiAudiencia,normalizarEmailsAudiencia,atribuirCodigoDeCanje,seedAudienceUsersIfEmpty,checkAudienceUserUniqueness,deleteAndPurgeUser}from"./repos/audiencia.ts";
export{insertRegistrationLog,getRecentRegistrationLogs,deleteRegistrationLog,clearAllRegistrationLogs,insertEmailLog,getRecentEmailLogs,insertChatLog,getRecentChatLogs,insertSecurityLog,getRecentSecurityLogs}from"./repos/logs.ts";
export{registerOfferClick,registerQualifiedLead,incrementOfferLikes}from"./repos/clics.ts";
export{getLoginFailureDb,registrarLoginFallidoDb,limpiarLoginFallidoDb,getAuthUsersDb,insertAuthUserDb,updateAuthUserDb,deleteAuthUserDb,consumeTotpBackupHashDb,migrateAuthUsersABTablaDb}from"./repos/auth.ts";
export{insertSession,getSession,revokeSession,revokeSessionsByUser,listSessionsByUser,purgeExpiredSessions}from"./repos/sesiones.ts";
export{listarClickPacks,sembrarClickPacksSiVacio,insertarClickPack,debitarClicAtomico}from"./repos/facturacion.ts";
export{sincronizarTerritorios,listarTerritorios,activarProvincias,establecerProvinciaActiva,contarTerritorios}from"./repos/geo.ts";
export{indiceDeActor,sanearActorIdEventos,listarOfertasVistas,insertarEvento,insertarEventos,contarEventos,listarEventos}from"./repos/eventos.ts";
export{insertarPreregistro,buscarPreregistroPorCorreoIdx,marcarBajaPreregistroPorTokenHash,listarPreregistros}from"./repos/preregistros.ts";
export{obtenerMetricasGlobales,obtenerSerieMensual,obtenerSerieDiaria,obtenerMetricasComercio}from"./repos/analitica.ts";
