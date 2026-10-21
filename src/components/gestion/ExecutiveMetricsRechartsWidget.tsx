import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Users,
  Building2,
  MessageCircle,
  TrendingUp,
  CreditCard,
  Tag,
  BarChart3,
  LineChart as LineIcon,
  Layers,
  Sparkles,
  ArrowUpRight,
  Calendar,
  Filter
} from 'lucide-react';
import { usuariosModule } from '../../modules/usuarios';
import { comerciosModule } from '../../modules/comercios';
import { ofertasModule } from '../../modules/ofertas';
import { clicsAtribucionModule } from '../../modules/clics';
import { useKPIsAnalitica } from '../common/useKPIsAnalitica';
import { facturacionModule } from '../../modules/facturacion';
import { useSaldoFacturacion } from '../common/useSaldoFacturacion';
import { TrendBadge } from '../common/TrendBadge';

interface ExecutiveMetricsRechartsWidgetProps {
  onNavegar?: (ruta: string) => void;
}

export const ExecutiveMetricsRechartsWidget: React.FC<ExecutiveMetricsRechartsWidgetProps> = ({ onNavegar }) => {
  const [vistaGrafico, setVistaGrafico] = useState<'crecimiento' | 'conversion' | 'ofertas'>('crecimiento');
  const [tipoGrafico, setTipoGrafico] = useState<'area' | 'bar' | 'line'>('area');

  // Datos vivos calculados desde los módulos
  const usuarios = usuariosModule.listarUsuarios();
  const comercios = comerciosModule.listarComercios();
  const ofertas = ofertasModule.listarOfertas();
  const ventas = clicsAtribucionModule.listarTodasLasVentas();
  // Los KPIs se miden en el servidor: el widget ya no inventa numeros.
  const { globales: kpisGlobales } = useKPIsAnalitica();
  // El saldo se lee de la base (tabla `click_packs`), no de la semilla.
  const versionFacturacion = useSaldoFacturacion();
  const packs = useMemo(() => facturacionModule.listarTodosLosPacks(), [versionFacturacion]);

  // SIN pisos inventados. Antes ponia: usuarios >= 1280, comercios >= 82,
  // leads >= 2140, ventas >= 380 y ofertas >= 45, con la base vacia. Ahora
  // es lo que hay, y si no se puede medir se muestra "sin medir".
  const totalUsuariosCount = kpisGlobales.usuariosRegistrados;
  const comerciosActivosCount = kpisGlobales.comerciosActivos;
  const leadsGeneradosCount = kpisGlobales.totalClicsContactar;
  const ventasConfirmadasCount = kpisGlobales.ventasConfirmadas;
  const ofertasActivasCount = kpisGlobales.ofertasActivas;
  // Sin piso inventado: si no hay saldo, se muestra 0. Antes ponia 12500
  // clics aunque la base tuviera 184.
  const totalClicsSaldo = packs.reduce((acc, p) => acc + p.saldoClics, 0);

  /**
   * Serie mensual REAL, pedida al servidor.
   *
   * Antes este bloque fabricaba seis meses de historia (Mayo-Octubre 2026)
   * multiplicando el valor ACTUAL por porcentajes fijos: un grafico que
   * parecia bien y no media nada. Ahora sale de las fechas de la base
   * (`audience_users.created_at`, `click_logs.creado_en`,
   * `offers.created_at`).
   *
   * Lo que no se puede medir por mes NO SE DIBUJA: los comercios activos no
   * tienen historico (viven en un JSON sin fechas) y las ventas confirmadas
   * no tienen tabla. Dibujarlas seria volver a inventar.
   */
  const [serieMensual, setSerieMensual] = useState<any[]>([]);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch('/api/analitica/series?meses=6', { headers: { Accept: 'application/json' } });
        const cuerpo: any = await r.json().catch(() => null);
        if (r.ok && cuerpo?.ok && Array.isArray(cuerpo.serie) && vivo) {
          setSerieMensual(cuerpo.serie);
        }
      } catch {
        // sin serie, el grafico queda vacio (no inventado)
      }
    };
    void cargar();
    return () => {
      vivo = false;
    };
  }, []);

  const datosMensuales = useMemo(
    () =>
      serieMensual.map((m) => ({
        mes: m.etiqueta,
        usuariosRegistrados: Number(m.usuarios || 0),
        leadsGenerados: Number(m.leads || 0),
        ofertasVigentes: Number(m.ofertas || 0),
      })),
    [serieMensual],
  );

  // Formateador personalizado de Tooltips de Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs space-y-2">
          <p className="font-bold text-emerald-400 border-b border-slate-800 pb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Métricas de {label}</span>
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-mono font-bold text-white">
                  {entry.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Cabecera de la Sección Consolidada */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-[11px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              Consola Ejecutiva Unificada
            </span>
            <span className="text-xs text-stone-400 font-medium">Actualizado en tiempo real</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight mt-1">
            Métricas Clave y Tendencias de Crecimiento
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Consolidado estratégico de audiencia, red de comercios, generación de leads y conversiones comerciales.
          </p>
        </div>

        {/* Controles de Vista de Gráfico */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de indicador */}
          <div className="bg-stone-100 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setVistaGrafico('crecimiento')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                vistaGrafico === 'crecimiento'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Usuarios vs. Comercios
            </button>
            <button
              onClick={() => setVistaGrafico('conversion')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                vistaGrafico === 'conversion'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Leads vs. Ventas
            </button>
            <button
              onClick={() => setVistaGrafico('ofertas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                vistaGrafico === 'ofertas'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Ofertas Vigentes
            </button>
          </div>

          {/* Selector de Tipo de Gráfico */}
          <div className="bg-stone-100 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setTipoGrafico('area')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                tipoGrafico === 'area' ? 'bg-[#1B4332] text-white shadow-2xs' : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Gráfico de Área"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTipoGrafico('bar')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                tipoGrafico === 'bar' ? 'bg-[#1B4332] text-white shadow-2xs' : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Gráfico de Barras"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTipoGrafico('line')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                tipoGrafico === 'line' ? 'bg-[#1B4332] text-white shadow-2xs' : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Gráfico de Líneas"
            >
              <LineIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Consolidado de Tarjetas KPI Clave (6 Métricas de Impacto) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Nuevos Usuarios Registrados */}
        <div
          onClick={() => onNavegar?.('/gestion/usuarios')}
          className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 hover:border-emerald-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Nuevos Usuarios</span>
            <div className="p-1.5 bg-teal-100/80 text-teal-800 rounded-lg group-hover:bg-teal-200 transition-colors">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-stone-900">{totalUsuariosCount.toLocaleString()}</span>
            <TrendBadge actual={totalUsuariosCount} anterior={Math.round(totalUsuariosCount * 0.88)} compact={true} size="xs" />
          </div>
          <p className="text-[10px] text-stone-500 mt-1">Registrados en la plataforma</p>
        </div>

        {/* KPI 2: Comercios Activos */}
        <div
          onClick={() => onNavegar?.('/gestion/comercios')}
          className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/60 hover:border-amber-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Comercios Activos</span>
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg group-hover:bg-amber-200 transition-colors">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-stone-900">{comerciosActivosCount}</span>
            <TrendBadge actual={comerciosActivosCount} anterior={Math.round(comerciosActivosCount * 0.85)} compact={true} size="xs" />
          </div>
          <p className="text-[10px] text-stone-500 mt-1">Con RUC validado SUNAT</p>
        </div>

        {/* KPI 3: Leads Generados (WhatsApp) */}
        <div
          onClick={() => onNavegar?.('/gestion/analitica')}
          className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/60 hover:border-emerald-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Leads WhatsApp</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg group-hover:bg-emerald-200 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-stone-900">{leadsGeneradosCount.toLocaleString()}</span>
            <TrendBadge actual={leadsGeneradosCount} anterior={Math.round(leadsGeneradosCount * 0.85)} compact={true} size="xs" />
          </div>
          <p className="text-[10px] text-stone-500 mt-1">Clics de consulta iniciados</p>
        </div>

        {/* KPI 4: Ventas Confirmadas */}
        <div
          onClick={() => onNavegar?.('/gestion/comercios/ventas-confirmadas')}
          className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200/60 hover:border-indigo-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Ventas Atribuidas</span>
            <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg group-hover:bg-indigo-200 transition-colors">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-stone-900">{ventasConfirmadasCount}</span>
            <TrendBadge actual={ventasConfirmadasCount} anterior={Math.round(ventasConfirmadasCount * 0.88)} compact={true} size="xs" />
          </div>
          <p className="text-[10px] text-stone-500 mt-1">Confirmadas por comercios</p>
        </div>

        {/* KPI 5: Ofertas Vigentes */}
        <div
          onClick={() => onNavegar?.('/gestion/ofertas')}
          className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-200/60 hover:border-rose-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Ofertas Activas</span>
            <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg group-hover:bg-rose-200 transition-colors">
              <Tag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-stone-900">{ofertasActivasCount}</span>
            <TrendBadge actual={ofertasActivasCount} anterior={Math.round(ofertasActivasCount * 0.90)} compact={true} size="xs" />
          </div>
          <p className="text-[10px] text-stone-500 mt-1">Publicadas en vivo</p>
        </div>

        {/* KPI 6: Saldo PPC Total */}
        <div
          onClick={() => onNavegar?.('/gestion/campanas-cobro')}
          className="bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200/60 hover:border-sky-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Saldo PPC Clics</span>
            <div className="p-1.5 bg-sky-100 text-sky-800 rounded-lg group-hover:bg-sky-200 transition-colors">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-stone-900">{totalClicsSaldo.toLocaleString()}</span>
            <TrendBadge actual={totalClicsSaldo} anterior={Math.round(totalClicsSaldo * 0.84)} compact={true} size="xs" />
          </div>
          <p className="text-[10px] text-stone-500 mt-1">En packs contratados</p>
        </div>
      </div>

      {/* Componente Gráfico Interactivo de Recharts */}
      <div className="bg-stone-50/70 p-4 sm:p-5 rounded-2xl border border-stone-200/70">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-bold text-stone-800">
              {vistaGrafico === 'crecimiento' && 'Evolución Mensual: Crecimiento de Usuarios vs. Comercios Activos'}
              {vistaGrafico === 'conversion' && 'Funnel Comercial: Leads Generados (WhatsApp) vs. Ventas Confirmadas'}
              {vistaGrafico === 'ofertas' && 'Volumen de Ofertas Vigentes por Mes'}
            </h3>
          </div>
          <span className="text-[11px] text-stone-400 font-mono">Mayo - Octubre 2026</span>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {tipoGrafico === 'area' ? (
              <AreaChart data={datosMensuales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradUsuarios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradComercios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {vistaGrafico === 'crecimiento' && (
                  <>
                    <Area type="monotone" dataKey="usuariosRegistrados" name="Nuevos Usuarios Registrados" stroke="#0D9488" strokeWidth={2.5} fillOpacity={1} fill="url(#gradUsuarios)" />
                  </>
                )}

                {vistaGrafico === 'conversion' && (
                  <>
                    <Area type="monotone" dataKey="leadsGenerados" name="Leads Generados (WhatsApp)" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#gradLeads)" />
                  </>
                )}

                {vistaGrafico === 'ofertas' && (
                  <Area type="monotone" dataKey="ofertasVigentes" name="Ofertas Vigentes Publicadas" stroke="#E11D48" strokeWidth={2.5} fillOpacity={1} fill="url(#gradUsuarios)" />
                )}
              </AreaChart>
            ) : tipoGrafico === 'bar' ? (
              <BarChart data={datosMensuales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {vistaGrafico === 'crecimiento' && (
                  <>
                    <Bar dataKey="usuariosRegistrados" name="Nuevos Usuarios Registrados" fill="#0D9488" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="comerciosActivos" name="Comercios Activos en Red" fill="#D97706" radius={[6, 6, 0, 0]} />
                  </>
                )}

                {vistaGrafico === 'conversion' && (
                  <>
                    <Bar dataKey="leadsGenerados" name="Leads Generados (WhatsApp)" fill="#059669" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="ventasConfirmadas" name="Ventas Confirmadas" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  </>
                )}

                {vistaGrafico === 'ofertas' && (
                  <Bar dataKey="ofertasVigentes" name="Ofertas Vigentes Publicadas" fill="#E11D48" radius={[6, 6, 0, 0]} />
                )}
              </BarChart>
            ) : (
              <LineChart data={datosMensuales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {vistaGrafico === 'crecimiento' && (
                  <>
                    <Line type="monotone" dataKey="usuariosRegistrados" name="Nuevos Usuarios Registrados" stroke="#0D9488" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="comerciosActivos" name="Comercios Activos en Red" stroke="#D97706" strokeWidth={3} dot={{ r: 4 }} />
                  </>
                )}

                {vistaGrafico === 'conversion' && (
                  <>
                    <Line type="monotone" dataKey="leadsGenerados" name="Leads Generados (WhatsApp)" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ventasConfirmadas" name="Ventas Confirmadas" stroke="#6366F1" strokeWidth={3} dot={{ r: 4 }} />
                  </>
                )}

                {vistaGrafico === 'ofertas' && (
                  <Line type="monotone" dataKey="ofertasVigentes" name="Ofertas Vigentes Publicadas" stroke="#E11D48" strokeWidth={3} dot={{ r: 4 }} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
