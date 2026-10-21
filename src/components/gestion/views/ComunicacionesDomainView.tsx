import { useDistritosZona } from '../../../modules/geo';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Send, Mail, Bell, Sparkles, CheckCircle2, AlertCircle, 
  Play, Calendar, MapPin, Clock, Eye, Layers, ShieldCheck, X
} from 'lucide-react';
import { digestModule, DigestLogEntry } from '../../../modules/digest';
import { usuariosModule } from '../../../modules/usuarios';

import { coreEvents } from '../../../core/events';

interface ComunicacionesDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const ComunicacionesDomainView: React.FC<ComunicacionesDomainViewProps> = ({ subruta, onNavegar }) => {
  // Los distritos salen de la zona de servicio, no de una lista a mano.
  const distritosZona = useDistritosZona();
  const [version, setVersion] = useState(0);
  const [distritoDigest, setDistritoDigest] = useState('Miraflores');
  const [ejecutandoDigest, setEjecutandoDigest] = useState(false);
  const [resultadoDigest, setResultadoDigest] = useState<string | null>(null);

  useEffect(() => {
    const unsub = digestModule.suscribir(() => setVersion(v => v + 1));
    return () => unsub();
  }, []);

  const historial = useMemo(() => digestModule.getHistorial(), [version]);
  const usuarios = useMemo(() => usuariosModule.listarUsuarios(), []);
  const usuariosConCorreo = usuarios.filter(u => u.consentimientos?.correo && u.estado === 'activo');

  // Subrutas
  const esEnvios = subruta === '/gestion/comunicaciones/envios';
  const esDigest = subruta === '/gestion/comunicaciones/digest';
  const esPlantillas = subruta === '/gestion/comunicaciones/plantillas';
  const esResumen = !esEnvios && !esDigest && !esPlantillas;

  const handleEjecutarDigest = () => {
    setEjecutandoDigest(true);
    setResultadoDigest(null);

    setTimeout(() => {
      const res = digestModule.ejecutarDigestMatutino(distritoDigest);
      setEjecutandoDigest(false);
      setResultadoDigest(res.mensajeResultado);
      setTimeout(() => setResultadoDigest(null), 6000);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Subnavegación de Sección */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onNavegar('/gestion/comunicaciones')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esResumen
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Resumen de Comunicaciones</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comunicaciones/envios')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esEnvios
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Envíos</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comunicaciones/digest')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esDigest
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Digest Matutino (D10)</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comunicaciones/plantillas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esPlantillas
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Plantillas</span>
        </button>
      </div>

      {/* 1. RESUMEN DE COMUNICACIONES */}
      {esResumen && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900">
                  Comunicaciones y Despacho Transaccional
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Política anti-spam estricta: <em>Nunca se envían ofertas masivas por WhatsApp</em>. El canal de salida es correo y push PWA.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavegar('/gestion/comunicaciones/digest')}
                  className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Configurar Digest Diario
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Destinatarios Habilitados</span>
                <div className="text-2xl font-black text-stone-900 mt-1">{usuariosConCorreo.length}</div>
                <span className="text-[10px] text-stone-500">Con consentimiento de correo</span>
              </div>
              <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Resúmenes Enviados</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{historial.length}</div>
                <span className="text-[10px] text-emerald-700">Ediciones matutinas</span>
              </div>
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
                <span className="text-[10px] font-bold text-blue-800 uppercase">Garantía Anti-Spam</span>
                <div className="text-base font-bold text-blue-900 mt-2">100% Opt-in</div>
                <span className="text-[10px] text-blue-700">Cero envíos masivos por WhatsApp</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ENVÍOS */}
      {(esEnvios || esResumen) && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Historial de Envíos y Despachos ({historial.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Registro de resúmenes matutinos ejecutados por distrito en Lima.
              </p>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {historial.length === 0 ? (
              <p className="py-6 text-center text-xs text-stone-400">Sin envíos registrados.</p>
            ) : (
              historial.map(item => (
                <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-stone-900">{item.distrito}</span>
                    <span className="text-stone-400 block text-[11px]">
                      {item.ofertasCount} ofertas destacadas: {item.ofertasTitulos.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {item.destinatariosCount} destinatarios
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">{item.fecha}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. DIGEST MATUTINO (D10) */}
      {esDigest && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Resumen Diario Matutino (simulacion, no envia)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              Genera y despacha el resumen matutino personalizado con las 3 ofertas más relevantes por cercanía para los usuarios del distrito elegido.
            </p>
          </div>

          {resultadoDigest && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{resultadoDigest}</span>
              </div>
              <button onClick={() => setResultadoDigest(null)} className="text-emerald-600 hover:text-emerald-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 max-w-xl">
            <label className="text-xs font-bold text-stone-700 block">
              Seleccionar Distrito de Lima para el Despacho:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={distritoDigest}
                onChange={(e) => setDistritoDigest(e.target.value)}
                className="flex-1 p-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800"
              >
                {distritosZona.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button
                disabled={ejecutandoDigest}
                onClick={handleEjecutarDigest}
                className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{ejecutandoDigest ? 'Despachando...' : 'Ejecutar Digest'}</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-400">
              Hora canónica programada en Lima: <strong>09:00 AM</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 4. PLANTILLAS */}
      {esPlantillas && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Plantillas de Notificaciones y Correos
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Estructura visual de las comunicaciones transaccionales oficiales de Yuddit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                Plantilla Transaccional
              </span>
              <h4 className="text-xs font-bold text-stone-900">Verificación de 1 Clic (Magic Link)</h4>
              <p className="text-[11px] text-stone-500">
                Correo limpio con logo de Yuddit y botón verde único para verificar cuenta sin contraseñas.
              </p>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                Plantilla Matutina
              </span>
              <h4 className="text-xs font-bold text-stone-900">Digest de Ofertas Cercanas</h4>
              <p className="text-[11px] text-stone-500">
                Formato carrusel con fotos 4:5, porcentaje de descuento y botón de llamada a la acción.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
