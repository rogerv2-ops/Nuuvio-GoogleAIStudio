import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Menu, X, ChevronRight, ChevronDown, ChevronLeft, 
  Search, Shield, Bell, Calendar, ArrowLeft, Store, 
  CheckCircle2, AlertCircle, ExternalLink, Building2,
  RotateCw, Check, Sparkles
} from 'lucide-react';
import { GESTION_MENU, resolverRutaCanonica } from './gestionMenuConfig';
import { GestionMenuItem, GestionSubItem, GestionBreadcrumb } from './types';
import { coreSecurity } from '../../core/security';
import { comerciosModule } from '../../modules/comercios';
import { ofertasModule } from '../../modules/ofertas';
import { bannersModule } from '../../modules/banners';
import { purgarTodasLasCaches } from '../../utils/resourceVersion';

// Vistas de Dominio
import { PanelGeneralView } from './views/PanelGeneralView';
import { AnaliticaDomainView } from './views/AnaliticaDomainView';
import { UsuariosDomainView } from './views/UsuariosDomainView';
import { ComerciosDomainView } from './views/ComerciosDomainView';
import { OfertasDomainView } from './views/OfertasDomainView';
import { CampanasCobroDomainView } from './views/CampanasCobroDomainView';
import { ComunicacionesDomainView } from './views/ComunicacionesDomainView';
import { ConfiguracionDomainView } from './views/ConfiguracionDomainView';

interface GestionLayoutProps {
  rutaInicial?: string;
  onVolverAWeb?: () => void;
}

