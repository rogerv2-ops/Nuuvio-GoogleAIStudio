import React, { useEffect, useState } from 'react';
import { useGeografia, cargarDistritos, DistritoGeo } from '../../modules/geo';

interface SelectorProvinciaDistritoProps {
  provincia: string;
  distrito: string;
  onProvinciaChange: (codigo: string) => void;
  onDistritoChange: (nombre: string) => void;
  provinciaLabel?: string;
  distritoLabel?: string;
  soloActivas?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Selector de geografia: PROVINCIA y luego sus DISTRITOS.
 *
 * La jerarquia es la del negocio (el dueno, 2026-10-21): "primero se
 * despliega Provincia y un sub menu con los distritos". El distrito sin su
 * provincia no se puede elegir: en el Peru hay 99 nombres de distrito
 * repetidos ("Santa Rosa" aparece 10 veces), asi que el nombre solo no
 * identifica un lugar.
 *
 * Las provincias y los distritos salen de la tabla `geo_territorios` (el
 * listado oficial del INEI), no de una lista escrita a mano.
 */
export const SelectorProvinciaDistrito: React.FC<SelectorProvinciaDistritoProps> = ({
  provincia,
  distrito,
  onProvinciaChange,
  onDistritoChange,
  provinciaLabel = 'Provincia',
  distritoLabel = 'Distrito',
  soloActivas = false,
  required = false,
  className = '',
}) => {
  const { provincias, cargando, error } = useGeografia();
  const [distritos, setDistritos] = useState<DistritoGeo[]>([]);

  useEffect(() => {
    let vivo = true;
    if (!provincia) {
      setDistritos([]);
      return;
    }
    void cargarDistritos(provincia).then((d) => {
      if (vivo) setDistritos(d);
    });
    return () => {
      vivo = false;
    };
  }, [provincia]);

  const lista = soloActivas ? provincias.filter((p) => p.activo) : provincias;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
      <div>
        <label className="text-[11px] font-semibold text-[#57534E]">{provinciaLabel}</label>
        <select
          value={provincia}
          required={required}
          onChange={(e) => {
            onProvinciaChange(e.target.value);
            // Al cambiar de provincia, el distrito anterior deja de tener
            // sentido: se limpia.
            onDistritoChange('');
          }}
          className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332] bg-white"
        >
          <option value="">{cargando ? 'Cargando…' : 'Selecciona una provincia'}</option>
          {lista.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre}
              {p.departamentoNombre ? ` — ${p.departamentoNombre}` : ''}
              {p.activo ? '' : ' (sin servicio)'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#57534E]">{distritoLabel}</label>
        <select
          value={distrito}
          required={required}
          disabled={!provincia}
          onChange={(e) => onDistritoChange(e.target.value)}
          className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332] bg-white disabled:bg-stone-50 disabled:text-stone-400"
        >
          <option value="">
            {!provincia
              ? 'Elige primero la provincia'
              : distritos.length
                ? 'Selecciona un distrito'
                : 'Sin distritos'}
          </option>
          {distritos.map((d) => (
            <option key={d.codigo} value={d.nombre}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="sm:col-span-2 text-[11px] text-amber-700">
          No se pudo cargar el catálogo de provincias. Recarga la página e inténtalo de nuevo.
        </p>
      )}
    </div>
  );
};
