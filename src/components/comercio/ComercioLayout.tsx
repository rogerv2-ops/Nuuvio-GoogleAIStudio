import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Menu, X, ChevronRight, ChevronDown, ChevronLeft,
  Calendar, Bell, Plus, LogOut, ArrowLeft, Store, HelpCircle,
  ExternalLink, Sparkles, CheckCircle2, AlertTriangle, Shield,
  Upload, Heart, MapPin, MessageCircle, Smartphone, Eye, AlertCircle, Lock,
  Video, Play, Film, Loader2
} from 'lucide-react';
import { Merchant, Offer, ClickRecord, ConfirmedSale } from '../../types';
import { comerciosModule } from '../../modules/comercios';
import { vistaComoModule } from '../../modules/vistaComo';
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
import { HistorialPromocionesView } from './views/HistorialPromocionesView';
import { ResultadosComercioView } from './views/ResultadosComercioView';
import { CampanasComercioView } from './views/CampanasComercioView';
import { VentasComercioView } from './views/VentasComercioView';
import { MiNegocioComercioView } from './views/MiNegocioComercioView';
import { OnboardingTourModal } from './OnboardingTourModal';

interface ComercioLayoutProps {
  onVolverAWeb?: () => void;
  /** "Entrar como comercio" (admin): id del comercio a mostrar en el panel. */
  entrarComoId?: string | null;
}

