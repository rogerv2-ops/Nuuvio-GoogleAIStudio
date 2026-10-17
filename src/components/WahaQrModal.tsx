import React, { useState, useEffect } from 'react';
import { 
  X, QrCode, RefreshCw, CheckCircle2, AlertCircle, Smartphone, 
  ShieldCheck, LogOut, Sparkles, KeyRound, Copy, Check, Info, ArrowRight
} from 'lucide-react';

interface WahaQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionConnected?: (phone: string) => void;
}

export const WahaQrModal: React.FC<WahaQrModalProps> = ({
  isOpen,
  onClose,
  onSessionConnected
}) => {
  const [metodo, setMetodo] = useState<'qr' | 'pairing_code'>('qr');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED'>('STARTING');
  const [phone, setPhone] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(45);

  // Estados para Pairing Code de 8 dígitos
  const [telefonoPairing, setTelefonoPairing] = useState('+51 ');
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);

  // Aplica una respuesta de estado/QR del servidor al estado del modal.
  const aplicarEstado = (data: any) => {
    if (!data) return;
    if (data.qrDataUrl) {
      setQrDataUrl(data.qrDataUrl);
      setStatus('SCAN_QR_CODE');
      setSegundosRestantes(45);
      return;
    }
    if (data.status === 'WORKING') {
      setQrDataUrl(null);
      setStatus('WORKING');
      setPhone(data.phone || null);
      if (onSessionConnected && data.phone) onSessionConnected(data.phone);
      return;
    }
    if (data.status) setStatus(data.status);
  };

  // Iniciar sesión y obtener QR real (reutiliza la sesión activa si existe)
  const iniciarSesionQr = async () => {
    setCargando(true);
    try {
      const estado = await fetch('/api/waha/session/status').then(r => r.json()).catch(() => ({}));
      if (estado.status === 'WORKING' || estado.qrDataUrl) {
        aplicarEstado(estado);
        return;
      }
      const res = await fetch('/api/waha/session/qr');
      const data = await res.json();
      if (data.ok) aplicarEstado(data);
    } catch (e) {
      console.error('Error al iniciar sesión WhatsApp:', e);
      setStatus('FAILED');
    } finally {
      setCargando(false);
    }
  };

  // Refrescar código QR
  const refrescarQr = async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/waha/session/qr');
      const data = await res.json();
      if (data.ok) aplicarEstado(data);
    } catch (e) {
      console.error('Error al refrescar QR:', e);
    } finally {
      setCargando(false);
    }
  };

  // Consultar estado periódico de la sesión
  const verificarEstado = async () => {
    try {
      const res = await fetch('/api/waha/session/status');
      const data = await res.json();
      if (data.ok) aplicarEstado(data);
    } catch (e) {
      console.error('Error verificando estado:', e);
    }
  };

  // Solicitar Código de Vinculación de 8 dígitos (Pairing Code)
  const handleSolicitarPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerandoCodigo(true);
    setCodigoGenerado(null);

    try {
      const res = await fetch('/api/waha/session/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: telefonoPairing })
      });
      const data = await res.json();
      if (data.ok && data.pairingCode) {
        setCodigoGenerado(data.pairingCode);
      } else {
        alert(data.error || 'No se pudo generar el código de vinculación.');
      }
    } catch (e) {
      alert('Error al conectar con el servidor.');
    } finally {
      setGenerandoCodigo(false);
    }
  };

  const handleCopiarCodigo = () => {
    if (!codigoGenerado) return;
    navigator.clipboard.writeText(codigoGenerado);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 2000);
  };

  // Desconectar sesión
  const desconectar = async () => {
    try {
      await fetch('/api/waha/session/logout', { method: 'POST' });
      setStatus('STOPPED');
      setPhone(null);
      setQrDataUrl(null);
      setCodigoGenerado(null);
      refrescarQr();
    } catch (e) {
      console.error('Error desconectando sesión:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      iniciarSesionQr();
      const interval = setInterval(() => {
        verificarEstado();
        setSegundosRestantes(prev => {
          if (prev <= 1) {
            refrescarQr();
            return 45;
          }
          return prev - 1;
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="px-5 py-4 bg-[#1B4332] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#25D366]">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold leading-tight">
                Vincular WhatsApp Oficial
              </h3>
              <p className="text-[11px] text-stone-200 font-normal">
                Generador de Código QR & Código de Vinculación
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Pestañas / Métodos de Vinculación */}
        {status !== 'WORKING' && (
          <div className="flex border-b border-stone-100 bg-stone-50 px-4 pt-2">
            <button
              type="button"
              onClick={() => setMetodo('qr')}
              className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
                metodo === 'qr'
                  ? 'border-[#1B4332] text-[#1B4332]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Escanear Código QR</span>
            </button>

            <button
              type="button"
              onClick={() => setMetodo('pairing_code')}
              className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
                metodo === 'pairing_code'
                  ? 'border-[#1B4332] text-[#1B4332]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Vincular con Número (Código de 8 dígitos)</span>
            </button>
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Badge de Estado en Tiempo Real */}
          <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-100">
            <span className="font-semibold text-stone-500">Estado de conexión:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              status === 'WORKING'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : status === 'SCAN_QR_CODE'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-stone-100 text-stone-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === 'WORKING' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`} />
              {status === 'WORKING' && 'Dispositivo Vinculado'}
              {status === 'SCAN_QR_CODE' && 'Esperando Escaneo / Código'}
              {status === 'STARTING' && 'Iniciando Handshake...'}
              {status === 'STOPPED' && 'Desconectado'}
              {status === 'FAILED' && 'Error'}
            </span>
          </div>

          {/* VISTA 1: YA CONECTADO CON ÉXITO */}
          {status === 'WORKING' ? (
            <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-emerald-950">
                  ¡WhatsApp Vinculado con Éxito!
                </h4>
                <p className="text-xs text-emerald-800">
                  El protocolo WhatsApp Web autenticó correctamente tu sesión.
                </p>
                <div className="mt-3 inline-block font-mono text-base font-bold bg-white px-4 py-2 rounded-xl border border-emerald-200 text-emerald-900 shadow-2xs">
                  {phone || '+51 987 654 321'}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#143427] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  Entendido y Continuar
                </button>
                <button
                  type="button"
                  onClick={desconectar}
                  className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </div>
            </div>
          ) : metodo === 'qr' ? (
            /* VISTA 2: ESCANEO POR CÓDIGO QR REAL */
            <div className="space-y-4">
              {/* Contenedor del Código QR Real */}
              <div className="flex flex-col items-center justify-center p-4 bg-stone-50 border border-stone-200/90 rounded-2xl relative">
                {cargando && !qrDataUrl ? (
                  <div className="w-64 h-64 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-8 h-8 text-[#1B4332] animate-spin" />
                    <span className="text-xs text-stone-500 font-medium">Generando código QR oficial...</span>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative">
                    <img 
                      src={qrDataUrl} 
                      alt="Código QR Real de WhatsApp" 
                      className="w-64 h-64 rounded-xl border border-stone-200 shadow-xs object-contain bg-white"
                    />
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                      Expira en {segundosRestantes}s
                    </div>
                  </div>
                ) : (
                  <div className="w-64 h-64 flex flex-col items-center justify-center text-center p-4">
                    <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                    <span className="text-xs text-stone-600 font-medium">Iniciando protocolo WhatsApp...</span>
                    <button
                      type="button"
                      onClick={refrescarQr}
                      className="mt-2 text-xs font-bold text-[#1B4332] underline"
                    >
                      Generar QR ahora
                    </button>
                  </div>
                )}

                {/* Botón de refrescar manual */}
                <button
                  type="button"
                  onClick={refrescarQr}
                  disabled={cargando}
                  className="mt-4 text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1.5 font-medium transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                  <span>Actualizar código QR</span>
                </button>
              </div>

              {/* Instrucciones de Escaneo */}
              <div className="bg-[#F8FAF8] border border-emerald-200/60 p-3.5 sm:p-4 rounded-2xl space-y-1.5">
                <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span>Pasos en tu teléfono:</span>
                </h4>
                <ol className="text-xs text-stone-600 space-y-1 pl-4 list-decimal font-normal">
                  <li>Abre WhatsApp en tu teléfono.</li>
                  <li>Toca <strong>Menú (⋮)</strong> en Android o <strong>Ajustes</strong> en iPhone.</li>
                  <li>Toca <strong>Dispositivos vinculados</strong> &gt; <strong>Vincular un dispositivo</strong>.</li>
                  <li>Apunta la cámara hacia el código QR de arriba.</li>
                </ol>
              </div>
            </div>
          ) : (
            /* VISTA 3: VINCULAR POR CÓDIGO DE 8 DÍGITOS (PAIRING CODE) */
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/60 border border-indigo-200/70 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-700" />
                  <h4 className="text-xs font-bold text-stone-900">
                    Vincular sin cámara (Código de 8 dígitos)
                  </h4>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Ideal si tu cámara no enfoca bien la pantalla. Ingresa tu número de WhatsApp y recibirás un código de 8 caracteres para vincularlo directamente desde la app.
                </p>

                <form onSubmit={handleSolicitarPairingCode} className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-stone-700">Tu número de WhatsApp (con código de país):</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={telefonoPairing}
                        onChange={e => setTelefonoPairing(e.target.value)}
                        placeholder="+51 987654321"
                        required
                        className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 font-mono text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                      />
                      <button
                        type="submit"
                        disabled={generandoCodigo}
                        className="px-4 py-2 bg-[#1B4332] hover:bg-[#143427] text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs disabled:opacity-50"
                      >
                        {generandoCodigo ? 'Generando...' : 'Obtener Código'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Código de 8 dígitos resultante */}
                {codigoGenerado && (
                  <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-sm text-center space-y-2 animate-in zoom-in-95">
                    <span className="text-[11px] font-bold text-stone-500 block uppercase tracking-wider">
                      Tu Código de Vinculación
                    </span>
                    <div className="font-mono text-2xl sm:text-3xl font-black text-[#0F172A] tracking-widest py-1">
                      {codigoGenerado}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopiarCodigo}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {copiadoCodigo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiadoCodigo ? 'Copiado al portapapeles' : 'Copiar código'}</span>
                    </button>

                    <div className="pt-2 text-left text-xs text-stone-600 bg-stone-50 p-3 rounded-xl space-y-1">
                      <span className="font-bold text-stone-800 block">Cómo ingresarlo en tu teléfono:</span>
                      <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                        <li>Abre WhatsApp &gt; <strong>Dispositivos vinculados</strong>.</li>
                        <li>Toca <strong>Vincular un dispositivo</strong>.</li>
                        <li>Toca en la parte inferior: <strong>"Vincular con el número de teléfono"</strong>.</li>
                        <li>Ingresa este código de 8 caracteres: <strong>{codigoGenerado}</strong>.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer del Modal */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Protocolo Oficial WhatsApp Web</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
