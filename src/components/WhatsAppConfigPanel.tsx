import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, QrCode, Shield, CheckCircle2, AlertCircle, RefreshCw, 
  Copy, Check, Send, ExternalLink, Key, Phone, Globe, Server, 
  HelpCircle, Eye, EyeOff, Save, Sparkles, Activity, Layers, LogOut,
  Smartphone
} from 'lucide-react';
import { WahaQrModal } from './WahaQrModal';
import { confirmar, alerta } from './common/ConfirmModal';

interface WhatsAppConfigData {
  modoActivo: 'meta' | 'waha';
  numeroTelefono?: string;
  metaConfig: {
    phoneNumberId: string;
    wabaId: string;
    accessToken: string;
    verifyToken: string;
    webhookUrl: string;
    // El servidor NO devuelve los secretos (hallazgo R1-001): solo dice si hay.
    // Por eso accessToken/verifyToken llegan vacios y su valor guardado se
    // conserva al guardar (el servidor ignora el campo vacio).
    hasAccessToken?: boolean;
    hasVerifyToken?: boolean;
  };
  wahaConfig: {
    endpointUrl: string;
    apiKey: string;
    sessionName: string;
    webhookUrl: string;
    hasApiKey?: boolean;
  };
}

interface MessageLogItem {
  id: string;
  timestamp: string;
  canal: 'meta' | 'waha';
  direccion: 'entrante' | 'saliente';
  telefono: string;
  contenido: string;
  estado: 'entregado' | 'fallido' | 'recibido';
  detalles?: string;
}