export const ComercioLayout: React.FC<ComercioLayoutProps> = ({ onVolverAWeb, entrarComoId }) => {
  const sesion = coreSecurity.getSesionActual();

  // Aislamiento estricto de negocio según la sesión autorizada
  // Si la sesión es comercio_user_01, su merchantId es 'merch_01' (La Bodega Verde)
  // Con "entrar como" (admin), se muestra el comercio elegido desde el panel de gestión.
  const comercioIdAutorizado = entrarComoId || sesion?.merchantId || 'merch_01';
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

  // Modal cambiar contraseña (autoservicio)
  const [modalPasswordAbierto, setModalPasswordAbierto] = useState(false);
  const [nuevaPass, setNuevaPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ ok: boolean; texto: string } | null>(null);

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
    diasVencimiento: 30,
    videoUrl: '',
    videoAspectRatio: '9:16' as '9:16' | '16:9'
  });

  // Estados para validación de foto de oferta y previsualizador móvil
  const [modoImagen, setModoImagen] = useState<'upload' | 'url'>('upload');
  const [errorImagen, setErrorImagen] = useState<string | null>(null);
  const [infoArchivoImagen, setInfoArchivoImagen] = useState<{ nombre: string; tamanoKb: number } | null>(null);
  const [modalVistaPreviaMovilAmpliada, setModalVistaPreviaMovilAmpliada] = useState(false);

  // Estados para animación de video con Veo (veo-3.1-fast-generate-preview 9:16)
  const [generandoVideo, setGenerandoVideo] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState(0);
  const [etapaVideo, setEtapaVideo] = useState('');
  const [vistaPreviaModo, setVistaPreviaModo] = useState<'foto' | 'video'>('foto');
  const [promptVideoPersonalizado, setPromptVideoPersonalizado] = useState('');
  const [mostrarOpcionesVideo, setMostrarOpcionesVideo] = useState(false);

  const handleSubirFotoOferta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Verificación exacta de formato (JPG, PNG, WEBP)
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      setErrorImagen('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.');
      return;
    }

    // 2. Verificación de tamaño máximo (no mayor a 2 MB = 2 * 1024 * 1024 bytes)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      const tamanoMb = (file.size / (1024 * 1024)).toFixed(2);
      setErrorImagen(`La imagen pesa ${tamanoMb} MB. El tamaño máximo permitido es 10.00 MB.`);
      return;
    }

    setErrorImagen(null);
    setInfoArchivoImagen({
      nombre: file.name,
      tamanoKb: Math.round(file.size / 1024)
    });

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const local = event.target!.result as string;
        const anterior = formOferta.imagenUrl;
        setFormOferta(prev => ({
          ...prev,
          imagenUrl: local,
          videoUrl: '' // Resetear video si sube una imagen nueva
        }));
        setVistaPreviaModo('foto');
        try {
          const { subirImagenAlServidor } = await import('../../utils/uploadMedia');
          const url = await subirImagenAlServidor(local, 'ofertas');
          setFormOferta(prev => ({ ...prev, imagenUrl: url }));
        } catch (err) {
          setFormOferta(prev => ({ ...prev, imagenUrl: anterior }));
          alert('No se pudo subir la imagen al servidor, no se guardó: ' + (err instanceof Error ? err.message : err));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Función para animar la foto de la oferta a video con Veo (9:16)
  const handleAnimarConVeo = async () => {
    if (!formOferta.imagenUrl) {
      alert('Primero selecciona o sube una imagen para la oferta.');
      return;
    }

    setGenerandoVideo(true);
    setProgresoVideo(15);
    setEtapaVideo('Iniciando generador de video Veo (veo-3.1-fast-generate-preview)...');

    try {
      const res = await fetch('/api/gemini/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: formOferta.imagenUrl.startsWith('data:') ? undefined : formOferta.imagenUrl,
          imageBase64: formOferta.imagenUrl.startsWith('data:') ? formOferta.imagenUrl : undefined,
          prompt: promptVideoPersonalizado || `Animación cinemática publicitaria de la oferta: ${formOferta.titulo || 'promoción comercial'}. Zoom suave y elegante, iluminación publicitaria para móviles en formato 9:16`,
          aspectRatio: formOferta.videoAspectRatio || '9:16'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo iniciar la animación');
      }

      setProgresoVideo(45);
      setEtapaVideo('Sintetizando movimiento vertical en formato 9:16...');

      // Si el video fue completado directamente
      if (data.status === 'completed' && data.videoUrl) {
        setProgresoVideo(100);
        setEtapaVideo('¡Video animado generado con éxito!');
        setFormOferta(prev => ({ ...prev, videoUrl: data.videoUrl }));
        setVistaPreviaModo('video');
        setTimeout(() => setGenerandoVideo(false), 500);
        return;
      }

      // Si es una operación en proceso (Google Veo), consultar status
      const videoId = data.videoId;
      const opName = data.operationName;
      let intentos = 0;
      let finalizado = false;

      while (!finalizado && intentos < 25) {
        await new Promise(r => setTimeout(r, 2000));
        intentos++;
        const porc = Math.min(94, 45 + intentos * 3);
        setProgresoVideo(porc);
        setEtapaVideo(`Renderizando cuadros de movimiento (${porc}%)...`);

        const pollRes = await fetch('/api/gemini/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, operationName: opName })
        });

        const pollData = await pollRes.json();
        if (pollData.done && pollData.videoUrl) {
          finalizado = true;
          setProgresoVideo(100);
          setEtapaVideo('¡Video vertical listo!');
          setFormOferta(prev => ({ ...prev, videoUrl: pollData.videoUrl }));
          setVistaPreviaModo('video');
          setTimeout(() => setGenerandoVideo(false), 500);
          break;
        }
      }
    } catch (err: any) {
      alert(`Error al generar video con Veo: ${err.message || 'Error inesperado'}`);
      setGenerandoVideo(false);
    }
  };

  // Cajón de notificaciones, modal ayuda y Tour de Bienvenida
  const [modalAyudaAbierto, setModalAyudaAbierto] = useState(false);
  const [cajonNotificacionesAbierto, setCajonNotificacionesAbierto] = useState(false);
  const [modalTourAbierto, setModalTourAbierto] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !comercio?.id) return false;
    try {
      const tourCompletado = localStorage.getItem(`vuuy_comercio_tour_v1_${comercio.id}`);
      return tourCompletado !== 'completado';
    } catch {
      return false;
    }
  });

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

  // Recargar comercios al montar el panel: el modulo pudo haberse cargado
  // antes del login (401 silencioso -> lista vacia) y el login no recarga la pagina.
  useEffect(() => {
    comerciosModule.recargar();
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

    if (errorImagen) {
      alert(`Error en la imagen: ${errorImagen}`);
      return;
    }
    if (!formOferta.imagenUrl || formOferta.imagenUrl.startsWith('data:')) {
      alert('La imagen aún se está subiendo al servidor. Espera a que termine antes de publicar.');
      return;
    }

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
      diasVencimiento: Number(formOferta.diasVencimiento),
      videoUrl: formOferta.videoUrl || undefined,
      videoAspectRatio: formOferta.videoAspectRatio || '9:16',
      videoEstado: formOferta.videoUrl ? 'completado' : undefined
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
        diasVencimiento: 30,
        videoUrl: '',
        videoAspectRatio: '9:16'
      });
      setVistaPreviaModo('foto');
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
    if (rutaActual === '/comercio/historial-promociones' || rutaActual.startsWith('/comercio/historial-promociones') || rutaActual === '/comercio/ofertas/historial') {
      return (
        <HistorialPromocionesView
          comercio={comercio}
          ofertas={ofertas}
          rutaActual={rutaActual}
          alNavegar={navegarA}
          alAbrirNuevaOferta={() => setModalNuevaOfertaAbierto(true)}
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
          <div className="pt-4 border-t border-stone-100 space-y-1.5">
            {!sidebarColapsadoDesktop && (
              <>
                <button
                  type="button"
                  onClick={() => setModalTourAbierto(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 transition-colors border border-emerald-200/60"
                >
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Guía de Inicio (Tour)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalAyudaAbierto(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                >
                  <HelpCircle className="w-4 h-4 text-stone-400" />
                  <span>Centro de ayuda</span>
                </button>
              </>
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
                      {sesion?.email || 'comercio@yuddit.com'}
                    </p>
                  </div>
                )}
              </div>

              {!sidebarColapsadoDesktop && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => { setPassMsg(null); setNuevaPass(''); setModalPasswordAbierto(true); }}
                    className="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-stone-400 transition-colors"
                    title="Cambiar contraseña"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => coreSecurity.cerrarSesion()}
                    className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-stone-400 transition-colors" 
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
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
            {entrarComoId && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-800">
                  Estás viendo el panel de {comercio?.nombreComercial || 'un comercio'} como administrador.
                </p>
                <button
                  onClick={() => vistaComoModule.salir()}
                  className="text-xs font-bold text-amber-900 hover:text-amber-700 underline cursor-pointer whitespace-nowrap"
                >
                  Volver al panel admin
                </button>
              </div>
            )}
            
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

                {/* Guía de Inicio (Tour) */}
                <button
                  type="button"
                  onClick={() => setModalTourAbierto(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-colors"
                  title="Abrir Guía de Inicio"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Guía de Inicio</span>
                </button>

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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#166534] hover:bg-[#14532D] text-white font-bold text-xs rounded-full shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Nueva oferta</span>
                </button>
              </div>
            </div>

            {/* Vistas de Dominio */}
            {comercio ? renderContenidoDominio() : (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-stone-700">Cargando tu panel...</p>
                <p className="text-xs text-stone-400 mt-1">Si no aparece en unos segundos, recargá la página.</p>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ================= MODAL RESPONSIVE: NUEVA OFERTA (PREVISUALIZACIÓN IDÉNTICA AL FEED MÓVIL) ================= */}
      {modalNuevaOfertaAbierto && (
        <div
          onClick={() => setModalNuevaOfertaAbierto(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 my-auto max-h-[94vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#0F172A] flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-700" />
                  <span>Publicar Nueva Oferta</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Formato vertical 4:5 · Previsualización en tiempo real exacta a cómo se verá en el Feed Público para celulares.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setModalNuevaOfertaAbierto(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearOferta} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* COLUMNA IZQUIERDA: FORMULARIO DE DATOS Y CARGA DE ARCHIVO */}
              <div className="lg:col-span-7 space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-stone-700 block mb-1">Título de la Oferta *</label>
                  <input
                    type="text"
                    required
                    value={formOferta.titulo}
                    onChange={e => setFormOferta({ ...formOferta, titulo: e.target.value })}
                    placeholder="Ej. Bowl Acai Orgánico con Toppings"
                    className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 outline-none font-medium text-stone-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-700 block mb-1">Descripción atractiva (máx 150 car.) *</label>
                  <textarea
                    required
                    rows={2}
                    maxLength={150}
                    value={formOferta.descripcion}
                    onChange={e => setFormOferta({ ...formOferta, descripcion: e.target.value })}
                    placeholder="Acai orgánico de la Amazonía con granola artesanal y frutas frescas..."
                    className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 outline-none font-medium text-stone-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">Precio Normal (S/) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formOferta.precioNormal}
                      onChange={e => setFormOferta({ ...formOferta, precioNormal: Number(e.target.value) })}
                      className="w-full p-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">Precio Oferta (S/) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formOferta.precioOferta}
                      onChange={e => setFormOferta({ ...formOferta, precioOferta: Number(e.target.value) })}
                      className="w-full p-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-bold text-emerald-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">Stock disponible *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formOferta.stock}
                      onChange={e => setFormOferta({ ...formOferta, stock: Number(e.target.value) })}
                      className="w-full p-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">Vigencia (días)</label>
                    <input
                      type="number"
                      value={formOferta.diasVencimiento}
                      onChange={e => setFormOferta({ ...formOferta, diasVencimiento: Number(e.target.value) })}
                      className="w-full p-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* CAMPO DE FOTO CON CARGA DE ARCHIVO Y VALIDACIÓN EXACTA (FORMATO + MÁX 2MB) */}
                <div className="space-y-2 pt-1 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-stone-700 block">
                      Foto de la Oferta (Vertical 4:5, Máx 2 MB) *
                    </label>
                    <span className="text-[10px] text-stone-400 font-mono">JPG, PNG, WEBP</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModoImagen('upload')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modoImagen === 'upload' ? 'bg-[#166534] text-white shadow-2xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir Imagen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoImagen('url')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modoImagen === 'url' ? 'bg-[#166534] text-white shadow-2xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <span>Pegar URL</span>
                    </button>
                  </div>

                  {modoImagen === 'upload' ? (
                    <div className="p-3.5 bg-stone-50 border-2 border-dashed border-stone-200/90 rounded-2xl text-center space-y-1.5">
                      <Upload className="w-5 h-5 text-emerald-700 mx-auto" />
                      <p className="text-xs font-bold text-stone-700">Selecciona una foto desde tu dispositivo</p>
                      <p className="text-[10px] text-stone-400">Verificación estricta: Formatos JPG, PNG, WEBP · Límite máximo: 2.0 MB</p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleSubirFotoOferta}
                        className="block w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                      />
                      {infoArchivoImagen && !errorImagen && (
                        <div className="p-2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center justify-between shadow-2xs">
                          <span>✓ {infoArchivoImagen.nombre} ({infoArchivoImagen.tamanoKb} KB)</span>
                          <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100 px-2 py-0.5 rounded-md">Válido &lt; 2MB</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="url"
                      value={formOferta.imagenUrl}
                      onChange={e => {
                        setErrorImagen(null);
                        setFormOferta({ ...formOferta, imagenUrl: e.target.value });
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-800"
                    />
                  )}

                  {errorImagen && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold flex items-center gap-2 shadow-2xs">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorImagen}</span>
                    </div>
                  )}

                  {/* GENERADOR DE VIDEO VEO (veo-3.1-fast-generate-preview 9:16) */}
                  <div className="mt-3 p-3 bg-gradient-to-br from-emerald-50/80 via-white to-stone-50 border border-emerald-200/90 rounded-2xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                        <Video className="w-4 h-4 text-emerald-700" />
                        <span>Animación de Video con IA</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono px-1.5 py-0.5 rounded-full font-bold">
                          veo-3.1-fast
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMostrarOpcionesVideo(!mostrarOpcionesVideo)}
                        className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                      >
                        {mostrarOpcionesVideo ? 'Ocultar opciones' : 'Opciones (9:16 / 16:9)'}
                      </button>
                    </div>

                    <p className="text-[11px] text-stone-600 leading-snug">
                      Convierte la foto estática en un video comercial animado para tus historias de WhatsApp o mensajes directos.
                    </p>

                    {mostrarOpcionesVideo && (
                      <div className="p-2.5 bg-white border border-stone-200/80 rounded-xl space-y-2 text-[11px]">
                        <div>
                          <label className="text-[10px] font-bold text-stone-700 block mb-1">Formato de Video:</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setFormOferta(prev => ({ ...prev, videoAspectRatio: '9:16' }))}
                              className={`py-1 px-2 rounded-lg text-xs font-bold transition-all ${
                                formOferta.videoAspectRatio === '9:16'
                                  ? 'bg-emerald-800 text-white shadow-2xs'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              📱 9:16 (Vertical Celulares)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormOferta(prev => ({ ...prev, videoAspectRatio: '16:9' }))}
                              className={`py-1 px-2 rounded-lg text-xs font-bold transition-all ${
                                formOferta.videoAspectRatio === '16:9'
                                  ? 'bg-emerald-800 text-white shadow-2xs'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              🖥️ 16:9 (Horizontal)
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-stone-700 block mb-1">Instrucción de animación (opcional):</label>
                          <input
                            type="text"
                            value={promptVideoPersonalizado}
                            onChange={e => setPromptVideoPersonalizado(e.target.value)}
                            placeholder="Ej. Zoom suave con iluminación dorada sobre el producto..."
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {generandoVideo ? (
                      <div className="p-3 bg-white border border-emerald-300 rounded-xl space-y-2 shadow-2xs animate-pulse">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                            <span>{etapaVideo || 'Sintetizando video animado con Veo...'}</span>
                          </span>
                          <span className="font-mono text-emerald-700">{progresoVideo}%</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-emerald-100">
                          <div 
                            className="bg-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progresoVideo}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-stone-500 text-center font-medium">
                          Generando video en formato {formOferta.videoAspectRatio || '9:16'} con modelo veo-3.1-fast-generate-preview...
                        </p>
                      </div>
                    ) : formOferta.videoUrl ? (
                      <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs">✓</span>
                          <div>
                            <p className="text-xs font-bold text-emerald-950">Video Veo {formOferta.videoAspectRatio || '9:16'} generado</p>
                            <p className="text-[10px] text-emerald-700 font-medium">Listo para previsualizar y enviar por WhatsApp</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setVistaPreviaModo('video')}
                            className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Ver en Feed
                          </button>
                          <button
                            type="button"
                            onClick={handleAnimarConVeo}
                            className="px-2 py-1 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-lg text-[11px] font-bold cursor-pointer"
                            title="Regenerar animación"
                          >
                            ↻
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAnimarConVeo}
                        disabled={!formOferta.imagenUrl || !!errorImagen}
                        className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>Animar Imagen a Video con Veo (9:16)</span>
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!!errorImagen || generandoVideo}
                  className="w-full py-3 bg-[#166534] hover:bg-[#14532D] disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>Enviar Oferta a Revisión</span>
                </button>
              </div>

              {/* COLUMNA DERECHA: SIMULADOR DE FEED MÓVIL EXACTO A PUBLICWEB.TSX */}
              <div className="lg:col-span-5 bg-stone-100 p-3 sm:p-4 rounded-3xl border border-stone-200/90 flex flex-col items-center space-y-3">
                <div className="flex items-center justify-between w-full px-1">
                  <span className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    <span>Vista Previa Feed Móvil</span>
                  </span>
                  
                  {/* SELECTOR ENTRE FOTO Y VIDEO */}
                  <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setVistaPreviaModo('foto')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        vistaPreviaModo === 'foto' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      📸 Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!formOferta.videoUrl) {
                          alert('Primero genera la animación con el botón "Animar Imagen con Veo".');
                          return;
                        }
                        setVistaPreviaModo('video');
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        vistaPreviaModo === 'video' 
                          ? 'bg-emerald-700 text-white shadow-2xs' 
                          : formOferta.videoUrl 
                            ? 'text-emerald-800 hover:text-emerald-950 font-black' 
                            : 'text-stone-400 opacity-60'
                      }`}
                    >
                      <span>🎬 Video 9:16</span>
                      {formOferta.videoUrl && vistaPreviaModo !== 'video' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalVistaPreviaMovilAmpliada(true)}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ampliar</span>
                  </button>
                </div>

                {/* TELÉFONO CELULAR SIMULADO DE FEED */}
                <div className="w-full max-w-[300px] bg-white rounded-[24px] border-4 border-stone-900 shadow-xl overflow-hidden relative text-stone-900">
                  {/* BARRA DE ESTADO */}
                  <div className="bg-stone-900 text-white text-[9px] px-3.5 py-0.5 flex items-center justify-between font-mono font-bold">
                    <span>12:00</span>
                    <div className="w-10 h-2 bg-stone-800 rounded-full mx-auto" />
                    <span>100% 🔋</span>
                  </div>

                  {/* BARRA SUPERIOR DEL FEED */}
                  <div className="bg-[#1B4332] text-white p-2 flex items-center justify-between">
                    <span className="font-black text-[11px] tracking-wider flex items-center gap-1">
                      <span>🍃</span> Yuddit feed
                    </span>
                    <span className="text-[8px] bg-emerald-900/80 px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-200 font-bold">
                      {comercio?.distrito || 'Miraflores'}
                    </span>
                  </div>

                  {/* TARJETA IDÉNTICA AL FEED EN PUBLICWEB.TSX */}
                  <div className="p-2 bg-stone-50">
                    <article className="bg-white rounded-[18px] overflow-hidden border border-[#EAE5D9] shadow-2xs text-left">
                      {/* FOTO O VIDEO FORMATO 4:5 / 9:16 */}
                      <div className="relative aspect-[4/5] w-full bg-stone-200 overflow-hidden rounded-t-[18px]">
                        {vistaPreviaModo === 'video' && formOferta.videoUrl ? (
                          <video
                            src={formOferta.videoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover rounded-t-[18px]"
                          />
                        ) : (
                          <img
                            src={formOferta.imagenUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&h=1000&q=80'}
                            alt="Previsualización"
                            className="w-full h-full object-cover rounded-t-[18px]"
                            onError={(e) => handleImgError(e, getCategoryFallbackImage(formOferta.categoria, formOferta.titulo))}
                          />
                        )}

                        {vistaPreviaModo === 'video' && formOferta.videoUrl && (
                          <div className="absolute top-2 left-2 z-20">
                            <span className="bg-black/75 backdrop-blur-xs text-white text-[8px] font-black tracking-wide px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-white/20 shadow-md">
                              <Film className="w-2.5 h-2.5 text-emerald-400" />
                              <span>Video Veo 9:16</span>
                            </span>
                          </div>
                        )}

                        {/* BADGES SUPERIORES IZQUIERDOS */}
                        <div className={`absolute left-2 flex flex-col items-start gap-1 z-10 ${vistaPreviaModo === 'video' ? 'top-8' : 'top-2'}`}>
                          <span className="bg-emerald-600 text-white text-[8px] font-black tracking-wide px-2 py-0.5 rounded-full uppercase flex items-center gap-0.5 shadow-md border border-emerald-400/80">
                            <Sparkles className="w-2 h-2 text-emerald-200" />
                            Nuevo
                          </span>
                          <span className="bg-[#B91C1C] text-white text-[8px] font-black tracking-wide px-2 py-0.5 rounded-full uppercase shadow-xs">
                            Expira en 2h 55m
                          </span>
                          <span className="bg-[#E0F2FE] text-[#0369A1] text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-0.5 shadow-xs border border-[#BAE6FD]">
                            ⚡ Boosted
                          </span>
                        </div>

                        {/* ETIQUETA NARANJA DE PRECIO TOP RIGHT */}
                        <div className="absolute top-2 right-2 bg-[#FF5722] text-white px-2.5 py-1 rounded-xl shadow-md text-right z-10 leading-none">
                          <span className="text-[8px] text-white/80 line-through font-semibold block mb-0.5">
                            S/ {formOferta.precioNormal || 60}
                          </span>
                          <span className="text-xs font-black tracking-tight block">
                            S/ {formOferta.precioOferta || 39}
                          </span>
                        </div>

                        {/* CORAZÓN DE FAVORITOS */}
                        <div className="absolute top-11 right-2 w-6 h-6 rounded-full bg-[#1B4332] text-white flex items-center justify-center shadow-md z-10">
                          <Heart className="w-3 h-3 fill-white text-white" />
                        </div>

                        {/* GRADIENTE INFERIOR SOBRE LA FOTO */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-2.5 pt-10 text-white z-10 space-y-1">
                          <h3 className="font-black text-xs text-white leading-tight uppercase tracking-tight drop-shadow-md truncate">
                            {formOferta.titulo || 'TÍTULO DE TU OFERTA'}
                          </h3>
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/20 text-[9px]">
                            <span className="flex items-center gap-1 font-black text-white truncate max-w-[110px]">
                              <Store className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span className="truncate">{comercio?.nombreComercial || comercio?.razonSocial || 'Tu Local'}</span>
                            </span>
                            <span className="inline-flex items-center gap-0.5 bg-black/70 px-1.5 py-0.5 rounded text-amber-300 font-bold shrink-0">
                              <MapPin className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span>10 km · {comercio?.distrito || 'Miraflores'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CONTENIDO DE LA TARJETA DEBAJO DE LA FOTO */}
                      <div className="p-2.5 space-y-1.5">
                        <div>
                          <h4 className="font-extrabold text-xs text-[#0F172A] leading-snug truncate">
                            {formOferta.titulo || 'Título de la Oferta'}
                          </h4>
                          <p className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed line-clamp-2">
                            {formOferta.descripcion || 'Descripción del producto o servicio promocionado...'}
                          </p>
                        </div>

                        {/* DESCUENTO Y URGENCIA */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-[9px] font-black text-emerald-800 bg-[#D1FAE5] px-1.5 py-0.5 rounded">
                            {formOferta.precioNormal > formOferta.precioOferta
                              ? Math.round(((formOferta.precioNormal - formOferta.precioOferta) / formOferta.precioNormal) * 100)
                              : 35}% OFF
                          </span>
                          <span className="text-[9px] text-[#64748B] font-medium flex items-center gap-0.5">
                            ⏱ Solo {formOferta.stock || 20} hoy
                          </span>
                        </div>

                        {/* BOTONES DE ACCIÓN: LO QUIERO Y LO COMPARTO */}
                        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-stone-100">
                          <div className="w-full py-1.5 px-1.5 bg-[#15803D] text-white rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 shadow-2xs">
                            <MessageCircle className="w-2.5 h-2.5 fill-white" />
                            <span>Lo quiero</span>
                          </div>
                          <div className="w-full py-1.5 px-1.5 bg-white text-[#0F172A] rounded-lg text-[9px] font-bold border border-[#EAE5D9] flex items-center justify-center gap-1">
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>Lo comparto</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>

                  {/* BARRA INFERIOR DEL TELÉFONO */}
                  <div className="bg-stone-900 py-1 flex justify-center">
                    <div className="w-16 h-0.5 bg-stone-600 rounded-full" />
                  </div>
                </div>

                <p className="text-[10px] text-stone-500 font-medium text-center leading-tight">
                  Así visualizarán los usuarios tu oferta en la app móvil de Yuddit.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL VISTA PREVIA MÓVIL PANTALLA COMPLETA ================= */}
      {modalVistaPreviaMovilAmpliada && (
        <div 
          onClick={() => setModalVistaPreviaMovilAmpliada(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-stone-900 text-white rounded-[36px] max-w-sm w-full p-3 shadow-2xl border-4 border-stone-700 relative space-y-3"
          >
            <div className="flex items-center justify-between px-3 pt-1">
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Simulador Feed Móvil Completo</span>
              </span>
              <button
                type="button"
                onClick={() => setModalVistaPreviaMovilAmpliada(false)}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-white rounded-[24px] text-stone-900 overflow-hidden shadow-xl border border-stone-200">
              <div className="bg-stone-900 text-white text-[10px] px-4 py-1 flex items-center justify-between font-mono font-bold">
                <span>12:00</span>
                <div className="w-12 h-2.5 bg-stone-800 rounded-full mx-auto" />
                <span>100% 🔋</span>
              </div>

              <div className="bg-[#1B4332] text-white p-3 flex items-center justify-between">
                <span className="font-black text-xs tracking-wider flex items-center gap-1">
                  <span>🍃</span> Yuddit feed
                </span>
                <span className="text-[10px] bg-emerald-900 px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-200 font-bold">
                  Lima · {comercio?.distrito || 'Miraflores'}
                </span>
              </div>

              <div className="p-3 max-h-[70vh] overflow-y-auto space-y-3 bg-stone-50">
                <p className="text-[11px] text-stone-500 text-center font-semibold">Vista previa exacta de tu anuncio en el feed público:</p>

                <article className="bg-white rounded-[20px] overflow-hidden border border-[#EAE5D9] shadow-sm text-left">
                  {/* Foto o Video 4:5 / 9:16 */}
                  <div className="relative aspect-[4/5] w-full bg-stone-200 overflow-hidden rounded-t-[20px]">
                    {vistaPreviaModo === 'video' && formOferta.videoUrl ? (
                      <video
                        src={formOferta.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover rounded-t-[20px]"
                      />
                    ) : (
                      <img
                        src={formOferta.imagenUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&h=1000&q=80'}
                        alt="Previsualización"
                        className="w-full h-full object-cover rounded-t-[20px]"
                        onError={(e) => handleImgError(e, getCategoryFallbackImage(formOferta.categoria, formOferta.titulo))}
                      />
                    )}

                    {vistaPreviaModo === 'video' && formOferta.videoUrl && (
                      <div className="absolute top-3 left-3 z-20">
                        <span className="bg-black/75 backdrop-blur-xs text-white text-[9px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase flex items-center gap-1 border border-white/20 shadow-md">
                          <Film className="w-3 h-3 text-emerald-400" />
                          <span>Video Veo 9:16</span>
                        </span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-10">
                      <span className="bg-emerald-600 text-white text-[9px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shadow-md border border-emerald-400/80">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-200" />
                        Nuevo
                      </span>
                      <span className="bg-[#B91C1C] text-white text-[9px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase shadow-xs">
                        Expira en 2h 55m
                      </span>
                      <span className="bg-[#E0F2FE] text-[#0369A1] text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase flex items-center gap-0.5 shadow-xs border border-[#BAE6FD]">
                        ⚡ Boosted
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 bg-[#FF5722] text-white px-3 py-1 rounded-xl shadow-md text-right z-10 leading-none">
                      <span className="text-[9px] text-white/80 line-through font-semibold block mb-0.5">
                        S/ {formOferta.precioNormal || 60}
                      </span>
                      <span className="text-sm font-black tracking-tight block">
                        S/ {formOferta.precioOferta || 39}
                      </span>
                    </div>

                    <div className="absolute top-14 right-3 w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center shadow-md z-10">
                      <Heart className="w-4 h-4 fill-white text-white" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 pt-16 text-white z-10 space-y-1.5">
                      <h3 className="font-black text-xl text-white leading-tight uppercase tracking-tight drop-shadow-md">
                        {formOferta.titulo || 'TÍTULO DE TU OFERTA'}
                      </h3>
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-white/20 text-xs">
                        <span className="flex items-center gap-1.5 font-black text-white truncate max-w-[160px]">
                          <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{comercio?.nombreComercial || comercio?.razonSocial || 'Tu Local'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md text-amber-300 font-bold shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>10 km · {comercio?.distrito || 'Miraflores'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div>
                      <h4 className="font-extrabold text-base text-[#0F172A] leading-snug">
                        {formOferta.titulo || 'Título de la Oferta'}
                      </h4>
                      <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                        {formOferta.descripcion || 'Descripción del producto o servicio promocionado...'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-xs font-black text-emerald-800 bg-[#D1FAE5] px-2.5 py-1 rounded-md">
                        {formOferta.precioNormal > formOferta.precioOferta
                          ? Math.round(((formOferta.precioNormal - formOferta.precioOferta) / formOferta.precioNormal) * 100)
                          : 35}% OFF
                      </span>
                      <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                        ⏱ Solo {formOferta.stock || 20} hoy
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                      <div className="w-full py-2 px-2.5 bg-[#15803D] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs">
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>Lo quiero</span>
                      </div>
                      <div className="w-full py-2 px-2.5 bg-white text-[#0F172A] rounded-xl text-xs font-bold border border-[#EAE5D9] flex items-center justify-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Lo comparto</span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
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
                <p>Los usuarios piden ofertas en Yuddit. Cuando una les gusta, tocan "Lo quiero" y se abre tu WhatsApp con un mensaje prearmado y su código personal (ej. CV88-91).</p>
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

      {/* ================= MODAL CAMBIAR CONTRASEÑA (AUTOSERVICIO) ================= */}
      {modalPasswordAbierto && (
        <div
          onClick={() => setModalPasswordAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700" />
                <span>Cambiar Mi Contraseña</span>
              </h4>
              <button
                onClick={() => setModalPasswordAbierto(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-stone-500">Cuenta: <span className="font-mono">{sesion?.email}</span></p>
            {passMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${passMsg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {passMsg.texto}
              </div>
            )}
            <input
              type="password"
              value={nuevaPass}
              onChange={(e) => setNuevaPass(e.target.value)}
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalPasswordAbierto(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const email = sesion?.email || '';
                  if (nuevaPass.trim().length < 6) { setPassMsg({ ok: false, texto: 'La contraseña debe tener al menos 6 caracteres.' }); return; }
                  const res = await coreSecurity.actualizarContrasena(email, nuevaPass.trim());
                  setPassMsg({ ok: res.ok, texto: res.mensaje });
                  if (res.ok) { setNuevaPass(''); setTimeout(() => { setModalPasswordAbierto(false); setPassMsg(null); }, 1500); }
                }}
                className="px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOUR DE BIENVENIDA / ASISTENTE PARA NUEVOS COMERCIOS ================= */}
      {comercio && (
        <OnboardingTourModal
          comercio={comercio}
          abierto={modalTourAbierto}
          alCerrar={() => setModalTourAbierto(false)}
          alAbrirNuevaOferta={() => setModalNuevaOfertaAbierto(true)}
          alNavegarVentas={() => navegarA('/comercio/ventas')}
          alNavegarResultados={() => navegarA('/comercio/resultados')}
        />
      )}

    </div>
  );
};
