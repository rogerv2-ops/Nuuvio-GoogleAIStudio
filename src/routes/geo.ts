/**
 * Catalogo geografico (UBIGEGO del INEI) en el servidor.
 *
 * QUE RESUELVE
 *
 * Antes, el bot reconocia el distrito de la persona con un mapa DENTRO del
 * codigo (`LIMA_DISTRICT_MAP` en `server.ts`): ~46 entryadas, escritas a
 * mano. Consecuencias:
 *
 *  - Una persona de un distrito que no estuviera en ese mapa NO se podia
 *    registrar: el bot le volvia a pedir el distrito, para siempre.
 *  - La lista del formulario web (`DISTRITOS_LIMA`, 20 entryadas) era OTRA
 *    lista distinta, que ya no coincidia con la del bot.
 *  - "Lima primero" estaba escrito en el codigo, no en un dato.
 *
 * Ahora la fuente de verdad es la tabla `geo_territorios`, sembrada con el
 * listado oficial del INEI (2.095 territorios: 25 departamentos, 196
 * provincias, 1.874 distritos).
 *
 * EL MODELO: PROVINCIA -> DISTRITO
 *
 * La unidad de negocio es la PROVINCIA, no el distrito:
 *
 *  - Yuddit activa una provincia cuando abre esa zona. Por eso la columna
 *    `activo` se pone en las provincias.
 *  - Cada provincia tiene su lista de distritos, y todo listado
 *    geografico se arma en esa jerarquia: primero las provincias, y al
 *    elegir una, sus distritos.
 *  - El distrito es la UBICACION de la persona, no la zona de servicio.
 *
 * Sin coordenadas: por ahora la geolocalizacion es "provincia + distrito"
 * en texto. Las coordenadas (radio en km, GPS) son una fase aparte.
 *
 * POR QUE ESTE ARCHIVO Y NO `src/modules/`
 *
 * `src/modules/*` se importa desde el navegador. Importar la capa de base
 * de datos ahi mete el Pool de Postgres en el bundle y la SPA queda en
 * blanco (error de modulo, script muerto, sitio caido). Este archivo solo
 * lo usa el SERVIDOR.
 */
import {
  activarProvincias,
  establecerProvinciaActiva,
  listarTerritorios,
  sincronizarTerritorios,
} from "../db/repo.ts";
import { UBIGEO_PERU } from "../data/ubigeoPeru.ts";

export type NivelTerritorio = "departamento" | "provincia" | "distrito";

export interface TerritorioGeo {
  codigo: string;
  nombre: string;
  nivel: NivelTerritorio;
  codigoPadre: string | null;
  departamento: string;
  provincia: string;
  activo: boolean;
}

export interface ProvinciaGeo extends TerritorioGeo {
  departamentoNombre: string;
  totalDistritos: number;
}

export interface DistritoGeo extends TerritorioGeo {
  provinciaNombre: string;
}

interface EntradaIndice {
  /** Clave normalizada con la que se busca en el texto ("san isidro"). */
  clave: string;
  /** Nombre canonico ("San Isidro"). */
  nombre: string;
  codigo: string;
  /** Codigo de la provincia a la que pertenece (6 digitos). */
  codigoProvincia: string;
  /** `true` si la provincia esta activa (donde opera el negocio). */
  provinciaActiva: boolean;
}

/**
 * Provincias con las que arranca el negocio.
 *
 * "150100" = la provincia de Lima (sus 43 distritos: Miraflores, Barranco,
 * San Isidro, Santiago de Surco...). Es un DATO, no una suposicion del
 * codigo: el panel de gestion puede activar mas provincias a medida que
 * Yuddit se expande (esa columna `activo` la escribe el panel, no el
 * generador).
 */
export const PROVINCIAS_ACTIVAS_POR_DEFECTO = ["150100"]; // 150100 = provincia de Lima

