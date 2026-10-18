import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, ShieldCheck, Mail, MessageCircle, 
  ExternalLink, ArrowRight, Sparkles, Tag, Gift, AlertCircle, Loader2, Check
} from 'lucide-react';
import { Offer, AudienceUser } from '../types';
import { usuariosModule } from '../modules/usuarios';
import { emailService } from '../modules/emailService';
import { obtenerAtribucionGuardada, AttributionData } from '../utils/attribution';
import { coreEvents } from '../core/events';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AudienceUser) => void;
  ofertaObjetivo?: Offer | null;
  motivo?: 'whatsapp' | 'compartir' | 'general';
}

const DISTRITOS_LIMA = [
  'Miraflores', 'San Isidro', 'Santiago de Surco', 'Barranco', 'San Borja',
  'Magdalena del Mar', 'Jesús María', 'Lince', 'San Miguel', 'Pueblo Libre',
  'Surquillo', 'La Molina', 'Los Olivos', 'Independencia', 'San Juan de Lurigancho',
  'San Juan de Miraflores', 'Chorrillos', 'Ate', 'Cercado de Lima'
];

function obtenerUrlProveedorCorreo(correo: string): string {
  const dominio = correo.split('@')[1]?.toLowerCase() || '';
  if (dominio.includes('gmail')) return 'https://mail.google.com';
  if (dominio.includes('outlook') || dominio.includes('hotmail') || dominio.includes('live')) return 'https://outlook.live.com';
  if (dominio.includes('yahoo')) return 'https://mail.yahoo.com';
  return `mailto:${correo}`;
}

export function limpiarYNormalizarTelefono(rawPhone: string, codigoPais: string = '+51'): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  const countryDigits = codigoPais.replace(/\D/g, '') || '51';
  
  if (digits.startsWith('00')) digits = digits.slice(2);
  
  // Si el usuario escribió el código de país repetido (ej: 5151987654321)
  if (digits.startsWith(`${countryDigits}${countryDigits}`) && digits.length >= 13) {
    digits = digits.slice(countryDigits.length);
  }
  
  // Si comienza con 0 y tiene 10 dígitos (ej: 0987654321)
  if (digits.startsWith('0') && digits.length === 10) {
    digits = digits.slice(1);
  }
  
  // Si el usuario ya incluyó el código de país (ej: 51987654321 para Perú)
  if (digits.startsWith(countryDigits) && digits.length >= (countryDigits.length + 8)) {
    return `+${countryDigits} ${digits.slice(countryDigits.length)}`;
  }
  
  // Si es un número local (ej: 987654321)
  if (digits.length >= 7) {
    return `+${countryDigits} ${digits}`;
  }
  
  return `+${countryDigits} ${digits}`;
}

const CODIGOS_PAIS = [
  { codigo: '+51', pais: 'Perú', bandera: '🇵🇪' },
  { codigo: '+57', pais: 'Colombia', bandera: '🇨🇴' },
  { codigo: '+52', pais: 'México', bandera: '🇲🇽' },
  { codigo: '+54', pais: 'Argentina', bandera: '🇦🇷' },
  { codigo: '+56', pais: 'Chile', bandera: '🇨🇱' },
  { codigo: '+34', pais: 'España', bandera: '🇪🇸' },
  { codigo: '+1', pais: 'EE.UU.', bandera: '🇺🇸' },
];

