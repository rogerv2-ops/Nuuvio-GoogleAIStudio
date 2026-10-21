/**
 * Capa de datos — eventos de negocio: lo que NO tiene tabla propia (impresiones, visitas, embudo).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{eventos}from"../schema.ts";
import{eq,and,gte,sql}from"drizzle-orm";
import{indiceCiego}from"../../utils/pii.ts";
import{normalizePhoneForMatching}from"./audiencia.ts";

/**
 * Convierte el "actor" de un evento en su indice ciego cuando es una
 * persona concreta.
 *
 * `audience_users` guarda el telefono CIFRADO y un indice ciego
 * (`telefono_idx`) para poder consultar sin descifrar. La tabla `eventos`
 * tiene que seguir la misma regla: si el actor es un telefono (o un id de
 * audiencia, que lo lleva embebido: `usr_wa_519...`), se guarda SU indice
 * ciego, no el telefono.
 *
 * Sin esto, la tabla de eventos se convertia en una copia en texto plano
 * de la lista de telefonos de los clientes.
 *
 * Un actor que NO es una persona (por ejemplo "anonimo" o "ref_VUUY-CV88")
 * se queda como esta: no es PII y sirve para agrupar.
 */
function indiceDeActor(actorId) {
  const v = String(actorId || "").trim();
  if (!v) return null;
  const m = v.match(/(\d{9,15})/);
  if (!m) return v.slice(0, 120);
  const _norm = normalizePhoneForMatching(m[1]);
  return indiceCiego(_norm.core9 || _norm.digits || m[1]);
}
__name(indiceDeActor, "indiceDeActor");

/**
 * Convierte a indice ciego los `actor_id` de los eventos que se guardaron
 * en texto plano (la tabla se creo asi y hay filas con el telefono).
 *
 * Es idempotente: solo toca los que parecen un telefono, y un indice
 * ciego (64 hex) no lo parece.
 */
async function sanearActorIdEventos() {
  try {
    const filas = await db.select({ id: eventos.id, actorId: eventos.actorId }).from(eventos);
    let corregidos = 0;
    for (const f of filas) {
      const actual = String(f.actorId || "");
      if (!actual || !/\d{9,15}/.test(actual)) continue;
      const idx = indiceDeActor(actual);
      if (!idx || idx === actual) continue;
      await db.update(eventos).set({ actorId: idx, updatedAt: new Date() } as any).where(eq(eventos.id, f.id));
      corregidos++;
    }
    if (corregidos > 0) {
      console.log("[Eventos] " + corregidos + " actor(es) convertidos a indice ciego (telefono en texto plano eliminado).");
    }
    return { ok: true, corregidos };
  } catch (error) {
    console.error("[DB Repo] Error saneando los actor_id de los eventos:", error);
    return { ok: false, corregidos: 0 };
  }
}
__name(sanearActorIdEventos, "sanearActorIdEventos");

/**
 * Las ofertas que se le MOSTRARON a una persona en las ultimas horas.
 *
 * Es lo que sostiene la regla de 24h del bot: no volver a enviar las
 * mismas ofertas dentro de la ventana. La fuente son las impresiones
 * (`eventos` tipo `oferta_mostrada`), que ya guardan quien y cuando.
 */
async function listarOfertasVistas(indiceActor, horas) {
  try {
    const idx = String(indiceActor || "");
    if (!idx) return [];
    const desde = new Date(Date.now() - Math.max(1, Number(horas) || 24) * 3600 * 1000);
    const r = await db
      .select({ ofertaId: sql`datos->>'ofertaId'` })
      .from(eventos)
      .where(
        and(
          eq(eventos.tipoEvento, "oferta_mostrada"),
          eq(eventos.actorId, idx),
          gte(eventos.creadoEn, desde)
        )
      );
    return [...new Set((r || []).map((x: any) => x.ofertaId).filter(Boolean))];
  } catch (error) {
    console.error("[DB Repo] Error listando las ofertas vistas:", error);
    return [];
  }
}
__name(listarOfertasVistas, "listarOfertasVistas");

