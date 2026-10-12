import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Menu, X, ChevronRight, ChevronDown, ChevronLeft,
  Calendar, Bell, Plus, LogOut, ArrowLeft, Store, HelpCircle,
  ExternalLink, Sparkles, CheckCircle2, AlertTriangle, Shield
} from 'lucide-react';
import { Merchant, Offer, ClickRecord, ConfirmedSale } from '../../types';
import { comerciosModule } from '../../modules/comercios';
import { ofertasModule } from '../../modules/ofertas';
import { clicsAtribucionModule } from '../../modules/clics';
import { facturacionModule } from '../../modules/facturacion';
import { puntosModule } from '../../modules/puntos';
import { analiticaModule } from '../../modules/analitica';
import { coreSecurity } from '../../core/security';
import { getCategoryFallbackImage, handleImgError } from '../../utils/imageFallbacks';
import { OBTENER_COMERCIO_MENU, normalizarRutaComercio } from './comercioMenuConfig';
import { ComercioRangoTiempo } from './types';

// Vistas de dominio
import { InicioComercioView } from './views/InicioComercioView';
import { MisOfertasComercioView } from './views/MisOfertasComercioView';
import { ResultadosComercioView } from './views/ResultadosComercioView';
import { CampanasComercioView } from './views/CampanasComercioView';
import { VentasComercioView } from './views/VentasComercioView';
import { MiNegocioComercioView } from './views/MiNegocioComercioView';

interface ComercioLayoutProps {
  onVolverAWeb?: () => void;
}

