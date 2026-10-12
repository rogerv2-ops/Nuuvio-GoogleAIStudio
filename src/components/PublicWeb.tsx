import React, { useState, useEffect } from 'react';
import { 
  Search, MapPin, Share2, MessageCircle, Heart, ChevronRight,
  Sparkles, CheckCircle2, Copy, Check, Filter, Info, Shield, 
  Store, UserCheck, X, ExternalLink, Lock, LogOut
} from 'lucide-react';
import { Offer, AudienceUser } from '../types';
import { DISTRITOS_LIMA } from '../data/seedData';
import { ofertasModule } from '../modules/ofertas';
import { usuariosModule } from '../modules/usuarios';
import { comerciosModule } from '../modules/comercios';
import { clicsAtribucionModule } from '../modules/clics';
import { BannerHeader } from './BannerHeader';
import { UserRegistrationFunnelModal } from './UserRegistrationFunnelModal';
import { capturarAtribucionDeUrl } from '../utils/attribution';
import { coreEvents } from '../core/events';
import { getCategoryFallbackImage, handleImgError } from '../utils/imageFallbacks';
import { esOfertaNueva } from '../utils/ofertaUtils';

interface PublicWebProps {
  ofertaSeleccionadaId?: string | null;
  onLimpiarOfertaSeleccionada?: () => void;
}

