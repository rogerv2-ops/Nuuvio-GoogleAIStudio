import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings, MessageCircle, Mail, Globe, Clock, 
  ToggleLeft, ToggleRight, Shield, Sparkles, CheckCircle2, 
  ExternalLink, Save, RefreshCw, Key, Eye, EyeOff, Lock, UserPlus, Server, Images,
  Trash2, Pencil, ShieldCheck
} from 'lucide-react';
import { WhatsAppConfigPanel } from '../../WhatsAppConfigPanel';
import { EmailConfigModal } from '../../EmailConfigModal';
import { SeoMetadataEditor } from '../../SeoMetadataEditor';
import { ProveedoresIaView } from './ProveedoresIaView';
import { BannersConfigView } from './BannersConfigView';
import { coreConfig } from '../../../core/config';
import { coreSecurity } from '../../../core/security';
import { coreEvents } from '../../../core/events';

interface ConfiguracionDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const ConfiguracionDomainView: React.FC<ConfiguracionDomainViewProps> = ({ subruta, onNavegar }) => {
  const [version, setVersion] = useState(0);
  const [modalEmailAbierto, setModalEmailAbierto] = useState(false);
  const [modeloIa, setModeloIa] = useState(() => coreConfig.obtenerValor('modelo_ia', 'gemini-2.5-flash'));
  const [radioCercania, setRadioCercania] = useState(() => Number(coreConfig.obtenerValor('radio_cercania_km', 5)));
  const [guardadoIa, setGuardadoIa] = useState(false);

  useEffect(() => {
    const unsub = coreConfig.suscribir(() => setVersion(v => v + 1));
    return () => unsub();
  }, []);

  const flags = useMemo(() => coreConfig.getFlags(), [version]);
  const eventosLog = useMemo(() => coreEvents.consultar({ limite: 40 }), [version]);
  const logsAuditoria = useMemo(() => coreSecurity.getAuditLogs(), [version]);
  const sesion = coreSecurity.getSesionActual();

  // Estados de gestión de credenciales y variables de entorno
  const [credenciales, setCredenciales] = useState(() => coreSecurity.listarCredenciales());
  const [usuarioEditarEmail, setUsuarioEditarEmail] = useState<string | null>(null);
  const [nuevaPasswordInput, setNuevaPasswordInput] = useState('');
  const [verPassword, setVerPassword] = useState<Record<string, boolean>>({});
  const [mensajeSeguridad, setMensajeSeguridad] = useState<{ ok: boolean; texto: string } | null>(null);

  // Edición de datos de usuario (nombre/rol/descripción/merchant)
  const [usuarioEditarDatos, setUsuarioEditarDatos] = useState<string | null>(null);
  const [formEditarDatos, setFormEditarDatos] = useState<{
    nombre: string;
    rol: 'admin' | 'operador' | 'comercio';
    descripcion: string;
    merchantId: string;
  }>({ nombre: '', rol: 'admin', descripcion: '', merchantId: '' });

  // Logs de seguridad del servidor (tabla security_logs)
  const [logsSeguridad, setLogsSeguridad] = useState<Array<{
    id: string; accion: string; entidad: string; entidadId: string;
    detalles: string; createdAt: string; operadorNombre: string;
  }>>([]);

