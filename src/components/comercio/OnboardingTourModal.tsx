import React, { useState } from 'react';
import { 
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, X, 
  Tag, CreditCard, BarChart2, Store, Lightbulb, Play, HelpCircle
} from 'lucide-react';
import { Merchant } from '../../types';

interface OnboardingTourModalProps {
  comercio: Merchant;
  abierto: boolean;
  alCerrar: () => void;
  alAbrirNuevaOferta: () => void;
  alNavegarVentas: () => void;
  alNavegarResultados: () => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  comercio,
  abierto,
  alCerrar,
  alAbrirNuevaOferta,
  alNavegarVentas,
  alNavegarResultados
}) => {
  const [paso, setPaso] = useState(0);

  if (!abierto) return null;

  const totalPasos = 4;

  const handleCompletarTour = () => {
    try {
      if (typeof window !== 'undefined' && comercio?.id) {
        localStorage.setItem(`vuuy_comercio_tour_v1_${comercio.id}`, 'completado');
      }
    } catch {
      // Ignorar errores en iframe
    }
    alCerrar();
  };

  const handleAccionOferta = () => {
    handleCompletarTour();
    alAbrirNuevaOferta();
  };

  const handleAccionVentas = () => {
    handleCompletarTour();
    alNavegarVentas();
  };

  const handleAccionResultados = () => {
    handleCompletarTour();
    alNavegarResultados();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200/90 max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Fondo decorativo con gradiente suave */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-100/60 to-transparent rounded-bl-full pointer-events-none" />

        {/* Encabezado: Progreso y Botón Cerrar */}
        <div className="flex items-center justify-between relative z-10 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-[#166534] font-bold text-xs flex items-center justify-center">
              🍃
            </span>
            <div>
              <span className="text-xs font-black uppercase text-emerald-800 tracking-wider block">Guía de Inicio</span>
              <span className="text-[11px] text-stone-500 font-bold">Paso {paso + 1} de {totalPasos + 1}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompletarTour}
            className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors cursor-pointer"
            title="Saltar guía de inicio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Progreso */}
        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-[#166534] h-full transition-all duration-300 rounded-full"
            style={{ width: `${((paso + 1) / (totalPasos + 1)) * 100}%` }}
          />
        </div>

        {/* CONTENIDO SEGÚN PASO */}
        <div className="space-y-4 relative z-10">

          {/* PASO 0: BIENVENIDA */}
          {paso === 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center text-2xl shadow-md">
                ✨
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                  ¡Bienvenido a vuuy, {comercio?.nombreComercial || 'Aliado'}!
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1">
                  Estás a pocos pasos de activar tu presencia comercial para miles de vecinos interesados en tu distrito ({comercio?.distrito || 'Lima'}).
                </p>
              </div>

              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 space-y-2.5 text-xs text-stone-700">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</div>
                  <p><strong>Cero Comisiones por Venta:</strong> Los clientes te contactan directamente a tu WhatsApp oficial.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</div>
                  <p><strong>Verificación en 24h:</strong> Tus promociones se aprueban rápidamente antes de salir en vivo.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</div>
                  <p><strong>Canje con Código Personal:</strong> Controla el consumo y recompensa a tus clientes habituales.</p>
                </div>
              </div>
            </div>
          )}

          {/* PASO 1: CREAR OFERTA */}
          {paso === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <Tag className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-black text-[#0F172A] tracking-tight">
                  1. Publica tu Primera Oferta
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-1">
                  Publica un descuento atractivo o una promoción combo. Define el precio regular, el precio de oferta y la cantidad de cupones disponibles.
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <span>Tip para el Éxito</span>
                </div>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Las ofertas con un 30% a 50% de descuento en productos estrella de tu local reciben hasta 3 veces más contactos a tu WhatsApp durante el fin de semana.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAccionOferta}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Tag className="w-4 h-4" />
                <span>Crear mi Primera Oferta Ahora</span>
              </button>
            </div>
          )}

          {/* PASO 2: VERIFICAR VENTAS */}
          {paso === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <CreditCard className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-black text-[#0F172A] tracking-tight">
                  2. Registra Ventas con Código Personal
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-1">
                  Cuando los clientes visiten tu establecimiento o te contacten por WhatsApp, te proporcionarán su código personal único (ej. <code className="bg-stone-100 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-700">VU-9812</code>).
                </p>
              </div>

              <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200/80 space-y-2 text-xs">
                <p className="text-indigo-900 font-bold">
                  ¿Por qué es importante registrar cada compra?
                </p>
                <p className="text-indigo-800 text-[11px] leading-relaxed">
                  Al registrar el código, el sistema acumula puntos de lealtad para el cliente y posiciona a tu comercio en los primeros lugares de la lista en Lima.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAccionVentas}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Ir a Registrar una Venta</span>
              </button>
            </div>
          )}

          {/* PASO 3: TABLERO DE RESULTADOS */}
          {paso === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <BarChart2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-black text-[#0F172A] tracking-tight">
                  3. Revisa tus Métricas y Tracción
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-1">
                  En el menú lateral encontrarás la pestaña <strong>Resultados</strong>. Allí verás con total claridad cuántas vistas recibieron tus promociones y cuántos contactos llegaron a tu WhatsApp.
                </p>
              </div>

              <div className="p-3.5 bg-purple-50/80 rounded-2xl border border-purple-200/80 space-y-2 text-xs">
                <p className="text-purple-900 font-bold">
                  Monitoreo Transparente
                </p>
                <p className="text-purple-800 text-[11px] leading-relaxed">
                  Filtra tus métricas por rango de fechas (hoy, 7 días, 30 días o fechas personalizadas) para medir el retorno exacto de cada campaña.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAccionResultados}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <BarChart2 className="w-4 h-4" />
                <span>Ver Tablero de Resultados</span>
              </button>
            </div>
          )}

          {/* PASO 4: FINALIZACIÓN */}
          {paso === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-3xl shadow-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-700" />
              </div>

              <div>
                <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
                  ¡Felicitaciones! Estás listo para empezar
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-1 max-w-sm mx-auto">
                  Tu negocio está completamente configurado en vuuy. Publica tu primera oferta y empieza a recibir contactos hoy mismo.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCompletarTour}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Entendido, Ir a mi Panel Principal
              </button>
            </div>
          )}

        </div>

        {/* Pie del Modal: Botones Anterior / Siguiente */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 relative z-10">
          {paso > 0 ? (
            <button
              type="button"
              onClick={() => setPaso(p => p - 1)}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
          ) : (
            <span className="text-[11px] text-stone-400 font-medium">Primer uso de {comercio?.nombreComercial}</span>
          )}

          {paso < totalPasos && (
            <button
              type="button"
              onClick={() => setPaso(p => p + 1)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
