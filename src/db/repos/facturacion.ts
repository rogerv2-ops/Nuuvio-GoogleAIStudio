/**
 * Capa de datos — packs de clics y el debito atomico del saldo (dinero del comercio).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{clickPacks}from"../schema.ts";
import{sql}from"drizzle-orm";
import type{ClickPack}from"../../types";

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

export{listarClickPacks,sembrarClickPacksSiVacio,insertarClickPack,debitarClicAtomico};
