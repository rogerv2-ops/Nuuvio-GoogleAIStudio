import React, { useState } from 'react';

export const BannerHeader: React.FC = () => {
  const [imgSrc, setImgSrc] = useState<string>('/banner-ficha-oferta-mujer.webp');

  const handleImageError = () => {
    // If the local file fails, fall back immediately to the direct remote URL
    if (imgSrc !== 'https://sustrae.com/wp-content/uploads/2026/10/banner-ficha-oferta-mujer.webp') {
      setImgSrc('https://sustrae.com/wp-content/uploads/2026/10/banner-ficha-oferta-mujer.webp');
    }
  };

  return (
    <div
      className="w-full relative overflow-hidden rounded-[20px] border border-[#EAE5D9] shadow-sm bg-gradient-to-b from-[#FFFDF9] to-[#FFF5EA]"
      title="Ofertas cerca de ti - vuuy"
    >
      <img
        src={imgSrc}
        alt="Ofertas cerca de ti - Solo cuando las quieres"
        className="w-full h-auto block object-cover rounded-[20px] transition-transform duration-300"
        loading="eager"
        decoding="async"
        onError={handleImageError}
      />
    </div>
  );
};