/**
 * Indice de busqueda de distritos.
 *
 * Se construye con TODOS los distritos del Peru, ordenados del mas largo
 * al mas corto: si no, "san martin de porres" se detectaria como "san martin".
 */
let indiceDistritos: EntradaIndice[] = [];
let listaProvincias: ProvinciaGeo[] = [];
let listaDepartamentos: TerritorioGeo[] = [];
let catalogoCargado = false;

/** Normaliza para comparar: sin tildes, minusculas, espacios colapsados. */
function clave(texto: string): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Siembra el catalogo en la base y recarga el indice en memoria.
 *
 * La siembra es idempotente (UPSERT por codigo), asi que se puede volver a
 * correr con un listado mas nuevo.
 */
export async function cargarCatalogoGeo(): Promise<{
  ok: boolean;
  siembra: number;
  indice: number;
  motivo?: string;
}> {
  try {
    const siembra = await sincronizarTerritorios(UBIGEO_PERU as any);
    if (!siembra.ok) {
      return { ok: false, siembra: 0, indice: indiceDistritos.length, motivo: siembra.error };
    }
    // Marca las provincias donde arranca el negocio. El panel puede
    // cambiarlo despues (tabla `geo_territorios.activo`).
    const activados = await activarProvincias(PROVINCIAS_ACTIVAS_POR_DEFECTO);
    if (!activados.ok) {
      console.warn("[Geo] No se pudieron activar las provincias iniciales:", activados);
    }
    const recarga = await recargarIndiceDesdeBase();
    return { ok: true, siembra: siembra.sembrados, indice: recarga };
  } catch (error) {
    console.error("[Geo] Error cargando el catalogo geografico:", error);
    return {
      ok: false,
      siembra: 0,
      indice: indiceDistritos.length,
      motivo: String((error as any)?.message || error),
    };
  }
}

/** Relee el catalogo de la base y reconstruye los indices en memoria. */
export async function recargarIndiceDesdeBase(): Promise<number> {
  const todos = await listarTerritorios({});

  const departamentos = todos.filter((t) => t.nivel === "departamento") as TerritorioGeo[];
  const provincias = todos.filter((t) => t.nivel === "provincia") as TerritorioGeo[];
  const distritos = todos.filter((t) => t.nivel === "distrito") as TerritorioGeo[];

  // El departamento de una provincia se guarda con 2 digitos ("15"), pero
  // el codigo del departamento es de 6 ("150000"): se indexa por ambos.
  const nombreDepartamento = new Map<string, string>();
  for (const d of departamentos) {
    nombreDepartamento.set(d.codigo, d.nombre);
    nombreDepartamento.set(d.codigo.slice(0, 2), d.nombre);
  }
  const nombreProvincia = new Map(provincias.map((p) => [p.codigo, p.nombre]));
  const provinciaDeDistrito = new Map(
    distritos.map((d) => [d.codigo, d.codigoPadre || ""]),
  );

  listaDepartamentos = departamentos;
  listaProvincias = provincias.map((p) => ({
    ...p,
    departamentoNombre: nombreDepartamento.get(p.departamento) || "",
    totalDistritos: distritos.filter((d) => provinciaDeDistrito.get(d.codigo) === p.codigo).length,
  }));

  // Varios distritos pueden llamarse igual (99 nombres repetidos en el
  // Peru). Se agrupan por clave y, dentro de cada grupo, gana el de la
  // provincia ACTIVA (donde opera el negocio); si ninguna esta activa, el de
  // codigo menor (determinista).
  const grupos = new Map<string, EntradaIndice[]>();
  for (const d of distritos) {
    const k = clave(d.nombre);
    if (!k) continue;
    const codigoProvincia = provinciaDeDistrito.get(d.codigo) || "";
    const provincia = provincias.find((p) => p.codigo === codigoProvincia);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push({
      clave: k,
      nombre: d.nombre,
      codigo: d.codigo,
      codigoProvincia,
      provinciaActiva: provincia?.activo === true,
    });
  }
  indiceDistritos = [...grupos.values()]
    .map((lista) =>
      lista.sort((a, b) => {
        if (a.provinciaActiva !== b.provinciaActiva) return a.provinciaActiva ? -1 : 1;
        return a.codigo.localeCompare(b.codigo);
      })[0],
    )
    .sort((a, b) => b.clave.length - a.clave.length);

  catalogoCargado = indiceDistritos.length > 0;
  return indiceDistritos.length;
}