export const WhatsAppConfigPanel: React.FC = () => {
  const [modoSeleccionado, setModoSeleccionado] = useState<'meta' | 'waha'>('waha');
  const [config, setConfig] = useState<WhatsAppConfigData>({
    modoActivo: 'waha',
    metaConfig: {
      phoneNumberId: '',
      wabaId: '',
      accessToken: '',
      verifyToken: '',
      webhookUrl: '/api/whatsapp/webhook'
    },
    wahaConfig: {
      endpointUrl: 'http://localhost:3000/api/waha',
      apiKey: '',
      sessionName: 'default',
      webhookUrl: '/api/waha/webhook'
    }
  });

  const [wahaSessionStatus, setWahaSessionStatus] = useState<{
    status: string;
    phone: string | null;
    name: string | null;
  }>({
    status: 'STOPPED',
    phone: null,
    name: null
  });

  const [modalQrAbierto, setModalQrAbierto] = useState(false);
  const [mostrarToken, setMostrarToken] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [copiadoWebhook, setCopiadoWebhook] = useState(false);

  // Estados para envío de mensaje de prueba
  const [testTelefono, setTestTelefono] = useState('+51 987 654 321');
  const [testMensaje, setTestMensaje] = useState('¡Hola! Este es un mensaje de prueba desde Yuddit para verificar la conexión de WhatsApp.');
  const [enviandoTest, setEnviandoTest] = useState(false);
  const [resultadoTest, setResultadoTest] = useState<{ ok: boolean; mensaje: string } | null>(null);

  // Historial de eventos
  const [logs, setLogs] = useState<MessageLogItem[]>([]);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  // Cargar configuración inicial del servidor Express
  const cargarConfiguracion = async () => {
    try {
      const res = await fetch('/api/whatsapp/config');
      const data = await res.json();
      if (data.ok && data.config) {
        // Los secretos ya no viajan (R1-001): sus campos llegan vacios y el
        // servidor conserva lo guardado. Se normaliza para que los inputs
        // controlados nunca reciban undefined.
        setConfig({
          ...data.config,
          metaConfig: { accessToken: '', verifyToken: '', ...data.config.metaConfig },
          wahaConfig: { apiKey: '', ...data.config.wahaConfig }
        });
        setModoSeleccionado(data.config.modoActivo);
        if (data.wahaSession) {
          setWahaSessionStatus(data.wahaSession);
        }
      }
    } catch (e) {
      console.error('Error cargando configuración de WhatsApp:', e);
    }
  };

  // Cargar logs de mensajes
  const cargarLogs = async () => {
    setCargandoLogs(true);
    try {
      const res = await fetch('/api/whatsapp/logs');
      const data = await res.json();
      if (data.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Error cargando logs:', e);
    } finally {
      setCargandoLogs(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
    cargarLogs();
    const interval = setInterval(() => {
      cargarLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Guardar configuración en el servidor Express
  const handleGuardarConfig = async (modoForzado?: 'meta' | 'waha') => {
    setGuardando(true);
    const nuevoModo = modoForzado || modoSeleccionado;

    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modoActivo: nuevoModo,
          numeroTelefono: config.numeroTelefono,
          // Solo los campos del contrato: las banderas has* son de lectura y un
          // secreto vacio significa "no lo cambio" (el servidor conserva el
          // guardado). Mandar hasAccessToken ensuciaria la configuracion.
          metaConfig: {
            phoneNumberId: config.metaConfig.phoneNumberId,
            wabaId: config.metaConfig.wabaId,
            webhookUrl: config.metaConfig.webhookUrl,
            accessToken: config.metaConfig.accessToken,
            verifyToken: config.metaConfig.verifyToken
          },
          wahaConfig: {
            endpointUrl: config.wahaConfig.endpointUrl,
            sessionName: config.wahaConfig.sessionName,
            webhookUrl: config.wahaConfig.webhookUrl,
            apiKey: config.wahaConfig.apiKey
          }
        })
      });
      const data = await res.json();
      if (data.ok) {
        setConfig({
          ...data.config,
          metaConfig: { accessToken: '', verifyToken: '', ...data.config.metaConfig },
          wahaConfig: { apiKey: '', ...data.config.wahaConfig }
        });
        setMensajeExito(`Configuración guardada exitosamente. Modo activo: ${nuevoModo.toUpperCase()}`);
        setTimeout(() => setMensajeExito(null), 4000);
      }
    } catch (e) {
      console.error('Error guardando configuración:', e);
      await alerta({ titulo: 'Error al guardar', mensaje: 'Error guardando la configuración de WhatsApp.', tono: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  // Enviar mensaje de prueba
  const handleEnviarTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoTest(true);
    setResultadoTest(null);

    try {
      const res = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: testTelefono,
          texto: testMensaje
        })
      });
      const data = await res.json();
      if (data.ok) {
        setResultadoTest({ ok: true, mensaje: data.mensaje });
        cargarLogs();
      } else {
        setResultadoTest({ ok: false, mensaje: data.error || 'Error al enviar mensaje' });
      }
    } catch (e) {
      setResultadoTest({ ok: false, mensaje: 'Error de conexión con el servidor.' });
    } finally {
      setEnviandoTest(false);
    }
  };

  // Desconectar sesión WAHA
  const handleDesconectarWaha = async () => {
    const confirmado = await confirmar({
      titulo: 'Desconectar WhatsApp',
      mensaje: '¿Deseas desconectar la sesión de WhatsApp vinculada en WAHA?',
      textoConfirmar: 'Desconectar',
      tono: 'aviso'
    });
    if (!confirmado) return;
    try {
      await fetch('/api/waha/session/logout', { method: 'POST' });
      setWahaSessionStatus({ status: 'STOPPED', phone: null, name: null });
      setMensajeExito('Sesión de WAHA desconectada.');
      setTimeout(() => setMensajeExito(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const getWebhookUrlCompleta = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yuddit.com';
    return `${origin}${modoSeleccionado === 'meta' ? config.metaConfig.webhookUrl : config.wahaConfig.webhookUrl}`;
  };

  const handleCopiarWebhook = () => {
    navigator.clipboard.writeText(getWebhookUrlCompleta());
    setCopiadoWebhook(true);
    setTimeout(() => setCopiadoWebhook(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal del Módulo */}
      <div className="bg-gradient-to-br from-[#1B4332] to-[#0A2016] text-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-[#25D366]">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Conectividad de Mensajería & Webhooks</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
              Gestor de Conexión a WhatsApp
            </h2>
            <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed font-normal">
              Configura el canal de comunicación en vivo para responder solicitudes de usuarios y publicar ofertas. 
              Soporta la <strong>API Oficial de Meta Cloud</strong> para producción empresarial y <strong>WAHA con código QR</strong> para pruebas y despliegue rápido.
            </p>
          </div>

          {/* Tarjeta de Estado del Modo Activo */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex flex-col justify-between shrink-0 min-w-[240px]">
            <div>
              <span className="text-[11px] font-medium text-stone-300">Modo Activo en Servidor</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-black text-white uppercase tracking-tight">
                  {config.modoActivo === 'meta' ? 'Meta Cloud API' : 'WAHA (Código QR)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-300 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  config.modoActivo === 'waha' && wahaSessionStatus.status === 'WORKING'
                    ? 'bg-emerald-400 animate-pulse'
                    : config.modoActivo === 'meta' && config.metaConfig.phoneNumberId
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`} />
                <span>
                  {config.modoActivo === 'waha' 
                    ? (wahaSessionStatus.status === 'WORKING' ? `Conectado (${wahaSessionStatus.phone || 'OK'})` : 'Requiere vincular QR')
                    : (config.metaConfig.phoneNumberId ? 'Configurado' : 'Pendiente de credenciales')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleGuardarConfig(config.modoActivo === 'meta' ? 'waha' : 'meta')}
              className="mt-3 w-full py-1.5 px-3 bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold rounded-xl transition-colors text-center"
            >
              Cambiar a {config.modoActivo === 'meta' ? 'Modo WAHA (QR)' : 'Modo Meta Oficial'}
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de Éxito */}
      {mensajeExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{mensajeExito}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setMensajeExito(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Selector de Pestañas: Meta Cloud API vs WAHA */}
      <div className="flex border-b border-stone-200">
        <button
          type="button"
          onClick={() => setModoSeleccionado('waha')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            modoSeleccionado === 'waha'
              ? 'border-[#1B4332] text-[#1B4332]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>WAHA (Conexión QR / Pruebas)</span>
          {config.modoActivo === 'waha' && (
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
              Activo
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setModoSeleccionado('meta')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            modoSeleccionado === 'meta'
              ? 'border-[#1B4332] text-[#1B4332]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Meta Cloud API Oficial</span>
          {config.modoActivo === 'meta' && (
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
              Activo
            </span>
          )}
        </button>
      </div>

      {/* ================= CONTENIDO DE CONFIGURACIÓN ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: FORMULARIOS DE CONFIGURACIÓN (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* ================= PESTAÑA 1: WAHA (QR CODE) ================= */}
          {modoSeleccionado === 'waha' && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">
                      Configuración de WAHA (WhatsApp HTTP API)
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Conecta cualquier número escaneando un código QR sin costo de API
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                  Puerto 3000 / Proxy
                </span>
              </div>

              {/* Tarjeta de Estado de la Sesión QR */}
              <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                    wahaSessionStatus.status === 'WORKING' ? 'bg-[#25D366]' : 'bg-stone-400'
                  }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800">
                        {wahaSessionStatus.status === 'WORKING'
                          ? `Conectado: ${wahaSessionStatus.phone || '+51 987 654 321'}`
                          : 'Sesión no vinculada'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        wahaSessionStatus.status === 'WORKING'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {wahaSessionStatus.status === 'WORKING' ? 'En Línea' : 'Requiere QR'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {wahaSessionStatus.status === 'WORKING'
                        ? 'La instancia de WhatsApp Web está lista para enviar y recibir mensajes.'
                        : 'Abre el modal para escanear el código QR con tu WhatsApp móvil.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalQrAbierto(true)}
                    className="px-4 py-2 bg-[#1B4332] hover:bg-[#153427] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>{wahaSessionStatus.status === 'WORKING' ? 'Ver Código QR' : 'Conectar con Código QR'}</span>
                  </button>

                  {wahaSessionStatus.status === 'WORKING' && (
                    <button
                      type="button"
                      onClick={handleDesconectarWaha}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Desconectar sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Campos de configuración WAHA */}
              <div className="space-y-4 pt-1">
                <div className="space-y-1 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80">
                  <label className="text-xs font-bold text-[#1B4332] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Número Telefónico de Respaldo / Oficial</span>
                  </label>
                  <input
                    type="text"
                    value={config.numeroTelefono || ""}
                    onChange={e => setConfig({ ...config, numeroTelefono: e.target.value })}
                    placeholder="Ej: 51912345678"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                  />
                  <p className="text-[11px] text-stone-500">
                    Se utilizará automáticamente si no hay una sesión de código QR vinculada activamente.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">URL del Endpoint de WAHA</label>
                  <input
                    type="text"
                    value={config.wahaConfig.endpointUrl}
                    onChange={e => setConfig({
                      ...config,
                      wahaConfig: { ...config.wahaConfig, endpointUrl: e.target.value }
                    })}
                    placeholder="http://localhost:3000/api/waha"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                  />
                  <p className="text-[11px] text-stone-400">
                    El backend Express en server.ts actúa como proxy transparente para la sesión de WAHA.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Nombre de la Sesión</label>
                    <input
                      type="text"
                      value={config.wahaConfig.sessionName}
                      onChange={e => setConfig({
                        ...config,
                        wahaConfig: { ...config.wahaConfig, sessionName: e.target.value }
                      })}
                      placeholder="default"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">API Key de WAHA (Opcional)</label>
                    <input
                      type="password"
                      value={config.wahaConfig.apiKey}
                      onChange={e => setConfig({
                        ...config,
                        wahaConfig: { ...config.wahaConfig, apiKey: e.target.value }
                      })}
                      placeholder={config.wahaConfig.hasApiKey ? 'API Key guardada. Deja el campo vacio para no cambiarla.' : 'Sin API Key de WAHA'}
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Guardado */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  Cambios aplicados de inmediato en el servidor Express.
                </span>
                <button
                  type="button"
                  onClick={() => handleGuardarConfig('waha')}
                  disabled={guardando}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#153427] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{guardando ? 'Guardando...' : 'Activar y Guardar Modo WAHA'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= PESTAÑA 2: META CLOUD API OFICIAL ================= */}
          {modoSeleccionado === 'meta' && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">
                      Meta Cloud API (WhatsApp Business Platform)
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Conexión oficial de nivel empresarial respaldada por Meta for Developers
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                  Oficial / Meta Graph
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Phone Number ID (Meta)</label>
                    <input
                      type="text"
                      value={config.metaConfig.phoneNumberId}
                      onChange={e => setConfig({
                        ...config,
                        metaConfig: { ...config.metaConfig, phoneNumberId: e.target.value }
                      })}
                      placeholder="109283746592019"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">WhatsApp Business Account ID (WABA)</label>
                    <input
                      type="text"
                      value={config.metaConfig.wabaId}
                      onChange={e => setConfig({
                        ...config,
                        metaConfig: { ...config.metaConfig, wabaId: e.target.value }
                      })}
                      placeholder="293847561029384"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-700">Token de Acceso Permanente (System User Token)</label>
                    <button
                      type="button"
                      onClick={() => setMostrarToken(!mostrarToken)}
                      className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium"
                    >
                      {mostrarToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{mostrarToken ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={mostrarToken ? 'text' : 'password'}
                    value={config.metaConfig.accessToken}
                    onChange={e => setConfig({
                      ...config,
                      metaConfig: { ...config.metaConfig, accessToken: e.target.value }
                    })}
                    placeholder={config.metaConfig.hasAccessToken ? 'Token guardado. Deja el campo vacio para no cambiarlo.' : 'Sin token de Meta'}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Verify Token de Webhook (hub.verify_token)</label>
                  <input
                    type="text"
                    value={config.metaConfig.verifyToken}
                    onChange={e => setConfig({
                      ...config,
                      metaConfig: { ...config.metaConfig, verifyToken: e.target.value }
                    })}
                    placeholder={config.metaConfig.hasVerifyToken ? 'Verify token guardado. Deja el campo vacio para no cambiarlo.' : 'Sin verify token'}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                  />
                  <p className="text-[11px] text-stone-400">
                    Ingresa este mismo token en el panel de Meta for Developers al configurar el webhook.
                  </p>
                </div>
              </div>

              {/* Botón de Guardado Meta */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  Ruta del webhook verificada: /api/whatsapp/webhook
                </span>
                <button
                  type="button"
                  onClick={() => handleGuardarConfig('meta')}
                  disabled={guardando}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{guardando ? 'Guardando...' : 'Activar y Guardar Modo Meta'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= CAJA DE URL DE WEBHOOK (COMPARTIDA) ================= */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                  URL Pública del Webhook ({modoSeleccionado.toUpperCase()})
                </h4>
              </div>
              <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                HTTPS
              </span>
            </div>

            <p className="text-xs text-stone-500">
              Copia esta URL y configúrala en el panel de Meta o en tu instancia de WAHA para recibir eventos de mensajes:
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={getWebhookUrlCompleta()}
                className="flex-1 px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 font-mono text-xs text-stone-800 select-all"
              />
              <button
                type="button"
                onClick={handleCopiarWebhook}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiadoWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiadoWebhook ? 'Copiado' : 'Copiar URL'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: PRUEBA DE MENSAJERÍA & LOGS (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Tarjeta de Envío de Mensaje de Prueba */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#25D366]" />
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Prueba de Conectividad en Vivo
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md">
                Modo: {config.modoActivo.toUpperCase()}
              </span>
            </div>

            <form onSubmit={handleEnviarTest} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Número de Destino (+51...)</label>
                <input
                  type="text"
                  value={testTelefono}
                  onChange={e => setTestTelefono(e.target.value)}
                  placeholder="+51 987 654 321"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Contenido del Mensaje</label>
                <textarea
                  rows={3}
                  value={testMensaje}
                  onChange={e => setTestMensaje(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 resize-none"
                />
              </div>

              {resultadoTest && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  resultadoTest.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {resultadoTest.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                  <span>{resultadoTest.mensaje}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={enviandoTest}
                className="w-full py-2.5 px-4 bg-[#1B4332] hover:bg-[#153427] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{enviandoTest ? 'Despachando Mensaje...' : 'Enviar Mensaje de Prueba'}</span>
              </button>
            </form>
          </div>

          {/* Tarjeta de Logs de Webhooks & Mensajes en Tiempo Real */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-[#0F172A]">Eventos de Mensajería</h4>
              </div>
              <button
                type="button"
                onClick={cargarLogs}
                className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${cargandoLogs ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin text-xs">
              {logs.length === 0 ? (
                <div className="text-center py-6 text-stone-400">
                  No hay mensajes registrados aún en el servidor.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-bold px-1.5 py-0.2 rounded uppercase ${
                        log.canal === 'waha' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {log.canal} · {log.direccion}
                      </span>
                      <span className="text-stone-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="font-mono text-[11px] text-stone-800 font-bold">
                      {log.telefono}
                    </div>

                    <p className="text-stone-600 text-[11px] leading-relaxed">
                      "{log.contenido}"
                    </p>

                    {log.detalles && (
                      <span className="text-[10px] text-stone-400 block italic">
                        {log.detalles}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modal Interactivo de Código QR WAHA */}
      <WahaQrModal
        isOpen={modalQrAbierto}
        onClose={() => setModalQrAbierto(false)}
        onSessionConnected={phone => {
          setWahaSessionStatus({ status: 'WORKING', phone, name: 'Yuddit WhatsApp Oficial' });
          cargarLogs();
        }}
      />
    </div>
  );
};
