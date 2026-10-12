import React, { useState } from 'react';
import { 
  Tag, Plus, Search, Filter, Sparkles, CheckCircle2, Clock, 
  AlertCircle, XCircle, ArrowRight, Eye, MessageCircle, ChevronDown, ExternalLink
} from 'lucide-react';
import { Merchant, Offer } from '../../../types';
import { ofertasModule } from '../../../modules/ofertas';
import { getCategoryFallbackImage, handleImgError } from '../../../utils/imageFallbacks';
import { esOfertaNueva } from '../../../utils/ofertaUtils';

interface MisOfertasComercioViewProps {
  comercio: Merchant;
  ofertas: Offer[];
  rutaActual: string;
  alNavegar: (ruta: string) => void;
  alAbrirNuevaOferta: () => void;
}

export const MisOfertasComercioView: React.FC<MisOfertasComercioViewProps> = ({
  comercio,
  ofertas,
  rutaActual,
  alNavegar,
  alAbrirNuevaOferta
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [ofertaDetalle, setOfertaDetalle] = useState<Offer | null>(null);

  // Subvistas
  const esNueva = rutaActual === '/comercio/ofertas/nueva';
  const esEnRevision = rutaActual === '/comercio/ofertas/en-revision';
  const esHistorial = rutaActual === '/comercio/ofertas/historial';

  // Filtrado según subvista
  const ofertasFiltradas = ofertas.filter(o => {
    if (esEnRevision) return o.estado === 'en_validacion';
    if (esHistorial) return o.estado === 'pausada' || o.estado === 'agotada' || o.estado === 'vencida';
    // Por defecto catálogo activo o general
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return o.titulo.toLowerCase().includes(q) || o.categoria.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Navegación de pestañas de ofertas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => alNavegar('/comercio/ofertas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              !esEnRevision && !esHistorial && !esNueva
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Todas ({ofertas.length})
          </button>
          <button
            onClick={() => alNavegar('/comercio/ofertas/en-revision')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              esEnRevision
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>En revisión ({ofertas.filter(o => o.estado === 'en_validacion').length})</span>
          </button>
          <button
            onClick={() => alNavegar('/comercio/ofertas/historial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              esHistorial
                ? 'bg-stone-800 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Historial / Pausadas ({ofertas.filter(o => o.estado !== 'activa' && o.estado !== 'en_validacion').length})
          </button>
        </div>

        <button
          onClick={alAbrirNuevaOferta}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#166534] hover:bg-[#14532D] text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>+ Publicar oferta</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por título o categoría..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-700"
          />
        </div>
        <p className="text-xs text-stone-400 hidden sm:block">
          Mostrando {ofertasFiltradas.length} de {ofertas.length} promociones
        </p>
      </div>

      {/* Tabla de Ofertas */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-100 text-stone-500 font-semibold text-[11px]">
                <th className="py-3 px-3.5 w-16">Foto 4:5</th>
                <th className="py-3 px-3.5">Título & Categoría</th>
                <th className="py-3 px-3.5 text-center">Stock</th>
                <th className="py-3 px-3.5 text-center">Vistas</th>
                <th className="py-3 px-3.5 text-center">Contactos (WhatsApp)</th>
                <th className="py-3 px-3.5 text-center">Estado</th>
                <th className="py-3 px-3.5 text-center w-20">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {ofertasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    No hay ofertas en esta vista.
                  </td>
                </tr>
              ) : (
                ofertasFiltradas.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/60 transition-colors">
                    {/* Foto */}
                    <td className="py-2.5 px-3.5">
                      <div className="w-11 h-14 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/80 shrink-0">
                        <img
                          src={o.imagenes[0]}
                          alt={o.titulo}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImgError(e, getCategoryFallbackImage(o.categoria, o.titulo))}
                        />
                      </div>
                    </td>

                    {/* Título */}
                    <td className="py-2.5 px-3.5">
                      <div className="font-bold text-[#0F172A] text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{o.titulo}</span>
                        {esOfertaNueva(o.creadaEn) && (
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                            Nueva
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        <strong className="text-emerald-700">S/ {o.precioOferta}</strong> (Antes S/ {o.precioNormal}) · {o.categoria}
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="py-2.5 px-3.5 text-center font-mono font-medium">
                      {o.stock || 20}
                    </td>

                    {/* Vistas */}
                    <td className="py-2.5 px-3.5 text-center font-mono text-stone-600">
                      {(o.vistas || 142).toLocaleString()}
                    </td>

                    {/* Clics */}
                    <td className="py-2.5 px-3.5 text-center font-mono font-bold text-emerald-700">
                      {(o.clics || 19).toLocaleString()}
                    </td>

                    {/* Estado */}
                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      {o.estado === 'activa' && (
                        <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                          Activa
                        </span>
                      )}
                      {o.estado === 'en_validacion' && (
                        <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full">
                          En revisión
                        </span>
                      )}
                      {o.estado === 'pausada' && (
                        <span className="inline-block px-2.5 py-0.5 bg-yellow-100 text-yellow-800 font-bold text-[10px] rounded-full">
                          Pausada
                        </span>
                      )}
                      {o.estado === 'agotada' && (
                        <span className="inline-block px-2.5 py-0.5 bg-stone-100 text-stone-600 font-bold text-[10px] rounded-full">
                          Agotada
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        onClick={() => setOfertaDetalle(o)}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        Ver ficha
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle de Oferta */}
      {ofertaDetalle && (
        <div 
          onClick={() => setOfertaDetalle(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 border border-stone-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="font-bold text-sm text-[#0F172A]">Ficha de la Oferta</h4>
              <button 
                onClick={() => setOfertaDetalle(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-4">
              <div className="w-24 aspect-[4/5] rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                <img src={ofertaDetalle.imagenes[0]} alt={ofertaDetalle.titulo} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1 text-xs">
                <h5 className="font-bold text-sm text-[#0F172A]">{ofertaDetalle.titulo}</h5>
                <p className="text-stone-500">{ofertaDetalle.descripcion}</p>
                <div className="pt-2 text-[11px] space-y-0.5">
                  <p>Precio Oferta: <strong className="text-emerald-700">S/ {ofertaDetalle.precioOferta}</strong></p>
                  <p>Precio Regular: S/ {ofertaDetalle.precioNormal}</p>
                  <p>Stock: {ofertaDetalle.stock || 20} unidades</p>
                  <p>Vistas recibidas: {ofertaDetalle.vistas || 142}</p>
                  <p>Contactos a WhatsApp: {ofertaDetalle.clics || 19}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setOfertaDetalle(null)}
                className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