/** `true` si el catalogo esta disponible en memoria. */
export function catalogoGeoDisponible(): boolean {
  return catalogoCargado;
}

/**
 * Detecta el distrito en un texto libre.
 *
 * `alias` son nombres alternativos que se consultan ANTES del catalogo
 * (por ejemplo "surco" -> "Santiago de Surco"): son el conocimiento curado
 * de como habla la gente en cada zona, y el catalogo oficial trae los
 * nombres completos.
 */
export function detectarDistritoEnTexto(
  texto: string | null | undefined,
  alias: { clave: string; nombre: string }[] = [],
): { nombre: string; codigo: string; codigoProvincia: string; provinciaActiva: boolean } | null {
  if (!texto) return null;
  const normalizado = clave(texto);
  if (!normalizado) return null;

  // 1) Los ALIAS van PRIMERO: el catalogo oficial trae los nombres
  //    completos, y en el Peru hay 99 nombres de distrito repetidos.
  const aliasOrdenados = [...alias]
    .map((a) => ({ clave: clave(a.clave), nombre: a.nombre }))
    .filter((a) => a.clave.length > 0)
    .sort((a, b) => b.clave.length - a.clave.length);
  for (const a of aliasOrdenados) {
    const re = new RegExp(`(^|\\s)${a.clave}(\\s|$)`);
    if (re.test(normalizado)) {
      // El alias apunta a un distrito REAL del catalogo: se busca su codigo
      // para que la audiencia guarde el codigo y no solo el nombre.
      const real = indiceDistritos.find((d) => d.nombre === a.nombre);
      return {
        nombre: a.nombre,
        codigo: real?.codigo || "",
        codigoProvincia: real?.codigoProvincia || "",
        provinciaActiva: real ? real.provinciaActiva : true,
      };
    }
  }

  // 2) El catalogo oficial: cualquier distrito del Peru.
  for (const entrada of indiceDistritos) {
    // Frontera de palabra: "surco" no debe aparecer dentro de "xsurco".
    const re = new RegExp(`(^|\\s)${entrada.clave}(\\s|$)`);
    if (re.test(normalizado)) {
      return {
        nombre: entrada.nombre,
        codigo: entrada.codigo,
        codigoProvincia: entrada.codigoProvincia,
        provinciaActiva: entrada.provinciaActiva,
      };
    }
  }
  return null;
}

/**
 * La provincia a la que pertenece un distrito, y si esta activa.
 *
 * Es lo que usa el bot para saber si en la zona de la persona hay ofertas
 * que ofrecerle: la ZONA DE SERVICIO es la provincia (encendida en el
 * panel de gestion), no el distrito.
 *
 * `null` si el distrito no esta en el catalogo.
 */
export function provinciaDeDistrito(nombreDistrito: string | null | undefined): {
  codigoProvincia: string;
  nombre: string;
  activa: boolean;
} | null {
  const k = clave(nombreDistrito);
  if (!k) return null;
  for (const d of indiceDistritos) {
    if (d.clave === k) {
      return {
        codigoProvincia: d.codigoProvincia,
        nombre: "",
        activa: d.provinciaActiva,
      };
    }
  }
  return null;
}

/** Las provincias, con su departamento y cuantos distritos tienen. */
export function listarProvinciasGeo(): ProvinciaGeo[] {
  return listaProvincias;
}

