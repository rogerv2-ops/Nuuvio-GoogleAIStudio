import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Send, Server, Key, ShieldCheck, CheckCircle2, 
  AlertCircle, RefreshCw, Loader2, ExternalLink, Clock, Shield
} from 'lucide-react';
import { emailService, EmailConfigData, EmailLogEntry } from '../modules/emailService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useState<'smtp' | 'resend'>('smtp');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviandoTest, setEnviandoTest] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Campos SMTP
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('vuuy Ofertas');
  const [smtpFromEmail, setSmtpFromEmail] = useState('notificaciones@vuuy.pe');

  // Campos Resend
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('onboarding@resend.dev');
  const [resendFromName, setResendFromName] = useState('vuuy Ofertas');

  // Prueba y logs
  const [correoPrueba, setCorreoPrueba] = useState('');
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      cargarConfiguracion();
      cargarLogs();
    }
  }, [isOpen]);

  const cargarConfiguracion = async () => {
    try {
      setCargando(true);
      const conf = await emailService.obtenerConfiguracion();
      if (conf) {
        setProvider(conf.provider || 'smtp');
        if (conf.smtp) {
          setSmtpHost(conf.smtp.host || 'smtp.gmail.com');
          setSmtpPort(conf.smtp.port || 587);
          setSmtpSecure(!!conf.smtp.secure);
          setSmtpUser(conf.smtp.user || '');
          setSmtpFromName(conf.smtp.fromName || 'vuuy Ofertas');
          setSmtpFromEmail(conf.smtp.fromEmail || 'notificaciones@vuuy.pe');
        }
        if (conf.resend) {
          setResendFromEmail(conf.resend.fromEmail || 'onboarding@resend.dev');
          setResendFromName(conf.resend.fromName || 'vuuy Ofertas');
        }
      }
    } catch (e) {
      console.error('Error cargando configuración de correo:', e);
    } finally {
      setCargando(false);
    }
  };

  const cargarLogs = async () => {
    try {
      const data = await emailService.obtenerLogs();
      setLogs(data);
    } catch (e) {
      console.error('Error cargando logs:', e);
    }
  };

  if (!isOpen) return null;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGuardando(true);
      setMensajeEstado(null);

      const payload: EmailConfigData = {
        provider,
        smtp: {
          host: smtpHost,
          port: Number(smtpPort),
          secure: smtpSecure,
          user: smtpUser,
          pass: smtpPass,
          fromName: smtpFromName,
          fromEmail: smtpFromEmail
        },
        resend: {
          apiKey: resendApiKey,
          fromEmail: resendFromEmail,
          fromName: resendFromName
        }
      };

      const res = await emailService.guardarConfiguracion(payload);
      if (res.ok) {
        setMensajeEstado({ tipo: 'exito', texto: 'Configuración de correo guardada exitosamente.' });
      } else {
        setMensajeEstado({ tipo: 'error', texto: res.message || 'Error al guardar la configuración.' });
      }
    } catch (err: any) {
      setMensajeEstado({ tipo: 'error', texto: err.message || 'Error de conexión.' });
    } finally {
      setGuardando(false);
    }
  };

  const handleEnviarPrueba = async () => {
    if (!correoPrueba.trim()) {
      setMensajeEstado({ tipo: 'error', texto: 'Por favor ingresa un correo destinatario para la prueba.' });
      return;
    }

    try {
      setEnviandoTest(true);
      setMensajeEstado(null);
      const res = await emailService.enviarCorreoPrueba(correoPrueba.trim());
      if (res.ok) {
        setMensajeEstado({ tipo: 'exito', texto: res.message });
        cargarLogs();
      } else {
        setMensajeEstado({ tipo: 'error', texto: res.message || 'Error enviando correo de prueba.' });
      }
    } catch (err: any) {
      setMensajeEstado({ tipo: 'error', texto: err.message || 'Error en prueba de correo.' });
    } finally {
      setEnviandoTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-[620px] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
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
              <Mail className="w-3 h-3 text-emerald-300" />
              Servidor de Correo Transaccional
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
            Configuración de Envío de Correo
          </h3>

          <p className="text-xs text-stone-200 mt-1">
            Configura el despacho de correos reales de verificación de 1 clic e invitaciones a WhatsApp usando SMTP o Resend API.
          </p>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {mensajeEstado && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
              mensajeEstado.tipo === 'exito'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {mensajeEstado.tipo === 'exito' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{mensajeEstado.texto}</span>
            </div>
          )}

          {/* Selector de Proveedor */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-2">
              Proveedor de Correo Activo:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider('smtp')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  provider === 'smtp'
                    ? 'border-[#1B4332] bg-emerald-50/50 text-[#1B4332] shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs">
                  <Server className="w-4 h-4" />
                  <span>Servidor SMTP</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Gmail, Outlook, Zoho, Amazon SES, servidores corporativos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('resend')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  provider === 'resend'
                    ? 'border-[#1B4332] bg-emerald-50/50 text-[#1B4332] shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs">
                  <Key className="w-4 h-4" />
                  <span>Resend API</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Alta tasa de entrega vía API Key sin configurar puertos.
                </p>
              </button>
            </div>
          </div>

          <form onSubmit={handleGuardar} className="space-y-4">
            {provider === 'smtp' ? (
              <div className="space-y-3 bg-[#FBF9F4] p-4 rounded-2xl border border-[#EAE5D9]">
                <h4 className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-[#1B4332]" />
                  Parámetros SMTP (Nodemailer)
                </h4>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Host SMTP *</label>
                    <input
                      type="text"
                      placeholder="smtp.gmail.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Puerto</label>
                    <input
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Usuario / Email</label>
                    <input
                      type="text"
                      placeholder="notificaciones@vuuy.pe"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Contraseña de Aplicación</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Nombre Remitente</label>
                    <input
                      type="text"
                      placeholder="vuuy Ofertas"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Correo Remitente (From)</label>
                    <input
                      type="email"
                      placeholder="notificaciones@vuuy.pe"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="smtpSecureCheck"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="w-3.5 h-3.5 text-[#1B4332] rounded border-stone-300"
                  />
                  <label htmlFor="smtpSecureCheck" className="text-[11px] text-stone-600">
                    Usar SSL directo (normalmente puerto 465)
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-[#FBF9F4] p-4 rounded-2xl border border-[#EAE5D9]">
                <h4 className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#1B4332]" />
                  Parámetros Resend API
                </h4>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Resend API Key *</label>
                  <input
                    type="password"
                    placeholder="re_1234567890abcdef..."
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">Obtenida desde resend.com/api-keys</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Nombre Remitente</label>
                    <input
                      type="text"
                      placeholder="vuuy Ofertas"
                      value={resendFromName}
                      onChange={(e) => setResendFromName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Correo Remitente (From)</label>
                    <input
                      type="text"
                      placeholder="onboarding@resend.dev"
                      value={resendFromEmail}
                      onChange={(e) => setResendFromEmail(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-[#1B4332]"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Guardar Configuración de Correo</span>
            </button>
          </form>

          {/* Prueba de Envío */}
          <div className="pt-3 border-t border-stone-200 space-y-2.5">
            <h4 className="text-xs font-black text-stone-800">Prueba de Envío en Vivo</h4>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Ingresa correo para probar (ej. tu@gmail.com)"
                value={correoPrueba}
                onChange={(e) => setCorreoPrueba(e.target.value)}
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleEnviarPrueba}
                disabled={enviandoTest}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-60"
              >
                {enviandoTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Probar</span>
              </button>
            </div>
          </div>

          {/* Historial de Despachos Recientes */}
          <div className="pt-3 border-t border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-stone-800">Envíos Recientes ({logs.length})</h4>
              <button
                type="button"
                onClick={cargarLogs}
                className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Actualizar</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="text-[11px] text-stone-400 py-3 text-center bg-stone-50 rounded-xl border border-stone-100">
                Aún no hay registros de correos enviados en esta sesión.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-stone-900 truncate max-w-[200px] sm:max-w-xs">{log.to}</p>
                      <p className="text-[10px] text-stone-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span className="uppercase">{log.provider}</span>
                      </p>
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.status === 'entregado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.status === 'simulado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
