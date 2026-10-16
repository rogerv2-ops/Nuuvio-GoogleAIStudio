/**
 * Utilidad de imágenes e ilustraciones de respaldo en formato 4:5 estándar (800x1000 px).
 * Garantiza que ninguna tarjeta u oferta aparezca rota si la red o el CDN falla.
 */

export function getCategoryFallbackImage(categoria: string = '', titulo: string = ''): string {
  const cat = categoria.toLowerCase();
  const tit = titulo.toLowerCase();

  // Definición de paletas y motivos según categoría
  let bg1 = '#0F2027';
  let bg2 = '#203A43';
  let accent = '#FF5722';
  let iconSvg = '';
  let badgeLabel = 'OFERTA DESTACADA';

  if (cat.includes('gastronom') || cat.includes('caf') || tit.includes('ceviche') || tit.includes('bao') || tit.includes('sushi')) {
    bg1 = '#1C1917';
    bg2 = '#292524';
    accent = '#FF5722';
    badgeLabel = 'GASTRONOMÍA & SABOR';
    // SVG Bowl / Dish icon
    iconSvg = `
      <g stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 280 460 Q 400 600 520 460 Z" fill="${accent}" fill-opacity="0.15" />
        <ellipse cx="400" cy="460" rx="120" ry="24" fill="${accent}" fill-opacity="0.25" />
        <path d="M 340 380 Q 360 340 350 300" stroke="#F59E0B" />
        <path d="M 400 370 Q 420 330 410 290" stroke="#F59E0B" />
        <path d="M 460 380 Q 480 340 470 300" stroke="#F59E0B" />
        <circle cx="400" cy="530" r="14" fill="${accent}" />
      </g>
    `;
  } else if (cat.includes('moda') || cat.includes('calzado') || tit.includes('alpaca')) {
    bg1 = '#1E1B18';
    bg2 = '#2B2520';
    accent = '#D97706';
    badgeLabel = 'MODA & ACCESORIOS';
    // SVG Hanger / Shopping bag icon
    iconSvg = `
      <g stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 400 340 C 370 340 370 300 400 300 C 430 300 420 360 400 380 L 260 490 L 540 490 Z" fill="${accent}" fill-opacity="0.15" />
        <line x1="260" y1="490" x2="540" y2="490" stroke-width="8" />
        <circle cx="400" cy="300" r="8" fill="${accent}" />
      </g>
    `;
  } else if (cat.includes('belleza') || cat.includes('bienestar') || tit.includes('spa') || tit.includes('masaje')) {
    bg1 = '#0F1E19';
    bg2 = '#193229';
    accent = '#10B981';
    badgeLabel = 'BIENESTAR & SPA';
    // Lotus / Leaf icon
    iconSvg = `
      <g stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 400 300 Q 450 400 400 500 Q 350 400 400 300 Z" fill="${accent}" fill-opacity="0.2" />
        <path d="M 320 360 Q 370 430 400 490 Q 330 460 320 360 Z" fill="${accent}" fill-opacity="0.15" />
        <path d="M 480 360 Q 430 430 400 490 Q 470 460 480 360 Z" fill="${accent}" fill-opacity="0.15" />
      </g>
    `;
  } else {
    bg1 = '#0B132B';
    bg2 = '#1C2541';
    accent = '#3B82F6';
    badgeLabel = 'OFERTA LOCAL';
    iconSvg = `
      <g stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="300" y="340" width="200" height="180" rx="20" fill="${accent}" fill-opacity="0.15" />
        <path d="M 340 340 L 340 300 Q 400 260 460 300 L 460 340" />
      </g>
    `;
  }

  const tituloLimpio = titulo.replace(/[<>&"]/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="60%" stop-color="${bg2}" />
        <stop offset="100%" stop-color="#000000" />
      </linearGradient>
      <radialGradient id="glowGrad" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.28" />
        <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
      </radialGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="1.5" fill="#FFFFFF" fill-opacity="0.06" />
      </pattern>
    </defs>
    
    <!-- Fondo 4:5 vertical -->
    <rect width="800" height="1000" fill="url(#bgGrad)" />
    <rect width="800" height="1000" fill="url(#grid)" />
    <circle cx="400" cy="420" r="300" fill="url(#glowGrad)" />

    <!-- Marca superior -->
    <g transform="translate(60, 70)">
      <rect width="40" height="40" rx="10" fill="#1B4332" />
      <text x="20" y="27" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#FFFFFF" text-anchor="middle">v</text>
      <text x="54" y="27" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#FFFFFF" letter-spacing="-0.5">vuuy</text>
      <rect x="120" y="4" width="170" height="32" rx="16" fill="${accent}" fill-opacity="0.2" stroke="${accent}" stroke-width="1.5" />
      <text x="205" y="25" font-family="system-ui, sans-serif" font-weight="800" font-size="12" fill="${accent}" text-anchor="middle" letter-spacing="1">${badgeLabel}</text>
    </g>

    <!-- Icono central representativo -->
    ${iconSvg}

    <!-- Título y detalles al pie -->
    <g transform="translate(60, 780)">
      <rect x="-10" y="-10" width="680" height="140" rx="20" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.1" />
      <text x="20" y="40" font-family="system-ui, sans-serif" font-weight="800" font-size="34" fill="#FFFFFF">
        ${tituloLimpio.length > 32 ? tituloLimpio.substring(0, 30) + '...' : tituloLimpio}
      </text>
      <text x="20" y="80" font-family="system-ui, sans-serif" font-weight="500" font-size="22" fill="#E2E8F0">
        Formato estándar 4:5 • Lima, Perú
      </text>
      <text x="20" y="110" font-family="system-ui, sans-serif" font-weight="700" font-size="16" fill="${accent}">
        ⚡ Toca para ver detalle o pedir por WhatsApp
      </text>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Handler común de onError para tags <img>
 */
export function handleImgError(e: React.SyntheticEvent<HTMLImageElement, Event>, fallbackUrl: string) {
  const target = e.currentTarget;
  if (target.src !== fallbackUrl) {
    target.src = fallbackUrl;
  }
}
