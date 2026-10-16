import React, { useState } from "react";
import { MessageCircle, Clock, MapPin, Store, ThumbsUp } from "lucide-react";

export interface Offer {
  id: string;
  titulo: string;
  descripcion: string;
  comercioNombre: string;
  comercioWhatsapp?: string;
  comercioTelefono?: string;
  telefonoComercio?: string;
  precioNormal: number | string;
  precioOferta: number | string;
  categoria: string;
  distrito: string;
  imagenes?: string[];
  imagenUrl?: string;
  tipo?: string;
  stock?: number;
  likes?: number;
  creadaEn?: string;
  venceEn?: string;
  videoUrl?: string;
}

interface PublicWebProps {
  ofertas: Offer[];
  botPhone?: string;
  onSelectOferta?: (oferta: Offer) => void;
  onPedirOferta?: (oferta: Offer) => void;
}

export const PublicWeb: React.FC<PublicWebProps> = ({
  ofertas = [],
  onSelectOferta,
  onPedirOferta,
}) => {
  const [selectedCategoria, setSelectedCategoria] = useState<string>("Todas");
  const [selectedDistrito, setSelectedDistrito] = useState<string>("Todos");
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [userLikedMap, setUserLikedMap] = useState<Record<string, boolean>>({});

  const categorias = ["Todas", ...Array.from(new Set(ofertas.map((o) => o.categoria).filter(Boolean)))];
  const distritos = ["Todos", ...Array.from(new Set(ofertas.map((o) => o.distrito).filter(Boolean)))];

  const filteredOfertas = ofertas.filter((o) => {
    const matchCat = selectedCategoria === "Todas" || o.categoria === selectedCategoria;
    const matchDist = selectedDistrito === "Todos" || o.distrito === selectedDistrito;
    return matchCat && matchDist;
  });

  const handleContactarOferta = (oferta: Offer) => {
    if (onPedirOferta) {
      onPedirOferta(oferta);
    }
    // Redirige de forma ofuscada al endpoint puente del backend sin exponer el teléfono del bot
    const destino = `/api/go/pedir${oferta?.id ? `?ofertaId=${encodeURIComponent(oferta.id)}` : ""}`;
    window.location.href = destino;
  };

  const handleLike = async (e: React.MouseEvent, ofertaId: string) => {
    e.stopPropagation();
    const currentBase = ofertas.find((o) => o.id === ofertaId)?.likes || 0;
    const currentLikes = likesMap[ofertaId] !== undefined ? likesMap[ofertaId] : currentBase;
    const isAlreadyLiked = Boolean(userLikedMap[ofertaId]);

    // Actualización optimista
    const newCount = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    setLikesMap((prev) => ({ ...prev, [ofertaId]: newCount }));
    setUserLikedMap((prev) => ({ ...prev, [ofertaId]: !isAlreadyLiked }));

    try {
      const res = await fetch(`/api/ofertas/${encodeURIComponent(ofertaId)}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes === "number") {
          setLikesMap((prev) => ({ ...prev, [ofertaId]: data.likes }));
        }
      }
    } catch (err) {
      console.error("Error al registrar Me gusta:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#0F172A] font-sans pb-16">
      {/* Top Banner */}
      <header className="bg-[#1B4332] text-white py-6 px-4 sm:px-8 border-b border-emerald-900 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>vuuy</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Ofertas Lima
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1">
              Descubre promociones exclusivas en tu distrito y pide directamente por WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-200">¿Tienes un negocio?</span>
            <a
              href="/api/go/comercio"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs text-[#57534E] hover:text-[#0F172A] font-semibold bg-white border border-[#EAE5D9] rounded-xl shadow-2xs hover:bg-stone-50 transition-colors"
            >
              Unir mi Comercio
            </a>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoria(cat)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  selectedCategoria === cat
                    ? "bg-[#1B4332] text-white shadow-2xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-stone-400" />
            <select
              value={selectedDistrito}
              onChange={(e) => setSelectedDistrito(e.target.value)}
              className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {distritos.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Feed de Ofertas */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 mt-6">
        {filteredOfertas.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8">
            <p className="text-stone-500 text-sm">No encontramos ofertas en esta selección.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOfertas.map((oferta) => {
              const pNorm = Number(oferta.precioNormal) || 0;
              const pOfer = Number(oferta.precioOferta) || 0;
              const descPct =
                pNorm > pOfer && pNorm > 0 ? Math.round(((pNorm - pOfer) / pNorm) * 100) : 0;
              const foto =
                oferta.imagenUrl || (oferta.imagenes && oferta.imagenes[0]) || "/banner-ficha-oferta-mujer.webp";

              const likesCount =
                likesMap[oferta.id] !== undefined
                  ? likesMap[oferta.id]
                  : oferta.likes || 0;
              const isLiked = Boolean(userLikedMap[oferta.id]);

              return (
                <article
                  key={oferta.id}
                  className="bg-white rounded-[24px] border border-stone-200/90 shadow-xs hover:shadow-md transition-all group overflow-hidden flex flex-col justify-between"
                >
                  {/* Foto con aspecto 1:1 (cuadrado) y overlay informativo */}
                  <div
                    onClick={() => onSelectOferta && onSelectOferta(oferta)}
                    className="relative aspect-square w-full bg-stone-200 cursor-pointer overflow-hidden rounded-t-[24px]"
                  >
                    <img
                      src={foto}
                      alt={oferta.titulo}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/banner-ficha-oferta-mujer.webp";
                      }}
                    />

                    {/* Tag de Precio en esquina superior derecha */}
                    <div className="absolute top-3.5 right-3.5 bg-[#FF5722] text-white px-3 py-1.5 rounded-2xl shadow-md text-right z-10 leading-none">
                      <span className="text-[10px] text-white/80 line-through font-semibold block mb-0.5">
                        S/ {pNorm.toFixed(2)}
                      </span>
                      <span className="text-base font-black tracking-tight block">
                        S/ {pOfer.toFixed(2)}
                      </span>
                    </div>

                    {/* Título encuadrado sobre degradado oscuro sobre la foto */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 sm:p-5 pt-16 text-white z-10 space-y-2">
                      <h3 className="font-black text-xl sm:text-2xl text-white leading-tight uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        {oferta.titulo}
                      </h3>
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/20 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-white truncate max-w-[160px]">
                          <Store className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="truncate">{oferta.comercioNombre}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg border border-amber-400/40 text-amber-300 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{oferta.distrito}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Detalle inferior con botón Me gusta al lado de los badges */}
                  <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">
                        {oferta.descripcion}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5">
                        <div className="flex items-center gap-2">
                          {descPct > 0 && (
                            <span className="text-xs font-black text-emerald-800 bg-[#D1FAE5] px-2.5 py-1 rounded-lg">
                              {descPct}% OFF
                            </span>
                          )}
                          <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            <span>Solo {oferta.stock || 5} hoy</span>
                          </span>
                        </div>

                        {/* Botón interactivo 👍 Me gusta */}
                        <button
                          type="button"
                          onClick={(e) => handleLike(e, oferta.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isLiked
                              ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                              : "bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200"
                          }`}
                          title="Dar me gusta a esta oferta"
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? "fill-amber-600 text-amber-600" : "text-stone-500"}`} />
                          <span>{likesCount > 0 ? `${likesCount} Me gusta` : "Me gusta"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100">
                      <button
                        onClick={() => handleContactarOferta(oferta)}
                        className="w-full py-3 px-4 bg-[#15803D] hover:bg-[#166534] text-white rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs hover:shadow-sm transition-all cursor-pointer"
                        title="Pedir oferta directamente por WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 fill-white text-white" />
                        <span>Lo quiero</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicWeb;