/**
 * Guarda eventos de negocio.
 *
 * REGLA DE LA CASA: un dominio que tiene su PROPIA tabla no emite evento.
 * Los clics van en `click_logs`, los chats en `chat_logs`, la audiencia en
 * `audience_users`, los packs en `click_packs`. Aqui va lo que NO tiene
 * tabla: las visitas a la landing, las impresiones de una oferta, la
 * entrega de una oferta al bot y los pasos del embudo.
 *
 * Antes estos eventos vivian en un `Map` EN MEMORIA del navegador: se
 * perdian al recargar y por eso las visitas a la landing no se podian
 * medir (el panel UTM tenia que inventar un minimo de 198).
 */
async function insertarEvento(evento) {
  try {
    const id = String(evento.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    await db.insert(eventos).values({
      id,
      tipoEvento: String(evento.tipoEvento),
      actorTipo: evento.actorTipo ? String(evento.actorTipo) : null,
      actorId: evento.actorId ? String(evento.actorId).slice(0, 120) : null,
      distrito: evento.distrito ? String(evento.distrito).slice(0, 80) : null,
      provincia: evento.provincia ? String(evento.provincia).slice(0, 80) : null,
      origen: evento.origen ? String(evento.origen).slice(0, 40) : null,
      datos: (evento.datos && typeof evento.datos === "object") ? evento.datos : {},
      creadoEn: new Date(),
      // `any`: mismo problema de Drizzle 0.38 con columnas nullable.
    } as any);
    return { ok: true, id };
  } catch (error) {
    console.error("[DB Repo] Error guardando el evento:", error);
    return { ok: false, id: null };
  }
}
__name(insertarEvento, "insertarEvento");

/** Guarda varios eventos (el cliente los manda en tanda). */
async function insertarEventos(lista) {
  const guardados = [];
  for (const e of lista) {
    const r = await insertarEvento(e);
    if (r.ok) guardados.push(r.id);
  }
  return { ok: guardados.length > 0, guardados: guardados.length };
}
__name(insertarEventos, "insertarEventos");

/** Cuenta los eventos por tipo (para las metricas del panel). */
async function contarEventos(filtros) {
  try {
    const condiciones = [];
    if (filtros && filtros.tipoEvento) condiciones.push(eq(eventos.tipoEvento, String(filtros.tipoEvento)));
    if (filtros && filtros.desde) condiciones.push(gte(eventos.creadoEn, new Date(String(filtros.desde))));
    if (filtros && filtros.hasta) condiciones.push(sql`${eventos.creadoEn} <= ${new Date(String(filtros.hasta))}`);
    const consulta = condiciones.length
      ? db.select({ n: sql`count(*)::int` }).from(eventos).where(and(...condiciones))
      : db.select({ n: sql`count(*)::int` }).from(eventos);
    const filas = await consulta;
    return filas.length ? Number(filas[0].n) : 0;
  } catch (error) {
    console.error("[DB Repo] Error contando los eventos:", error);
    return 0;
  }
}
__name(contarEventos, "contarEventos");

/** Los eventos mas recientes de un tipo (para las listas del panel). */
async function listarEventos(filtros) {
  try {
    const condiciones = [];
    if (filtros && filtros.tipoEvento) condiciones.push(eq(eventos.tipoEvento, String(filtros.tipoEvento)));
    if (filtros && filtros.limite) condiciones.push(sql`1=1`);
    const base = condiciones.length
      ? db.select().from(eventos).where(and(...condiciones))
      : db.select().from(eventos);
    const filas = await base;
    const limite = Number((filtros && filtros.limite) || 100);
    return filas
      .sort((a: any, b: any) => new Date(b.creadoEn || 0).getTime() - new Date(a.creadoEn || 0).getTime())
      .slice(0, limite)
      .map((r: any) => ({
        id: r.id,
        tipoEvento: r.tipoEvento,
        actorTipo: r.actorTipo,
        actorId: r.actorId,
        distrito: r.distrito,
        provincia: r.provincia,
        origen: r.origen,
        datos: r.datos || {},
        creadoEn: r.creadoEn,
      }));
  } catch (error) {
    console.error("[DB Repo] Error listando los eventos:", error);
    return [];
  }
}
__name(listarEventos, "listarEventos");

export{indiceDeActor,sanearActorIdEventos,listarOfertasVistas,insertarEvento,insertarEventos,contarEventos,listarEventos};
