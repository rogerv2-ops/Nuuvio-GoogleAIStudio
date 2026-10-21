/**
 * Capa de datos — metricas y series que alimentan los tableros del panel.
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{offers,eventos}from"../schema.ts";
import{and,sql}from"drizzle-orm";
import{getSetting}from"./ajustes.ts";

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
        (select coalesce(sum(saldo_clics), 0)::int from click_packs) as saldo_clics,
        (select count(*)::int from eventos where tipo_evento = 'visita_landing_utm') as visitas,
        (select count(*)::int from eventos where tipo_evento = 'oferta_mostrada') as impresiones,
        (select count(*)::int from eventos where tipo_evento = 'oferta_enviada') as ofertas_entregadas,
        (select count(*)::int from eventos where tipo_evento = 'embudo_registro_completado') as embudos
    `);
    const fila: any = (r && r.rows && r.rows[0]) || {};

    // Los comercios viven en `app_settings.merchants_list` (JSON).
    const lista = await getSetting("merchants_list", []);
    const comercios = Array.isArray(lista) ? lista : [];
    const comerciosActivos = comercios.filter((m: any) => m && m.estado === "activo").length;

    const clics = Number(fila.clics || 0);
    // Las VISTAS se miden con las impresiones de la tabla `eventos` (cada vez
    // que el bot muestra una oferta queda una). Antes no se median porque
    // `offers.vistas` no lo incrementa nadie.
    const impresiones = Number(fila.impresiones || 0);
    const vistas = Number(fila.vistas_ofertas || 0);
    const vistasTotales = Math.max(vistas, impresiones);
    return {
      ofertasActivas: Number(fila.ofertas_activas || 0),
      ofertasTotal: Number(fila.ofertas_total || 0),
      totalVistasOfertas: vistasTotales > 0 ? vistasTotales : null,
      totalClicsContactar: clics,
      northStarLeadsSemanales: Number(fila.leads_semana || 0),
      leadsCalificados: Number(fila.leads || 0),
      // El CTR solo existe si hay vistas medidas.
      ctrPromedioGlobal: vistasTotales > 0 ? Number(((clics / vistasTotales) * 100).toFixed(1)) : null,
      // Las ventas confirmadas no tienen tabla: no se miden.
      ventasConfirmadas: null,
      comerciosActivos,
      comerciosTotales: comercios.length,
      usuariosRegistrados: Number(fila.usuarios || 0),
      usuariosActivos: Number(fila.usuarios_activos || 0),
      chats: Number(fila.chats || 0),
      // De la tabla de eventos (lo que NO tiene tabla propia).
      visitas: Number(fila.visitas || 0),
      impresiones: Number(fila.impresiones || 0),
      ofertasEntregadas: Number(fila.ofertas_entregadas || 0),
      embudosCompletados: Number(fila.embudos || 0),
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

/**
 * Serie mensual REAL (para el grafico de evolucion).
 *
 * Antes el widget ejecutivo fabricaba seis meses de historia (Mayo-Octubre)
 * multiplicando el valor actual por porcentajes fijos: un grafico que
 * parece bien y no mide nada. Esto se arma con las fechas de la base:
 * `audience_users.created_at`, `click_logs.creado_en` y
 * `offers.created_at`.
 *
 * Un mes sin datos es 0. No se rellena.
 */
async function obtenerSerieMensual(meses) {
  try {
    const cuantos = Math.max(1, Math.min(Number(meses) || 6, 24));
    const desde = new Date();
    desde.setDate(1);
    desde.setHours(0, 0, 0, 0);
    desde.setMonth(desde.getMonth() - (cuantos - 1));
    const desdeIso = desde.toISOString();

    const r = await db.execute(sql`
      select
        to_char(date_trunc('month', created_at), 'YYYY-MM') as mes,
        count(*)::int as usuarios
      from audience_users
      where created_at >= ${desdeIso}
      group by 1
    `);
    const usuariosPorMes = new Map<string, number>();
    for (const f of (r && r.rows) || []) usuariosPorMes.set(String(f.mes), Number(f.usuarios || 0));

    const r2 = await db.execute(sql`
      select
        to_char(date_trunc('month', creado_en), 'YYYY-MM') as mes,
        count(*)::int as clics,
        count(*) filter (where facturable = true)::int as leads
      from click_logs
      where creado_en >= ${desdeIso}
      group by 1
    `);
    const clicsPorMes = new Map<string, { clics: number; leads: number }>();
    for (const f of (r2 && r2.rows) || []) {
      clicsPorMes.set(String(f.mes), { clics: Number(f.clics || 0), leads: Number(f.leads || 0) });
    }

    const r3 = await db.execute(sql`
      select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes, count(*)::int as ofertas
      from offers where created_at >= ${desdeIso} group by 1
    `);
    const ofertasPorMes = new Map<string, number>();
    for (const f of (r3 && r3.rows) || []) ofertasPorMes.set(String(f.mes), Number(f.ofertas || 0));

    // Los meses del calendario, en orden. Los que no tienen datos van en 0.
    const salida: { mes: string; etiqueta: string; usuarios: number; clics: number; leads: number; ofertas: number }[] = [];
    for (let i = 0; i < cuantos; i++) {
      const d = new Date(desde);
      d.setMonth(desde.getMonth() + i);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const etiqueta = d.toLocaleDateString("es-PE", { month: "short" }).replace(".", "");
      const c = clicsPorMes.get(clave);
      salida.push({
        mes: clave,
        etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1),
        usuarios: usuariosPorMes.get(clave) || 0,
        clics: c?.clics || 0,
        leads: c?.leads || 0,
        ofertas: ofertasPorMes.get(clave) || 0,
      });
    }
    return salida;
  } catch (error) {
    console.error("[DB Repo] Error calculando la serie mensual:", error);
    return [];
  }
}
__name(obtenerSerieMensual, "obtenerSerieMensual");

