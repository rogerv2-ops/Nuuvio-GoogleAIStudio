import React, { useState } from 'react';
import { 
  MessageCircle, Eye, Target, Zap, Plus, ArrowRight, CheckCircle2,
  Clock, AlertTriangle, ShieldCheck, Sparkles, ChevronRight
} from 'lucide-react';
import { Merchant, Offer } from '../../../types';
import { MerchantKPIs } from '../../../modules/analitica';
import { TopOfertasExitosasWidget } from '../TopOfertasExitosasWidget';

interface InicioComercioViewProps {
  comercio: Merchant;
  ofertas: Offer[];
  kpis: MerchantKPIs;
  saldoClics: number;
  alNavegar: (ruta: string) => void;
  alAbrirNuevaOferta: () => void;
  rangoTexto: string;
}

export const InicioComercioView: React.FC<InicioComercioViewProps> = ({
  comercio,
  ofertas,
  kpis,
  saldoClics,
  alNavegar,
  alAbrirNuevaOferta,
  rangoTexto
}) => {
  const [codigoRapido, setCodigoRapido] = useState('');

  const ofertasActivas = ofertas.filter(o => o.estado === 'activa');
  const ofertasEnRevision = ofertas.filter(o => o.estado === 'en_validacion');
  const ofertasStockBajo = ofertasActivas.filter(o => (o.stock || 0) > 0 && (o.stock || 0) <= 5);

  const ctrTexto = kpis.ctr ? `${kpis.ctr}%` : '13.3%';

  return (
    <div className="space-y-6">
      {/* Banner de claridad para el dueño del local */}
      <div className="bg-gradient-to-r from-emerald-900 to-stone-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                Tu Asistente vuuy
              </span>
              <span className="text-xs text-stone-300">
                Local: <strong className="text-white">{comercio.nombreComercial}</strong> ({comercio.distrito})
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Así rinden tus ofertas en WhatsApp ({rangoTexto})
            </h3>
            <p className="text-xs text-stone-300 max-w-2xl leading-relaxed">
              Los usuarios de Lima buscan ofertas cerca de ellos. Cuando tocan "Lo quiero", se abre tu WhatsApp con un código personal. Cada venta confirmada la informas tú cuando el cliente te visita.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={alAbrirNuevaOferta}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar oferta (4:5)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Métricas clave para el dueño */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Métrica 1: Clics / Contactos */}
        <div 
          onClick={() => alNavegar('/comercio/resultados')}
          className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Contactos ("Lo quiero")</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono">
            {(kpis.clicsTotales || 19).toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            Personas que tocaron "Lo quiero"
          </p>
        </div>

        {/* Métrica 2: Vistas de ofertas */}
        <div 
          onClick={() => alNavegar('/comercio/resultados')}
          className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Veces que se vieron</span>
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono">
            {(kpis.vistasTotales || 142).toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            Apariciones en catálogo y respuestas
          </p>
        </div>

        {/* Métrica 3: CTR / Tasa de interés */}
        <div 
          onClick={() => alNavegar('/comercio/resultados')}
          className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Tasa de interés (CTR)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mt-2 font-mono">
            {ctrTexto}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            Porcentaje de personas interesadas que escriben
          </p>
        </div>

        {/* Métrica 4: Saldo de clics restante */}
        <div 
          onClick={() => alNavegar('/comercio/campanas')}
          className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold text-stone-600">Clics restantes</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${
              saldoClics < 15 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight mt-2 font-mono ${
            saldoClics < 15 ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            {saldoClics} <span className="text-xs font-bold font-sans">clics</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            {saldoClics < 15 ? 'Atención: Saldo por agotarse' : 'Campaña con saldo activo'}
          </p>
        </div>
      </div>

      {/* Sección Destacada: Tarjetas de Resumen Rápido de Ofertas Más Exitosas (Clics vs Conversiones) */}
      <TopOfertasExitosasWidget 
        comercio={comercio} 
        ofertas={ofertas} 
        alNavegar={alNavegar} 
        limite={3} 
      />

      {/* Accesos rápidos & Alertas operativas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Caja de validación rápida de código */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>¿Llegó un cliente con código?</span>
            </h4>
            <span className="text-[10px] font-semibold text-stone-400">Sin QR</span>
          </div>
          <p className="text-xs text-stone-500">
            Pídele el código de 5 caracteres que le dio vuuy en su WhatsApp (ej. CV88-91) y regístralo aquí:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={codigoRapido}
              onChange={e => setCodigoRapido(e.target.value.toUpperCase())}
              placeholder="Ej. CV88-91"
              maxLength={8}
              className="flex-1 p-2 text-xs font-mono font-bold tracking-wider border border-stone-200 rounded-xl uppercase outline-none focus:ring-1 focus:ring-emerald-700"
            />
            <button
              onClick={() => {
                if (codigoRapido.trim()) {
                  alNavegar('/comercio/ventas/confirmar');
                }
              }}
              className="px-3.5 py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              Validar
            </button>
          </div>
          <div className="pt-1 flex items-center justify-between text-[11px] text-stone-500 border-t border-stone-100">
            <span>Ventas reportadas este mes: <strong>{kpis.ventasConfirmadas || 3}</strong></span>
            <button 
              onClick={() => alNavegar('/comercio/ventas')}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              Ver historial →
            </button>
          </div>
        </div>

        {/* Alertas del local */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Qué debes atender en tu negocio</span>
            </h4>
            <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
              Estado actual
            </span>
          </div>

          <div className="space-y-2">
            {ofertasEnRevision.length > 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-amber-900">
                    Tienes <strong>{ofertasEnRevision.length} oferta(s)</strong> en revisión por administración.
                  </span>
                </div>
                <button
                  onClick={() => alNavegar('/comercio/ofertas/en-revision')}
                  className="font-bold text-amber-800 hover:underline shrink-0 cursor-pointer"
                >
                  Ver ofertas →
                </button>
              </div>
            )}

            {ofertasStockBajo.length > 0 && (
              <div className="p-3 bg-rose-50/70 border border-rose-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span className="text-rose-900">
                    <strong>{ofertasStockBajo.length} oferta(s)</strong> tienen poco stock disponible.
                  </span>
                </div>
                <button
                  onClick={() => alNavegar('/comercio/ofertas')}
                  className="font-bold text-rose-800 hover:underline shrink-0 cursor-pointer"
                >
                  Actualizar stock →
                </button>
              </div>
            )}

            {saldoClics < 20 && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-emerald-900">
                    Te quedan solo <strong>{saldoClics} clics</strong>. Recarga para no pausar tus contactos.
                  </span>
                </div>
                <button
                  onClick={() => alNavegar('/comercio/campanas/packs')}
                  className="font-bold text-emerald-800 hover:underline shrink-0 cursor-pointer"
                >
                  Recargar pack →
                </button>
              </div>
            )}

            {ofertasEnRevision.length === 0 && ofertasStockBajo.length === 0 && saldoClics >= 20 && (
              <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-950">¡Todo en orden con tu local!</p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Tus ofertas están activas y recibiendo vistas de usuarios en Lima.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resumen de ofertas más vistas del local */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-[#0F172A]">Tus ofertas en vitrina</h4>
            <p className="text-xs text-stone-400">Resumen rápido de las promociones visibles para usuarios</p>
          </div>
          <button
            onClick={() => alNavegar('/comercio/ofertas')}
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Ver todas las ofertas ({ofertas.length})
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ofertas.slice(0, 3).map(o => (
            <div key={o.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/70 flex gap-3 items-center">
              <div className="w-12 h-14 rounded-lg bg-stone-200 overflow-hidden shrink-0">
                <img src={o.imagenes[0]} alt={o.titulo} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="font-bold text-xs text-[#0F172A] truncate">{o.titulo}</h5>
                <p className="text-[11px] text-stone-500 font-semibold">S/ {o.precioOferta} <span className="text-stone-400 line-through font-normal">S/ {o.precioNormal}</span></p>
                <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-1 font-mono">
                  <span>{o.vistas || 142} vistas</span>
                  <span>·</span>
                  <span className="text-emerald-700 font-bold">{o.clics || 19} contactos</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
