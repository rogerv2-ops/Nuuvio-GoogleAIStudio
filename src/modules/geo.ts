/**
 * Geografia del negocio, en el navegador.
 *
 * La lista de distritos YA NO esta escrita a mano en el codigo. Antes
 * habia TRES listas distintas (y ninguna coincidia con la del bot):
 * `DISTRITOS_LIMA` en `src/data/seedData.ts` (12 distritos), la del
 * formulario del embudo (20) y el `LIMA_DISTRICT_MAP` del servidor (~46).
 *
 * Ahora salen de la tabla `geo_territorios` (el listado oficial del INEI)
 * y se piden por la API. La jerarquia es la del negocio:
 * PROVINCIA -> DISTRITO. El distrito es la ubicacion de la persona; la
 * provincia es la zona de servicio (la enciende el panel de gestion).
 */
import { useEffect, useState, useCallback } from 'react';

export interface ProvinciaGeo {
  codigo: string;
  nombre: string;
  departamento: string;
  departamentoNombre: string;
  totalDistritos: number;
  activo: boolean;
}

export interface DistritoGeo {
  codigo: string;
  nombre: string;
  codigoPadre: string | null;
  provincia: string;
}

interface EstadoGeo {
  provincias: ProvinciaGeo[];
  distritosPorProvincia: Record<string, DistritoGeo[]>;
  distritosDeZona: string[];
  cargando: boolean;
  error: string | null;
}

const estado: EstadoGeo = {
  provincias: [],
  distritosPorProvincia: {},
  distritosDeZona: [],
  cargando: false,
  error: null,
};

let cargandoEnCurso: Promise<void> | null = null;
const escuchas = new Set<() => void>();

function avisar(): void {
  for (const e of escuchas) {
    try {
      e();
    } catch {
      // un listener que falla no puede tumbar a los demas
    }
  }
}

/** Carga las provincias y, si se piden, los distritos de una. */
export async function cargarGeografia(provincia?: string): Promise<void> {
  if (estado.cargando) return;
  estado.cargando = true;
  estado.error = null;
  avisar();
  try {
    const rProv = await fetch('/api/geo/provincias', { headers: { Accept: 'application/json' } });
    const cuerpo: any = await rProv.json().catch(() => null);
    if (!rProv.ok || !cuerpo?.ok || !Array.isArray(cuerpo.provincias)) {
      throw new Error('No se pudo leer el catalogo de provincias.');
    }
    estado.provincias = cuerpo.provincias;

    if (provincia && !estado.distritosPorProvincia[provincia]) {
      const rDist = await fetch(`/api/geo/distritos?provincia=${encodeURIComponent(provincia)}`, {
        headers: { Accept: 'application/json' },
      });
      const dist: any = await rDist.json().catch(() => null);
      if (rDist.ok && dist?.ok && Array.isArray(dist.distritos)) {
        estado.distritosPorProvincia[provincia] = dist.distritos;
      }
    }
  } catch (e) {
    estado.error = e instanceof Error ? e.message : String(e);
  } finally {
    estado.cargando = false;
    avisar();
  }
}

/** Los distritos de una provincia (carga si hace falta). */
export async function cargarDistritos(provincia: string): Promise<DistritoGeo[]> {
  if (!provincia) return [];
  if (!estado.distritosPorProvincia[provincia]) {
    await cargarGeografia(provincia);
  }
  return estado.distritosPorProvincia[provincia] || [];
}

/** Las provincias que el negocio tiene encendidas (zona de servicio). */
export function provinciasActivas(): ProvinciaGeo[] {
  return estado.provincias.filter((p) => p.activo);
}

/**
 * Los distritos de la ZONA DE SERVICIO (las provincias encendidas).
 *
 * Es lo que usan los filtros del panel: un filtro por distrito tiene que
 * ofrecer los distritos por los que realmente se puede servir, no una lista
 * escrita a mano que ademas estaba desactualizada.
 */
export async function cargarDistritosDeZona(): Promise<string[]> {
  if (!estado.provincias.length) await cargarGeografia();
  const activas = estado.provincias.filter((p) => p.activo);
  const nombres: string[] = [];
  for (const p of activas) {
    const dist = await cargarDistritos(p.codigo);
    for (const d of dist) {
      if (!nombres.includes(d.nombre)) nombres.push(d.nombre);
    }
  }
  nombres.sort((a, b) => a.localeCompare(b));
  estado.distritosDeZona = nombres;
  return nombres;
}

/**
 * Hook de geografia: carga el catalogo y avisa cuando cambia.
 *
 * Devuelve las provincias y una funcion para pedir los distritos de una.
 */
export function useGeografia(): {
  provincias: ProvinciaGeo[];
  cargar: (provincia?: string) => Promise<void>;
  cargando: boolean;
  error: string | null;
} {
  const [, setVersion] = useState(0);

  const recargar = useCallback(async (provincia?: string) => {
    await cargarGeografia(provincia);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const escucha = () => setVersion((v) => v + 1);
    escuchas.add(escucha);
    if (!estado.provincias.length && !cargandoEnCurso) {
      cargandoEnCurso = cargarGeografia().finally(() => {
        cargandoEnCurso = null;
      });
    }
    return () => {
      escuchas.delete(escucha);
    };
  }, []);

  return {
    provincias: estado.provincias,
    cargar: recargar,
    cargando: estado.cargando,
    error: estado.error,
  };
}

/**
 * Hook con los distritos de la zona de servicio (provincias encendidas).
 *
 * Para los filtros por distrito del panel. Devuelve una lista vacia hasta
 * que el catalogo este cargado: es preferible un filtro sin opciones a uno
 * con un distrito equivocado.
 */
export function useDistritosZona(): string[] {
  const [, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    const escucha = () => setVersion((v) => v + 1);
    escuchas.add(escucha);
    void cargarDistritosDeZona().then(() => {
      if (vivo) setVersion((v) => v + 1);
    });
    return () => {
      escuchas.delete(escucha);
    };
  }, []);

  return estado.distritosDeZona;
}
