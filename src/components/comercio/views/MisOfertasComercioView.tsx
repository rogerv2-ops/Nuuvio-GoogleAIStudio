import React, { useState } from 'react';
import { 
  Plus, Search, Sparkles, Clock, 
  Play, Film, Loader2
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

  // Estados para Video con Veo
  const [ofertaReproducirVideo, setOfertaReproducirVideo] = useState<Offer | null>(null);
  const [animandoOfertaId, setAnimandoOfertaId] = useState<string | null>(null);
  const [progresoAnimacion, setProgresoAnimacion] = useState(0);
  const [etapaAnimacion, setEtapaAnimacion] = useState('');

  // Generar video con Veo para una oferta existente
  const handleAnimarOfertaExistente = async (o: Offer) => {
    if (animandoOfertaId) return;
    setAnimandoOfertaId(o.id);
    setProgresoAnimacion(15);
    setEtapaAnimacion('Iniciando animación con Veo 9:16...');

    try {
      const res = await fetch('/api/gemini/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: o.imagenes[0],
          prompt: `Animación comercial en video vertical 9:16 del producto: ${o.titulo}. Zoom suave y foco de luz cinematográfica`,
          aspectRatio: '9:16'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al iniciar animación');

      if (data.status === 'completed' && data.videoUrl) {
        setProgresoAnimacion(100);
        ofertasModule.actualizarOfertaVideo(o.id, data.videoUrl, '9:16');
        setTimeout(() => setAnimandoOfertaId(null), 500);
        return;
      }

      const videoId = data.videoId;
      const opName = data.operationName;
      let finalizado = false;
      let intentos = 0;

      while (!finalizado && intentos < 25) {
        await new Promise(r => setTimeout(r, 2000));
        intentos++;
        const porc = Math.min(94, 30 + intentos * 4);
        setProgresoAnimacion(porc);
        setEtapaAnimacion(`Sintetizando cuadros con Veo (${porc}%)...`);

        const pollRes = await fetch('/api/gemini/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, operationName: opName })
        });

        const pollData = await pollRes.json();
        if (pollData.done && pollData.videoUrl) {
          finalizado = true;
          setProgresoAnimacion(100);
          ofertasModule.actualizarOfertaVideo(o.id, pollData.videoUrl, '9:16');
          setTimeout(() => setAnimandoOfertaId(null), 500);
          break;
        }
      }
    } catch (e: any) {
      alert(`Error al animar oferta: ${e.message}`);
      setAnimandoOfertaId(null);
    }
  };

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
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-100 text-stone-500 font-semibold text-[11px]">
                <th className="py-3 px-3.5 w-16">Foto 4:5</th>
                <th className="py-3 px-3.5">Título & Categoría</th>
                <th className="py-3 px-3.5 text-center">Video Veo (9:16)</th>
                <th className="py-3 px-3.5 text-center">Stock</th>
                <th className="py-3 px-3.5 text-center">Vistas</th>
                <th className="py-3 px-3.5 text-center">Contactos</th>
                <th className="py-3 px-3.5 text-center">Estado</th>
                <th className="py-3 px-3.5 text-center w-36">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {ofertasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400 text-xs">
                    No hay ofertas en esta vista.
                  </td>
                </tr>
              ) : (
                ofertasFiltradas.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/60 transition-colors">
                    {/* Foto */}
                    <td className="py-2.5 px-3.5">
                      <div className="relative w-11 h-14 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/80 shrink-0 group">
                        <img
                          src={o.imagenes[0]}
                          alt={o.titulo}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImgError(e, getCategoryFallbackImage(o.categoria, o.titulo))}
                        />
                        {o.videoUrl && (
                          <button
                            type="button"
                            onClick={() => setOfertaReproducirVideo(o)}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Reproducir video"
                          >
                            <Play className="w-4 h-4 fill-white text-white drop-shadow" />
                          </button>
                        )}
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

                    {/* Video Veo (9:16) */}
                    <td className="py-2.5 px-3.5 text-center">
                      {o.videoUrl ? (
                        <button
                          type="button"
                          onClick={() => setOfertaReproducirVideo(o)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          <Film className="w-3 h-3 text-emerald-700" />
                          <span>Video 9:16</span>
                        </button>
                      ) : animandoOfertaId === o.id ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          <span>{progresoAnimacion}%</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAnimarOfertaExistente(o)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 text-stone-600 border border-stone-200 rounded-full text-[10px] font-medium transition-colors cursor-pointer"
                          title="Generar video animado con Veo"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Animar IA</span>
                        </button>
                      )}
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
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setOfertaDetalle(o)}
                          className="px-2 py-1 text-[11px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Ficha
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE OFERTA */}
      {ofertaDetalle && (
        <div 
          onClick={() => setOfertaDetalle(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 border border-stone-200 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                <span>Ficha de la Oferta</span>
                {ofertaDetalle.videoUrl && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Film className="w-2.5 h-2.5" /> Video Veo 9:16
                  </span>
                )}
              </h4>
              <button 
                onClick={() => setOfertaDetalle(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-36 aspect-[4/5] rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200 relative">
                {ofertaDetalle.videoUrl ? (
                  <video 
                    src={ofertaDetalle.videoUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <img src={ofertaDetalle.imagenes[0]} alt={ofertaDetalle.titulo} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="space-y-1 text-xs flex-1">
                <h5 className="font-bold text-sm text-[#0F172A]">{ofertaDetalle.titulo}</h5>
                <p className="text-stone-500">{ofertaDetalle.descripcion}</p>
                <div className="pt-2 text-[11px] space-y-0.5">
                  <p>Precio Oferta: <strong className="text-emerald-700">S/ {ofertaDetalle.precioOferta}</strong></p>
                  <p>Precio Regular: S/ {ofertaDetalle.precioNormal}</p>
                  <p>Stock: {ofertaDetalle.stock || 20} unidades</p>
                  <p>Vistas recibidas: {ofertaDetalle.vistas || 142}</p>
                  <p>Contactos a WhatsApp: {ofertaDetalle.clics || 19}</p>
                </div>

                {!ofertaDetalle.videoUrl && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleAnimarOfertaExistente(ofertaDetalle)}
                      disabled={animandoOfertaId === ofertaDetalle.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                      <span>{animandoOfertaId === ofertaDetalle.id ? `Animando (${progresoAnimacion}%)...` : 'Animar con Veo (9:16)'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setOfertaDetalle(null)}
                className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPRODUCTOR DE VIDEO VEO (9:16) */}
      {ofertaReproducirVideo && (
        <div 
          onClick={() => setOfertaReproducirVideo(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-stone-900 text-white rounded-3xl max-w-sm w-full p-4 space-y-3 border border-stone-700 shadow-2xl my-auto text-center"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Film className="w-4 h-4" />
                <span>Video Veo (9:16)</span>
              </span>
              <button
                onClick={() => setOfertaReproducirVideo(null)}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="w-full aspect-[9/16] max-h-[65vh] rounded-2xl overflow-hidden bg-black mx-auto border border-stone-800 shadow-inner">
              <video
                src={ofertaReproducirVideo.videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1 text-left px-1">
              <h5 className="font-bold text-sm text-white truncate">{ofertaReproducirVideo.titulo}</h5>
              <p className="text-xs text-stone-400">
                S/ {ofertaReproducirVideo.precioOferta} · Formato vertical 9:16 optimizado para WhatsApp e Instagram Stories.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
