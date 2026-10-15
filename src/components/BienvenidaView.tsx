import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, MessageCircle, ExternalLink, ShieldAlert, ArrowRight, 
  Sparkles, Mail, Lock, ArrowLeft, RefreshCw, AlertTriangle
} from 'lucide-react';
import { AudienceUser } from '../types';
import { usuariosModule } from '../modules/usuarios';
import { abrirWhatsAppNativo } from '../utils/whatsappNative';

interface BienvenidaViewProps {
  onVolverAWeb: () => void;
  onAbrirRegistro: () => void;
  botPhone?: string;
}

export const BienvenidaView: React.FC<BienvenidaViewProps> = ({
  onVolverAWeb,
  onAbrirRegistro,
  botPhone = ''
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<AudienceUser | null>(null);
  const [estadoVerificacion, setEstadoVerificacion] = useState<'verificando' | 'valido' | 'invalido'>('verificando');
  const [activeBotPhone, setActiveBotPhone] = useState<string>(botPhone);

  useEffect(() => {
    // Cargar número dinámico de WhatsApp del servidor (código QR o respaldo)
    fetch('/api/whatsapp/config')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.botPhone) {
          setActiveBotPhone(data.botPhone);
        } else if (data.ok && data.wahaSession?.phone) {
          setActiveBotPhone(data.wahaSession.phone);
        }
      })
      .catch(err => console.warn('Error al obtener botPhone:', err));
  }, []);

  useEffect(() => {
    // 1. Extraer el token de verificación de la URL (?verify_token= o ?token=)
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('verify_token') || params.get('token');
    setToken(tokenParam);

    if (!tokenParam) {
      // No viene ningún token: la página NO es pública, debe ocultar el botón a WhatsApp
      setEstadoVerificacion('invalido');
      return;
    }

    // 2. Intentar validar el usuario mediante el token recibido (local + servidor)
    const verificarConServidor = async (tk: string) => {
      try {
        const res = await fetch(`/api/audience/verify-token?token=${encodeURIComponent(tk)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.user) {
            usuariosModule.agregarOActualizarUsuario(data.user);
            setUsuario(data.user);
            setEstadoVerificacion('valido');
            return;
          }
        }
      } catch (err) {
        console.warn('Error al verificar token con el servidor:', err);
      }
      setEstadoVerificacion('invalido');
    };

    const userVerified = usuariosModule.verificarPorToken(tokenParam);
    if (userVerified) {
      setUsuario(userVerified);
      setEstadoVerificacion('valido');
    } else {
      const usuarioExistente = usuariosModule.obtenerPorToken(tokenParam);
      if (usuarioExistente && usuarioExistente.emailVerificado) {
        setUsuario(usuarioExistente);
        setEstadoVerificacion('valido');
      } else {
        verificarConServidor(tokenParam);
      }
    }
  }, []);

  // Construir el enlace oficial a WhatsApp con la palabra exacta "Ofertas"
  const cleanPhone = (activeBotPhone || botPhone || '').replace(/\D/g, '');
  const nativeWhatsappUrl = cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent('Ofertas')}` : '#';
  const webWhatsappUrl = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent('Ofertas')}` : '#';

  const handleAbrirWhatsapp = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!cleanPhone) return;
    e.preventDefault();
    abrirWhatsAppNativo(cleanPhone, 'Ofertas');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[560px] bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera institucional de la marca */}
        <div className={`p-6 sm:p-8 text-white relative ${
          estadoVerificacion === 'valido' ? 'bg-[#1B4332]' : 'bg-stone-800'
        }`}>
          <div className="flex items-center justify-between gap-4 mb-3">
            <button
              onClick={onVolverAWeb}
              className="inline-flex items-center gap-1.5 text-xs text-stone-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a vuuy</span>
            </button>

            {estadoVerificacion === 'valido' && (
              <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                Acceso Verificado
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            {estadoVerificacion === 'verificando' && 'Verificando enlace...'}
            {estadoVerificacion === 'valido' && (
              <>¡Bienvenido a vuuy{usuario?.nombre ? `, ${usuario.nombre}` : ''}! 🎉</>
            )}
            {estadoVerificacion === 'invalido' && 'Acceso restringido'}
          </h1>

          <p className="text-xs sm:text-sm text-stone-300 mt-2 leading-relaxed">
            {estadoVerificacion === 'verificando' && 'Estamos validando tu enlace de confirmación oficial...'}
            {estadoVerificacion === 'valido' && 'Tu correo electrónico ha sido confirmado con éxito. Ya tienes acceso directo para pedir ofertas personalizadas.'}
            {estadoVerificacion === 'invalido' && 'Esta página está reservada exclusivamente para usuarios que acceden desde su enlace de verificación por correo.'}
          </p>
        </div>

        {/* Cuerpo del contenido según el estado de validación */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* ESTADO 1: VERIFICANDO */}
          {estadoVerificacion === 'verificando' && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#1B4332] animate-spin mx-auto" />
              <p className="text-xs font-bold text-stone-600">Comprobando token de verificación...</p>
            </div>
          )}

          {/* ESTADO 2: VÁLIDO (VIENE DE ENLACE DE VERIFICACIÓN) */}
          {estadoVerificacion === 'valido' && (
            <div className="space-y-6">
              {/* Badge y confirmación de cuenta activa */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-950">Correo Confirmado Exitosamente</p>
                  <p className="text-emerald-800 mt-0.5 leading-relaxed">
                    {usuario?.email 
                      ? `La cuenta vinculada a ${usuario.email} ya está activa en nuestro sistema.`
                      : 'Tu cuenta está activa en nuestro sistema.'}
                    {usuario?.distrito ? ` Distrito preferido: ${usuario.distrito}.` : ''}
                  </p>
                </div>
              </div>

              {/* Tarjeta Principal de WhatsApp con la palabra Ofertas */}
              <div className="bg-[#FBF9F4] border-2 border-emerald-500/30 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <MessageCircle className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-stone-900 leading-tight">
                      Pide tus ofertas en WhatsApp
                    </h2>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Canal oficial verificado con nuestro bot local
                    </p>
                  </div>
                </div>

                <p className="text-xs text-stone-700 leading-relaxed">
                  Haz clic en el botón a continuación para abrir WhatsApp. Se incluirá la palabra <strong>"Ofertas"</strong> preescrita; solo presiona enviar y te responderemos al instante con las promociones cercanas a ti.
                </p>

                {/* BOTÓN OFICIAL A WHATSAPP CON MENSAJE PREESCRITO "Ofertas" */}
                {cleanPhone ? (
                  <a
                    href={nativeWhatsappUrl}
                    onClick={handleAbrirWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 shadow-md shadow-emerald-900/10 hover:shadow-lg transition-all"
                  >
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>Abrir WhatsApp y enviar "Ofertas"</span>
                    <ExternalLink className="w-4 h-4 opacity-90" />
                  </a>
                ) : (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
                    <p className="text-xs font-bold text-amber-900">
                      WhatsApp en proceso de sincronización
                    </p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Conecta la cuenta de WhatsApp desde el <strong>Panel Admin</strong> escaneando el código QR para activar el bot en vivo.
                    </p>
                  </div>
                )}

                <div className="bg-white/80 border border-stone-200/80 rounded-xl p-3 flex items-center justify-between text-[11px] text-stone-600">
                  <span className="font-semibold">Mensaje preconfigurado:</span>
                  <span className="bg-emerald-100 text-[#1B4332] font-mono font-bold px-2.5 py-0.5 rounded-md">
                    "Ofertas"
                  </span>
                </div>
              </div>

              {/* Botón secundario para explorar ofertas web */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={onVolverAWeb}
                  className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Explorar ofertas en la web</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 3: INVÁLIDO O PÁGINA PÚBLICA */}
          {estadoVerificacion === 'invalido' && (
            <div className="space-y-6">
              {/* Tarjeta de Acceso Restringido */}
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <h2 className="font-bold text-amber-950 text-sm">Se requiere verificación previa por correo</h2>
                  <p className="text-amber-800 mt-1 leading-relaxed">
                    El botón directo a nuestro canal de WhatsApp está protegido y solo se activa para usuarios que hayan hecho clic en el enlace de confirmación enviado a su correo electrónico.
                  </p>
                </div>
              </div>

              {/* Instrucciones para el usuario */}
              <div className="bg-[#FBF9F4] border border-[#EAE5D9] rounded-2xl p-4 text-xs text-stone-700 space-y-2.5">
                <p className="font-bold text-stone-900 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#1B4332]" />
                  ¿Cómo desbloquear tu acceso a WhatsApp?
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-stone-600 pl-1 leading-relaxed">
                  <li>Si ya te registraste, busca el correo de <strong>vuuy</strong> en tu bandeja de entrada o spam.</li>
                  <li>Toca el botón <strong>"Confirmar mi correo"</strong> dentro de ese correo.</li>
                  <li>Ese enlace te redirigirá a esta página con tu botón oficial de WhatsApp desbloqueado.</li>
                </ol>
              </div>

              {/* Acciones para visitantes no registrados o sin token */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={onAbrirRegistro}
                  className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Mail className="w-4 h-4" />
                  <span>Registrarme gratis para recibir mi enlace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setUsuario({
                        id: 'dev_preview_user',
                        nombre: 'Usuario de Prueba',
                        apellido: 'Demo',
                        email: 'demo@vuuy.pe',
                        emailVerificado: true,
                        telefono: '+51 987 654 321',
                        edad: 28,
                        genero: 'No especificado',
                        ciudad: 'Lima',
                        provincia: 'Lima',
                        distrito: 'Miraflores',
                        categoriasInteres: ['Gastronomía y Café'],
                        puntosSaldo: 100,
                        codigoRef: 'DEMO01',
                        estado: 'activo',
                        consentimientos: { correo: true, push: true, whatsapp: true },
                        registradoEn: new Date().toISOString()
                      });
                      setEstadoVerificacion('valido');
                    }}
                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Probar Vista como Verificado</span>
                  </button>

                  <button
                    onClick={onVolverAWeb}
                    className="py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver a Ofertas Web</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
