/**
 * Capa de datos — ofertas y banners (el catalogo que sincroniza el panel con la base).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{offers,banners}from"../schema.ts";
import{notInArray}from"drizzle-orm";

async function getAllOffers(){try{const rows=await db.select().from(offers);return rows.map(r=>({...r,precioNormal:Number(r.precioNormal),precioOferta:Number(r.precioOferta),lat:Number(r.lat),lng:Number(r.lng),likes:r.likes||0,vistas:r.vistas||0,clics:r.clics||0,leadsCalificados:r.leadsCalificados||0}))}catch(error){console.error("[DB Repo] Error al obtener ofertas:",error);return[]}}__name(getAllOffers,"getAllOffers");

async function replaceOffers(offersList){try{const _oids=offersList.map(o=>o.id);if(_oids.length>0){await db.delete(offers).where(notInArray(offers.id,_oids))}else{await db.delete(offers)}}catch(error){console.error("[DB Repo] Error limpiando ofertas obsoletas:",error)}return await syncOffers(offersList)}__name(replaceOffers,"replaceOffers");

async function syncOffers(offersList){try{for(const o of offersList){await db.insert(offers).values({id:o.id,codigoUrl:o.codigoUrl||`oferta-${o.id}`,comercioId:o.comercioId||"comercio-default",comercioNombre:o.comercioNombre||"Comercio Yuddit",comercioWhatsapp:o.comercioWhatsapp||"51987654321",titulo:o.titulo||"",descripcion:o.descripcion||"",tipo:o.tipo||"descuento_porcentaje",precioNormal:String(o.precioNormal??0),precioOferta:String(o.precioOferta??0),stock:o.stock??null,categoria:o.categoria||"Gastronom\xEDa y Caf\xE9",distrito:o.distrito||"Miraflores",provincia:o.provincia||"Lima",lat:String(o.lat??-12.12),lng:String(o.lng??-77.03),imagenes:o.imagenes||[],venceEn:o.venceEn||new Date(Date.now()+30*864e5).toISOString(),estado:o.estado||"activa",likes:o.likes||0,vistas:o.vistas||0,clics:o.clics||0,leadsCalificados:o.leadsCalificados||0,videoUrl:o.videoUrl||null,creadaEn:o.creadaEn||new Date().toISOString(),updatedAt:new Date}).onConflictDoUpdate({target:offers.id,set:{titulo:o.titulo||"",descripcion:o.descripcion||"",precioNormal:String(o.precioNormal??0),precioOferta:String(o.precioOferta??0),stock:o.stock??null,categoria:o.categoria||"",distrito:o.distrito||"",provincia:o.provincia||"",lat:String(o.lat??-12.12),lng:String(o.lng??-77.03),imagenes:o.imagenes||[],venceEn:o.venceEn||new Date().toISOString(),estado:o.estado||"activa",likes:o.likes||0,vistas:o.vistas||0,clics:o.clics||0,leadsCalificados:o.leadsCalificados||0,videoUrl:o.videoUrl||null,updatedAt:new Date}})}}catch(error){console.error("[DB Repo] Error sincronizando ofertas:",error);throw new Error("Failed to sync offers",{cause:error})}}__name(syncOffers,"syncOffers");

async function getAllBanners(){try{const rows=await db.select().from(banners);return rows}catch(error){console.error("[DB Repo] Error al obtener banners:",error);return[]}}__name(getAllBanners,"getAllBanners");

async function syncBanners(bannerList){try{const _bids=bannerList.map(b=>b.id);if(_bids.length>0){await db.delete(banners).where(notInArray(banners.id,_bids))}else{await db.delete(banners)}for(const b of bannerList){await db.insert(banners).values({id:b.id,titulo:b.titulo,subtitulo:b.subtitulo,imagenUrl:b.imagenUrl,enlaceUrl:b.enlaceUrl||null,activado:b.activado!==false,orden:b.orden||1}).onConflictDoUpdate({target:banners.id,set:{titulo:b.titulo,subtitulo:b.subtitulo,imagenUrl:b.imagenUrl,enlaceUrl:b.enlaceUrl||null,activado:b.activado!==false,orden:b.orden||1}})}}catch(error){console.error("[DB Repo] Error sincronizando banners:",error);throw new Error("Failed to sync banners",{cause:error})}}__name(syncBanners,"syncBanners");

export{getAllOffers,replaceOffers,syncOffers,getAllBanners,syncBanners};