export const ComercioLayout: React.FC<ComercioLayoutProps> = ({ onVolverAWeb }) => {
  const sesion = coreSecurity.getSesionActual();

  // Aislamiento estricto de negocio según la sesión autorizada
  // Si la sesión es comercio_user_01, su merchantId es 'merch_01' (La Bodega Verde)
  const comercioIdAutorizado = sesion?.merchantId || 'merch_01';
  const comercio = comerciosModule.obtenerComercio(comercioIdAutorizado) || comerciosModule.listarComercios()[0];

  // Ruta actual sincronizada
  const [rutaActual, setRutaActual] = useState<string>(() => {
    if (typeof window === 'undefined') return '/comercio';
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path.startsWith('/comercio')) return normalizarRutaComercio(path);
    if (hash.startsWith('#comercio') || hash.startsWith('#/comercio')) return normalizarRutaComercio(hash);
    return '/comercio';
  });

  // Selector de período unificado (America/Lima)
  const [rangoTiempo, setRangoTiempo] = useState<ComercioRangoTiempo>('7dias');
  const [selectorRangoAbierto, setSelectorRangoAbierto] = useState(false);

  // Estados de layout
  const [sidebarMovilAbierto, setSidebarMovilAbierto] = useState(false);
  const [sidebarColapsadoDesktop, setSidebarColapsadoDesktop] = useState(false);
  const [itemsExpandidos, setItemsExpandidos] = useState<Record<string, boolean>>({
    ofertas: true,
    resultados: false,
    campanas: false,
    ventas: false,
    negocio: false
  });

  // Modal nueva oferta
  const [modalNuevaOfertaAbierto, setModalNuevaOfertaAbierto] = useState(false);
  const [formOferta, setFormOferta] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'descuento' as const,
    precioNormal: 60,
    precioOferta: 39,
    stock: 20,
    categoria: comercio?.categoria || 'Gastronomía y Café',
    imagenUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&h=1000&q=80',
    diasVencimiento: 30
  });

  // Cajón de notificaciones y modal ayuda
  const [modalAyudaAbierto, setModalAyudaAbierto] = useState(false);
  const [cajonNotificacionesAbierto, setCajonNotificacionesAbierto] = useState(false);

  // Datos reactivos del negocio autorizado
  const ofertas = ofertasModule.listarOfertasPorComercio(comercio?.id || '');
  const ventas = clicsAtribucionModule.listarVentasPorComercio(comercio?.id || '');
  const saldoClics = facturacionModule.obtenerSaldoComercio(comercio?.id || '');
  const kpis = analiticaModule.calcularKPIsComercio(comercio?.id || '');

  // Menú dinámico
  const menuConfig = useMemo(() => {
    return OBTENER_COMERCIO_MENU(comercio?.id || '');
  }, [comercio?.id, ofertas.length, saldoClics]);

  // Manejador de navegación fluida
  const navegarA = useCallback((nuevaRuta: string) => {
    const normalizada = normalizarRutaComercio(nuevaRuta);
    setRutaActual(normalizada);
    setSidebarMovilAbierto(false);

    try {
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ ruta: normalizada }, '', normalizada);
      }
    } catch {
      window.location.hash = `#${normalizada}`;
    }
  }, []);

  // Escuchar popstate / hashchange
  useEffect(() => {
    const handlePop = () => {
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p.startsWith('/comercio')) setRutaActual(normalizarRutaComercio(p));
      else if (h.startsWith('#comercio') || h.startsWith('#/comercio')) setRutaActual(normalizarRutaComercio(h));
    };
    window.addEventListener('popstate', handlePop);
    window.addEventListener('hashchange', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('hashchange', handlePop);
    };
  }, []);

  const toggleExpand = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemsExpandidos(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const rangoTexto = useMemo(() => {
    switch (rangoTiempo) {
      case 'hoy': return 'Hoy';
      case '7dias': return 'Últimos 7 días';
      case '30dias': return 'Últimos 30 días';
      default: return 'Personalizado';
    }
  }, [rangoTiempo]);

  const handleCrearOferta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio) return;

    const res = ofertasModule.crearOferta({
      comercioId: comercio.id,
      titulo: formOferta.titulo,
      descripcion: formOferta.descripcion,
      tipo: formOferta.tipo,
      precioNormal: Number(formOferta.precioNormal),
      precioOferta: Number(formOferta.precioOferta),
      stock: Number(formOferta.stock),
      categoria: formOferta.categoria,
      imagenes: [formOferta.imagenUrl],
      diasVencimiento: Number(formOferta.diasVencimiento)
    });

    if (res.ok && res.oferta) {
      alert(`¡Oferta "${res.oferta.titulo}" enviada exitosamente! Se encuentra "En revisión" y será validada en menos de 24 horas.`);
      setModalNuevaOfertaAbierto(false);
      setFormOferta({
        titulo: '',
        descripcion: '',
        tipo: 'descuento',
        precioNormal: 60,
        precioOferta: 39,
        stock: 20,
        categoria: comercio.categoria || 'Gastronomía y Café',
        imagenUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&h=1000&q=80',
        diasVencimiento: 30
      });
      navegarA('/comercio/ofertas/en-revision');
    } else {
      alert(res.error || 'Error al crear la oferta.');
    }
  };

  // Renderizar la vista según la ruta actual
  const renderContenidoDominio = () => {
    if (rutaActual === '/comercio' || rutaActual === '/comercio/inicio') {
      return (
        <InicioComercioView
          comercio={comercio}
          ofertas={ofertas}
          kpis={kpis}
          saldoClics={saldoClics}
          alNavegar={navegarA}
          alAbrirNuevaOferta={() => setModalNuevaOfertaAbierto(true)}
          rangoTexto={rangoTexto}
        />
      );
    }
    if (rutaActual.startsWith('/comercio/ofertas')) {
      return (
        <MisOfertasComercioView
          comercio={comercio}
          ofertas={ofertas}
          rutaActual={rutaActual}
          alNavegar={navegarA}
          alAbrirNuevaOferta={() => setModalNuevaOfertaAbierto(true)}
        />
      );
    }
    if (rutaActual.startsWith('/comercio/resultados')) {
      return (
        <ResultadosComercioView
          comercio={comercio}
          ofertas={ofertas}
          kpis={kpis}
          rutaActual={rutaActual}
          rangoTexto={rangoTexto}
        />
      );
    }
    if (rutaActual.startsWith('/comercio/campanas')) {
      return (
        <CampanasComercioView
          comercio={comercio}
          saldoClics={saldoClics}
          rutaActual={rutaActual}
        />
      );
    }
    if (rutaActual.startsWith('/comercio/ventas')) {
      return (
        <VentasComercioView
          comercio={comercio}
          ventas={ventas}
          rutaActual={rutaActual}
        />
      );
    }
    if (rutaActual.startsWith('/comercio/negocio')) {
      return (
        <MiNegocioComercioView
          comercio={comercio}
          rutaActual={rutaActual}
        />
      );
    }
    // Fallback por defecto a Inicio
    return (
      <InicioComercioView
        comercio={comercio}
        ofertas={ofertas}
        kpis={kpis}
        saldoClics={saldoClics}
        alNavegar={navegarA}
        alAbrirNuevaOferta={() => setModalNuevaOfertaAbierto(true)}
        rangoTexto={rangoTexto}
      />
    );
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F5F7] p-2 sm:p-4 md:p-6 lg:p-8 flex items-start justify-center">
      {/* Contenedor principal responsive */}
      <div className="w-full max-w-[1380px] bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[calc(100vh-80px)] md:min-h-[820px] relative">
        
        {/* ================= BACKDROP MÓVIL ================= */}
        {sidebarMovilAbierto && (
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 md:hidden"
            onClick={() => setSidebarMovilAbierto(false)}
          />
        )}

        {/* ================= SIDEBAR MODULAR ================= */}
        <aside 
          className={`
            fixed md:static inset-y-0 left-0 z-50 md:z-auto
            bg-white border-r border-stone-100 flex flex-col justify-between select-none
            transition-all duration-300 ease-in-out shadow-2xl md:shadow-none
            ${sidebarMovilAbierto ? 'translate-x-0 w-72 max-w-[85vw] p-4' : '-translate-x-full md:translate-x-0'}
            ${sidebarColapsadoDesktop ? 'md:w-20 md:p-3' : 'md:w-64 md:p-4'}
            shrink-0
          `}
        >
          <div className="space-y-5">
            {/* Cabecera del Comercio (Fijado a su negocio autorizado) */}
            <div className="flex items-center justify-between">
              <div 
                onClick={() => navegarA('/comercio')}
                className="flex items-center gap-2.5 px-1 pt-1 min-w-0 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-xs shrink-0 text-base">
                  🍃
                </div>
                {!sidebarColapsadoDesktop && (
                  <div className="min-w-0">
                    <h1 className="font-black text-sm text-[#0F172A] tracking-tight leading-none truncate">
                      {comercio?.nombreComercial || 'Comercio Aliado'}
                    </h1>
                    <p className="text-[11px] text-stone-400 font-medium mt-1 truncate">
                      {comercio?.distrito || 'Barranco'} · Negocio Activo
                    </p>
                  </div>
                )}
              </div>

              {/* Botón cerrar en móvil */}
              <button 
                type="button"
                onClick={() => setSidebarMovilAbierto(false)}
                className="md:hidden w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Botón colapsar en Desktop */}
              <button
                type="button"
                onClick={() => setSidebarColapsadoDesktop(!sidebarColapsadoDesktop)}
                className="hidden md:flex w-7 h-7 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 items-center justify-center ml-auto"
                title={sidebarColapsadoDesktop ? 'Expandir' : 'Colapsar'}
              >
                {sidebarColapsadoDesktop ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            {/* Menú de Navegación Vertical Modular */}
            <nav className="space-y-1">
              {menuConfig.map(item => {
                const IconComponent = item.icono;
                const estaActivo = rutaActual === item.ruta || (item.ruta !== '/comercio' && rutaActual.startsWith(item.ruta));
                const badge = item.badge ? item.badge() : null;
                const tieneSubitems = item.subitems.length > 0;
                const desplegado = itemsExpandidos[item.id] ?? false;

                return (
                  <div key={item.id} className="space-y-0.5">
                    <div 
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                        estaActivo
                          ? 'bg-[#EAF5EE] text-[#166534]'
                          : 'text-stone-600 hover:text-[#0F172A] hover:bg-stone-50'
                      }`}
                    >
                      {/* Clic en icono y texto abre la página resumen del dominio */}
                      <button
                        type="button"
                        onClick={() => navegarA(item.ruta)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left outline-none"
                      >
                        <IconComponent className={`w-4 h-4 shrink-0 ${estaActivo ? 'text-[#166534]' : 'text-stone-400'}`} />
                        {!sidebarColapsadoDesktop && (
                          <span className="truncate">{item.titulo}</span>
                        )}
                      </button>

                      {!sidebarColapsadoDesktop && badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.color}`}>
                          {badge.count}
                        </span>
                      )}

                      {/* Flecha aparte para desplegar subpáginas */}
                      {!sidebarColapsadoDesktop && tieneSubitems && (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(item.id, e)}
                          className="w-5 h-5 rounded-md hover:bg-stone-200/50 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
                          title={desplegado ? 'Ocultar subpáginas' : 'Mostrar subpáginas'}
                        >
                          {desplegado ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>

                    {/* Subpáginas desplegables */}
                    {!sidebarColapsadoDesktop && tieneSubitems && desplegado && (
                      <div className="pl-7 pr-1 py-0.5 space-y-0.5 border-l border-stone-200 ml-5 my-0.5">
                        {item.subitems.map(sub => {
                          const subActiva = rutaActual === sub.ruta;
                          const subBadge = sub.badge ? sub.badge() : null;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => navegarA(sub.ruta)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                                subActiva
                                  ? 'bg-emerald-50 text-emerald-900 font-bold'
                                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
                              }`}
                            >
                              <span className="truncate">{sub.titulo}</span>
                              {subBadge && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${subBadge.color}`}>
                                  {subBadge.count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Pie del Sidebar: Usuario & Utilidades */}
          <div className="pt-4 border-t border-stone-100 space-y-2">
            {!sidebarColapsadoDesktop && (
              <button
                type="button"
                onClick={() => setModalAyudaAbierto(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-stone-400" />
                <span>Centro de ayuda</span>
              </button>
            )}

            <div className={`bg-stone-50 rounded-xl p-2.5 flex items-center border border-stone-100 ${
              sidebarColapsadoDesktop ? 'justify-center' : 'justify-between'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                  {comercio?.contactoNombre ? comercio.contactoNombre.substring(0, 2).toUpperCase() : 'CO'}
                </div>
                {!sidebarColapsadoDesktop && (
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] truncate">
                      {comercio?.contactoNombre || 'Comercio'}
                    </p>
                    <p className="text-[10px] text-stone-400 truncate font-mono">
                      {sesion?.email || 'comercio@vuuy.pe'}
                    </p>
                  </div>
                )}
              </div>

              {!sidebarColapsadoDesktop && (
                <button 
                  onClick={() => coreSecurity.cerrarSesion()}
                  className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-stone-400 transition-colors" 
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ================= CONTENIDO PRINCIPAL ================= */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* Header Superior Móvil */}
          <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-white border-b border-stone-100 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarMovilAbierto(true)}
                className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-stone-700"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div>
                <span className="text-xs font-bold text-[#0F172A] leading-none block truncate max-w-[160px]">
                  {comercio?.nombreComercial}
                </span>
                <span className="text-[10px] text-stone-400 leading-none">Panel Comercio</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setModalNuevaOfertaAbierto(true)}
                className="px-2.5 py-1.5 bg-[#166534] text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Oferta</span>
              </button>
              <button
                onClick={() => setCajonNotificacionesAbierto(true)}
                className="w-8 h-8 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center text-stone-600 relative"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 ring-1 ring-white" />
              </button>
            </div>
          </div>

          {/* Área de scroll principal */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
            
            {/* Header del Comercio Desktop con Selector de Período y Acciones */}
            <div className="hidden md:flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                    {comercio?.nombreComercial}
                  </h2>
                  <span className="text-xs font-bold bg-emerald-100 text-[#166534] px-2 py-0.5 rounded-md">
                    {comercio?.distrito || 'Barranco'}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  Consola de control de ofertas y contactos de clientes en WhatsApp
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Selector de Rango de Fechas (America/Lima) */}
                <div className="relative">
                  <button
                    onClick={() => setSelectorRangoAbierto(!selectorRangoAbierto)}
                    className="flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 transition-colors shadow-2xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    <span>{rangoTexto}</span>
                    <ChevronDown className="w-3 h-3 text-stone-400" />
                  </button>

                  {selectorRangoAbierto && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-white border border-stone-200 rounded-xl shadow-lg p-1.5 z-40 space-y-0.5 text-xs">
                      {[
                        { id: 'hoy' as const, label: 'Hoy' },
                        { id: '7dias' as const, label: 'Últimos 7 días' },
                        { id: '30dias' as const, label: 'Últimos 30 días' }
                      ].map(r => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setRangoTiempo(r.id);
                            setSelectorRangoAbierto(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                            rangoTiempo === r.id ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notificaciones */}
                <button 
                  onClick={() => setCajonNotificacionesAbierto(true)}
                  className="w-9 h-9 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 transition-colors relative"
                  title="Avisos del local"
                >
                  <Bell className="w-4 h-4" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white" />
                </button>

                {/* Botón Nueva Oferta */}
                <button
                  onClick={() => setModalNuevaOfertaAbierto(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#166534] hover:bg-[#14532D] text-white font-bold text-xs rounded-full shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Nueva oferta</span>
                </button>
              </div>
            </div>

            {/* Vistas de Dominio */}
            {renderContenidoDominio()}

          </main>
        </div>
      </div>

      {/* ================= MODAL RESPONSIVE: NUEVA OFERTA (4:5) ================= */}
      {modalNuevaOfertaAbierto && (
        <div
          onClick={() => setModalNuevaOfertaAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#0F172A]">Publicar Nueva Oferta</h3>
                <p className="text-xs text-stone-500">Formato vertical 4:5 obligatorio (máxima conversión en WhatsApp y móvil)</p>
              </div>
              <button 
                onClick={() => setModalNuevaOfertaAbierto(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearOferta} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">Título de la Oferta</label>
                  <input
                    type="text"
                    required
                    value={formOferta.titulo}
                    onChange={e => setFormOferta({ ...formOferta, titulo: e.target.value })}
                    placeholder="Ej. Bowl Acai Orgánico con Toppings"
                    className="w-full p-2 text-xs border border-stone-200 rounded-xl focus:ring-1 focus:ring-emerald-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">Descripción atractiva (máx 150 car.)</label>
                  <textarea
                    required
                    rows={2}
                    maxLength={150}
                    value={formOferta.descripcion}
                    onChange={e => setFormOferta({ ...formOferta, descripcion: e.target.value })}
                    placeholder="Acai orgánico de la Amazonía con granola artesanal..."
                    className="w-full p-2 text-xs border border-stone-200 rounded-xl focus:ring-1 focus:ring-emerald-700 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Precio Normal (S/)</label>
                    <input
                      type="number"
                      required
                      value={formOferta.precioNormal}
                      onChange={e => setFormOferta({ ...formOferta, precioNormal: Number(e.target.value) })}
                      className="w-full p-2 text-xs border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Precio Oferta (S/)</label>
                    <input
                      type="number"
                      required
                      value={formOferta.precioOferta}
                      onChange={e => setFormOferta({ ...formOferta, precioOferta: Number(e.target.value) })}
                      className="w-full p-2 text-xs border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Stock disponible</label>
                    <input
                      type="number"
                      required
                      value={formOferta.stock}
                      onChange={e => setFormOferta({ ...formOferta, stock: Number(e.target.value) })}
                      className="w-full p-2 text-xs border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Vigencia (días)</label>
                    <input
                      type="number"
                      value={formOferta.diasVencimiento}
                      onChange={e => setFormOferta({ ...formOferta, diasVencimiento: Number(e.target.value) })}
                      className="w-full p-2 text-xs border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">Foto Vertical (4:5)</label>
                  <input
                    type="url"
                    value={formOferta.imagenUrl}
                    onChange={e => setFormOferta({ ...formOferta, imagenUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full p-2 text-xs border border-stone-200 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  Enviar Oferta a Revisión
                </button>
              </div>

              {/* Previsualizador 4:5 */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold text-stone-600 mb-2">Previsualización Vertical 4:5</span>
                <div className="w-36 sm:w-44 aspect-[4/5] rounded-[20px] overflow-hidden bg-stone-200 relative border border-stone-300 shadow-sm">
                  <img
                    src={formOferta.imagenUrl}
                    alt="Previsualización"
                    className="w-full h-full object-cover rounded-[20px]"
                    onError={(e) => handleImgError(e, getCategoryFallbackImage(formOferta.categoria, formOferta.titulo))}
                  />
                  <div className="absolute top-2 right-2 bg-rose-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-black">
                    S/ {formOferta.precioOferta}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 text-white">
                    <p className="text-[11px] font-bold truncate">{formOferta.titulo || 'Tu oferta'}</p>
                    <p className="text-[9px] text-stone-300 line-through">Antes S/ {formOferta.precioNormal}</p>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE AYUDA OPERATIVA ================= */}
      {modalAyudaAbierto && (
        <div 
          onClick={() => setModalAyudaAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 border border-stone-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                <span>Guía Rápida para Dueños de Negocio</span>
              </h4>
              <button 
                onClick={() => setModalAyudaAbierto(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-600">
              <div className="p-3 bg-stone-50 rounded-xl space-y-1">
                <h5 className="font-bold text-stone-900">1. ¿Cómo llegan los clientes a mi local?</h5>
                <p>Los usuarios piden ofertas en vuuy. Cuando una les gusta, tocan "Lo quiero" y se abre tu WhatsApp con un mensaje prearmado y su código personal (ej. CV88-91).</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl space-y-1">
                <h5 className="font-bold text-stone-900">2. ¿Cómo confirmo una venta?</h5>
                <p>Pídele al cliente el código que tiene en su WhatsApp y regístralo en la sección "Ventas confirmadas". No requiere lector de QR.</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl space-y-1">
                <h5 className="font-bold text-stone-900">3. ¿Cómo funciona el saldo de clics?</h5>
                <p>Solo consumes clics cuando un usuario presiona "Lo quiero". Puedes recargar paquetes de 50, 100 o 500 clics con Yape o Plin.</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setModalAyudaAbierto(false)}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CAJÓN DE NOTIFICACIONES ================= */}
      {cajonNotificacionesAbierto && (
        <div 
          onClick={() => setCajonNotificacionesAbierto(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-white h-full p-5 space-y-4 shadow-2xl flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-700" />
                  <span>Avisos del Local</span>
                </h4>
                <button 
                  onClick={() => setCajonNotificacionesAbierto(false)}
                  className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                  <span className="font-bold text-emerald-900 block">Campañas con saldo activo</span>
                  <p className="text-emerald-700">Tu local tiene {saldoClics} clics disponibles para seguir recibiendo contactos por WhatsApp.</p>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="font-bold text-stone-800 block">Ofertas en vitrina</span>
                  <p className="text-stone-500">Tienes {ofertas.length} ofertas registradas para {comercio?.distrito || 'Barranco'}.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCajonNotificacionesAbierto(false)}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors"
            >
              Cerrar avisos
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
