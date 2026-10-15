import React, { useState, useEffect } from 'react';
import { Calendar, Check, Clock, Filter, ArrowRight, AlertCircle, ChevronDown, RotateCcw } from 'lucide-react';

export type DateRangePreset = 'hoy' | 'ayer' | '7d' | '14d' | '30d' | '60d' | '90d' | 'mes' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
  etiqueta: string;
}

interface DateRangeSelectorProps {
  value: DateRangeValue;
  onChange: (nuevoRango: DateRangeValue) => void;
  className?: string;
  compact?: boolean;
  titulo?: string;
}

export const helperObtenerRangoPorPreset = (
  preset: DateRangePreset,
  fechaInicioPrev?: string,
  fechaFinPrev?: string
): DateRangeValue => {
  const hoy = new Date();
  const formatoIso = (d: Date) => d.toISOString().split('T')[0] || '';

  if (preset === 'hoy') {
    const f = formatoIso(hoy);
    return { preset: 'hoy', fechaInicio: f, fechaFin: f, etiqueta: 'Hoy' };
  }

  if (preset === 'ayer') {
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const f = formatoIso(ayer);
    return { preset: 'ayer', fechaInicio: f, fechaFin: f, etiqueta: 'Ayer' };
  }

  if (preset === '7d') {
    const d7 = new Date(hoy);
    d7.setDate(hoy.getDate() - 6);
    return { preset: '7d', fechaInicio: formatoIso(d7), fechaFin: formatoIso(hoy), etiqueta: 'Últimos 7 días' };
  }

  if (preset === '14d') {
    const d14 = new Date(hoy);
    d14.setDate(hoy.getDate() - 13);
    return { preset: '14d', fechaInicio: formatoIso(d14), fechaFin: formatoIso(hoy), etiqueta: 'Últimos 14 días' };
  }

  if (preset === '30d') {
    const d30 = new Date(hoy);
    d30.setDate(hoy.getDate() - 29);
    return { preset: '30d', fechaInicio: formatoIso(d30), fechaFin: formatoIso(hoy), etiqueta: 'Últimos 30 días' };
  }

  if (preset === '60d') {
    const d60 = new Date(hoy);
    d60.setDate(hoy.getDate() - 59);
    return { preset: '60d', fechaInicio: formatoIso(d60), fechaFin: formatoIso(hoy), etiqueta: '8 Semanas (60 días)' };
  }

  if (preset === '90d') {
    const d90 = new Date(hoy);
    d90.setDate(hoy.getDate() - 89);
    return { preset: '90d', fechaInicio: formatoIso(d90), fechaFin: formatoIso(hoy), etiqueta: 'Trimestre (90 días)' };
  }

  if (preset === 'mes') {
    const dMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { preset: 'mes', fechaInicio: formatoIso(dMes), fechaFin: formatoIso(hoy), etiqueta: 'Este mes' };
  }

  // Custom
  const fInicio = fechaInicioPrev || formatoIso(new Date(hoy.getTime() - 14 * 24 * 3600 * 1000));
  const fFin = fechaFinPrev || formatoIso(new Date());
  return {
    preset: 'custom',
    fechaInicio: fInicio,
    fechaFin: fFin,
    etiqueta: `Personalizado (${fInicio} al ${fFin})`
  };
};

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  value,
  onChange,
  className = '',
  compact = false,
  titulo = 'Periodo de Análisis'
}) => {
  const [mostrarCustomInputs, setMostrarCustomInputs] = useState(value.preset === 'custom');
  const [tempInicio, setTempInicio] = useState(value.fechaInicio);
  const [tempFin, setTempFin] = useState(value.fechaFin);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  useEffect(() => {
    setMostrarCustomInputs(value.preset === 'custom');
    setTempInicio(value.fechaInicio);
    setTempFin(value.fechaFin);
    setErrorValidacion(null);
  }, [value]);

  const handleSelectPreset = (p: DateRangePreset) => {
    setErrorValidacion(null);
    if (p === 'custom') {
      setMostrarCustomInputs(true);
      const nuevo = helperObtenerRangoPorPreset('custom', tempInicio, tempFin);
      onChange(nuevo);
    } else {
      setMostrarCustomInputs(false);
      const nuevo = helperObtenerRangoPorPreset(p);
      onChange(nuevo);
    }
  };

  const handleAplicarCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tempInicio || !tempFin) {
      setErrorValidacion('Debes ingresar ambas fechas (desde y hasta).');
      return;
    }
    if (tempInicio > tempFin) {
      setErrorValidacion('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    setErrorValidacion(null);
    onChange({
      preset: 'custom',
      fechaInicio: tempInicio,
      fechaFin: tempFin,
      etiqueta: `Personalizado (${tempInicio} al ${tempFin})`
    });
  };

  const presetsList: { id: DateRangePreset; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: '7d', label: '7 días' },
    { id: '14d', label: '14 días' },
    { id: '30d', label: '30 días' },
    { id: '60d', label: '8 Semanas' },
    { id: '90d', label: 'Trimestre' },
    { id: 'mes', label: 'Este mes' },
    { id: 'custom', label: 'Personalizado' }
  ];

  if (compact) {
    return (
      <div className={`bg-stone-50 border border-stone-200/90 rounded-2xl p-2.5 shadow-2xs space-y-2 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-stone-800">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-xs font-bold text-stone-900">{value.etiqueta}</span>
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
              {value.fechaInicio} ~ {value.fechaFin}
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-stone-200/70 p-0.5 rounded-lg">
            {presetsList.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  value.preset === p.id
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {mostrarCustomInputs && (
          <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-stone-500 uppercase">Desde</span>
              <input
                type="date"
                value={tempInicio}
                onChange={e => setTempInicio(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-semibold text-stone-800"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-stone-500 uppercase">Hasta</span>
              <input
                type="date"
                value={tempFin}
                onChange={e => setTempFin(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-semibold text-stone-800"
              />
            </div>
            <button
              type="button"
              onClick={handleAplicarCustom}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Aplicar
            </button>
            {errorValidacion && (
              <span className="text-[11px] text-rose-600 font-semibold">{errorValidacion}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-stone-50/90 border border-stone-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3 ${className}`}>
      {/* Fila Principal: Etiqueta + Píldoras de Preset */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-stone-800">
          <div className="w-8 h-8 rounded-xl bg-[#1B4332] text-white flex items-center justify-center shadow-2xs shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
              {titulo}
            </span>
            <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5 flex-wrap">
              <span>{value.etiqueta}</span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                {value.fechaInicio} ~ {value.fechaFin}
              </span>
            </span>
          </div>
        </div>

        {/* Botones Píldora de Rango */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-full bg-stone-200/60 p-1 rounded-xl">
          {presetsList.map(p => {
            const activo = value.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activo
                    ? 'bg-white text-[#1B4332] shadow-xs scale-100'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles para Rango Personalizado de Fechas (Si preset === 'custom') */}
      {mostrarCustomInputs && (
        <form onSubmit={handleAplicarCustom} className="pt-3 border-t border-stone-200/80 space-y-2 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                <span>Desde (Fecha inicio)</span>
              </label>
              <input
                type="date"
                value={tempInicio}
                onChange={(e) => {
                  setTempInicio(e.target.value);
                  setErrorValidacion(null);
                }}
                className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>

            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                <span>Hasta (Fecha fin)</span>
              </label>
              <input
                type="date"
                value={tempFin}
                onChange={(e) => {
                  setTempFin(e.target.value);
                  setErrorValidacion(null);
                }}
                className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <span>Aplicar Rango</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorValidacion && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorValidacion}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