/** Los distritos de una provincia. */
export function listarDistritosDeProvincia(codigoProvincia: string): DistritoGeo[] {
  if (!codigoProvincia) return [];
  return indiceDistritos
    .filter((d) => d.codigoProvincia === codigoProvincia)
    .map((d) => ({
      codigo: d.codigo,
      nombre: d.nombre,
      nivel: "distrito" as const,
      codigoPadre: d.codigoProvincia || null,
      departamento: d.codigo.slice(0, 2),
      provincia: d.codigoProvincia.slice(2, 4),
      activo: d.provinciaActiva,
      provinciaNombre: "",
    }));
}

/**
 * Rutas del catalogo geografico.
 *
 * `GET /api/geo/provincias` y `GET /api/geo/distritos` son PUBLICAS: es
 * informacion de referencia (la lista de provincias y distritos del Peru) y
 * las necesita el formulario de registro de la landing, que no tiene
 * sesion. No expone datos de nadie.
 */
export function registrarRutasGeo(app: any, ctx: any): void {
  const rateLimit = ctx.rateLimit;
  const requireAdmin = ctx.requireAdmin;

  /** Provincias (con su departamento y su numero de distritos). */
  app.get("/api/geo/provincias", rateLimit("geo", 60, 60000), async (_req: any, res: any) => {
    try {
      const provincias = listaProvincias.map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        departamento: p.departamento,
        departamentoNombre: p.departamentoNombre,
        totalDistritos: p.totalDistritos,
        activo: p.activo === true,
      }));
      res.json({ ok: true, provincias, total: provincias.length });
    } catch (error) {
      console.error("[Geo] Error listando las provincias:", error);
      res.status(500).json({ ok: false, error: "Error obteniendo las provincias." });
    }
  });

  /**
   * Activa o desactiva una provincia (lo usa el panel de gestion).
   *
   * Es la operacion que hace el negocio cuando se expande: enciende una
   * provincia y sus distritos pasan a ser zona de servicio.
   */
  app.post(
    "/api/geo/provincias/activar",
    requireAdmin,
    rateLimit("geo", 60, 60000),
    async (req: any, res: any) => {
      try {
        const codigo = String(req.body?.codigo || "").trim();
        const activo = req.body?.activo === true;
        if (!/^\d{6}$/.test(codigo)) {
          res.status(400).json({ ok: false, error: "Codigo de provincia invalido." });
          return;
        }
        const provincia = listaProvincias.find((p) => p.codigo === codigo);
        if (!provincia) {
          res.status(404).json({ ok: false, error: "Provincia no encontrada." });
          return;
        }
        const cambio = await establecerProvinciaActiva(codigo, activo);
        if (!cambio.ok) {
          res.status(500).json({ ok: false, error: "No se pudo guardar el estado de la provincia." });
          return;
        }
        // El indice en memoria decide que distrito se detecta: hay que
        // recargarlo o el bot seguiria con el mapa viejo.
        const indice = await recargarIndiceDesdeBase();
        res.json({
          ok: true,
          provincia: codigo,
          activo,
          indice,
          mensaje: activo
            ? `${provincia.nombre} activada: ${provincia.totalDistritos} distritos en zona de servicio.`
            : `${provincia.nombre} desactivada.`,
        });
      } catch (error) {
        console.error("[Geo] Error activando una provincia:", error);
        res.status(500).json({ ok: false, error: "Error activando la provincia." });
      }
    },
  );

  /** Los distritos de una provincia. */
  app.get("/api/geo/distritos", rateLimit("geo", 60, 60000), async (req: any, res: any) => {
    try {
      const provincia = String(req.query?.provincia || "").trim();
      if (!provincia) {
        res.status(400).json({ ok: false, error: "Falta el codigo de provincia." });
        return;
      }
      const distritos = listarDistritosDeProvincia(provincia);
      res.json({ ok: true, provincia, distritos, total: distritos.length });
    } catch (error) {
      console.error("[Geo] Error listando los distritos de una provincia:", error);
      res.status(500).json({ ok: false, error: "Error obteniendo los distritos." });
    }
  });
}
