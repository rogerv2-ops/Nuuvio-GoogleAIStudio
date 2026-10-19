import React, { useState } from 'react';
import { 
  Zap, CreditCard, Receipt, Plus, CheckCircle2, 
  AlertCircle, ArrowRight, ShieldCheck, Clock
} from 'lucide-react';
import { Merchant } from '../../../types';
import { facturacionModule } from '../../../modules/facturacion';

interface CampanasComercioViewProps {
  comercio: Merchant;
  saldoClics: number;
  rutaActual: string;
}

export const CampanasComercioView: React.FC<CampanasComercioViewProps> = ({
  comercio,
  saldoClics,
  rutaActual
}) => {
  const [packSeleccionado, setPackSeleccionado] = useState<50 | 100 | 500>(100);
  const [mensajeRecarga, setMensajeRecarga] = useState<string | null>(null);

  const packs = [
    { clics: 50, precio: 30, nombre: 'Básico', ahorro: '' },
    { clics: 100, precio: 55, nombre: 'Recomendado', ahorro: 'Ahorras S/ 5' },
    { clics: 500, precio: 250, nombre: 'Empresarial', ahorro: 'Ahorras S/ 50' }
  ];

  const handleComprarPack = async () => {
    try {
      const pack = await facturacionModule.comprarPack({
        comercioId: comercio.id,
        cantidadClics: packSeleccionado,
        metodoPago: 'yape_plin'
      });

      setMensajeRecarga(`¡Recarga exitosa! Se agregaron ${pack.totalClics} clics a tu saldo para ${comercio.nombreComercial}.`);
    } catch (e) {
      // comprarPack ahora persiste: si la escritura falla, el comercio no debe
      // ver un "¡Recarga exitosa!" que nunca se acredito.
      console.error('[Campanas] No se pudo acreditar el pack de clics:', e);
      setMensajeRecarga('No pudimos acreditar el pack. Intenta de nuevo o contacta a soporte.');
    }
    setTimeout(() => setMensajeRecarga(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Resumen de saldo y consumo */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Modelo prepago por contacto
            </span>
            <h3 className="text-xl font-black text-[#0F172A] mt-0.5">
              Saldo de Clics Disponibles
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              Solo consumes clics cuando un usuario presiona "Lo quiero" para tu local. No pagas por mostrar la oferta ni por visitas simples.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center sm:text-right shrink-0">
            <span className="text-xs text-emerald-800 font-bold block">Saldo actual</span>
            <div className="text-3xl font-black text-emerald-700 font-mono mt-0.5">
              {saldoClics} <span className="text-sm font-sans font-bold">clics</span>
            </div>
            <span className="text-[10px] text-emerald-600 mt-1 block">
              Equivalente a aprox. {Math.round(saldoClics * 1.5)} días activos
            </span>
          </div>
        </div>
      </div>

      {mensajeRecarga && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mensajeRecarga}</span>
        </div>
      )}

      {/* Selector de Packs */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
        <div>
          <h4 className="font-bold text-sm text-[#0F172A]">Recargar Saldo de Contactos</h4>
          <p className="text-xs text-stone-400">Elige el paquete que mejor se acomode a tu negocio</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {packs.map(p => (
            <div
              key={p.clics}
              onClick={() => setPackSeleccionado(p.clics as any)}
              className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
                packSeleccionado === p.clics
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {p.nombre}
                </span>
                {p.ahorro && (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    {p.ahorro}
                  </span>
                )}
              </div>
              <div className="text-2xl font-black text-[#0F172A] mt-2 font-mono">
                {p.clics} Clics
              </div>
              <div className="text-sm font-bold text-stone-600 mt-0.5 font-mono">
                S/ {p.precio}
              </div>
              <p className="text-[10px] text-stone-400 mt-2">
                S/ {(p.precio / p.clics).toFixed(2)} por contacto calificado
              </p>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <button
            onClick={handleComprarPack}
            className="w-full py-3 bg-[#166534] hover:bg-[#14532D] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pagar con Yape / Plin y Recargar {packSeleccionado} Clics</span>
          </button>
        </div>
      </div>

      {/* Historial de Comprobantes */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
        <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-stone-600" />
          <span>Comprobantes de pago y recargas anteriores</span>
        </h4>
        <div className="divide-y divide-stone-100 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0F172A]">Recarga 100 Clics PPC</p>
              <span className="text-[10px] text-stone-400 font-mono">15 Oct 2026 · Yape</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-700 font-mono">S/ 55.00</span>
              <span className="text-[10px] text-stone-400 block">Comprobante #YP-8821</span>
            </div>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0F172A]">Recarga 50 Clics Básico</p>
              <span className="text-[10px] text-stone-400 font-mono">01 Oct 2026 · Plin</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-700 font-mono">S/ 30.00</span>
              <span className="text-[10px] text-stone-400 block">Comprobante #PL-1092</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
