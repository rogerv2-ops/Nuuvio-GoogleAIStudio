import { useDistritosZona } from '../../../modules/geo';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Tag, ShieldAlert, BarChart2, Layers, Search, Filter, 
  CheckCircle2, XCircle, Eye, Sparkles, MapPin, Calendar, 
  ExternalLink, ChevronDown, Check, X, Building2, AlertCircle
} from 'lucide-react';
import { ofertasModule } from '../../../modules/ofertas';
import { comerciosModule } from '../../../modules/comercios';
import { Offer } from '../../../types';
import {CATEGORIAS_OFERTAS} from '../../../data/seedData';
import { getCategoryFallbackImage, handleImgError } from '../../../utils/imageFallbacks';
import { esOfertaNueva } from '../../../utils/ofertaUtils';
import { EstadisticasOfertasWhatsAppPanel } from '../EstadisticasOfertasWhatsAppPanel';
import { DateRangeSelector, DateRangeValue, helperObtenerRangoPorPreset } from '../../common/DateRangeSelector';

interface OfertasDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const OfertasDomainView: React.FC<OfertasDomainViewProps> = ({ subruta, onNavegar }) => {
  // Los distritos del filtro salen de la zona de servicio (las
  // provincias encendidas en el panel), no de una lista escrita a mano.
  const distritosZona = useDistritosZona();
  const [version, setVersion] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroDistrito, setFiltroDistrito] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activa' | 'en_validacion' | 'pausada' | 'rechazada'>('todos');
  const [usarFiltroFecha, setUsarFiltroFecha] = useState(false);
  const [rangoFechaCatalogo, setRangoFechaCatalogo] = useState<DateRangeValue>(() => helperObtenerRangoPorPreset('30d'));
  const [ordenCampo, setOrdenCampo] = useState<'publicacion' | 'vencimiento'>('publicacion');
  const [ordenDir, setOrdenDir] = useState<'desc' | 'asc'>('desc');
  
  // Oferta seleccionada para modal de detalle
  const [ofertaDetalle, setOfertaDetalle] = useState<Offer | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [ofertaRechazandoId, setOfertaRechazandoId] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  useEffect(() => {
    const unsub = ofertasModule.suscribir(() => setVersion(v => v + 1));
    return () => unsub();
  }, []);

  const todasOfertas = useMemo(() => ofertasModule.listarOfertas(), [version]);
  const pendientesModeracion = useMemo(() => ofertasModule.listarPendientesModeracion(), [version]);

  // KPIs analíticos principales
  const totalActivas = useMemo(() => {
    const ahora = Date.now();
    return todasOfertas.filter(o => o.estado === 'activa' && new Date(o.venceEn).getTime() > ahora).length;
  }, [todasOfertas]);

  const vencenHoyCount = useMemo(() => {
    const ahora = Date.now();
    return todasOfertas.filter(o => {
      if (o.estado !== 'activa') return false;
      const diffMs = new Date(o.venceEn).getTime() - ahora;
      return diffMs > 0 && diffMs <= 24 * 3600 * 1000;
    }).length;
  }, [todasOfertas]);

  const totalClicsWhatsApp = useMemo(() => {
    return todasOfertas.reduce((sum, o) => sum + (o.clics || 0), 0);
  }, [todasOfertas]);

  const totalVentasConfirmadas = useMemo(() => {
    return todasOfertas.reduce((sum, o) => sum + (o.leadsCalificados || 0), 0);
  }, [todasOfertas]);

  // Helpers de formato de fecha
  const formatFechaHora = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const getDiasVencimientoBadge = (venceEn: string) => {
    if (!venceEn) return null;
    const venceMs = new Date(venceEn).getTime();
    const ahoraMs = Date.now();
    const diffMs = venceMs - ahoraMs;
    const diffDias = Math.ceil(diffMs / (1000 * 3600 * 24));

    if (diffMs <= 0) {
      return <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 font-bold text-[10px] rounded-md">Vencida</span>;
    }
    if (diffDias === 0 || diffMs <= 24 * 3600 * 1000) {
      return <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-md animate-pulse">Vence hoy</span>;
    }
    if (diffDias <= 3) {
      return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md">En {diffDias}d</span>;
    }
    return <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-md">En {diffDias}d</span>;
  };

  // Subrutas
  const esCatalogo = subruta === '/gestion/ofertas/catalogo';
  const esModeracion = subruta === '/gestion/ofertas/moderacion';
  const esKpis = subruta === '/gestion/ofertas/kpis';
  const esCategorias = subruta === '/gestion/ofertas/categorias-banners';
  const esResumen = !esCatalogo && !esModeracion && !esKpis && !esCategorias;

  // Filtrado y ordenamiento de ofertas
  const ofertasFiltradas = useMemo(() => {
    const filtradas = todasOfertas.filter(o => {
      const cumpleCat = filtroCategoria === 'todas' || o.categoria.toLowerCase() === filtroCategoria.toLowerCase();
      const cumpleDistrito = filtroDistrito === 'todos' || o.distrito.toLowerCase() === filtroDistrito.toLowerCase();
      const cumpleEstado = filtroEstado === 'todos' || o.estado === filtroEstado;
      const q = busqueda.toLowerCase().trim();
      const cumpleBusqueda = !q ||
        o.titulo.toLowerCase().includes(q) ||
        o.comercioNombre.toLowerCase().includes(q) ||
        o.distrito.toLowerCase().includes(q);

      let cumpleFecha = true;
      if (usarFiltroFecha) {
        const fIso = (o.validadaEn || o.creadaEn || '').split('T')[0];
        cumpleFecha = Boolean(fIso && fIso >= rangoFechaCatalogo.fechaInicio && fIso <= rangoFechaCatalogo.fechaFin);
      }

      return cumpleCat && cumpleDistrito && cumpleEstado && cumpleBusqueda && cumpleFecha;
    });

    return filtradas.sort((a, b) => {
      if (ordenCampo === 'publicacion') {
        const mA = new Date(a.validadaEn || a.creadaEn).getTime();
        const mB = new Date(b.validadaEn || b.creadaEn).getTime();
        return ordenDir === 'desc' ? mB - mA : mA - mB;
      } else {
        const vA = new Date(a.venceEn || 0).getTime();
        const vB = new Date(b.venceEn || 0).getTime();
        return ordenDir === 'desc' ? vB - vA : vA - vB;
      }
    });
  }, [todasOfertas, filtroCategoria, filtroDistrito, filtroEstado, busqueda, ordenCampo, ordenDir, usarFiltroFecha, rangoFechaCatalogo]);

  const handleAprobarOferta = (ofertaId: string) => {
    ofertasModule.activarOferta(ofertaId, 'Super Admin');
    setNotificacion('¡Oferta aprobada y publicada en el catálogo activo!');
    setTimeout(() => setNotificacion(null), 3500);
  };

  const handleRechazarOfertaSubmit = (ofertaId: string) => {
    if (!motivoRechazo.trim()) {
      setNotificacion('Por favor ingresa el motivo del rechazo.');
      setTimeout(() => setNotificacion(null), 3500);
      return;
    }
    ofertasModule.rechazarOferta(ofertaId, motivoRechazo, 'Super Admin');
    setOfertaRechazandoId(null);
    setMotivoRechazo('');
    setNotificacion('Oferta rechazada.');
    setTimeout(() => setNotificacion(null), 3500);
  };

  return (
    <div className="space-y-6">
      {notificacion && (
        <div className="p-3 bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{notificacion}</span>
        </div>
      )}

      {/* Subnavegación de Sección */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onNavegar('/gestion/ofertas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esResumen
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Resumen de Ofertas</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/ofertas/catalogo')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esCatalogo
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Catálogo de Ofertas</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/ofertas/moderacion')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esModeracion
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Moderación (4:5)</span>
          {pendientesModeracion.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
              {pendientesModeracion.length}
            </span>
          )}
        </button>

        <button
          onClick={() => onNavegar('/gestion/ofertas/kpis')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esKpis
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Ofertas con KPIs</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/ofertas/categorias-banners')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esCategorias
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Categorías del Catálogo</span>
        </button>
      </div>

      {/* Banner de Notificación */}
      {notificacion && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notificacion}</span>
          </div>
          <button onClick={() => setNotificacion(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TARJETAS DE KPIS PRINCIPALES DEL SISTEMA DE OFERTAS (SIEMPRE VISIBLES EN RESUMEN / CATÁLOGO) */}
      {(esResumen || esCatalogo) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[10px] font-bold uppercase tracking-wider">Activas en Vivo</span>
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-1">{totalActivas}</div>
            <span className="text-[10px] text-emerald-700 font-medium">Publicadas en feed y WA</span>
          </div>

          <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-[10px] font-bold uppercase tracking-wider">En Moderación</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-1">{pendientesModeracion.length}</div>
            <span className="text-[10px] text-rose-700 font-medium">Cola de revisión 4:5</span>
          </div>

          <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-[10px] font-bold uppercase tracking-wider">Vencen Hoy</span>
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-1">{vencenHoyCount}</div>
            <span className="text-[10px] text-amber-700 font-medium">Próximas 24 horas</span>
          </div>

          <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-[10px] font-bold uppercase tracking-wider">Clics a WhatsApp</span>
              <BarChart2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-1">{totalClicsWhatsApp}</div>
            <span className="text-[10px] text-blue-700 font-medium">Interacciones en vivo</span>
          </div>

          <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-purple-800">
              <span className="text-[10px] font-bold uppercase tracking-wider">Ventas Confirmadas</span>
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-1">{totalVentasConfirmadas}</div>
            <span className="text-[10px] text-purple-700 font-medium">Conversiones registradas</span>
          </div>
        </div>
      )}

      {/* 2. CATÁLOGO DE OFERTAS & TABLA DETALLADA */}
      {(esCatalogo || esResumen) && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Catálogo Operativo de Ofertas ({ofertasFiltradas.length})
              </h3>
              <p className="text-xs text-stone-400">
                Ordenado por {ordenCampo === 'publicacion' ? 'Fecha de Publicación' : 'Fecha de Vencimiento'} ({ordenDir === 'desc' ? 'Más reciente primero' : 'Más antiguo primero'})
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar oferta, comercio, distrito..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                />
              </div>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
              >
                <option value="todas">Todas las categorías</option>
                {CATEGORIAS_OFERTAS.map(c => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>

              <select
                value={filtroDistrito}
                onChange={(e) => setFiltroDistrito(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
              >
                <option value="todos">Todos los distritos</option>
                {distritosZona.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
                className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none font-semibold text-stone-700 cursor-pointer"
              >
                <option value="todos">Todos los estados</option>
                <option value="activa">Activas</option>
                <option value="en_validacion">En validación</option>
                <option value="pausada">Pausadas</option>
                <option value="rechazada">Rechazadas</option>
              </select>

              <button
                type="button"
                onClick={() => setUsarFiltroFecha(!usarFiltroFecha)}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                  usarFiltroFecha
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{usarFiltroFecha ? 'Filtro Fecha Activo' : 'Filtrar por Fecha'}</span>
              </button>
            </div>
          </div>

          {usarFiltroFecha && (
            <div className="pt-2">
              <DateRangeSelector
                value={rangoFechaCatalogo}
                onChange={setRangoFechaCatalogo}
                compact={true}
                titulo="Rango de Fechas de Publicación"
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="pb-2.5">Oferta / Imagen 4:5</th>
                  <th className="pb-2.5">Comercio & Zona</th>
                  <th className="pb-2.5">Descuento</th>
                  <th
                    onClick={() => {
                      if (ordenCampo === 'publicacion') {
                        setOrdenDir(d => d === 'desc' ? 'asc' : 'desc');
                      } else {
                        setOrdenCampo('publicacion');
                        setOrdenDir('desc');
                      }
                    }}
                    className="pb-2.5 cursor-pointer hover:text-stone-900 select-none"
                  >
                    <div className="flex items-center gap-1 font-bold text-stone-700">
                      <span>Fecha Publicación</span>
                      {ordenCampo === 'publicacion' && (
                        <span className="text-[11px] font-black text-emerald-800">{ordenDir === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (ordenCampo === 'vencimiento') {
                        setOrdenDir(d => d === 'desc' ? 'asc' : 'desc');
                      } else {
                        setOrdenCampo('vencimiento');
                        setOrdenDir('desc');
                      }
                    }}
                    className="pb-2.5 cursor-pointer hover:text-stone-900 select-none"
                  >
                    <div className="flex items-center gap-1 font-bold text-stone-700">
                      <span>Fecha Vencimiento</span>
                      {ordenCampo === 'vencimiento' && (
                        <span className="text-[11px] font-black text-emerald-800">{ordenDir === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </div>
                  </th>
                  <th className="pb-2.5">Estado</th>
                  <th className="pb-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ofertasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400 text-xs">
                      No se encontraron ofertas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  ofertasFiltradas.map(of => (
                    <tr
                      key={of.id}
                      onClick={() => setOfertaDetalle(of)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={of.imagenes?.[0] || getCategoryFallbackImage(of.categoria)}
                            alt={of.titulo}
                            onError={(e) => handleImgError(e, getCategoryFallbackImage(of.categoria))}
                            className="w-10 h-12 object-cover rounded-lg border border-stone-200 bg-stone-100 shrink-0"
                          />
                          <div>
                            <span className="font-semibold text-stone-900 block truncate max-w-[200px]">{of.titulo}</span>
                            <span className="text-[10px] text-stone-400 font-mono">ID: {of.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-medium text-stone-800 block">{of.comercioNombre}</span>
                        <span className="text-[10px] text-stone-500">{of.distrito} · {of.categoria}</span>
                      </td>
                      <td className="py-3 font-bold text-emerald-800">
                        {of.precioNormal > of.precioOferta ? (
                          <span>{Math.round(((of.precioNormal - of.precioOferta) / of.precioNormal) * 100)}% OFF</span>
                        ) : (
                          <span>S/. {of.precioOferta}</span>
                        )}
                        <span className="block text-[10px] text-stone-400 font-normal">S/ {of.precioOferta} (Antes S/ {of.precioNormal})</span>
                      </td>
                      <td className="py-3 font-medium text-stone-700">
                        <span>{formatFechaHora(of.validadaEn || of.creadaEn)}</span>
                        {of.validadaPor && (
                          <span className="block text-[10px] text-emerald-700">Por: {of.validadaPor}</span>
                        )}
                      </td>
                      <td className="py-3 font-medium text-stone-700 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span>{formatFechaHora(of.venceEn)}</span>
                        </div>
                        <div>{getDiasVencimientoBadge(of.venceEn)}</div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          of.estado === 'activa'
                            ? 'bg-emerald-100 text-emerald-800'
                            : of.estado === 'en_validacion'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {of.estado === 'en_validacion' ? 'En validación' : of.estado}
                        </span>
                      </td>
                      <td className="py-3 text-right flex items-center justify-end gap-1.5">
                        {of.estado === 'en_validacion' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAprobarOferta(of.id);
                            }}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs"
                          >
                            Aprobar
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfertaDetalle(of);
                          }}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MODERACIÓN DE OFERTAS (FORMATO 4:5 CON IA) */}
      {esModeracion && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Cola de Moderación de Ofertas ({pendientesModeracion.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Revisión editorial de fotografía en proporción vertical 4:5 y reglas comunitarias antes de su publicación en vivo.
            </p>
          </div>

          {pendientesModeracion.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-stone-700">Cola de moderación al día.</p>
              <p className="text-[11px]">No hay ofertas pendientes de revisión.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendientesModeracion.map(of => (
                <div key={of.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 flex flex-col justify-between">
                  <div className="flex gap-4">
                    {/* Imagen 4:5 */}
                    <div className="w-24 sm:w-28 shrink-0 aspect-[4/5] rounded-xl overflow-hidden border border-stone-200 bg-stone-200 relative">
                      <img
                        src={of.imagenes?.[0] || getCategoryFallbackImage(of.categoria)}
                        alt={of.titulo}
                        onError={(e) => handleImgError(e, getCategoryFallbackImage(of.categoria))}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-mono px-1 rounded">
                        4:5
                      </span>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                        Pendiente Moderación
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2">{of.titulo}</h4>
                      <p className="text-xs text-stone-600 line-clamp-2">{of.descripcion}</p>
                      <div className="text-[11px] text-stone-500 pt-1">
                        <span>{of.comercioNombre} · {of.distrito}</span>
                      </div>
                    </div>
                  </div>

                  {/* Checklist IA */}
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-xs space-y-1 text-stone-700">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Auditoría Automática Asistente IA
                    </span>
                    <div className="text-[11px] text-stone-600 flex items-center justify-between">
                      <span>Proporción vertical 4:5 válida</span>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-[11px] text-stone-600 flex items-center justify-between">
                      <span>Sin contenido prohibido / Spam</span>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setOfertaRechazandoId(of.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleAprobarOferta(of.id)}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                    >
                      Aprobar y Publicar
                    </button>
                  </div>

                  {ofertaRechazandoId === of.id && (
                    <div className="p-3 bg-rose-50 rounded-xl space-y-2 border border-rose-100 mt-2">
                      <input
                        type="text"
                        value={motivoRechazo}
                        onChange={e => setMotivoRechazo(e.target.value)}
                        placeholder="Motivo del rechazo de la oferta..."
                        className="w-full p-2 text-xs border border-rose-200 rounded-lg bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRechazarOfertaSubmit(of.id)}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setOfertaRechazandoId(null)}
                          className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. OFERTAS CON KPIS: GRÁFICOS SEMANALES Y MÉTRICAS DE ALCANCE WHATSAPP */}
      {esKpis && (
        <div className="space-y-6">
          <EstadisticasOfertasWhatsAppPanel />

          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Rendimiento y Métricas por Oferta (KPIs Individuales)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Clics generados a WhatsApp, conversiones estimadas y efectividad en el feed.
              </p>
            </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="pb-2.5">Oferta</th>
                  <th className="pb-2.5">Comercio</th>
                  <th className="pb-2.5">Distrito</th>
                  <th className="pb-2.5">Clics WhatsApp</th>
                  <th className="pb-2.5">Ventas Asoc.</th>
                  <th className="pb-2.5 text-right">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {todasOfertas.map(of => (
                  <tr key={of.id} className="hover:bg-stone-50">
                    <td className="py-3 font-semibold text-stone-900">{of.titulo}</td>
                    <td className="py-3 text-stone-700">{of.comercioNombre}</td>
                    <td className="py-3 text-stone-600">{of.distrito}</td>
                    <td className="py-3 font-bold text-emerald-800">{of.clics || 0} clics</td>
                    <td className="py-3 font-mono text-stone-700">{of.leadsCalificados || 0}</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                        Alta tracción
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* 5. TAXONOMÍA DE CATEGORÍAS */}
      {esCategorias && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Taxonomía de Categorías del Catálogo
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Rubros habilitados para clasificación en el asistente de WhatsApp y catálogo web.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CATEGORIAS_OFERTAS.map(cat => {
              const count = todasOfertas.filter(o => o.categoria.toLowerCase() === cat.nombre.toLowerCase()).length;
              return (
                <div key={cat.id} className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">{cat.nombre}</h4>
                    <span className="text-[10px] text-stone-400 font-mono">ID: {cat.id}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 bg-white border border-stone-200 rounded-full text-stone-700">
                    {count} ofertas
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE OFERTA */}
      {ofertaDetalle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Detalle de la Oferta
                </span>
                <h3 className="text-base sm:text-lg font-black text-stone-900 mt-1">
                  {ofertaDetalle.titulo}
                </h3>
                <p className="text-xs text-stone-500">{ofertaDetalle.comercioNombre}</p>
              </div>
              <button
                onClick={() => setOfertaDetalle(null)}
                className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-[4/5] max-h-60 mx-auto rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
              <img
                src={ofertaDetalle.imagenes?.[0] || getCategoryFallbackImage(ofertaDetalle.categoria)}
                alt={ofertaDetalle.titulo}
                onError={(e) => handleImgError(e, getCategoryFallbackImage(ofertaDetalle.categoria))}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/70 text-xs space-y-1.5">
              <div><strong>Descripción:</strong> <span className="text-stone-600">{ofertaDetalle.descripcion}</span></div>
              <div><strong>Ubicación:</strong> <span className="text-stone-600">{ofertaDetalle.distrito}</span></div>
              <div><strong>Categoría:</strong> <span className="text-stone-600">{ofertaDetalle.categoria}</span></div>
              <div><strong>Estado:</strong> <span className="font-bold text-emerald-800">{ofertaDetalle.estado}</span></div>
              {ofertaDetalle.venceEn && <div><strong>Vencimiento:</strong> <span className="text-stone-600">{ofertaDetalle.venceEn}</span></div>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              {ofertaDetalle.estado === 'en_validacion' && (
                <button
                  onClick={() => {
                    handleAprobarOferta(ofertaDetalle.id);
                    setOfertaDetalle(null);
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Aprobar y Publicar
                </button>
              )}
              <button
                onClick={() => setOfertaDetalle(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