/**
 * Serie diaria REAL (para el grafico por dias del panel de Analitica).
 *
 * Antes el dashboard fabricaba una serie diaria: recorria los dias del
 * rango y inventaba una progresion suave ("factorProgreso") y unos leads
 * estimados (`ofertas * 4.2 + (i % 3) * 6`). Ahora sale de las fechas de
 * la base.
 *
 * Los COMERCIOS no se incluyen: viven en un JSON (`app_settings`) sin
 * historico, asi que no hay "comercios registrados por dia" que medir.
 */
async function obtenerSerieDiaria(dias) {
  try {
    const cuantos = Math.max(1, Math.min(Number(dias) || 30, 120));
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - (cuantos - 1));
    const desdeIso = desde.toISOString();

    const r = await db.execute(sql`
      select
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as dia,
        count(*)::int as usuarios
      from audience_users where created_at >= ${desdeIso} group by 1
    `);
    const usuariosPorDia = new Map<string, number>();
    for (const f of (r && r.rows) || []) usuariosPorDia.set(String(f.dia), Number(f.usuarios || 0));

    const r2 = await db.execute(sql`
      select
        to_char(date_trunc('day', creado_en), 'YYYY-MM-DD') as dia,
        count(*)::int as clics,
        count(*) filter (where facturable = true)::int as leads
      from click_logs where creado_en >= ${desdeIso} group by 1
    `);
    const clicsPorDia = new Map<string, { clics: number; leads: number }>();
    for (const f of (r2 && r2.rows) || []) {
      clicsPorDia.set(String(f.dia), { clics: Number(f.clics || 0), leads: Number(f.leads || 0) });
    }

    const r3 = await db.execute(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as dia, count(*)::int as ofertas
      from offers where created_at >= ${desdeIso} group by 1
    `);
    const ofertasPorDia = new Map<string, number>();
    for (const f of (r3 && r3.rows) || []) ofertasPorDia.set(String(f.dia), Number(f.ofertas || 0));

    const salida: { dia: string; fecha: string; usuarios: number; clics: number; leads: number; ofertas: number; usuariosAcumulados: number; ofertasAcumuladas: number; leadsAcumulados: number }[] = [];
    let acumUsuarios = 0;
    let acumOfertas = 0;
    let acumLeads = 0;
    for (let i = 0; i < cuantos; i++) {
      const d = new Date(desde);
      d.setDate(desde.getDate() + i);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const c = clicsPorDia.get(clave);
      acumUsuarios += usuariosPorDia.get(clave) || 0;
      acumOfertas += ofertasPorDia.get(clave) || 0;
      acumLeads += c?.leads || 0;
      salida.push({
        dia: clave,
        fecha: d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }),
        usuarios: usuariosPorDia.get(clave) || 0,
        clics: c?.clics || 0,
        leads: c?.leads || 0,
        ofertas: ofertasPorDia.get(clave) || 0,
        // Los acumulados van HASTA ESE DIA (no el total final).
        usuariosAcumulados: acumUsuarios,
        ofertasAcumuladas: acumOfertas,
        leadsAcumulados: acumLeads,
      });
    }
    return salida;
  } catch (error) {
    console.error("[DB Repo] Error calculando la serie diaria:", error);
    return [];
  }
}
__name(obtenerSerieDiaria, "obtenerSerieDiaria");

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

export{obtenerMetricasGlobales,obtenerSerieMensual,obtenerSerieDiaria,obtenerMetricasComercio};