export const UserRegistrationFunnelModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  ofertaObjetivo,
  motivo = 'whatsapp'
}) => {
  const [atribucion, setAtribucion] = useState<AttributionData | null>(null);
  const [paso, setPaso] = useState<'formulario' | 'enviado'>('formulario');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [codigoPais, setCodigoPais] = useState('+51');
  const [telefono, setTelefono] = useState('');
  const [distrito, setDistrito] = useState('Miraflores');

  // Resultado
  const [usuarioRegistrado, setUsuarioRegistrado] = useState<AudienceUser | null>(null);
  const [verificationLink, setVerificationLink] = useState<string>('');
  const [whatsappLink, setWhatsappLink] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [esSimulado, setEsSimulado] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const data = obtenerAtribucionGuardada();
      setAtribucion(data);
      setPaso('formulario');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    const telefonoFinal = limpiarYNormalizarTelefono(telefono.trim(), codigoPais);

    try {
      setCargando(true);
      setError(null);

      // 1. Validar unicidad en servidor (base de datos Cloud SQL)
      try {
        const checkRes = await fetch('/api/audience/check-uniqueness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            telefono: telefonoFinal,
            nombre: `${nombre.trim()} ${apellido.trim()}`
          })
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists) {
            if (checkData.isEmailDuplicate) {
              setError('El correo electrónico ingresado ya se encuentra registrado. Por favor ingresa otro correo o inicia sesión.');
              setCargando(false);
              return;
            }
            if (checkData.isPhoneDuplicate) {
              setError('El número de WhatsApp ingresado ya se encuentra registrado. Por favor ingresa otro número o inicia sesión.');
              setCargando(false);
              return;
            }
          }
        }
      } catch (errCheck) {
        console.warn('Advertencia en verificación previa de unicidad:', errCheck);
      }

      // 2. Registrar usuario con atribución UTM y Referido (garantizando persistencia sincrónica en Cloud SQL)
      const regRes = await usuariosModule.registrarUsuarioAsync({
        nombre: nombre.trim(),
        apellido: apellido.trim() || 'U.',
        telefono: telefonoFinal,
        email: email.trim().toLowerCase(),
        edad: 28,
        genero: 'No especificado',
        distrito,
        categoriasInteres: ofertaObjetivo ? [ofertaObjetivo.categoria] : ['Gastronomía y Café', 'Servicios'],
        invitadoPor: atribucion?.afiliadoId,
        utm: atribucion ? {
          source: atribucion.utm_source,
          medium: atribucion.utm_medium,
          campaign: atribucion.utm_campaign,
          term: atribucion.utm_term,
          content: atribucion.utm_content
        } : undefined
      });

      setUsuarioRegistrado(regRes.usuario);
      setVerificationToken(regRes.verificationToken);

      // Enviar correo real (o en simulación dev si no hay SMTP configurado)
      const emailRes = await emailService.enviarCorreoVerificacion({
        email: regRes.usuario.email,
        nombre: regRes.usuario.nombre,
        verificationToken: regRes.verificationToken
      });

      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const vLink = emailRes.verificationLink || `${currentOrigin}/bienvenida?verify_token=${regRes.verificationToken}`;
      // El número del sistema nunca se expone: el enlace apunta al redirect público del servidor.
      const waLink = emailRes.whatsappLink || '/go/whatsapp';

      setVerificationLink(vLink);
      setWhatsappLink(waLink);
      setEsSimulado(!!emailRes.simulated);

      // Registrar evento de conversión completada
      coreEvents.emitir({
        tipoEvento: 'embudo_registro_completado',
        actorTipo: 'usuario',
        actorId: regRes.usuario.id,
        distrito,
        origen: 'web',
        datos: {
          email: regRes.usuario.email,
          motivo,
          ofertaId: ofertaObjetivo?.id,
          afiliadoId: atribucion?.afiliadoId,
          utm: atribucion
        }
      });

      setPaso('enviado');
    } catch (err: any) {
      console.error('Error registrando usuario:', err);
      setError(err.message || 'No se pudo completar el registro. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  const handleSimularClickVerificacion = () => {
    if (!verificationToken) return;
    const verifiedUser = usuariosModule.verificarPorToken(verificationToken);
    if (verifiedUser) {
      onSuccess(verifiedUser);
      onClose();
    }
  };

  const handleCopiarEnlace = () => {
    if (!verificationLink) return;
    navigator.clipboard?.writeText(verificationLink);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-[500px] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Verde Institucional */}
        <div className="bg-[#1B4332] text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              Acceso a Ofertas Exclusivas
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
            {paso === 'formulario' ? 'Regístrate para continuar' : '¡Casi listo! Revisa tu correo'}
          </h3>

          <p className="text-xs sm:text-sm text-stone-200 mt-1 leading-snug">
            {paso === 'formulario'
              ? (motivo === 'whatsapp'
                  ? 'Para pedir ofertas ("Lo quiero") y desbloquear promociones necesitas registrarte previamente.'
                  : 'Para compartir ofertas ("Lo comparto") con tu enlace de referidos y sumar puntos, completa tu registro gratuito.')
              : `Hemos despachado tu invitación oficial a ${email}.`}
          </p>

          {/* Banner de Atribución si viene de referido o campaña */}
          {paso === 'formulario' && (atribucion?.afiliadoId || atribucion?.utm_campaign) && (
            <div className="mt-3 bg-white/10 rounded-xl p-2.5 flex items-center justify-between text-xs border border-white/15">
              {atribucion?.afiliadoId && (
                <div className="flex items-center gap-1.5 text-emerald-200">
                  <Gift className="w-3.5 h-3.5 shrink-0" />
                  <span>Invitado por: <strong>{atribucion.afiliadoId}</strong> (+50 pts)</span>
                </div>
              )}
              {atribucion?.utm_campaign && (
                <div className="flex items-center gap-1 text-stone-300 text-[11px]">
                  <Tag className="w-3 h-3" />
                  <span>Campaña: {atribucion.utm_campaign}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {paso === 'formulario' ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {ofertaObjetivo && (
                <div className="bg-[#FBF9F4] p-3 rounded-2xl border border-[#EAE5D9] flex items-center gap-3">
                  <img
                    src={ofertaObjetivo.imagenes[0]}
                    alt={ofertaObjetivo.titulo}
                    className="w-12 h-12 object-cover rounded-xl shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-[#1B4332] truncate">{ofertaObjetivo.comercioNombre}</p>
                    <p className="text-xs font-semibold text-stone-800 truncate">{ofertaObjetivo.titulo}</p>
                    <p className="text-xs font-black text-[#FF5722]">S/ {ofertaObjetivo.precioOferta}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Rodrigo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Apellido</label>
                  <input
                    type="text"
                    placeholder="Ej. Vargas"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Correo Electrónico *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="tu.correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">Recibirás un enlace de 1 clic para confirmar tu cuenta.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">WhatsApp / Celular *</label>
                <div className="flex gap-1.5">
                  <select
                    value={codigoPais}
                    onChange={(e) => setCodigoPais(e.target.value)}
                    className="px-2 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
                  >
                    {CODIGOS_PAIS.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.bandera} {c.codigo}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <MessageCircle className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      placeholder="987 654 321"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Código de país preconfigurado: <span className="font-bold text-[#1B4332]">{codigoPais}</span> ({CODIGOS_PAIS.find(c => c.codigo === codigoPais)?.pais}).
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Distrito de Lima *</label>
                <select
                  value={distrito}
                  onChange={(e) => setDistrito(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
                >
                  {DISTRITOS_LIMA.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
                >
                  {cargando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando registro...</span>
                    </>
                  ) : (
                    <>
                      <span>Crear cuenta y recibir ofertas</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-stone-500">
                Al registrarte aceptas los Términos de Servicio de Yuudit. Modelo PULL, no push: cero spam.
              </p>
            </form>
          ) : (
            /* PASO 2: Confirmación y Enlace de 1 Clic */
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-[#1B4332]">
                <Mail className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-base font-black text-stone-900">
                  Enlace de confirmación enviado
                </h4>
                <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
                  Enviamos un correo a <strong>{email}</strong> con tu enlace de verificación instantánea y la invitación oficial a WhatsApp.
                </p>
              </div>

              {/* Tarjeta de Pasos Siguientes */}
              <div className="bg-[#FBF9F4] border border-[#EAE5D9] rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#1B4332] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-800">Verifica tu correo con 1 solo clic</p>
                    <p className="text-[11px] text-stone-500 leading-snug">
                      Abre el correo que te enviamos y toca el botón <strong>"Confirmar mi correo"</strong> para activar tu cuenta de inmediato.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#2D6A4F] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-800">Página de bienvenida y WhatsApp</p>
                    <p className="text-[11px] text-stone-500 leading-snug">
                      Al confirmar tu correo serás llevado a la página de bienvenida con el enlace a nuestro WhatsApp y podrás pedir las ofertas cercanas a ti con solo enviar la palabra <strong>"Ofertas"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón principal: Abrir o revisar su correo */}
              <a
                href={obtenerUrlProveedorCorreo(email)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Mail className="w-4 h-4" />
                <span>Abrir mi correo para confirmar</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              {/* Simulador de Verificación para pruebas rápidas / modo de desarrollo */}
              <div className="pt-2 border-t border-stone-200/80 space-y-2">
                <p className="text-[10px] text-stone-500 uppercase font-bold tracking-wider text-center">
                  Acceso directo de prueba (1 Clic)
                </p>
                <button
                  onClick={() => {
                    if (!verificationToken) return;
                    const verifiedUser = usuariosModule.verificarPorToken(verificationToken);
                    if (verifiedUser) {
                      onSuccess(verifiedUser);
                      onClose();
                      if (typeof window !== 'undefined') {
                        window.location.href = `/bienvenida?verify_token=${verificationToken}`;
                      }
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#1B4332] border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Simular clic en el enlace del correo (abrir página de bienvenida)</span>
                </button>

                {verificationLink && (
                  <button
                    onClick={handleCopiarEnlace}
                    className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1 mx-auto"
                  >
                    {copiadoLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    <span>{copiadoLink ? '¡Enlace copiado al portapapeles!' : 'Copiar enlace directo de verificación'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
