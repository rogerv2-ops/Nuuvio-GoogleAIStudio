/**
 * Hoja de eleccion de app para los botones de WhatsApp.
 *
 * REGLA INQUEBRANTABLE (ver AGENTS.md): un enlace a WhatsApp SIEMPRE tiene que
 * dejar elegir la app. En Android el sistema ya muestra el selector cuando se
 * usa el esquema nativo, asi que ahi no hace falta esta hoja; en iOS y en la
 * web el sistema no ofrece selector y la eleccion la pone esta hoja.
 *
 * El telefono no aparece en ningun momento: se pide al servidor en el clic y
 * el servidor responde con el enlace ya armado (y deja registrado el evento).
 */
import React, { useEffect, useState } from 'react';
import { X, MessageCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  abrirContactoWhatsApp,
  generarLinksWhatsApp,
  opcionesWhatsApp,
  type DestinoWhatsApp,
} from '../utils/whatsappNative';

interface WhatsAppChooserProps {
  abierto: boolean;
  onCerrar: () => void;
  /** Oferta a la que se atribuye el contacto (atribucion y tracking). */
  ofertaId?: string | null;
  /** Telefono ya conocido (uso interno del panel). Si viene, no se pide al servidor. */
  telefono?: string | null;
  /** Texto del mensaje, solo cuando el telefono ya se conoce. */
  texto?: string;
  titulo?: string;
}

export const WhatsAppChooser: React.FC<WhatsAppChooserProps> = ({
  abierto,
  onCerrar,
  ofertaId,
  telefono,
  texto,
  titulo,
}) => {
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState<DestinoWhatsApp | null>(null);
  const opciones = opcionesWhatsApp();

  useEffect(() => {
    if (abierto) setError('');
  }, [abierto]);

  if (!abierto) return null;

  const elegir = async (destino: DestinoWhatsApp) => {
    setError('');
    setCargando(destino);
    try {
      if (telefono) {
        // Telefono ya conocido (panel interno): el enlace se arma en el cliente.
        const links = generarLinksWhatsApp(telefono, texto);
        const url =
          destino === 'business' ? links.businessUrl : destino === 'web' ? links.webUrl : links.nativeUrl;
        if (!url) {
          setError('No hay un número de WhatsApp configurado para este contacto.');
          setCargando(null);
          return;
        }
        window.location.href = url;
        return;
      }

      const r = await abrirContactoWhatsApp({ ofertaId, destino });
      if (!r.ok) {
        setError(r.error || 'No pudimos abrir WhatsApp. Inténtalo de nuevo.');
        setCargando(null);
      }
    } catch {
      setError('No pudimos abrir WhatsApp. Inténtalo de nuevo.');
      setCargando(null);
    }
  };

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end justify-center cursor-pointer sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-[24px] sm:rounded-[24px] border border-[#EAE5D9] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-150 cursor-default"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-sm font-black text-[#1C1917]">{titulo || 'Abrir en WhatsApp'}</h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Elige con qué app quieres continuar.
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pb-3 space-y-1.5">
          {opciones.map((op) => (
            <button
              key={op.destino}
              onClick={() => void elegir(op.destino)}
              disabled={cargando !== null}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-[#EAE5D9] hover:bg-[#F7F5F0] hover:border-[#15803D]/40 transition-colors text-left disabled:opacity-60 cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-[#25D366]/15 text-[#15803D] flex items-center justify-center shrink-0">
                {cargando === op.destino ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-[#1C1917] truncate">{op.etiqueta}</span>
                <span className="block text-[10px] text-stone-500 truncate">{op.detalle}</span>
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-700 leading-snug">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