  // Cambio de la propia contraseña (autoservicio)
  const [miPassword, setMiPassword] = useState('');
  const [miPasswordMsg, setMiPasswordMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // Segundo factor (MFA / TOTP)
  const [mfaEstado, setMfaEstado] = useState<{ habilitado: boolean; disponible: boolean } | null>(null);
  const [mfaCargando, setMfaCargando] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string; qrDataUrl?: string } | null>(null);
  const [mfaCodigo, setMfaCodigo] = useState('');
  const [mfaCodigoDesactivar, setMfaCodigoDesactivar] = useState('');
  const [mfaMensaje, setMfaMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [mfaCodigosRespaldo, setMfaCodigosRespaldo] = useState<string[] | null>(null);

  // Estados de nueva credencial
  const [modalNuevoUsuarioAbierto, setModalNuevoUsuarioAbierto] = useState(false);
  const [nuevoUsuarioForm, setNuevoUsuarioForm] = useState({
    nombre: '',
    email: '',
    contrasena: '',
    rol: 'admin' as 'admin' | 'operador' | 'comercio',
    descripcion: ''
  });

  // Estados de Variables de Entorno del Sistema
  const [envVars, setEnvVars] = useState({
    geminiKeyConfigured: true,
    whatsappActiveMode: coreConfig.obtenerValor('conector_whatsapp', 'WAHA (Pruebas / Local)'),
    appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://nuuvio.ai.studio',
    puerto: 3000
  });

  useEffect(() => {
    const unsubSec = coreSecurity.suscribir(() => {
      setCredenciales(coreSecurity.listarCredenciales());
    });
    coreSecurity.cargarCredenciales().then(setCredenciales).catch(() => undefined);
    return () => unsubSec();
  }, []);

  // Subrutas
  const esWhatsapp = subruta === '/gestion/configuracion/whatsapp';
  const esCorreo = subruta === '/gestion/configuracion/correo';
  const esSeo = subruta === '/gestion/configuracion/seo';
  const esBanners = subruta === '/gestion/configuracion/banners';
  const esAuditoria = subruta === '/gestion/configuracion/auditoria';
  const esGeneral = subruta === '/gestion/configuracion/general';
  const esSeguridad = subruta === '/gestion/configuracion/seguridad';
  const esAgentes = subruta === '/gestion/configuracion/agentes';
  const esResumen = !esWhatsapp && !esCorreo && !esSeo && !esBanners && !esAuditoria && !esGeneral && !esSeguridad && !esAgentes;

  useEffect(() => {
    if (esAuditoria) {
      coreSecurity.cargarLogsSeguridad(150).then(setLogsSeguridad).catch(() => undefined);
    }
  }, [subruta]);

  useEffect(() => {
    if (esSeguridad) {
      coreSecurity
        .obtenerEstadoMfa()
        .then((r) => {
          if (r.ok) setMfaEstado({ habilitado: !!r.habilitado, disponible: r.disponible !== false });
        })
        .catch(() => undefined);
    }
  }, [subruta]);

  const iniciarMfa = async () => {
    setMfaMensaje(null);
    setMfaCodigosRespaldo(null);
    setMfaCargando(true);
    const r = await coreSecurity.configurarMfa();
    setMfaCargando(false);
    if (!r.ok || !r.secret) {
      setMfaMensaje({ ok: false, texto: r.error || 'No se pudo iniciar la configuración.' });
      return;
    }
    setMfaSetup({ secret: r.secret, otpauthUrl: r.otpauthUrl || '', qrDataUrl: r.qrDataUrl });
    setMfaCodigo('');
  };

  const confirmarMfa = async () => {
    if (!mfaCodigo.trim()) return;
    setMfaMensaje(null);
    setMfaCargando(true);
    const r = await coreSecurity.activarMfa(mfaCodigo);
    setMfaCargando(false);
    if (!r.ok) {
      setMfaMensaje({ ok: false, texto: r.error || 'Código incorrecto.' });
      return;
    }
    setMfaSetup(null);
    setMfaCodigo('');
    setMfaCodigosRespaldo(r.codigosRespaldo || []);
    setMfaEstado({ habilitado: true, disponible: true });
    setMfaMensaje({ ok: true, texto: 'Verificación en dos pasos activada.' });
  };

  const desactivarMfa = async () => {
    if (!mfaCodigoDesactivar.trim()) return;
    setMfaMensaje(null);
    setMfaCargando(true);
    const r = await coreSecurity.desactivarMfa(mfaCodigoDesactivar);
    setMfaCargando(false);
    if (!r.ok) {
      setMfaMensaje({ ok: false, texto: r.error || 'Código incorrecto.' });
      return;
    }
    setMfaCodigoDesactivar('');
    setMfaCodigosRespaldo(null);
    setMfaEstado({ habilitado: false, disponible: true });
    setMfaMensaje({ ok: true, texto: 'Verificación en dos pasos desactivada.' });
  };

  const cancelarMfaSetup = () => {
    setMfaSetup(null);
    setMfaCodigo('');
  };

  const handleToggleFlag = (nombre: keyof typeof flags) => {
    coreConfig.alternarModulo(nombre, 'Super Admin');
  };

  const handleGuardarIa = (e: React.FormEvent) => {
    e.preventDefault();
    coreConfig.cambiarParametro('modelo_ia', modeloIa, 'Super Admin');
    coreConfig.cambiarParametro('radio_cercania_km', Number(radioCercania), 'Super Admin');
    setGuardadoIa(true);
    setTimeout(() => setGuardadoIa(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Subnavegación de Sección */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onNavegar('/gestion/configuracion')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esResumen
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Resumen Configuración</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/whatsapp')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esWhatsapp
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Conexión WhatsApp</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/correo')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esCorreo
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Correo/SMTP</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/seo')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esSeo
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>SEO/Metadatos</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/banners')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esBanners
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Images className="w-3.5 h-3.5" />
          <span>Banners del Feed</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/auditoria')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esAuditoria
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Auditoría y Logs</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/general')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esGeneral
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ToggleLeft className="w-3.5 h-3.5" />
          <span>General e interruptores</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/seguridad')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esSeguridad
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Seguridad</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/configuracion/agentes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esAgentes
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Proveedores de IA</span>
        </button>
      </div>

      {/* 1. RESUMEN DE CONFIGURACIÓN */}
      {esResumen && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900">
                Panel Central de Configuración de Sistema
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Conectores de WhatsApp, servidor de correo electrónico, metadatos SEO globales, auditoría de eventos e interruptores del microkernel.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div 
                onClick={() => onNavegar('/gestion/configuracion/whatsapp')}
                className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 cursor-pointer hover:border-emerald-300 transition-all"
              >
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp WAHA</span>
                </div>
                <div className="text-sm font-bold text-emerald-950 mt-1">Conector Activo</div>
                <p className="text-[10px] text-emerald-700 mt-1">Sesión de prueba vinculada</p>
              </div>

              <div 
                onClick={() => onNavegar('/gestion/configuracion/correo')}
                className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 cursor-pointer hover:border-blue-300 transition-all"
              >
                <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                  <Mail className="w-4 h-4" />
                  <span>Servidor Correo</span>
                </div>
                <div className="text-sm font-bold text-blue-950 mt-1">SMTP & Resend API</div>
                <p className="text-[10px] text-blue-700 mt-1">Magic Links de 1 clic</p>
              </div>

              <div 
                onClick={() => onNavegar('/gestion/configuracion/general')}
                className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 cursor-pointer hover:border-purple-300 transition-all"
              >
                <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
                  <ToggleLeft className="w-4 h-4" />
                  <span>Feature Flags</span>
                </div>
                <div className="text-sm font-bold text-purple-950 mt-1">Microkernel Activo</div>
                <p className="text-[10px] text-purple-700 mt-1">14 interruptores de control</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CONEXIÓN WHATSAPP */}
      {esWhatsapp && (
        <WhatsAppConfigPanel />
      )}

      {/* 3. CORREO / SMTP */}
      {esCorreo && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#1B4332]" />
                Servidor de Correo Transaccional (SMTP & Resend API)
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-xl">
                Configuración del despacho de correos reales de verificación de 1 clic y los resúmenes matutinos.
              </p>
            </div>
            <button
              onClick={() => setModalEmailAbierto(true)}
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Configurar SMTP / Resend</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#FBF9F4] rounded-2xl border border-[#EAE5D9] space-y-2 text-xs text-stone-600">
              <span className="font-bold text-[#1B4332] block">Capacidades del Servicio:</span>
              <ul className="space-y-1 list-disc list-inside">
                <li>Soporte SMTP estándar (Gmail, Outlook, Amazon SES)</li>
                <li>Soporte Resend REST API para entornos Cloud</li>
                <li>Plantillas responsivas oficiales de vuuy</li>
              </ul>
            </div>
          </div>

          <EmailConfigModal
            isOpen={modalEmailAbierto}
            onClose={() => setModalEmailAbierto(false)}
          />
        </div>
      )}

      {/* 4. SEO / METADATOS */}
      {esSeo && (
        <SeoMetadataEditor usuarioNombre={sesion?.nombre || 'Super Admin'} />
      )}

      {/* 5. AUDITORÍA Y LOGS */}
      {esAuditoria && (
        <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">Registro Cronológico y Auditoría de Seguridad</h3>
              <p className="text-xs text-stone-400">Microkernel event bus audit log</p>
            </div>
            <span className="text-xs font-mono bg-stone-100 px-2.5 py-1 rounded-lg text-stone-600">
              {eventosLog.length} eventos
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs text-stone-600 scrollbar-thin">
            {eventosLog.map(ev => (
              <div key={ev.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="break-all">
                  <span className="font-bold text-emerald-800">[{ev.tipoEvento}]</span> {JSON.stringify(ev.datos)}
                </div>
                <span className="text-[10px] text-stone-400 whitespace-nowrap">{new Date(ev.fechaHora).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">Eventos de Seguridad (servidor)</h3>
              <p className="text-xs text-stone-400">Tabla security_logs · PostgreSQL</p>
            </div>
            <span className="text-xs font-mono bg-stone-100 px-2.5 py-1 rounded-lg text-stone-600">
              {logsSeguridad.length} eventos
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs text-stone-600 scrollbar-thin">
            {logsSeguridad.length === 0 ? (
              <p className="text-stone-400">Sin eventos de seguridad registrados.</p>
            ) : logsSeguridad.map((l) => (
              <div key={l.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="break-all">
                  <span className="font-bold text-rose-700">[{l.accion}]</span> {l.entidad} · {l.entidadId} — {l.detalles}
                </div>
                <span className="text-[10px] text-stone-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* 6. GENERAL E INTERRUPTORES */}
      {esGeneral && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">Interruptores de Módulos (Feature Flags)</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Controla de forma atómica y en tiempo real el encendido o apagado de cada subsistema de vuuy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {(Object.keys(flags) as (keyof typeof flags)[]).map(key => {
              const activo = flags[key];
              return (
                <div key={key} className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block capitalize">{key}</span>
                    <span className="text-[10px] text-stone-400 font-mono">flag_{key}</span>
                  </div>
                  <button
                    onClick={() => handleToggleFlag(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activo
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                    }`}
                  >
                    {activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{activo ? 'Activo' : 'Pausado'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. SEGURIDAD, CLAVES DE ACCESO Y VARIABLES DE ENTORNO */}
      {esSeguridad && (
        <div className="space-y-6">
          {/* Tarjeta de Verificación en Dos Pasos (MFA / TOTP) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-700" />
                  <span>Verificación en Dos Pasos (MFA / TOTP)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Protege tu cuenta de administración con un código temporal de una app autenticadora.
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold self-start sm:self-auto ${mfaEstado?.habilitado ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                {mfaEstado?.habilitado ? 'Activado' : 'Desactivado'}
              </span>
            </div>

            {mfaEstado?.disponible === false && (
              <div className="p-3.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                MFA está deshabilitado globalmente por configuración del servidor (VUUV_MFA_DISABLED).
              </div>
            )}

            {mfaMensaje && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${mfaMensaje.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {mfaMensaje.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Shield className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{mfaMensaje.texto}</span>
              </div>
            )}

            {mfaCodigosRespaldo && (
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />Códigos de respaldo (guárdalos ahora; no se vuelven a mostrar)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {mfaCodigosRespaldo.map((c) => (
                    <code key={c} className="px-2 py-1.5 bg-white rounded-lg border border-amber-200 text-[11px] font-mono text-center text-amber-900">{c}</code>
                  ))}
                </div>
              </div>
            )}

            {mfaSetup ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  {mfaSetup.qrDataUrl ? (
                    <img src={mfaSetup.qrDataUrl} alt="Código QR MFA" className="w-40 h-40 rounded-xl border border-stone-200 bg-white p-1" />
                  ) : null}
                  <div className="text-xs text-stone-600 space-y-1.5 flex-1 min-w-0">
                    <p className="font-semibold text-stone-800">1. Escanea el código QR con tu app autenticadora.</p>
                    <p>Si no puedes escanear, ingresa esta clave manualmente:</p>
                    <code className="block px-3 py-2 bg-stone-50 rounded-lg border border-stone-200 font-mono text-[11px] break-all text-stone-800">{mfaSetup.secret}</code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">2. Ingresa el código de 6 dígitos para confirmar</label>
                  <input type="text" value={mfaCodigo} onChange={(e) => setMfaCodigo(e.target.value)} placeholder="123456" className="w-full sm:w-56 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm tracking-[0.3em] text-center font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={mfaCargando} onClick={confirmarMfa} className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50">Confirmar y activar</button>
                  <button type="button" onClick={cancelarMfaSetup} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all">Cancelar</button>
                </div>
              </div>
            ) : mfaEstado?.habilitado ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-500">Para desactivar, ingresa un código de tu app o un código de respaldo.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input type="text" value={mfaCodigoDesactivar} onChange={(e) => setMfaCodigoDesactivar(e.target.value)} placeholder="Código" className="w-40 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm tracking-[0.2em] text-center font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500" />
                  <button type="button" disabled={mfaCargando} onClick={desactivarMfa} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50">Desactivar MFA</button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={mfaCargando || mfaEstado?.disponible === false} onClick={iniciarMfa} className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5">
                <Key className="w-4 h-4" />Activar verificación en dos pasos
              </button>
            )}
          </div>

          {/* Tarjeta de Sesión Activa */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-700" />
                  <span>Control de Claves de Acceso y Sesión de Administración</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Gestiona las credenciales del personal de administración, contraseñas seguras y acceso de comercios.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoUsuarioAbierto(true)}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Nueva Credencial</span>
              </button>
            </div>

            {mensajeSeguridad && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                mensajeSeguridad.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {mensajeSeguridad.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Shield className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{mensajeSeguridad.texto}</span>
              </div>
            )}

            {/* Ficha de la Sesión Actual */}
            <div className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/70 text-xs">
              <span className="font-bold text-stone-800 block mb-2">Sesión en Uso:</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-stone-600">
                <div className="p-2.5 bg-white rounded-xl border border-stone-200/60">
                  <span className="text-[10px] text-stone-400 block font-semibold">USUARIO</span>
                  <strong className="text-stone-900">{sesion?.nombre || 'Administrador'}</strong>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-stone-200/60">
                  <span className="text-[10px] text-stone-400 block font-semibold">EMAIL</span>
                  <strong className="text-stone-900 font-mono">{sesion?.email || 'admin@vuuy.pe'}</strong>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-stone-200/60">
                  <span className="text-[10px] text-stone-400 block font-semibold">ROL</span>
                  <strong className="text-emerald-800 font-bold uppercase">{sesion?.rol || 'admin'}</strong>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-stone-200/60">
                  <span className="text-[10px] text-stone-400 block font-semibold">ESTADO</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Sesión Segura
                  </span>
                </div>
              </div>
            </div>

            {/* Tabla de Credenciales y Contraseñas del Sistema */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-stone-500" />
                <span>Usuarios con Credenciales Autorizadas ({credenciales.length})</span>
              </h4>

              <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-2xl overflow-hidden bg-white">
                {credenciales.map((cred) => {
                  const estaEditando = usuarioEditarEmail === cred.email;
                  const mostrarPass = verPassword[cred.email] ?? false;

                  return (
                    <div key={cred.email} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-stone-900">{cred.nombre}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            cred.rol === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {cred.rol}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-mono">{cred.email}</p>
                        <p className="text-[11px] text-stone-400">{cred.descripcion}</p>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-auto">
                        {/* Contraseñas protegidas: nunca se exponen en el navegador */}
                        <div className="flex items-center gap-1.5 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/70 text-xs font-mono text-stone-400">
                          <Lock className="w-3.5 h-3.5" />
                          <span className="tracking-wider">••••••••••••</span>
                        </div>

                        {/* Botón cambiar clave */}
                        <button
                          type="button"
                          onClick={() => {
                            if (estaEditando) {
                              setUsuarioEditarEmail(null);
                              setNuevaPasswordInput('');
                            } else {
                              setUsuarioEditarEmail(cred.email);
                              setNuevaPasswordInput('');
                            }
                          }}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {estaEditando ? 'Cancelar' : 'Cambiar Clave'}
                        </button>

                        {/* Botón editar datos */}
                        <button
                          type="button"
                          onClick={() => {
                            if (usuarioEditarDatos === cred.email) {
                              setUsuarioEditarDatos(null);
                            } else {
                              setUsuarioEditarDatos(cred.email);
                              setFormEditarDatos({
                                nombre: cred.nombre || '',
                                rol: cred.rol,
                                descripcion: cred.descripcion || '',
                                merchantId: cred.merchantId || ''
                              });
                            }
                          }}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>

                        {/* Botón eliminar */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`¿Eliminar la credencial de ${cred.nombre} (${cred.email})?`)) return;
                            const res = await coreSecurity.eliminarCredencial(cred.usuarioId || cred.email);
                            setMensajeSeguridad({ ok: res.ok, texto: res.mensaje });
                            setTimeout(() => setMensajeSeguridad(null), 4000);
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Formulario desplegable para editar datos */}
                      {usuarioEditarDatos === cred.email && (
                        <div className="w-full pt-2 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={formEditarDatos.nombre}
                              onChange={(e) => setFormEditarDatos({ ...formEditarDatos, nombre: e.target.value })}
                              placeholder="Nombre"
                              className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                            />
                            <select
                              value={formEditarDatos.rol}
                              onChange={(e) => setFormEditarDatos({ ...formEditarDatos, rol: e.target.value as any })}
                              className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                            >
                              <option value="admin">Administrador</option>
                              <option value="operador">Operador</option>
                              <option value="comercio">Comercio</option>
                            </select>
                            <input
                              type="text"
                              value={formEditarDatos.descripcion}
                              onChange={(e) => setFormEditarDatos({ ...formEditarDatos, descripcion: e.target.value })}
                              placeholder="Descripción"
                              className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                            />
                            <input
                              type="text"
                              value={formEditarDatos.merchantId}
                              onChange={(e) => setFormEditarDatos({ ...formEditarDatos, merchantId: e.target.value })}
                              placeholder="Merchant ID (opcional)"
                              className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await coreSecurity.actualizarCredencial(cred.usuarioId || cred.email, {
                                  nombre: formEditarDatos.nombre,
                                  rol: formEditarDatos.rol,
                                  descripcion: formEditarDatos.descripcion,
                                  merchantId: formEditarDatos.merchantId || undefined
                                });
                                setMensajeSeguridad({ ok: res.ok, texto: res.mensaje });
                                if (res.ok) setUsuarioEditarDatos(null);
                                setTimeout(() => setMensajeSeguridad(null), 4000);
                              }}
                              className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Guardar cambios</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Formulario desplegable para cambiar clave */}
                      {estaEditando && (
                        <div className="w-full md:w-auto flex items-center gap-2 pt-2 md:pt-0">
                          <input
                            type="text"
                            value={nuevaPasswordInput}
                            onChange={(e) => setNuevaPasswordInput(e.target.value)}
                            placeholder="Nueva contraseña..."
                            className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (nuevaPasswordInput.trim().length >= 6) {
                                const res = await coreSecurity.actualizarContrasena(cred.email, nuevaPasswordInput);
                                setMensajeSeguridad({ ok: res.ok, texto: res.mensaje });
                                setUsuarioEditarEmail(null);
                                setNuevaPasswordInput('');
                                setTimeout(() => setMensajeSeguridad(null), 4000);
                              } else {
                                setMensajeSeguridad({ ok: false, texto: 'La clave debe tener al menos 6 caracteres' });
                              }
                            }}
                            className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Guardar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tarjeta: cambiar mi propia contraseña (autoservicio) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <span>Cambiar Mi Contraseña</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Actualiza la contraseña de tu propia cuenta ({sesion?.email || 'sesión actual'}). No requiere permisos de administrador.
              </p>
            </div>

            {miPasswordMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${miPasswordMsg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {miPasswordMsg.texto}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={miPassword}
                onChange={(e) => setMiPassword(e.target.value)}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
              />
              <button
                type="button"
                onClick={async () => {
                  const email = sesion?.email || '';
                  if (!email) { setMiPasswordMsg({ ok: false, texto: 'No hay una sesión activa.' }); return; }
                  if (miPassword.trim().length < 6) { setMiPasswordMsg({ ok: false, texto: 'La contraseña debe tener al menos 6 caracteres.' }); return; }
                  const res = await coreSecurity.actualizarContrasena(email, miPassword.trim());
                  setMiPasswordMsg({ ok: res.ok, texto: res.mensaje });
                  setMiPassword('');
                  setTimeout(() => setMiPasswordMsg(null), 4000);
                }}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Actualizar Contraseña
              </button>
            </div>
          </div>

          {/* Tarjeta de Variables de Entorno del Sistema (.env) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <Server className="w-5 h-5 text-emerald-700" />
                  <span>Variables de Entorno del Sistema (Runtime .env)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Estado de inyección de claves de infraestructura, proxies y puertos de ejecución.
                </p>
              </div>
              <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-bold self-start sm:self-auto">
                PORT: 3000 · America/Lima
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              {/* Variable GEMINI_API_KEY */}
              <div className="p-4 bg-stone-50/90 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-stone-800">GEMINI_API_KEY</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Conectado / Inyectado
                  </span>
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  Clave de autenticación para llamadas a Gemini AI Studio. Gestionada mediante proxy seguro en backend sin exposición en cliente.
                </p>
                <div className="text-[11px] font-mono text-stone-400 bg-white p-2 rounded-xl border border-stone-200/60">
                  Estado: Inyectado automáticamente por entorno Cloud Run
                </div>
              </div>

              {/* Variable WHATSAPP_ACTIVE_MODE */}
              <div className="p-4 bg-stone-50/90 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-stone-800">WHATSAPP_ACTIVE_MODE</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    waha (QR Oficial)
                  </span>
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  Modo activo del conector de WhatsApp: "waha" para código QR real con Baileys o "meta" para Meta Cloud API.
                </p>
                <div className="text-[11px] font-mono text-stone-600 bg-white p-2 rounded-xl border border-stone-200/60 flex items-center justify-between">
                  <span>Conector: {coreConfig.obtenerValor('conector_whatsapp', 'WAHA')}</span>
                  <button
                    onClick={() => onNavegar('/gestion/configuracion/whatsapp')}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Editar →
                  </button>
                </div>
              </div>

              {/* Variable APP_URL */}
              <div className="p-4 bg-stone-50/90 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-stone-800">APP_URL</span>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    Self-Referential
                  </span>
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  URL base del servidor utilizada para enlaces de verificación por correo y webhooks oficiales.
                </p>
                <div className="text-[11px] font-mono text-stone-700 bg-white p-2 rounded-xl border border-stone-200/60 truncate">
                  {envVars.appUrl}
                </div>
              </div>

              {/* Variable SMTP_HOST & RESEND_API_KEY */}
              <div className="p-4 bg-stone-50/90 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-stone-800">EMAIL_PROVIDER</span>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    SMTP / Resend
                  </span>
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  Configuración del despacho de correos transaccionales para verificación de usuarios y reportes matutinos.
                </p>
                <div className="text-[11px] font-mono text-stone-600 bg-white p-2 rounded-xl border border-stone-200/60 flex items-center justify-between">
                  <span>Proveedor: smtp.gmail.com / Resend</span>
                  <button
                    onClick={() => onNavegar('/gestion/configuracion/correo')}
                    className="text-purple-700 font-bold hover:underline"
                  >
                    Configurar →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Nuevo Usuario */}
          {modalNuevoUsuarioAbierto && (
            <div
              onClick={() => setModalNuevoUsuarioAbierto(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200 cursor-default"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h4 className="font-bold text-sm text-stone-900">Crear Nueva Credencial</h4>
                  <button
                    onClick={() => setModalNuevoUsuarioAbierto(false)}
                    className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await coreSecurity.agregarCredencial({
                      email: nuevoUsuarioForm.email.trim(),
                      contrasena: nuevoUsuarioForm.contrasena.trim(),
                      nombre: nuevoUsuarioForm.nombre.trim(),
                      rol: nuevoUsuarioForm.rol,
                      usuarioId: `usr_${Date.now()}`,
                      descripcion: nuevoUsuarioForm.descripcion.trim() || 'Usuario del sistema'
                    });
                    setMensajeSeguridad({ ok: res.ok, texto: res.mensaje });
                    if (res.ok) {
                      setModalNuevoUsuarioAbierto(false);
                      setNuevoUsuarioForm({
                        nombre: '',
                        email: '',
                        contrasena: '',
                        rol: 'admin',
                        descripcion: ''
                      });
                    }
                    setTimeout(() => setMensajeSeguridad(null), 4000);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      value={nuevoUsuarioForm.nombre}
                      onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, nombre: e.target.value })}
                      placeholder="Ej. Operador de Contenidos"
                      className="w-full p-2 border border-stone-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Correo Electrónico (Login)</label>
                    <input
                      type="email"
                      required
                      value={nuevoUsuarioForm.email}
                      onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, email: e.target.value })}
                      placeholder="ejemplo@vuuy.pe"
                      className="w-full p-2 border border-stone-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Contraseña de Acceso</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={nuevoUsuarioForm.contrasena}
                      onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, contrasena: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full p-2 border border-stone-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Rol de Acceso</label>
                    <select
                      value={nuevoUsuarioForm.rol}
                      onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, rol: e.target.value as any })}
                      className="w-full p-2 border border-stone-200 rounded-xl bg-stone-50"
                    >
                      <option value="admin">Administrador (Acceso total al Panel de Gestión)</option>
                      <option value="operador">Operador (Aprobación y moderación)</option>
                      <option value="comercio">Comercio (Acceso al Panel de Comercio)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Descripción / Función</label>
                    <input
                      type="text"
                      value={nuevoUsuarioForm.descripcion}
                      onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, descripcion: e.target.value })}
                      placeholder="Ej. Moderación de ofertas de Lima"
                      className="w-full p-2 border border-stone-200 rounded-xl outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalNuevoUsuarioAbierto(false)}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl font-bold"
                    >
                      Crear Credencial
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. PROVEEDORES Y MODELOS DE IA */}
      {esAgentes && (
        <ProveedoresIaView onNavegar={onNavegar} />
      )}

      {/* 9. BANNERS DEL FEED */}
      {esBanners && (
        <BannersConfigView />
      )}
    </div>
  );
};
