import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bannersModule, FeedBanner } from '../modules/banners';
import { withResourceVersion, suscribirCambioVersion } from '../utils/resourceVersion';

export const BannerHeader: React.FC = () => {
  const [banners, setBanners] = useState<FeedBanner[]>(() => bannersModule.listarBannersActivos());
  const [indiceActual, setIndiceActual] = useState(0);
  const [estaSobre, setEstaSobre] = useState(false);
  const [, setVersionTick] = useState(0);

  // Sincronizar y escuchar cambios reactivos en el módulo de banners y versión de recursos
  useEffect(() => {
    bannersModule.sincronizarConServidor();

    const unsubBanners = bannersModule.suscribir(() => {
      const activos = bannersModule.listarBannersActivos();
      setBanners(activos);
      if (indiceActual >= activos.length) {
        setIndiceActual(0);
      }
    });

    const unsubVersion = suscribirCambioVersion(() => {
      // Forzar re-render de imágenes con el nuevo timestamp
      setVersionTick(v => v + 1);
      bannersModule.sincronizarConServidor();
    });

    return () => {
      unsubBanners();
      unsubVersion();
    };
  }, [indiceActual]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    if (!target.src.includes('banner-ficha-oferta-mujer.webp')) {
      target.src = withResourceVersion('/banner-ficha-oferta-mujer.webp');
    } else if (!target.src.includes('banner-ficha-oferta-mujer.svg')) {
      target.src = withResourceVersion('/banner-ficha-oferta-mujer.svg');
    }
  };

  // Rotación automática cada 5 segundos
  useEffect(() => {
    if (banners.length <= 1 || estaSobre) return;

    const timer = setInterval(() => {
      setIndiceActual(prev => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length, estaSobre]);

  const handleSiguiente = useCallback(() => {
    if (banners.length === 0) return;
    setIndiceActual(prev => (prev + 1) % banners.length);
  }, [banners.length]);

  const handleAnterior = useCallback(() => {
    if (banners.length === 0) return;
    setIndiceActual(prev => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Si no hay banners activos registrados, usar el banner predeterminado adaptativo
  if (banners.length === 0) {
    return (
      <div
        className="w-full relative overflow-hidden rounded-[20px] border border-[#EAE5D9] shadow-xs bg-[#FFFDF9]"
        title="Ofertas cerca de ti - Yuudit"
      >
        <img
          src={withResourceVersion('/banner-ficha-oferta-mujer.webp')}
          alt="Ofertas cerca de ti - Solo cuando las quieres"
          className="w-full h-auto block rounded-[20px] object-contain"
          loading="eager"
          onError={handleImageError}
        />
      </div>
    );
  }

  const bannerActual = banners[indiceActual] || banners[0];

  return (
    <div
      onMouseEnter={() => setEstaSobre(true)}
      onMouseLeave={() => setEstaSobre(false)}
      className="w-full relative overflow-hidden rounded-[20px] border border-[#EAE5D9] shadow-xs bg-[#FFFDF9] group select-none"
      title={bannerActual.titulo}
    >
      {/* IMÁGENES DEL CARRUSEL: ALTO ADAPTATIVO SIN CORTAR LA IMAGEN */}
      <div className="grid grid-cols-1 grid-rows-1 w-full">
        {banners.map((b, idx) => {
          const esActivo = idx === indiceActual;
          return (
            <div
              key={b.id}
              className={`col-start-1 row-start-1 w-full transition-opacity duration-500 ease-in-out ${
                esActivo ? 'opacity-100 z-10 relative pointer-events-auto' : 'opacity-0 z-0 absolute inset-0 pointer-events-none'
              }`}
            >
              {b.enlaceUrl ? (
                <a href={b.enlaceUrl} className="block w-full relative">
                  <img
                    src={withResourceVersion(b.imagenUrl)}
                    alt={b.titulo}
                    className="w-full h-auto block rounded-[20px] object-contain"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    onError={handleImageError}
                  />
                  {(b.titulo && b.titulo !== 'Ofertas cerca de ti - Yuudit' && b.titulo !== 'Banner Yuudit') && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 sm:p-6 flex flex-col justify-end text-white rounded-[20px]">
                      <h3 className="font-black text-sm sm:text-lg lg:text-xl drop-shadow-md">{b.titulo}</h3>
                      {b.subtitulo && <p className="text-xs sm:text-sm text-stone-200 drop-shadow-sm font-medium">{b.subtitulo}</p>}
                    </div>
                  )}
                </a>
              ) : (
                <div className="w-full relative">
                  <img
                    src={withResourceVersion(b.imagenUrl)}
                    alt={b.titulo}
                    className="w-full h-auto block rounded-[20px] object-contain"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    onError={handleImageError}
                  />
                  {(b.titulo && b.titulo !== 'Ofertas cerca de ti - Yuudit' && b.titulo !== 'Banner Yuudit' && b.subtitulo) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 sm:p-6 flex flex-col justify-end text-white rounded-[20px]">
                      <h3 className="font-black text-sm sm:text-lg lg:text-xl drop-shadow-md">{b.titulo}</h3>
                      {b.subtitulo && <p className="text-xs sm:text-sm text-stone-200 drop-shadow-sm font-medium">{b.subtitulo}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FLECHAS DE NAVEGACIÓN (SI HAY MÁS DE 1 BANNER) */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={handleAnterior}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
            title="Banner anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleSiguiente}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
            title="Banner siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* INDICADORES DE PUNTOS (PAGINACIÓN) */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setIndiceActual(idx)}
                className={`transition-all rounded-full cursor-pointer ${
                  idx === indiceActual
                    ? 'w-5 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                }`}
                title={`Ir al banner ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
