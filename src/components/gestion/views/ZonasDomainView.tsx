import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  MapPin, Globe, CheckCircle2, ChevronDown, ChevronRight,
  Search, Loader2, AlertCircle, Building2
} from 'lucide-react';

interface ProvinciaGeo {
  codigo: string;
  nombre: string;
  departamento: string;
  departamentoNombre: string;
  totalDistritos: number;
  activo: boolean;
}

interface DistritoGeo {
  codigo: string;
  nombre: string;
}

interface ZonasDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

/**
 * ZONAS DE OPERACION: que provincias tiene el negocio encendidas.
 *
 * La unidad de negocio es la PROVINCIA. Yuddit abre una provincia cuando
 * entra en esa zona, y el distrito es la ubicacion de la persona dentro de
 * una provincia activa. Este panel es el interruptor: se enciende una
 * provincia y sus distritos pasan a ser zona de servicio.
 *
 * El catalogo NO esta en el bundle del navegador: se pide a la API, que lo
 * lee de la tabla `geo_territorios` (el listado oficial del INEI).
 */
export const ZonasDomainView: React.FC<ZonasDomainViewProps> = ({ subruta, onNavegar }) => {
  const [provincias, setProvincias] = useState<ProvinciaGeo[]>([]);
  const [distritosPorProvincia, setDistritosPorProvincia] = useState<Record<string, DistritoGeo[]>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [provinciaAbierta, setProvinciaAbierta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargarProvincias = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch('/api/geo/provincias', { headers: { Accept: 'application/json' } });
      const cuerpo: any = await r.json().catch(() => null);
      if (!r.ok || !cuerpo || !Array.isArray(cuerpo.provincias)) {
        throw new Error('No se pudo leer el catalogo de provincias.');
      }
      setProvincias(cuerpo.provincias);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarProvincias();
  }, [cargarProvincias]);

  const alternar = async (provincia: ProvinciaGeo) => {
    setGuardando(provincia.codigo);
    setAviso(null);
    try {
      const r = await fetch('/api/geo/provincias/activar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: provincia.codigo, activo: !provincia.activo }),
      });
      const cuerpo: any = await r.json().catch(() => null);
      if (!r.ok || !cuerpo?.ok) {
        throw new Error(cuerpo?.error || 'No se pudo guardar el estado de la provincia.');
      }
      setProvincias((prev) =>
        prev.map((p) => (p.codigo === provincia.codigo ? { ...p, activo: !!cuerpo.activo } : p)),
      );
      setAviso({ ok: true, texto: cuerpo.mensaje || 'Provincia actualizada.' });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(null);
    }
  };

  const verDistritos = async (provincia: ProvinciaGeo) => {
    if (provinciaAbierta === provincia.codigo) {
      setProvinciaAbierta(null);
      return;
    }
    setProvinciaAbierta(provincia.codigo);
    if (distritosPorProvincia[provincia.codigo]) return;
    try {
      const r = await fetch(`/api/geo/distritos?provincia=${provincia.codigo}`, {
        headers: { Accept: 'application/json' },
      });
      const cuerpo: any = await r.json().catch(() => null);
      if (r.ok && cuerpo?.ok) {
        setDistritosPorProvincia((prev) => ({ ...prev, [provincia.codigo]: cuerpo.distritos || [] }));
      }
    } catch {
      // si falla, la lista simplemente no se despliega
    }
  };

  const activas = useMemo(() => provincias.filter((p) => p.activo), [provincias]);
  const distritosCubiertos = useMemo(
    () => activas.reduce((acc, p) => acc + (p.totalDistritos || 0), 0),
    [activas],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return provincias;
    return provincias.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.departamentoNombre || '').toLowerCase().includes(q),
    );
  }, [provincias, busqueda]);

  const porDepartamento = useMemo(() => {
    const grupos = new Map<string, ProvinciaGeo[]>();
    for (const p of filtradas) {
      const clave = p.departamentoNombre || p.departamento;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(p);
    }
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtradas]);

  return (
    <div className="space-y-5">
      {/* ENCABEZADO */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" /> Zonas de operacion
            </h2>
            <p className="text-xs text-stone-500 mt-1 max-w-2xl">
              La zona de servicio de Yuddit se enciende <strong>por provincia</strong>. Cada provincia
              tiene su lista de distritos: al activarla, sus distritos pasan a ser zona donde el bot
              muestra ofertas. Enciende una provincia nueva a medida que el negocio se expanda.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Provincias activas
              </div>
              <div className="text-xl font-black text-amber-900">{activas.length}</div>
            </div>
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-2 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Distritos cubiertos
              </div>
              <div className="text-xl font-black text-[#0F172A]">{distritosCubiertos}</div>
            </div>
          </div>
        </div>

        {cargando && (
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando el catalogo de provincias...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {aviso && (
          <div
            className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mt-4 border ${
              aviso.ok
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            {aviso.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {aviso.texto}
          </div>
        )}

        <div className="relative mt-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar provincia o departamento (ej. Lima, Arequipa, Callao)"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      {/* PROVINCIAS */}
      {!cargando && !error && porDepartamento.map(([departamento, lista]) => {
        const activasDelGrupo = lista.filter((p) => p.activo).length;
        return (
          <div key={departamento} className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-stone-500" />
                <span className="text-sm font-bold text-[#0F172A]">{departamento}</span>
                <span className="text-[11px] text-stone-500">
                  {lista.length} province{lista.length === 1 ? '' : 's'}
                </span>
              </div>
              {activasDelGrupo > 0 && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                  {activasDelGrupo} activa{activasDelGrupo === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <ul className="divide-y divide-stone-100">
              {lista.map((p) => {
                const districts = distritosPorProvincia[p.codigo] || [];
                const abierta = provinciaAbierta === p.codigo;
                return (
                  <li key={p.codigo} className={p.activo ? 'bg-amber-50/40' : ''}>
                    <div className="flex items-center gap-3 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => void verDistritos(p)}
                        className="text-stone-400 hover:text-stone-700"
                        title="Ver los distritos de la provincia"
                      >
                        {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[#0F172A] truncate">{p.nombre}</div>
                        <div className="text-[11px] text-stone-500">
                          {p.totalDistritos} distrito{p.totalDistritos === 1 ? '' : 's'} · código {p.codigo}
                        </div>
                      </div>

                      {p.activo && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> En servicio
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => void alternar(p)}
                        disabled={guardando === p.codigo}
                        className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${
                          p.activo ? 'bg-amber-500' : 'bg-stone-300'
                        }`}
                        title={p.activo ? 'Desactivar provincia' : 'Activar provincia'}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            p.activo ? 'left-6' : 'left-0.5'
                          }`}
                        />
                        {guardando === p.codigo && (
                          <Loader2 className="w-3.5 h-3.5 absolute inset-0 m-auto animate-spin text-stone-500" />
                        )}
                      </button>
                    </div>

                    {abierta && (
                      <div className="px-5 pb-4 pl-14">
                        {districts.length === 0 ? (
                          <div className="text-[11px] text-stone-400">Cargando distritos...</div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {districts.map((d) => (
                              <span
                                key={d.codigo}
                                className={`text-[11px] rounded-lg px-2 py-1 border ${
                                  p.activo
                                    ? 'text-amber-900 bg-amber-50 border-amber-200'
                                    : 'text-stone-600 bg-stone-50 border-stone-200'
                                }`}
                                title={d.codigo}
                              >
                                {d.nombre}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {!cargando && !error && porDepartamento.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200/80 text-center text-sm text-stone-500">
          <Building2 className="w-8 h-8 mx-auto mb-2 text-stone-300" />
          No hay provincias que coincidan con «{busqueda}».
        </div>
      )}
    </div>
  );
};
