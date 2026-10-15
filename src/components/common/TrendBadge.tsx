import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown } from 'lucide-react';

export interface TrendBadgeProps {
  actual?: number;
  anterior?: number;
  porcentaje?: number;
  compact?: boolean;
  mostrarTextoPeriodo?: boolean;
  etiquetaPeriodo?: string;
  inverso?: boolean; // Si es true, una bajada es positiva (ej. costo, rechazos)
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Calcula las fechas correspondientes al periodo anterior inmediatamente igual
 * (Misma cantidad de días inmediatamente anteriores a la fecha de inicio)
 */
export const helperCalcularPeriodoAnterior = (fechaInicioIso: string, fechaFinIso: string) => {
  const parsear = (s: string) => {
    const parts = s.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };

  const fIni = parsear(fechaInicioIso);
  const fFin = parsear(fechaFinIso);
  const diffMs = Math.max(0, fFin.getTime() - fIni.getTime());
  const duracionDias = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

  // El periodo anterior termina 1 día antes de la fechaInicio
  const antFin = new Date(fIni);
  antFin.setDate(antFin.getDate() - 1);

  // Y empieza duracionDias antes
  const antIni = new Date(antFin);
  antIni.setDate(antIni.getDate() - (duracionDias - 1));

  const toIso = (d: Date) => d.toISOString().split('T')[0] || '';

  return {
    duracionDias,
    anteriorInicioIso: toIso(antIni),
    anteriorFinIso: toIso(antFin),
    etiquetaRangoAnterior: `${toIso(antIni)} al ${toIso(antFin)}`
  };
};

/**
 * Insignia visual con código de color y flecha de tendencia comparativa
 * (Verde para crecimiento, rojo para descenso, gris para neutro)
 */
export const TrendBadge: React.FC<TrendBadgeProps> = ({
  actual,
  anterior,
  porcentaje: porcentajeProp,
  compact = false,
  mostrarTextoPeriodo = true,
  etiquetaPeriodo = 'vs período ant.',
  inverso = false,
  className = '',
  size = 'xs'
}) => {
  // Determinar el porcentaje
  let pct = 0;
  if (typeof porcentajeProp === 'number') {
    pct = porcentajeProp;
  } else if (typeof actual === 'number' && typeof anterior === 'number') {
    if (anterior > 0) {
      pct = ((actual - anterior) / anterior) * 100;
    } else if (actual > 0) {
      pct = 100;
    } else {
      pct = 0;
    }
  }

  const esPositivo = pct > 0;
  const esNegativo = pct < 0;
  const esNeutro = pct === 0;

  // Lógica de color si es métrica inversa
  const esExito = inverso ? esNegativo : esPositivo;
  const esAlerta = inverso ? esPositivo : esNegativo;

  const pctFormateado = Math.abs(pct) >= 100 
    ? Math.round(pct) 
    : Number(pct.toFixed(1));

  const signo = pct > 0 ? '+' : '';

  // Tamaños y paddings
  const sizeClasses = {
    xs: 'text-[11px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2'
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4'
  }[size];

  if (esNeutro) {
    return (
      <span
        className={`inline-flex items-center font-bold rounded-lg border bg-stone-100 text-stone-600 border-stone-200/80 tracking-tight ${sizeClasses} ${className}`}
        title={`0.0% ${etiquetaPeriodo}`}
      >
        <Minus className={`${iconSizes} text-stone-400 shrink-0`} />
        <span>0.0%</span>
        {mostrarTextoPeriodo && !compact && (
          <span className="text-[10px] text-stone-400 font-normal">
            {etiquetaPeriodo}
          </span>
        )}
      </span>
    );
  }

  if (esExito) {
    return (
      <span
        className={`inline-flex items-center font-bold rounded-lg border bg-emerald-50/90 text-emerald-800 border-emerald-200/90 tracking-tight shadow-3xs ${sizeClasses} ${className}`}
        title={`${signo}${pctFormateado}% ${etiquetaPeriodo}`}
      >
        <ArrowUpRight className={`${iconSizes} text-emerald-600 shrink-0 stroke-[2.5]`} />
        <span>
          {signo}{pctFormateado}%
        </span>
        {mostrarTextoPeriodo && !compact && (
          <span className="text-[10px] text-emerald-700/80 font-normal">
            {etiquetaPeriodo}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-bold rounded-lg border bg-rose-50/90 text-rose-800 border-rose-200/90 tracking-tight shadow-3xs ${sizeClasses} ${className}`}
      title={`${pctFormateado}% ${etiquetaPeriodo}`}
    >
      <ArrowDownRight className={`${iconSizes} text-rose-600 shrink-0 stroke-[2.5]`} />
      <span>
        {pctFormateado}%
      </span>
      {mostrarTextoPeriodo && !compact && (
        <span className="text-[10px] text-rose-700/80 font-normal">
          {etiquetaPeriodo}
        </span>
      )}
    </span>
  );
};
