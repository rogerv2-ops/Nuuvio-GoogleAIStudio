/**
 * Capa de datos — catalogo geografico del Peru y zona de servicio (geo_territorios).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{geoTerritorios}from"../schema.ts";
import{eq,and,sql}from"drizzle-orm";

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

export{sincronizarTerritorios,listarTerritorios,activarProvincias,establecerProvinciaActiva,contarTerritorios};
