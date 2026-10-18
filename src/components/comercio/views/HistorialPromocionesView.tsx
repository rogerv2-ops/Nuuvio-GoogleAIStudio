import React, { useState, useMemo } from 'react';
import { 
  History, Send, Eye, MessageCircle, Target, TrendingUp, Search, 
  Filter, Calendar, ExternalLink, CheckCircle2, Clock, 
  AlertCircle, ArrowUpDown, ChevronRight, Sparkles,
  Zap, ArrowRight, ShieldCheck, Tag
} from 'lucide-react';
import { Merchant, Offer } from '../../../types';
import { getCategoryFallbackImage, handleImgError } from '../../../utils/imageFallbacks';

interface HistorialPromocionesViewProps {
  comercio: Merchant;
  ofertas: Offer[];
  rutaActual: string;
  alNavegar: (ruta: string) => void;
  alAbrirNuevaOferta: () => void;
}

export const HistorialPromocionesView: React.FC<HistorialPromocionesViewProps> = ({
  comercio,
  ofertas,
  alNavegar,
  alAbrirNuevaOferta
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'activa' | 'en_validacion' | 'pausada' | 'vencida'>('todas');
  const [criterioOrden, setCriterioOrden] = useState<'recientes' | 'vistas' | 'clics' | 'ctr'>('recientes');
  const [promocionDetalle, setPromocionDetalle] = useState<Offer | null>(null);

  // Estadísticas globales de alcance acumulado para el comercio
  const metricasGlobales = useMemo(() => {
    const totalPromociones = ofertas.length;
    const totalVistas = ofertas.reduce((acc, o) => acc + (o.vistas || 0), 0);
    const totalClics = ofertas.reduce((acc, o) => acc + (o.clics || 0), 0);
    const totalLeads = ofertas.reduce((acc, o) => acc + (o.leadsCalificados || 0), 0);
    const ctrPromedio = totalVistas > 0 ? ((totalClics / totalVistas) * 100).toFixed(1) : '0';
    const activasCount = ofertas.filter(o => o.estado === 'activa').length;
    const finalizadasCount = ofertas.filter(o => o.estado === 'vencida' || o.estado === 'pausada').length;

    return {
      totalPromociones,
      totalVistas,
      totalClics,
      totalLeads,
      ctrPromedio,
      activasCount,
      finalizadasCount
    };
  }, [ofertas]);

  // Filtrado y ordenamiento de promociones previas
  const promocionesProcesadas = useMemo(() => {
    let lista = ofertas.filter(o => {
      // Filtro por estado
      if (filtroEstado !== 'todas') {
        if (filtroEstado === 'vencida') {
          const esVencida = o.estado === 'vencida' || o.estado === 'pausada' || o.estado === 'agotada';
          if (!esVencida) return false;
        } else if (o.estado !== filtroEstado) {
          return false;
        }
      }

      // Filtro por búsqueda
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const coincideTitulo = o.titulo.toLowerCase().includes(q);
        const coincideCat = o.categoria.toLowerCase().includes(q);
        const coincideDist = o.distrito.toLowerCase().includes(q);
        if (!coincideTitulo && !coincideCat && !coincideDist) return false;
      }

      return true;
    });

    // Criterio de ordenamiento
    lista.sort((a, b) => {
      if (criterioOrden === 'vistas') {
        return (b.vistas || 0) - (a.vistas || 0);
      }
      if (criterioOrden === 'clics') {
        return (b.clics || 0) - (a.clics || 0);
      }
      if (criterioOrden === 'ctr') {
        const ctrA = (a.vistas || 0) > 0 ? (a.clics || 0) / (a.vistas || 1) : 0;
        const ctrB = (b.vistas || 0) > 0 ? (b.clics || 0) / (b.vistas || 1) : 0;
        return ctrB - ctrA;
      }
      // 'recientes' por defecto (creadaEn desc)
      const timeA = new Date(a.creadaEn || 0).getTime();
      const timeB = new Date(b.creadaEn || 0).getTime();
      return timeB - timeA;
    });

    return lista;
  }, [ofertas, filtroEstado, busqueda, criterioOrden]);

  const formatearFecha = (fechaStr?: string) => {
    if (!fechaStr) return 'Fecha no registrada';
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'activa':
        return {
          texto: 'Activa en circulación',
          clases: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          punto: 'bg-emerald-500'
        };
      case 'en_validacion':
        return {
          texto: 'En revisión técnica',
          clases: 'bg-amber-50 text-amber-800 border-amber-200/80',
          punto: 'bg-amber-500'
        };
      case 'pausada':
        return {
          texto: 'Pausada por local',
          clases: 'bg-stone-100 text-stone-700 border-stone-200',
          punto: 'bg-stone-400'
        };
      case 'agotada':
        return {
          texto: 'Stock agotado',
          clases: 'bg-orange-50 text-orange-800 border-orange-200/80',
          punto: 'bg-orange-500'
        };
      case 'vencida':
      default:
        return {
          texto: 'Campaña finalizada',
          clases: 'bg-stone-100 text-stone-600 border-stone-200',
          punto: 'bg-stone-400'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Contexto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
              <History className="w-3 h-3" />
              Historial de Envíos
            </span>
            <span className="text-xs text-stone-500 font-medium">
              Comercio: <strong>{comercio.nombreComercial}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight mt-1">
            Historial de Promociones y Alcance
          </h2>
          <p className="text-xs text-stone-600 max-w-2xl mt-0.5">
            Consulta el desempeño de todas las promociones que has publicado y enviado por WhatsApp. Analiza cuántos clientes las vieron, cuántos contactaron a tu local y la efectividad de cada oferta.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => alNavegar('/comercio/resultados')}
            className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Ver analítica detallada →
          </button>
          <button
            onClick={alAbrirNuevaOferta}
            className="px-3.5 py-2 bg-[#166534] hover:bg-[#14532D] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publicar nueva oferta</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Alcance Global */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Promociones Enviadas */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Promociones enviadas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono tabular-nums">
            {metricasGlobales.totalPromociones}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold">{metricasGlobales.activasCount} activas</span>
            <span>·</span>
            <span>{metricasGlobales.finalizadasCount} finalizadas</span>
          </div>
        </div>

        {/* KPI 2: Alcance Total / Vistas */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Alcance total (Vistas)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono tabular-nums">
            {metricasGlobales.totalVistas.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Impresiones en WhatsApp y catálogo web
          </p>
        </div>

        {/* KPI 3: Contactos Generados */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Contactos a WhatsApp</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono tabular-nums text-emerald-700">
            {metricasGlobales.totalClics.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Clientes que abrieron chat con tu local
          </p>
        </div>

        {/* KPI 4: Tasa de Interés / CTR */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Tasa de interés promedio</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono tabular-nums">
            {metricasGlobales.ctrPromedio}%
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Ratio de conversión visual a contacto
          </p>
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Ordenamiento */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por título, categoría o distrito..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-stone-400"
            />
            {busqueda && (
              <button 
                onClick={() => setBusqueda('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                ×
              </button>
            )}
          </div>

          {/* Ordenamiento */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-medium flex items-center gap-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar:
            </span>
            <select
              value={criterioOrden}
              onChange={e => setCriterioOrden(e.target.value as any)}
              className="text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white text-stone-800 outline-none focus:border-emerald-600 font-medium cursor-pointer"
            >
              <option value="recientes">Más recientes primero</option>
              <option value="vistas">Mayor alcance (Vistas)</option>
              <option value="clics">Más contactos WhatsApp (Clics)</option>
              <option value="ctr">Mayor tasa de conversión (CTR)</option>
            </select>
          </div>
        </div>

        {/* Pestañas de Estado */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100 text-xs font-semibold">
          <span className="text-stone-400 text-[11px] mr-1">Filtrar por:</span>
          <button
            onClick={() => setFiltroEstado('todas')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filtroEstado === 'todas'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Todas ({ofertas.length})
          </button>
          <button
            onClick={() => setFiltroEstado('activa')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filtroEstado === 'activa'
                ? 'bg-emerald-800 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Activas ({ofertas.filter(o => o.estado === 'activa').length})
          </button>
          <button
            onClick={() => setFiltroEstado('en_validacion')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filtroEstado === 'en_validacion'
                ? 'bg-amber-700 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            En revisión ({ofertas.filter(o => o.estado === 'en_validacion').length})
          </button>
          <button
            onClick={() => setFiltroEstado('vencida')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filtroEstado === 'vencida'
                ? 'bg-stone-700 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Finalizadas / Pausadas ({ofertas.filter(o => o.estado === 'vencida' || o.estado === 'pausada' || o.estado === 'agotada').length})
          </button>
        </div>
      </div>

      {/* Lista de Promociones con Estadísticas de Alcance */}
      <div className="space-y-3">
        {promocionesProcesadas.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-stone-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-stone-800 text-base">
              No se encontraron promociones en este filtro
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              {busqueda
                ? `No hay resultados para "${busqueda}". Prueba limpiando el buscador.`
                : 'Aún no tienes promociones registradas bajo este estado.'}
            </p>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          promocionesProcesadas.map(o => {
            const badge = getBadgeEstado(o.estado);
            const ctr = (o.vistas || 0) > 0 ? (((o.clics || 0) / (o.vistas || 1)) * 100).toFixed(1) : '0';
            const imgUrl = (o.imagenes && o.imagenes[0]) || getCategoryFallbackImage(o.categoria);

            return (
              <div 
                key={o.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-emerald-300 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
              >
                {/* Cabecera de la promoción */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    {/* Imagen miniatura */}
                    <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                      <img 
                        src={imgUrl} 
                        alt={o.titulo}
                        onError={e => handleImgError(e, o.categoria)}
                        className="w-full h-full object-cover"
                      />
                      {o.videoUrl && (
                        <div className="absolute top-1 left-1 bg-purple-900/80 text-purple-200 text-[9px] font-bold px-1 py-0.5 rounded-sm flex items-center gap-0.5 backdrop-blur-xs">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Veo</span>
                        </div>
                      )}
                    </div>

                    {/* Información principal */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${badge.clases}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.punto}`} />
                          {badge.texto}
                        </span>
                        <span className="text-[11px] text-stone-500 font-medium">
                          {o.distrito} · {o.categoria}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm sm:text-base text-[#0F172A] leading-tight">
                        {o.titulo}
                      </h4>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-black text-emerald-700 font-mono">
                          S/ {Number(o.precioOferta).toFixed(2)}
                        </span>
                        {Number(o.precioNormal) > Number(o.precioOferta) && (
                          <span className="text-stone-400 line-through font-mono text-[11px]">
                            S/ {Number(o.precioNormal).toFixed(2)}
                          </span>
                        )}
                        <span className="text-[11px] text-stone-500">
                          · Publicada el {formatearFecha(o.creadaEn)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botón de acción rápida */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => setPromocionDetalle(o)}
                      className="px-3 py-1.5 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Ver alcance</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Grid de Estadísticas de Alcance de la Promoción */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-stone-50/80 rounded-xl p-3 border border-stone-100">
                  {/* Métrica 1: Vistas / Alcance */}
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                      <Eye className="w-3 h-3 text-stone-400" />
                      <span>Alcance (Vistas)</span>
                    </div>
                    <div className="text-lg font-black text-[#0F172A] font-mono tabular-nums">
                      {(o.vistas || 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-stone-400">
                      Impresiones de la oferta
                    </p>
                  </div>

                  {/* Métrica 2: Contactos WhatsApp */}
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      <span>Contactos WhatsApp</span>
                    </div>
                    <div className="text-lg font-black text-emerald-700 font-mono tabular-nums">
                      {(o.clics || 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-stone-400">
                      Interesados en chatear
                    </p>
                  </div>

                  {/* Métrica 3: Leads Calificados */}
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                      <Target className="w-3 h-3 text-blue-600" />
                      <span>Leads Calificados</span>
                    </div>
                    <div className="text-lg font-black text-[#0F172A] font-mono tabular-nums">
                      {(o.leadsCalificados || 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-stone-400">
                      Clientes potenciales
                    </p>
                  </div>

                  {/* Métrica 4: CTR / Efectividad */}
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-purple-600" />
                      <span>Tasa de contacto</span>
                    </div>
                    <div className="text-lg font-black text-[#0F172A] font-mono tabular-nums flex items-baseline gap-1">
                      <span>{ctr}%</span>
                      <span className="text-[10px] font-normal text-stone-400">CTR</span>
                    </div>
                    {/* Barra de progreso de efectividad */}
                    <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(8, Number(ctr) * 3))}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Pie de detalles adicionales */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 pt-1 border-t border-stone-100">
                  <div className="flex items-center gap-3">
                    <span>
                      Vigencia: <strong>Hasta el {formatearFecha(o.venceEn)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Difusión: <strong>WhatsApp Bot & yuddit.com</strong>
                    </span>
                  </div>

                  <a
                    href={`${window.location.origin}/?oferta=${o.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Ver ficha pública</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Detalle Extendido de Alcance */}
      {promocionDetalle && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-xl border border-stone-200 space-y-5 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  Reporte de Alcance de Promoción
                </span>
                <h3 className="font-bold text-lg text-[#0F172A] mt-1">
                  {promocionDetalle.titulo}
                </h3>
                <p className="text-xs text-stone-500">
                  {promocionDetalle.comercioNombre} · {promocionDetalle.distrito}
                </p>
              </div>
              <button
                onClick={() => setPromocionDetalle(null)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Vista Previa de la Oferta */}
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <img 
                src={(promocionDetalle.imagenes && promocionDetalle.imagenes[0]) || getCategoryFallbackImage(promocionDetalle.categoria)} 
                alt={promocionDetalle.titulo}
                onError={e => handleImgError(e, promocionDetalle.categoria)}
                className="w-16 h-20 object-cover rounded-lg shrink-0 border border-stone-200"
              />
              <div className="space-y-1 text-xs">
                <p className="text-stone-600 line-clamp-2">
                  {promocionDetalle.descripcion}
                </p>
                <div className="flex items-center gap-2 pt-1 font-mono">
                  <span className="font-black text-emerald-700 text-sm">
                    S/ {Number(promocionDetalle.precioOferta).toFixed(2)}
                  </span>
                  {Number(promocionDetalle.precioNormal) > Number(promocionDetalle.precioOferta) && (
                    <span className="line-through text-stone-400 text-xs">
                      S/ {Number(promocionDetalle.precioNormal).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Desglose de Alcance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/60">
                <span className="text-[11px] text-blue-900 font-semibold block">Vistas acumuladas</span>
                <span className="text-2xl font-black text-blue-950 font-mono mt-1 block">
                  {(promocionDetalle.vistas || 0).toLocaleString()}
                </span>
                <p className="text-[10px] text-blue-800 mt-1">
                  Veces que se mostró en resultados del bot y catálogo
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
                <span className="text-[11px] text-emerald-900 font-semibold block">Contactos a WhatsApp</span>
                <span className="text-2xl font-black text-emerald-950 font-mono mt-1 block">
                  {(promocionDetalle.clics || 0).toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-800 mt-1">
                  Usuarios que hicieron clic para iniciar chat comercial
                </p>
              </div>

              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/60">
                <span className="text-[11px] text-purple-900 font-semibold block">Tasa de interés (CTR)</span>
                <span className="text-2xl font-black text-purple-950 font-mono mt-1 block">
                  {(promocionDetalle.vistas || 0) > 0 
                    ? (((promocionDetalle.clics || 0) / (promocionDetalle.vistas || 1)) * 100).toFixed(1)
                    : '0'}%
                </span>
                <p className="text-[10px] text-purple-800 mt-1">
                  Proporción de interés respecto a impresiones
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/60">
                <span className="text-[11px] text-amber-900 font-semibold block">Leads de alta intención</span>
                <span className="text-2xl font-black text-amber-950 font-mono mt-1 block">
                  {(promocionDetalle.leadsCalificados || 0).toLocaleString()}
                </span>
                <p className="text-[10px] text-amber-800 mt-1">
                  Contactos listos para conversión en tu tienda
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setPromocionDetalle(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cerrar reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