export const GestionLayout: React.FC<GestionLayoutProps> = ({ 
  rutaInicial = '/gestion',
  onVolverAWeb 
}) => {
  // Detección de ruta inicial desde URL o hash
  const obtenerRutaActual = useCallback((): string => {
    if (typeof window === 'undefined') return '/gestion';
    const path = window.location.pathname;
    const hash = window.location.hash;

    if (hash.startsWith('#/gestion') || hash.startsWith('#gestion')) {
      const limpia = hash.replace(/^#/, '');
      return resolverRutaCanonica(limpia);
    }
    if (path.startsWith('/gestion')) {
      return resolverRutaCanonica(path);
    }
    return resolverRutaCanonica(rutaInicial);
  }, [rutaInicial]);

  const [rutaActiva, setRutaActiva] = useState<string>(obtenerRutaActual);
  const [sidebarMovilAbierto, setSidebarMovilAbierto] = useState(false);
  const [sidebarColapsadoDesktop, setSidebarColapsadoDesktop] = useState(false);
  const [busquedaGlobal, setBusquedaGlobal] = useState('');
  const [rangoFecha, setRangoFecha] = useState('13 — 19 Oct, 2025');
  const [limpiandoCache, setLimpiandoCache] = useState(false);
  const [mensajeCache, setMensajeCache] = useState<string | null>(null);

  const handleLimpiarTodasLasCaches = async () => {
    try {
      setLimpiandoCache(true);
      setMensajeCache(null);
      const res = await purgarTodasLasCaches();
      await bannersModule.sincronizarConServidor();
      setMensajeCache(`✓ Caché purgada (${res.version.slice(-4)})`);
      setTimeout(() => setMensajeCache(null), 3500);
    } catch (err) {
      console.error('Error al purgar caché:', err);
      setMensajeCache('Error al purgar');
      setTimeout(() => setMensajeCache(null), 3000);
    } finally {
      setLimpiandoCache(false);
    }
  };

  // Menús desplegados (se expanden/colapsan con control independiente)
  const [menusDesplegados, setMenusDesplegados] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {};
    GESTION_MENU.forEach(m => {
      // Si la ruta activa pertenece a este menú, iniciarlo expandido
      if (rutaActiva.startsWith(m.ruta) && m.ruta !== '/gestion') {
        inicial[m.id] = true;
      }
    });
    return inicial;
  });

  // Suscripción a módulos para contadores de badges
  const [, setVersion] = useState(0);
  useEffect(() => {
    const unC = comerciosModule.suscribir(() => setVersion(v => v + 1));
    const unO = ofertasModule.suscribir(() => setVersion(v => v + 1));
    return () => {
      unC();
      unO();
    };
  }, []);

  // Navegación centralizada con actualización de URL
  const navegarA = useCallback((rutaObjetivo: string) => {
    const canonica = resolverRutaCanonica(rutaObjetivo);
    setRutaActiva(canonica);
    setSidebarMovilAbierto(false);

    try {
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ ruta: canonica }, '', canonica);
      }
    } catch {
      window.location.hash = canonica;
    }

    // Auto-expandir el menú padre si es un subitem
    const padre = GESTION_MENU.find(m => canonica.startsWith(m.ruta) && m.ruta !== '/gestion');
    if (padre) {
      setMenusDesplegados(prev => ({ ...prev, [padre.id]: true }));
    }
  }, []);

  // Escuchar popstate y hashchange del navegador
  useEffect(() => {
    const handlePopState = () => {
      setRutaActiva(obtenerRutaActual());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [obtenerRutaActual]);

  const alternarDespliegueMenu = (menuId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenusDesplegados(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  // Identificar el menú principal activo y el subitem activo
  const { menuActivo, subitemActivo, breadcrumbs } = useMemo(() => {
    let mActivo: GestionMenuItem = GESTION_MENU[0]; // Panel General por defecto
    let sActivo: GestionSubItem | undefined = undefined;
    const crumbs: GestionBreadcrumb[] = [{ titulo: 'Gestión', ruta: '/gestion' }];

    if (rutaActiva === '/gestion') {
      crumbs.push({ titulo: 'Panel General' });
      return { menuActivo: GESTION_MENU[0], subitemActivo: undefined, breadcrumbs: crumbs };
    }

    for (const menu of GESTION_MENU) {
      if (menu.ruta !== '/gestion' && rutaActiva.startsWith(menu.ruta)) {
        mActivo = menu;
        crumbs.push({ titulo: menu.titulo, ruta: menu.ruta });

        const sub = menu.subitems.find(s => s.ruta === rutaActiva);
        if (sub) {
          sActivo = sub;
          crumbs.push({ titulo: sub.titulo });
        } else if (rutaActiva.startsWith('/gestion/comercios/') && !sActivo) {
          // Ficha 360 específica de comercio
          crumbs.push({ titulo: 'Ficha 360' });
        }
        break;
      }
    }

    return { menuActivo: mActivo, subitemActivo: sActivo, breadcrumbs: crumbs };
  }, [rutaActiva]);

  const sesion = coreSecurity.getSesionActual();
  const pendientesComercios = comerciosModule.listarPendientes().length;
  const pendientesOfertas = ofertasModule.listarPendientesModeracion().length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F5F7] p-2 sm:p-4 md:p-6 lg:p-8 flex items-start justify-center">
      {/* Contenedor Principal de la Consola CRM/ERP */}
      <div className="w-full max-w-[1400px] bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[calc(100vh-80px)] md:min-h-[840px] relative">

        {/* SIDEBAR MÓVIL (DRAWER BACKDROP) */}
        {sidebarMovilAbierto && (
          <div 
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-2xs transition-opacity"
            onClick={() => setSidebarMovilAbierto(false)}
          />
        )}

        {/* SIDEBAR NAVEGACIÓN MODULAR */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-50 bg-[#16201B] text-[#E7ECE9] flex flex-col justify-between
            transition-all duration-300 ease-in-out shrink-0
            ${sidebarMovilAbierto ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
            ${sidebarColapsadoDesktop ? 'md:w-20' : 'md:w-64 lg:w-72'}
          `}
        >
          {/* Cabecera del Sidebar */}
          <div>
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
              <div 
                className="flex items-center gap-2.5 cursor-pointer select-none"
                onClick={() => navegarA('/gestion')}
              >
                <div className="w-8 h-8 rounded-xl bg-[#2D6A4F] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  v
                </div>
                {!sidebarColapsadoDesktop && (
                  <div className="leading-tight">
                    <span className="font-bold text-base tracking-tight text-white block">vuuy consola</span>
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">CRM & ERP Modular</span>
                  </div>
                )}
              </div>

              {/* Botón para colapsar en Desktop */}
              <button
                type="button"
                onClick={() => setSidebarColapsadoDesktop(!sidebarColapsadoDesktop)}
                title={sidebarColapsadoDesktop ? 'Expandir menú' : 'Colapsar menú'}
                className="hidden md:flex p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {sidebarColapsadoDesktop ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              {/* Botón para cerrar en Móvil */}
              <button
                type="button"
                onClick={() => setSidebarMovilAbierto(false)}
                className="md:hidden p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menú Principal: 8 Elementos Centrales */}
            <nav className="p-2 sm:p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] scrollbar-thin">
              {GESTION_MENU.map(item => {
                const Icono = item.icono;
                const estaActivo = item.ruta === '/gestion'
                  ? rutaActiva === '/gestion'
                  : rutaActiva.startsWith(item.ruta);
                const tieneSubitems = item.subitems.length > 0;
                const desplegado = !!menusDesplegados[item.id];
                const badgeInfo = item.badge ? item.badge() : null;

                return (
                  <div key={item.id} className="space-y-0.5">
                    {/* Botón Principal del Menú */}
                    <div
                      className={`
                        w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all group select-none
                        ${estaActivo 
                          ? 'bg-[#2D6A4F] text-white shadow-xs font-bold' 
                          : 'text-stone-300 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      {/* Clic en título abre su página resumen */}
                      <button
                        type="button"
                        onClick={() => navegarA(item.ruta)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                        title={item.titulo}
                      >
                        <Icono className={`w-4 h-4 shrink-0 ${estaActivo ? 'text-emerald-300' : 'text-stone-400 group-hover:text-emerald-400'}`} />
                        {!sidebarColapsadoDesktop && (
                          <span className="truncate">{item.titulo}</span>
                        )}
                      </button>

                      {/* Control aparte para desplegar/colapsar subpáginas */}
                      {!sidebarColapsadoDesktop && (
                        <div className="flex items-center gap-1 shrink-0">
                          {badgeInfo && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${badgeInfo.color}`}>
                              {badgeInfo.count}
                            </span>
                          )}

                          {tieneSubitems && (
                            <button
                              type="button"
                              onClick={(e) => alternarDespliegueMenu(item.id, e)}
                              title={desplegado ? 'Colapsar subpáginas' : 'Desplegar subpáginas'}
                              className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              {desplegado ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Subpáginas Desplegables */}
                    {tieneSubitems && desplegado && !sidebarColapsadoDesktop && (
                      <div className="ml-5 pl-2.5 border-l border-white/10 space-y-0.5 py-1">
                        {item.subitems.map(sub => {
                          const subActivo = rutaActiva === sub.ruta;
                          const subBadge = sub.badge ? sub.badge() : null;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => navegarA(sub.ruta)}
                              className={`
                                w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer
                                ${subActivo 
                                  ? 'bg-white/15 text-emerald-300 font-bold' 
                                  : 'text-stone-400 hover:text-white hover:bg-white/5'
                                }
                              `}
                              title={sub.descripcion || sub.titulo}
                            >
                              <span className="truncate">{sub.titulo}</span>
                              {subBadge && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${subBadge.color}`}>
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

          {/* Pie de Sidebar con Sesión y Salida */}
          <div className="p-3 border-t border-white/10">
            {!sidebarColapsadoDesktop ? (
              <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <div className="truncate">
                  <span className="text-[11px] font-bold text-white block truncate">{sesion?.email || 'admin@vuuy.pe'}</span>
                  <span className="text-[10px] text-emerald-400 font-medium">{sesion?.rol || 'Super Administrador'}</span>
                </div>
                {onVolverAWeb && (
                  <button
                    onClick={onVolverAWeb}
                    title="Volver a la web pública"
                    className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              onVolverAWeb && (
                <button
                  onClick={onVolverAWeb}
                  title="Volver a la web pública"
                  className="w-full flex justify-center p-2 text-stone-400 hover:text-white rounded-xl hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </aside>

        {/* CONTENEDOR PRINCIPAL: ENCABEZADO, BREADCRUMBS Y VISTA DE CONTENIDO */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F4F5F7]">
          
          {/* ENCABEZADO PRINCIPAL DE LA CONSOLA */}
          <header className="bg-white border-b border-stone-200/80 px-4 sm:px-6 py-3 sticky top-0 z-30 flex items-center justify-between gap-3 shadow-2xs">
            {/* Botón Menú Móvil & Breadcrumbs */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarMovilAbierto(true)}
                className="md:hidden p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Breadcrumbs Jerárquicos */}
              <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-stone-500 overflow-x-auto scrollbar-none py-1">
                {breadcrumbs.map((crumb, idx) => {
                  const esUltimo = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-stone-300 shrink-0" />}
                      {crumb.ruta && !esUltimo ? (
                        <button
                          type="button"
                          onClick={() => navegarA(crumb.ruta!)}
                          className="hover:text-stone-900 font-medium hover:underline truncate cursor-pointer whitespace-nowrap"
                        >
                          {crumb.titulo}
                        </button>
                      ) : (
                        <span className={`truncate whitespace-nowrap ${esUltimo ? 'font-bold text-stone-900' : 'font-medium'}`}>
                          {crumb.titulo}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            </div>

            {/* Acciones del Encabezado */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Badges de Alertas Activas */}
              {pendientesOfertas > 0 && (
                <button
                  onClick={() => navegarA('/gestion/ofertas/moderacion')}
                  title={`${pendientesOfertas} ofertas pendientes de moderación`}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{pendientesOfertas} ofertas</span>
                </button>
              )}

              {pendientesComercios > 0 && (
                <button
                  onClick={() => navegarA('/gestion/comercios/aprobaciones')}
                  title={`${pendientesComercios} comercios esperando aprobación con RUC`}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>{pendientesComercios} comercios</span>
                </button>
              )}

              {/* Rango de Fechas Operativo */}
              <div className="hidden lg:flex items-center gap-1.5 bg-stone-50 border border-stone-200/80 px-2.5 py-1 rounded-xl text-xs font-semibold text-stone-600">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>{rangoFecha}</span>
              </div>

              {/* Botón Limpiar Caché */}
              <button
                type="button"
                onClick={handleLimpiarTodasLasCaches}
                disabled={limpiandoCache}
                title="Limpiar todas las cachés del sistema (navegador, banners, CDN y assets estáticos)"
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs
                  ${mensajeCache
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200/90 hover:border-stone-300'
                  }
                  ${limpiandoCache ? 'opacity-70 cursor-wait' : ''}
                `}
              >
                {mensajeCache ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <RotateCw className={`w-3.5 h-3.5 shrink-0 ${limpiandoCache ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
                )}
                <span>
                  {mensajeCache || (limpiandoCache ? 'Limpiando...' : 'Limpiar Caché')}
                </span>
              </button>

              {/* Botón Volver a la Web */}
              {onVolverAWeb && (
                <button
                  onClick={onVolverAWeb}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Web Pública</span>
                </button>
              )}
            </div>
          </header>

          {/* ÁREA DE CONTENIDO PRINCIPAL POR DOMINIO */}
          <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-7 overflow-y-auto">
            {/* 1. Panel General: /gestion */}
            {rutaActiva === '/gestion' && (
              <PanelGeneralView onNavegar={navegarA} />
            )}

            {/* 2. Analítica: /gestion/analitica* */}
            {rutaActiva.startsWith('/gestion/analitica') && (
              <AnaliticaDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}

            {/* 3. Usuarios: /gestion/usuarios* */}
            {rutaActiva.startsWith('/gestion/usuarios') && (
              <UsuariosDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}

            {/* 4. Comercios CRM: /gestion/comercios* */}
            {rutaActiva.startsWith('/gestion/comercios') && (
              <ComerciosDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}

            {/* 5. Ofertas: /gestion/ofertas* */}
            {rutaActiva.startsWith('/gestion/ofertas') && (
              <OfertasDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}

            {/* 6. Campañas y Cobro ERP: /gestion/campanas-cobro* */}
            {rutaActiva.startsWith('/gestion/campanas-cobro') && (
              <CampanasCobroDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}

            {/* 7. Comunicaciones: /gestion/comunicaciones* */}
            {rutaActiva.startsWith('/gestion/comunicaciones') && (
              <ComunicacionesDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}

            {/* 8. Configuración: /gestion/configuracion* */}
            {rutaActiva.startsWith('/gestion/configuracion') && (
              <ConfiguracionDomainView subruta={rutaActiva} onNavegar={navegarA} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