export const PublicWeb: React.FC<PublicWebProps> = ({
  ofertaSeleccionadaId,
  onLimpiarOfertaSeleccionada
}) => {
  const [fichaOferta, setFichaOferta] = useState<Offer | null>(null);
  const [fotoActivaIndex, setFotoActivaIndex] = useState(0);

  // Estado del usuario activo y verificación
  const [usuarioActivo, setUsuarioActivo] = useState<AudienceUser | null>(usuariosModule.getUsuarioActivo());
  const [modalFunnelAbierto, setModalFunnelAbierto] = useState(false);
  const [ofertaObjetivoFunnel, setOfertaObjetivoFunnel] = useState<Offer | null>(null);
  const [motivoFunnel, setMotivoFunnel] = useState<'whatsapp' | 'compartir' | 'general'>('whatsapp');
  const [toastVerificacion, setToastVerificacion] = useState<string | null>(null);

  // Modales adicionales
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);
  const [modalRegistroComercioAbierto, setModalRegistroComercioAbierto] = useState(false);
  const [modalQuienesSomosAbierto, setModalQuienesSomosAbierto] = useState(false);
  const [modalTerminosAbierto, setModalTerminosAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Formulario de registro de usuario legacy (para fallback de modal general)
  const [formUser, setFormUser] = useState({
    nombre: '',
    apellido: '',
    telefono: '+51 9',
    email: '',
    edad: 28,
    genero: 'Prefiero no decir',
    distrito: 'Miraflores',
    categorias: ['Gastronomía y Café']
  });
  const [registroExitoso, setRegistroExitoso] = useState<{
    usuario: AudienceUser;
    codigoVinculacion: string;
  } | null>(null);

  // Formulario de registro de comercio
  const [formMerchant, setFormMerchant] = useState({
    ruc: '',
    nombreComercial: '',
    razonSocial: '',
    contactoNombre: '',
    telefono: '+51 9',
    email: '',
    direccion: '',
    distrito: 'Miraflores',
    categoria: 'Gastronomía y Café',
    instagram: '@'
  });
  const [registroComercioExitoso, setRegistroComercioExitoso] = useState<string | null>(null);
  const [errorComercio, setErrorComercio] = useState<string | null>(null);

  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [versionOfertas, setVersionOfertas] = useState(0);

  // Atribución de campaña y detección automática de verificación por 1 clic
  useEffect(() => {
    // 1. Extraer y preservar UTMs y ref de la URL
    capturarAtribucionDeUrl();

    // 2. Suscribirse a cambios reactivos en usuariosModule y ofertasModule
    const desuscribirUsuarios = usuariosModule.suscribir(() => {
      setUsuarioActivo(usuariosModule.getUsuarioActivo());
    });

    const desuscribirOfertas = ofertasModule.suscribir(() => {
      setVersionOfertas(v => v + 1);
    });

    // 3. Detección automática del token de verificación por enlace de 1 clic (?verify_token=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('verify_token') || params.get('token');
      if (token) {
        const usuarioVerificado = usuariosModule.verificarPorToken(token);
        if (usuarioVerificado) {
          setUsuarioActivo(usuarioVerificado);
          setToastVerificacion(`¡Cuenta verificada exitosamente! Bienvenido, ${usuarioVerificado.nombre}. Ya puedes pedir ofertas por WhatsApp y compartir.`);
          
          // Limpiar el parámetro de la URL sin recargar la página
          params.delete('verify_token');
          params.delete('token');
          const nuevaSearch = params.toString() ? `?${params.toString()}` : '';
          const nuevaUrl = window.location.pathname + nuevaSearch + window.location.hash;
          window.history.replaceState({}, '', nuevaUrl);
        }
      }
    }

    return () => {
      desuscribirUsuarios();
      desuscribirOfertas();
    };
  }, []);

  // Si viene una oferta seleccionada por prop, abrirla en ficha
  useEffect(() => {
    if (ofertaSeleccionadaId) {
      const ofr = ofertasModule.obtenerOferta(ofertaSeleccionadaId);
      if (ofr) {
        setFichaOferta(ofr);
        setFotoActivaIndex(0);
      }
    }
  }, [ofertaSeleccionadaId]);

  const cerrarModalOferta = () => {
    setFichaOferta(null);
    setFotoActivaIndex(0);
    if (onLimpiarOfertaSeleccionada) onLimpiarOfertaSeleccionada();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fichaOferta) cerrarModalOferta();
        if (modalFunnelAbierto) setModalFunnelAbierto(false);
        if (modalRegistroAbierto) setModalRegistroAbierto(false);
        if (modalRegistroComercioAbierto) setModalRegistroComercioAbierto(false);
        if (modalQuienesSomosAbierto) setModalQuienesSomosAbierto(false);
        if (modalTerminosAbierto) setModalTerminosAbierto(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fichaOferta, modalFunnelAbierto, modalRegistroAbierto, modalRegistroComercioAbierto, modalQuienesSomosAbierto, modalTerminosAbierto]);

  // Listar ofertas activas aprobadas ordenadas por fecha de aprobación / creación más reciente
  const ofertas = ofertasModule.listarOfertasActivas();

  // Filtrado exclusivamente a través del buscador ancho completo
  const ofertasFiltradas = ofertas.filter(o => {
    if (!busquedaTexto.trim()) return true;
    const q = busquedaTexto.toLowerCase();
    return (
      o.titulo.toLowerCase().includes(q) ||
      o.descripcion.toLowerCase().includes(q) ||
      o.comercioNombre.toLowerCase().includes(q) ||
      o.distrito.toLowerCase().includes(q) ||
      o.categoria.toLowerCase().includes(q)
    );
  });

  // LÍMITE CANÓNICO ESTRICTO: Máximo 7 ofertas activas en el feed público (las más recientes)
  const MAX_OFERTAS_PUBLICAS = 7;
  const ofertasVisibles = ofertasFiltradas.slice(0, MAX_OFERTAS_PUBLICAS);

  // Verificar si el usuario actual está registrado y verificado
  const estaVerificado = !!usuarioActivo && usuarioActivo.emailVerificado;

  const handleContactarOferta = (oferta: Offer) => {
    if (!estaVerificado) {
      coreEvents.emitir({
        tipoEvento: 'click_bloqueado_sin_registro',
        actorTipo: 'usuario',
        actorId: 'anonimo',
        distrito: oferta.distrito,
        origen: 'web',
        datos: { accion: 'whatsapp', ofertaId: oferta.id, comercioNombre: oferta.comercioNombre }
      });
      setOfertaObjetivoFunnel(oferta);
      setMotivoFunnel('whatsapp');
      setModalFunnelAbierto(true);
      return;
    }

    const resultado = clicsAtribucionModule.registrarClicContactar({
      ofertaId: oferta.id,
      usuarioId: usuarioActivo.id,
      usuarioCodigoRef: usuarioActivo.codigoRef,
      canal: 'web'
    });

    window.open(resultado.waUrl, '_blank');
  };

  const handleCompartirOferta = (oferta: Offer) => {
    if (!estaVerificado) {
      coreEvents.emitir({
        tipoEvento: 'click_bloqueado_sin_registro',
        actorTipo: 'usuario',
        actorId: 'anonimo',
        distrito: oferta.distrito,
        origen: 'web',
        datos: { accion: 'compartir', ofertaId: oferta.id, comercioNombre: oferta.comercioNombre }
      });
      setOfertaObjetivoFunnel(oferta);
      setMotivoFunnel('compartir');
      setModalFunnelAbierto(true);
      return;
    }

    const resultado = clicsAtribucionModule.registrarClicCompartir({
      ofertaId: oferta.id,
      usuarioId: usuarioActivo.id,
      codigoRef: usuarioActivo.codigoRef,
      canal: 'web'
    });

    navigator.clipboard?.writeText(resultado.urlCompartir);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleRegistrarUsuarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUser.nombre || !formUser.email || !formUser.telefono) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    const res = usuariosModule.registrarUsuario({
      nombre: formUser.nombre,
      apellido: formUser.apellido,
      telefono: formUser.telefono,
      email: formUser.email,
      edad: Number(formUser.edad),
      genero: formUser.genero,
      distrito: formUser.distrito,
      categoriasInteres: formUser.categorias
    });

    setRegistroExitoso(res);
  };

  const handleRegistrarComercioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorComercio(null);

    const res = comerciosModule.registrarComercio({
      ruc: formMerchant.ruc,
      nombreComercial: formMerchant.nombreComercial,
      razonSocial: formMerchant.razonSocial || formMerchant.nombreComercial,
      contactoNombre: formMerchant.contactoNombre,
      telefono: formMerchant.telefono,
      email: formMerchant.email,
      direccion: formMerchant.direccion,
      distrito: formMerchant.distrito,
      categoria: formMerchant.categoria,
      instagram: formMerchant.instagram
    });

    if (res.ok && res.comercio) {
      setRegistroComercioExitoso(res.comercio.nombreComercial);
    } else {
      setErrorComercio(res.error || 'Ocurrió un error en el registro.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1C1917] py-4 px-3 sm:px-4">
      {/* Responsive layout - Vista Mobile Estricta max-w-[640px] */}
      <div className="w-full max-w-[640px] mx-auto space-y-4">
        {/* Toast de Verificación de Cuenta por 1 Clic */}
        {toastVerificacion && (
          <div className="bg-[#1B4332] text-white p-4 rounded-2xl shadow-lg border border-emerald-500/40 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">{toastVerificacion}</p>
                <p className="text-[11px] text-emerald-200 mt-0.5">
                  Los botones de WhatsApp y Compartir ya están habilitados.
                </p>
              </div>
            </div>
            <button
              onClick={() => setToastVerificacion(null)}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick User Actions Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="text-xs text-stone-500 font-medium truncate pr-2">
            {estaVerificado ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Hola, {usuarioActivo?.nombre} (Verificado)</span>
              </span>
            ) : (
              <span>Ofertas locales verificadas en Lima</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {estaVerificado ? (
              <button
                onClick={() => {
                  usuariosModule.setUsuarioActivo(null);
                  setUsuarioActivo(null);
                }}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-red-600 font-semibold bg-white border border-[#EAE5D9] rounded-xl hover:bg-stone-50 transition-colors flex items-center gap-1"
                title="Cerrar sesión"
              >
                <LogOut className="w-3 h-3" />
                <span>Salir</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setOfertaObjetivoFunnel(null);
                  setMotivoFunnel('general');
                  setModalFunnelAbierto(true);
                }}
                className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Registrarme
              </button>
            )}

            <button
              onClick={() => setModalRegistroComercioAbierto(true)}
              className="px-3 py-1.5 text-xs text-[#57534E] hover:text-[#0F172A] font-semibold bg-white border border-[#EAE5D9] rounded-xl shadow-2xs hover:bg-stone-50 transition-colors"
            >
              Unir mi Comercio
            </button>
          </div>
        </div>

        {/* ================= HEADER IMAGE: banner-ficha-oferta-mujer ================= */}
        <BannerHeader />

        {/* ================= BUSCADOR ANCHO COMPLETO ================= */}
        <div className="w-full relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busquedaTexto}
            onChange={e => setBusquedaTexto(e.target.value)}
            placeholder="Buscar ofertas, comercios, distritos en Lima..."
            className="w-full bg-white border border-[#EAE5D9] rounded-2xl pl-11 pr-10 py-3.5 text-xs text-[#1C1917] placeholder:text-[#A8A29E] shadow-xs focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] outline-none transition-all"
          />
          {busquedaTexto && (
            <button
              onClick={() => setBusquedaTexto('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Offers Feed List (ESTÁNDAR FORMATO 4:5 OBLIGATORIO) */}
        <div className="space-y-6">
          {ofertasVisibles.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-[#EAE5D9] text-center space-y-2">
              <p className="font-semibold text-sm text-[#1C1917]">No encontramos ofertas para "{busquedaTexto}"</p>
              <p className="text-xs text-[#78716C]">
                Prueba buscando otro término, plato o distrito (ej. ceviche, café, Miraflores, Barranco).
              </p>
              <button
                onClick={() => setBusquedaTexto('')}
                className="mt-2 text-xs font-semibold text-[#1B4332] hover:underline"
              >
                Limpiar búsqueda y ver todas
              </button>
            </div>
          ) : (
            <>
              {ofertasVisibles.map(oferta => {
                const descuentoPct = Math.round(((oferta.precioNormal - oferta.precioOferta) / oferta.precioNormal) * 100);
                return (
                  <article
                    key={oferta.id}
                    className="bg-white rounded-[20px] overflow-hidden border border-[#EAE5D9] shadow-sm hover:shadow-md transition-all group"
                  >
                    {/* FOTO EN FORMATO ESTÁNDAR 4:5 VERTICAL (NUNCA HORIZONTAL) */}
                    <div 
                      onClick={() => {
                        setFichaOferta(oferta);
                        setFotoActivaIndex(0);
                      }}
                      className="relative aspect-[4/5] w-full bg-stone-200 cursor-pointer overflow-hidden rounded-t-[20px]"
                    >
                      <img
                        src={oferta.imagenes[0]}
                        alt={oferta.titulo}
                        className="w-full h-full object-cover rounded-t-[20px] group-hover:scale-102 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          handleImgError(e, getCategoryFallbackImage(oferta.categoria, oferta.titulo));
                        }}
                      />

                      {/* Top Left Badges: NUEVO, EXPIRA EN & BOOSTED */}
                      <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-1.5 z-10">
                        {esOfertaNueva(oferta.creadaEn) && (
                          <span className="bg-emerald-600 text-white text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shadow-md border border-emerald-400/80 animate-in fade-in duration-200">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-200" />
                            Nuevo
                          </span>
                        )}
                        <span className="bg-[#B91C1C] text-white text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase shadow-xs">
                          Expira en 2h 55m
                        </span>
                        <span className="bg-[#E0F2FE] text-[#0369A1] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shadow-xs border border-[#BAE6FD]">
                          <span>⚡</span> Boosted
                        </span>
                      </div>

                      {/* Top Right Orange Price Tag */}
                      <div className="absolute top-3.5 right-3.5 bg-[#FF5722] text-white px-3.5 py-1.5 rounded-2xl shadow-md text-right z-10 leading-none">
                        <span className="text-[10px] text-white/80 line-through font-semibold block mb-0.5">
                          S/ {oferta.precioNormal}
                        </span>
                        <span className="text-base font-black tracking-tight block">
                          S/ {oferta.precioOferta}
                        </span>
                      </div>

                      {/* Top Right Bookmark Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          alert(`Oferta "${oferta.titulo}" guardada en favoritos.`);
                        }}
                        className="absolute top-16 right-3.5 w-9 h-9 rounded-full bg-[#1B4332] text-white flex items-center justify-center shadow-md hover:bg-[#2D6A4F] transition-colors z-10"
                        title="Guardar oferta"
                      >
                        <Heart className="w-4 h-4 fill-white text-white" />
                      </button>

                      {/* Dark Scrim Overlay at the bottom of the 4:5 photo */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-10 text-white z-10">
                        <h3 className="font-bold text-base text-white leading-tight">
                          {oferta.titulo}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-white/90 pt-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>{oferta.comercioNombre}</span>
                          </span>
                          <span className="text-[11px] text-white/80 font-medium">
                            📍 10 km · {oferta.distrito}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Content Below Photo */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div>
                        <h4 
                          onClick={() => {
                            setFichaOferta(oferta);
                            setFotoActivaIndex(0);
                          }}
                          className="font-bold text-base text-[#0F172A] hover:text-[#1B4332] cursor-pointer leading-snug"
                        >
                          {oferta.titulo}
                        </h4>
                        <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                          {oferta.descripcion}
                        </p>
                      </div>

                      {/* Badges: Discount % OFF & Urgency Indicator */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-xs font-black text-emerald-800 bg-[#D1FAE5] px-2.5 py-1 rounded-lg">
                          {descuentoPct}% OFF
                        </span>
                        <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                          <span>⏱</span> Solo {oferta.stock || 4} hoy
                        </span>
                      </div>

                      {/* Action Buttons: 💬 WhatsApp & ↗ Compartir (Condicionados a registro) */}
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-100">
                        {estaVerificado ? (
                          <button
                            onClick={() => handleContactarOferta(oferta)}
                            className="w-full py-2.5 px-3 bg-[#15803D] hover:bg-[#166534] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 fill-white" />
                            <span>Lo quiero</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleContactarOferta(oferta)}
                            className="w-full py-2.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl text-[11px] font-bold flex items-center justify-center gap-1.5 border border-stone-200/90 transition-all cursor-pointer group/btn"
                            title="Regístrate previamente para pedir la oferta"
                          >
                            <Lock className="w-3.5 h-3.5 text-stone-400 group-hover/btn:text-stone-700 shrink-0" />
                            <span className="truncate">Regístrate para 'Lo quiero'</span>
                          </button>
                        )}

                        {estaVerificado ? (
                          <button
                            onClick={() => handleCompartirOferta(oferta)}
                            className="w-full py-2.5 px-3 bg-white hover:bg-stone-50 text-[#0F172A] rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-[#EAE5D9] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Lo comparto</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCompartirOferta(oferta)}
                            className="w-full py-2.5 px-2 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-2xl text-[11px] font-bold flex items-center justify-center gap-1.5 border border-dashed border-stone-200 transition-all cursor-pointer group/btn"
                            title="Regístrate previamente para compartir ofertas"
                          >
                            <Lock className="w-3.5 h-3.5 text-stone-400 group-hover/btn:text-stone-700 shrink-0" />
                            <span className="truncate">Regístrate para 'Lo comparto'</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* ================= BANNER LÍMITE DE 7 OFERTAS ACTIVAS ================= */}
              <div className="bg-[#1B4332] text-white p-5 sm:p-6 rounded-3xl text-center shadow-md space-y-3 border border-emerald-800">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mx-auto text-emerald-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Mostrando las 7 ofertas destacadas de hoy en Lima
                  </h3>
                  <p className="text-xs text-stone-200 mt-1 max-w-md mx-auto leading-relaxed">
                    {estaVerificado
                      ? 'Pronto más comercios locales publicarán nuevas ofertas en tu distrito. ¡Recibirás novedades en tu WhatsApp oficial!'
                      : 'Regístrate gratis para desbloquear el catálogo completo, contactar a los comercios y recibir ofertas personalizadas por WhatsApp.'}
                  </p>
                </div>
                {!estaVerificado && (
                  <button
                    onClick={() => {
                      setOfertaObjetivoFunnel(null);
                      setMotivoFunnel('general');
                      setModalFunnelAbierto(true);
                    }}
                    className="px-6 py-2.5 bg-[#FF5722] hover:bg-[#F4511E] text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Crear cuenta gratuita y desbloquear</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Public Footer */}
        <footer className="pt-6 pb-12 text-center text-xs text-[#78716C] space-y-2 border-t border-[#EAE5D9]">
          <div className="flex items-center justify-center gap-4 text-xs font-medium text-[#57534E]">
            <button onClick={() => setModalQuienesSomosAbierto(true)} className="hover:text-[#1B4332]">
              Quiénes Somos
            </button>
            <span>·</span>
            <button onClick={() => setModalTerminosAbierto(true)} className="hover:text-[#1B4332]">
              Condiciones de Servicio
            </button>
            <span>·</span>
            <button onClick={() => setModalRegistroComercioAbierto(true)} className="hover:text-[#1B4332]">
              Para Comercios
            </button>
          </div>
          <p className="text-[11px]">
            vuuy © 2026 · Plataforma de ofertas locales para Lima, Perú · PULL, no push.
          </p>
        </footer>
      </div>

      {/* MODAL: Ficha Completa de Oferta (/o/[id]) con carrusel de 3 fotos */}
      {fichaOferta && (
        <div
          onClick={cerrarModalOferta}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[20px] max-w-md w-full overflow-hidden shadow-2xl border border-[#EAE5D9] space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            {/* Carousel Header EN FORMATO ESTÁNDAR 4:5 VERTICAL (NUNCA HORIZONTAL) */}
            <div className="relative aspect-[4/5] w-full bg-stone-200 overflow-hidden rounded-t-[20px]">
              <img
                src={fichaOferta.imagenes[fotoActivaIndex] || fichaOferta.imagenes[0]}
                alt={fichaOferta.titulo}
                className="w-full h-full object-cover rounded-t-[20px]"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  handleImgError(e, getCategoryFallbackImage(fichaOferta.categoria, fichaOferta.titulo));
                }}
              />

              {/* Close button */}
              <button
                onClick={cerrarModalOferta}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-sm transition-colors z-20 shadow-md cursor-pointer"
              >
                ✕
              </button>

              {/* Top Left Badges */}
              <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-1.5 z-10">
                {esOfertaNueva(fichaOferta.creadaEn) && (
                  <span className="bg-emerald-600 text-white text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shadow-md border border-emerald-400/80">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-200" />
                    Nuevo
                  </span>
                )}
                <span className="bg-[#B91C1C] text-white text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase shadow-xs">
                  Expira en 2h 55m
                </span>
                <span className="bg-[#E0F2FE] text-[#0369A1] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shadow-xs border border-[#BAE6FD]">
                  <span>⚡</span> Boosted
                </span>
              </div>

              {/* Top Right Price Tag (below close button) */}
              <div className="absolute top-14 right-3.5 bg-[#FF5722] text-white px-3 py-1.5 rounded-2xl shadow-md text-right z-10 leading-none">
                <span className="text-[10px] text-white/80 line-through font-semibold block mb-0.5">
                  S/ {fichaOferta.precioNormal}
                </span>
                <span className="text-base font-black tracking-tight block">
                  S/ {fichaOferta.precioOferta}
                </span>
              </div>

              {/* Photo Thumbnails if multiple */}
              {fichaOferta.imagenes.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2 z-20">
                  {fichaOferta.imagenes.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setFotoActivaIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        fotoActivaIndex === idx ? 'bg-white w-6 shadow-sm' : 'bg-white/50 w-2'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Bottom Scrim Overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-12 text-white z-10">
                <span className="text-xs text-white/80 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {fichaOferta.distrito}, Lima · {fichaOferta.comercioNombre}
                </span>
              </div>
            </div>

            {/* Offer Body */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#78716C]">
                <span className="font-semibold text-[#1B4332]">{fichaOferta.categoria}</span>
                <span>Vence en: <strong>{new Date(fichaOferta.venceEn).toLocaleDateString()}</strong></span>
              </div>

              <h2 className="text-lg font-bold text-[#1C1917] leading-snug">
                {fichaOferta.titulo}
              </h2>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-[#1B4332]">
                  S/ {fichaOferta.precioOferta}
                </span>
                <span className="text-sm text-[#A8A29E] line-through">
                  S/ {fichaOferta.precioNormal}
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-[#D8F3DC] px-2 py-0.5 rounded-md">
                  Ahorras S/ {fichaOferta.precioNormal - fichaOferta.precioOferta}
                </span>
              </div>

              <p className="text-xs text-[#57534E] leading-relaxed pt-1">
                {fichaOferta.descripcion}
              </p>

              {/* Merchant Details & Map Pin */}
              <div className="bg-[#FBF9F4] rounded-2xl p-3.5 border border-[#EAE5D9] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C]">Comercio:</span>
                  <span className="font-bold text-[#1C1917]">{fichaOferta.comercioNombre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C]">Ubicación:</span>
                  <span className="font-medium text-[#1C1917] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1B4332]" />
                    {fichaOferta.distrito}, Lima
                  </span>
                </div>
                {fichaOferta.stock && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#78716C]">Stock disponible:</span>
                    <span className="font-medium text-emerald-700">{fichaOferta.stock} unidades</span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="space-y-2 pt-2">
                {estaVerificado ? (
                  <button
                    onClick={() => handleContactarOferta(fichaOferta)}
                    className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Lo quiero</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleContactarOferta(fichaOferta)}
                    className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300/80 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group/cta"
                  >
                    <Lock className="w-4 h-4 text-stone-500 group-hover/cta:text-stone-800" />
                    <span>Regístrate para 'Lo quiero'</span>
                  </button>
                )}

                {estaVerificado ? (
                  <button
                    onClick={() => handleCompartirOferta(fichaOferta)}
                    className="w-full py-2.5 bg-[#F5F2EB] hover:bg-[#EAE5D9] text-[#1C1917] rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#EAE5D9] transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{copiado ? '¡Enlace copiado!' : 'Lo comparto (+10 puntos)'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleCompartirOferta(fichaOferta)}
                    className="w-full py-2.5 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 border border-dashed border-stone-200 transition-all cursor-pointer group/cta"
                  >
                    <Lock className="w-3.5 h-3.5 text-stone-400 group-hover/cta:text-stone-600" />
                    <span>Regístrate para 'Lo comparto'</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registro de Usuario (F-AUD-01) */}
      {modalRegistroAbierto && (
        <div
          onClick={() => setModalRegistroAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EAE5D9] space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#1C1917]">Registro de Usuario</h3>
                <p className="text-xs text-[#78716C]">Únete a vuuy para pedir ofertas cercanas</p>
              </div>
              <button onClick={() => setModalRegistroAbierto(false)} className="text-[#78716C] hover:text-[#1C1917]">
                ✕
              </button>
            </div>

            {registroExitoso ? (
              <div className="space-y-3 py-2 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h4 className="font-bold text-sm text-[#1C1917]">¡Registro completado!</h4>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  Tu código de usuario para promociones es:
                </p>
                <div className="text-2xl font-mono font-bold tracking-widest text-[#1B4332] bg-[#D8F3DC] py-2 rounded-xl">
                  {registroExitoso.codigoVinculacion}
                </div>
                <p className="text-[11px] text-[#78716C]">
                  Guarda este código para canjear ofertas exclusivas y acumular puntos en comercios de tu distrito.
                </p>
                <button
                  onClick={() => setModalRegistroAbierto(false)}
                  className="w-full py-2.5 bg-[#1B4332] text-white rounded-xl text-xs font-bold hover:bg-[#2D6A4F] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Listo, explorar ofertas
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegistrarUsuarioSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Nombre</label>
                    <input
                      type="text"
                      required
                      value={formUser.nombre}
                      onChange={e => setFormUser({ ...formUser, nombre: e.target.value })}
                      placeholder="Ej. Rodrigo"
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Apellido</label>
                    <input
                      type="text"
                      required
                      value={formUser.apellido}
                      onChange={e => setFormUser({ ...formUser, apellido: e.target.value })}
                      placeholder="Ej. Salas"
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#57534E]">Número de WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={formUser.telefono}
                    onChange={e => setFormUser({ ...formUser, telefono: e.target.value })}
                    placeholder="+51 912 345 678"
                    className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#57534E]">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={formUser.email}
                    onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                    placeholder="nombre@gmail.com"
                    className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Distrito</label>
                    <select
                      value={formUser.distrito}
                      onChange={e => setFormUser({ ...formUser, distrito: e.target.value })}
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332] bg-white"
                    >
                      {DISTRITOS_LIMA.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Edad</label>
                    <input
                      type="number"
                      value={formUser.edad}
                      onChange={e => setFormUser({ ...formUser, edad: Number(e.target.value) })}
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  Completar Registro
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Registro de Comercio con RUC (F-COM-01) */}
      {modalRegistroComercioAbierto && (
        <div
          onClick={() => setModalRegistroComercioAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EAE5D9] space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#1C1917]">Registro de Negocio</h3>
                <p className="text-xs text-[#78716C]">Publica tus ofertas y recibe leads comerciales</p>
              </div>
              <button onClick={() => setModalRegistroComercioAbierto(false)} className="text-[#78716C] hover:text-[#1C1917]">
                ✕
              </button>
            </div>

            {registroComercioExitoso ? (
              <div className="space-y-3 py-2 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h4 className="font-bold text-sm text-[#1C1917]">Registro enviado a validación</h4>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  Gracias <strong>{registroComercioExitoso}</strong>. El equipo de administración revisará tu RUC y dirección física en menos de 24 horas. Recibirás la confirmación por correo para iniciar tus publicaciones.
                </p>
                <button
                  onClick={() => {
                    setModalRegistroComercioAbierto(false);
                    setRegistroComercioExitoso(null);
                  }}
                  className="w-full py-2.5 bg-[#1B4332] text-white rounded-xl text-xs font-bold hover:bg-[#2D6A4F]"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegistrarComercioSubmit} className="space-y-2.5">
                {errorComercio && (
                  <div className="p-2 bg-red-50 text-red-700 rounded-xl text-xs">
                    {errorComercio}
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-[#57534E]">RUC Obligatorio (11 dígitos)</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={formMerchant.ruc}
                    onChange={e => setFormMerchant({ ...formMerchant, ruc: e.target.value })}
                    placeholder="20601248951"
                    className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332] font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Nombre Comercial</label>
                    <input
                      type="text"
                      required
                      value={formMerchant.nombreComercial}
                      onChange={e => setFormMerchant({ ...formMerchant, nombreComercial: e.target.value })}
                      placeholder="Ej. Café Altura"
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Responsable</label>
                    <input
                      type="text"
                      required
                      value={formMerchant.contactoNombre}
                      onChange={e => setFormMerchant({ ...formMerchant, contactoNombre: e.target.value })}
                      placeholder="Ej. Ana Ramos"
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">WhatsApp Negocio</label>
                    <input
                      type="text"
                      required
                      value={formMerchant.telefono}
                      onChange={e => setFormMerchant({ ...formMerchant, telefono: e.target.value })}
                      placeholder="+51 987 654 321"
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#57534E]">Distrito del Local</label>
                    <select
                      value={formMerchant.distrito}
                      onChange={e => setFormMerchant({ ...formMerchant, distrito: e.target.value })}
                      className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332] bg-white"
                    >
                      {DISTRITOS_LIMA.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#57534E]">Dirección Física</label>
                  <input
                    type="text"
                    required
                    value={formMerchant.direccion}
                    onChange={e => setFormMerchant({ ...formMerchant, direccion: e.target.value })}
                    placeholder="Av. Larco 450, Miraflores"
                    className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#57534E]">Correo de Contacto</label>
                  <input
                    type="email"
                    required
                    value={formMerchant.email}
                    onChange={e => setFormMerchant({ ...formMerchant, email: e.target.value })}
                    placeholder="contacto@empresa.pe"
                    className="w-full p-2 text-xs border border-[#EAE5D9] rounded-xl focus:ring-1 focus:ring-[#1B4332]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  Enviar para Validación Manual
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Quiénes Somos */}
      {modalQuienesSomosAbierto && (
        <div
          onClick={() => setModalQuienesSomosAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EAE5D9] space-y-3 cursor-default"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-[#1C1917]">Quiénes Somos</h3>
              <button onClick={() => setModalQuienesSomosAbierto(false)} className="text-[#78716C] hover:text-[#1C1917] cursor-pointer">✕</button>
            </div>
            <p className="text-xs text-[#57534E] leading-relaxed">
              <strong>vuuy</strong> es un asistente sobre WhatsApp creado en Lima para conectar personas con oportunidades comerciales cercanas y alcanzables con un solo mensaje.
            </p>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Para los usuarios, es una forma rápida de encontrar ofertas reales y ganar puntos por compartir. Para los comercios, es un generador de leads calificados que tocan a su puerta listos para comprar.
            </p>
            <p className="text-xs font-semibold text-[#1B4332]">
              Regla del modelo: PULL, no push. Jamás enviamos ofertas no solicitadas.
            </p>
          </div>
        </div>
      )}

      {/* MODAL: Condiciones de Servicio */}
      {modalTerminosAbierto && (
        <div
          onClick={() => setModalTerminosAbierto(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EAE5D9] space-y-3 cursor-default"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-[#1C1917]">Condiciones de Servicio</h3>
              <button onClick={() => setModalTerminosAbierto(false)} className="text-[#78716C] hover:text-[#1C1917] cursor-pointer">✕</button>
            </div>
            <div className="text-xs text-[#57534E] space-y-2 max-h-60 overflow-y-auto leading-relaxed">
              <p>• <strong>Uso para Audiencia:</strong> El servicio es 100% gratuito. Los usuarios reciben ofertas solo cuando escriben "Oferta".</p>
              <p>• <strong>Comercios:</strong> Deben contar con RUC activo y local físico comprobable. Cada oferta tiene una vigencia máxima de 30 días.</p>
              <p>• <strong>Privacidad y Datos:</strong> vuuy nunca comparte los números de teléfono con terceros. El lead se completa únicamente cuando el usuario decide voluntariamente escribir por WhatsApp al comercio.</p>
              <p>• <strong>Bajas (Opt-out):</strong> El usuario puede darse de baja en cualquier momento escribiendo "baja" o "stop".</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Embudo Canónico de Registro con Atribución UTM y Verificación */}
      <UserRegistrationFunnelModal
        isOpen={modalFunnelAbierto}
        onClose={() => setModalFunnelAbierto(false)}
        onSuccess={(usuario) => {
          setUsuarioActivo(usuario);
          setToastVerificacion(`¡Cuenta verificada exitosamente! Bienvenido, ${usuario.nombre}. Ya puedes pedir ofertas por WhatsApp y compartir.`);
        }}
        ofertaObjetivo={ofertaObjetivoFunnel}
        motivo={motivoFunnel}
      />
    </div>
  );
};
