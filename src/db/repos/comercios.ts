/**
 * Capa de datos — comercios y kanban persistidos como JSON en app_settings (datos legacy congelados).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{getSetting}from"./ajustes.ts";
import{saveSetting}from"./ajustes.ts";

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

export{getPersistedMerchants,savePersistedMerchants,getPersistedKanban,savePersistedKanban};
