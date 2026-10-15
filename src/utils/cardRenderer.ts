import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

export interface OfferCardData {
  id: string;
  titulo: string;
  comercioNombre: string;
  precioNormal: number | string;
  precioOferta: number | string;
  distrito: string;
  categoria?: string;
  imagenUrl?: string;
  imagenes?: string[];
  tipo?: string;
  venceEn?: string | Date;
  distanciaTexto?: string;
  creadaEn?: string | Date;
}

/**
 * Formatea una fecha de expiración en hora de Lima (America/Lima)
 */
export function formatLimaExpirationDate(venceEn?: string | Date): string {
  if (!venceEn) return '⏰ Válida por tiempo limitado';
  const d = new Date(venceEn);
  if (isNaN(d.getTime())) return '⏰ Válida por tiempo limitado';

  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'short',
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Lima',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const now = new Date();
  const dateStr = d.toLocaleDateString('es-PE', optionsDate);
  const timeStr = d.toLocaleTimeString('es-PE', optionsTime).toLowerCase();

  const nowLimaStr = now.toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
  const dLimaStr = d.toLocaleDateString('es-PE', { timeZone: 'America/Lima' });

  if (nowLimaStr === dLimaStr) {
    return `⏰ Válida hasta hoy ${timeStr}`;
  }
  return `⏰ Válida hasta el ${dateStr}, ${timeStr}`;
}

/**
 * Función auxiliar para dibujar rectángulos con bordes redondeados
 */
function roundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Dibuja un icono vectorial de estrella brillante (Sparkle) sin depender de fuentes de emojis
 */
function drawSparkle(ctx: any, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  // Estrella de 4 puntas cóncava
  const rOuter = size;
  const rInner = size * 0.28;
  for (let i = 0; i < 4; i++) {
    const angleOuter = (i * Math.PI) / 2;
    const angleInner = angleOuter + Math.PI / 4;
    if (i === 0) {
      ctx.moveTo(cx + Math.cos(angleOuter) * rOuter, cy + Math.sin(angleOuter) * rOuter);
    } else {
      ctx.lineTo(cx + Math.cos(angleOuter) * rOuter, cy + Math.sin(angleOuter) * rOuter);
    }
    ctx.lineTo(cx + Math.cos(angleInner) * rInner, cy + Math.sin(angleInner) * rInner);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Dibuja un icono vectorial de rayo (Lightning)
 */
function drawLightning(ctx: any, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.1, cy - size * 0.9);
  ctx.lineTo(cx - size * 0.55, cy + size * 0.05);
  ctx.lineTo(cx - size * 0.05, cy + size * 0.05);
  ctx.lineTo(cx - size * 0.2, cy + size * 0.95);
  ctx.lineTo(cx + size * 0.6, cy - size * 0.05);
  ctx.lineTo(cx + size * 0.05, cy - size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Dibuja un icono vectorial de fachada de tienda / comercio
 */
function drawStoreIcon(ctx: any, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Techo / toldo
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.45);
  ctx.lineTo(x + w * 0.1, y);
  ctx.lineTo(x + w * 0.9, y);
  ctx.lineTo(x + w, y + h * 0.45);
  ctx.closePath();
  ctx.fill();

  // Columnas y base
  ctx.beginPath();
  ctx.rect(x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.55);
  ctx.stroke();

  // Puerta central
  ctx.beginPath();
  ctx.rect(x + w * 0.35, y + h * 0.6, w * 0.3, h * 0.4);
  ctx.fill();
  ctx.restore();
}

/**
 * Dibuja un icono vectorial de chincheta de ubicación (Map Pin)
 */
function drawMapPin(ctx: any, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.5, r, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.lineTo(cx, cy + r * 1.1);
  ctx.closePath();
  ctx.fill();

  // Círculo interior
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.5, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Dibuja un icono vectorial de corazón
 */
function drawHeart(ctx: any, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(cx, cy + size * 0.4);
  ctx.bezierCurveTo(cx, cy + size * 0.1, cx - size * 0.5, cy - topCurveHeight, cx - size * 0.5, cy - size * 0.2);
  ctx.bezierCurveTo(cx - size * 0.5, cy - size * 0.55, cx, cy - size * 0.4, cx, cy - size * 0.1);
  ctx.bezierCurveTo(cx, cy - size * 0.4, cx + size * 0.5, cy - size * 0.55, cx + size * 0.5, cy - size * 0.2);
  ctx.bezierCurveTo(cx + size * 0.5, cy - topCurveHeight, cx, cy + size * 0.1, cx, cy + size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renderiza una tarjeta visual de oferta con badges, etiquetas y precios 100% idénticos
 * a como se muestra la imagen en el feed de la aplicación web (formato 4:5 vertical).
 * Retorna un Buffer JPEG optimizado para entrega instantánea en WhatsApp.
 */
export async function renderOfferCardImage(oferta: OfferCardData): Promise<Buffer> {
  const width = 800;
  const height = 1000; // Aspect ratio canónico 4:5 vertical
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Cargar imagen de fondo de la oferta (o resolver ruta local)
  let imgLoaded = false;
  const imgSource = oferta.imagenUrl || (oferta.imagenes && oferta.imagenes[0]) || '';
  if (imgSource) {
    try {
      let resolvedSource = imgSource;
      if (imgSource.startsWith('/')) {
        const localPath = path.resolve(process.cwd(), 'public', imgSource.replace(/^\/+/, ''));
        if (fs.existsSync(localPath)) {
          resolvedSource = localPath;
        }
      }
      const img = await loadImage(resolvedSource);
      // Object-fit: cover centrado y exacto al feed
      const scale = Math.max(width / img.width, height / img.height);
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      imgLoaded = true;
    } catch (err) {
      console.warn(`[CardRenderer] Error cargando imagen (${imgSource}), usando respaldo de alta fidelidad:`, err);
    }
  }

  if (!imgLoaded) {
    // Fondo fallback premium degradado con textura
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#1B4332');
    bgGrad.addColorStop(0.6, '#133526');
    bgGrad.addColorStop(1, '#081C13');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.arc(620, 260, 260, 0, Math.PI * 2);
    ctx.fill();
  }

  // Precios y descuento
  const pNorm = Number(oferta.precioNormal) || 0;
  const pOfer = Number(oferta.precioOferta) || 0;
  const descuentoPct = pNorm > pOfer && pNorm > 0 ? Math.round(((pNorm - pOfer) / pNorm) * 100) : 0;

  // =========================================================================
  // 2. BADGES SUPERIORES IZQUIERDOS (Fila horizontal idéntica a flex gap-1.5 de la web)
  // =========================================================================
  let badgeX = 26;
  const badgeY = 26;
  const badgeH = 34;

  // BADGE 1: "NUEVO" (Esmeralda con estrella Sparkle)
  // En la web: <span className="bg-emerald-600 text-white text-[10px] font-black ..."><Sparkles /> Nuevo</span>
  const esNueva = oferta.creadaEn ? (Date.now() - new Date(oferta.creadaEn).getTime() < 48 * 3600 * 1000) : true;
  if (esNueva) {
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    const textNuevo = 'NUEVO';
    const textW = ctx.measureText(textNuevo).width;
    const bWidth = textW + 36;

    ctx.fillStyle = '#059669'; // Emerald 600
    roundRect(ctx, badgeX, badgeY, bWidth, badgeH, 17);
    ctx.fill();

    ctx.strokeStyle = '#34D399'; // Emerald 400
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icono Sparkle vectorial
    drawSparkle(ctx, badgeX + 16, badgeY + badgeH / 2, 7, '#A7F3D0');

    // Texto
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(textNuevo, badgeX + 26, badgeY + badgeH / 2);
    ctx.restore();

    badgeX += bWidth + 8;
  }

  // BADGE 2: "EXPIRA EN 2H 55M" (Rojo de urgencia)
  // En la web: <span className="bg-[#B91C1C] text-white text-[10px] font-black ...">Expira en 2h 55m</span>
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  let expText = 'EXPIRA EN 2H 55M';
  if (oferta.venceEn) {
    const d = new Date(oferta.venceEn);
    if (!isNaN(d.getTime())) {
      const diffMs = d.getTime() - Date.now();
      if (diffMs > 0 && diffMs < 24 * 3600 * 1000) {
        const hrs = Math.floor(diffMs / (3600 * 1000));
        const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        expText = `EXPIRA EN ${hrs}H ${mins}M`;
      } else {
        const opts: Intl.DateTimeFormatOptions = { timeZone: 'America/Lima', day: 'numeric', month: 'short' };
        expText = `EXPIRA ${d.toLocaleDateString('es-PE', opts).toUpperCase()}`;
      }
    }
  }
  const expTextW = ctx.measureText(expText).width;
  const expBWidth = expTextW + 24;

  ctx.fillStyle = '#B91C1C'; // Red 700
  roundRect(ctx, badgeX, badgeY, expBWidth, badgeH, 17);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(expText, badgeX + 12, badgeY + badgeH / 2);
  ctx.restore();

  badgeX += expBWidth + 8;

  // BADGE 3: "⚡ BOOSTED" (Celeste con rayo azul)
  // En la web: <span className="bg-[#E0F2FE] text-[#0369A1] text-[10px] font-extrabold ..."><span>⚡</span> Boosted</span>
  // Si no cabe en la fila superior (límite con el precio), se dibuja debajo
  const precioTagX = width - 26 - 170;
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  const boostedLabel = 'BOOSTED';
  const boostedTextW = ctx.measureText(boostedLabel).width;
  const boostedBWidth = boostedTextW + 36;

  let boostedX = badgeX;
  let boostedY = badgeY;
  if (boostedX + boostedBWidth > precioTagX - 10) {
    boostedX = 26;
    boostedY = badgeY + badgeH + 8;
  }

  ctx.fillStyle = '#E0F2FE'; // Sky 100
  roundRect(ctx, boostedX, boostedY, boostedBWidth, badgeH, 17);
  ctx.fill();

  ctx.strokeStyle = '#BAE6FD'; // Sky 200
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rayo vectorial
  drawLightning(ctx, boostedX + 15, boostedY + badgeH / 2, 7, '#0369A1');

  ctx.fillStyle = '#0369A1'; // Sky 700
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(boostedLabel, boostedX + 26, boostedY + badgeH / 2);
  ctx.restore();

  // =========================================================================
  // 3. ETIQUETA NARANJA DE PRECIO SUPERIOR DERECHA (Idéntica al feed web)
  // En la web:
  // <div className="absolute top-3.5 right-3.5 bg-[#FF5722] text-white px-3.5 py-1.5 rounded-2xl shadow-md text-right leading-none">
  //   <span className="line-through text-[10px]">S/ {precioNormal}</span>
  //   <span className="text-base font-black">S/ {precioOferta}</span>
  // </div>
  // =========================================================================
  ctx.save();
  const tagWidth = 175;
  const tagHeight = 76;
  const tagX = width - 26 - tagWidth;
  const tagY = 26;

  // Sombra de elevación de la etiqueta
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#FF5722'; // Naranja brillante del feed
  roundRect(ctx, tagX, tagY, tagWidth, tagHeight, 20);
  ctx.fill();

  // Desactivar sombra para el texto
  ctx.shadowColor = 'transparent';

  // Precio Normal tachado
  const pNormText = `S/ ${pNorm.toFixed(2)}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(pNormText, tagX + tagWidth - 16, tagY + 12);

  const pNormWidth = ctx.measureText(pNormText).width;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tagX + tagWidth - 16 - pNormWidth - 2, tagY + 20);
  ctx.lineTo(tagX + tagWidth - 14, tagY + 20);
  ctx.stroke();

  // Precio Oferta grande y llamativo
  const pOferText = `S/ ${pOfer.toFixed(2)}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 30px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(pOferText, tagX + tagWidth - 16, tagY + tagHeight - 8);
  ctx.restore();

  // Botón Bookmark / Favorito y Badge de Descuento % OFF justo debajo del precio
  const subY = tagY + tagHeight + 10;

  // Botón circular verde oscuro de favoritos (Bookmark)
  ctx.save();
  const heartR = 19;
  const heartCx = width - 26 - heartR;
  const heartCy = subY + heartR;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#1B4332'; // Verde bosque del feed
  ctx.beginPath();
  ctx.arc(heartCx, heartCy, heartR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Icono corazón blanco en el centro
  drawHeart(ctx, heartCx, heartCy + 1, 15, '#FFFFFF');
  ctx.restore();

  // Badge de Descuento % OFF a la izquierda del botón de favorito
  if (descuentoPct > 0 || oferta.tipo === '2x1') {
    ctx.save();
    const descText = oferta.tipo === '2x1' ? '2X1' : `${descuentoPct}% OFF`;
    ctx.font = '900 14px sans-serif';
    const descW = ctx.measureText(descText).width + 24;
    const descH = 34;
    const descX = heartCx - heartR - 8 - descW;
    const descY = subY + 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#D1FAE5'; // Menta clara
    roundRect(ctx, descX, descY, descW, descH, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#6EE7B7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#065F46'; // Verde esmeralda intenso
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(descText, descX + descW / 2, descY + descH / 2);
    ctx.restore();
  }

  // =========================================================================
  // 4. DEGRADADO INFERIOR (SCRIM OSCURO DE PROFUNDIDAD)
  // En la web: <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent ...">
  // =========================================================================
  const scrimGrad = ctx.createLinearGradient(0, height - 420, 0, height);
  scrimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrimGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.75)');
  scrimGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.92)');
  scrimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
  ctx.fillStyle = scrimGrad;
  ctx.fillRect(0, height - 420, width, 420);

  // =========================================================================
  // 5. TÍTULO DE LA OFERTA (Mayúsculas, tipografía gruesa 900, sombra profunda)
  // En la web: <h3 className="font-black text-2xl sm:text-3xl text-white uppercase drop-shadow ...">
  // =========================================================================
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';

  // Ajuste inteligente en dos líneas si excede el ancho disponible
  const maxTitleW = width - 64;
  const words = (oferta.titulo || '').toUpperCase().split(' ');
  let line1 = '';
  let line2 = '';

  for (const w of words) {
    const testLine = line1 ? `${line1} ${w}` : w;
    if (ctx.measureText(testLine).width <= maxTitleW && !line2) {
      line1 = testLine;
    } else {
      line2 = line2 ? `${line2} ${w}` : w;
    }
  }

  if (line2 && ctx.measureText(line2).width > maxTitleW) {
    while (ctx.measureText(line2 + '...').width > maxTitleW && line2.length > 0) {
      line2 = line2.slice(0, -1);
    }
    line2 += '...';
  }

  const titleBaseY = height - 128;
  if (line2) {
    ctx.fillText(line1, 32, titleBaseY - 44);
    ctx.fillText(line2, 32, titleBaseY);
  } else {
    ctx.fillText(line1, 32, titleBaseY);
  }
  ctx.restore();

  // =========================================================================
  // 6. LÍNEA DIVISORIA SUTIL SUPERIOR AL FOOTER DE LA TARJETA
  // En la web: <div className="... pt-2 border-t border-white/25">
  // =========================================================================
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, height - 104);
  ctx.lineTo(width - 32, height - 104);
  ctx.stroke();
  ctx.restore();

  // =========================================================================
  // 7. FILA INFERIOR: COMERCIO Y DISTRITO / DISTANCIA
  // En la web:
  // <span className="flex items-center gap-2 font-black text-sm text-white"><Store /> {comercioNombre}</span>
  // <span className="inline-flex items-center gap-2 bg-black/75 px-3.5 py-1.5 rounded-xl border border-amber-400/50 text-amber-300 font-black ..."><MapPin /> {distancia} · {distrito}</span>
  // =========================================================================
  ctx.save();
  // Icono de comercio y nombre a la izquierda
  drawStoreIcon(ctx, 32, height - 68, 26, 26, '#34D399');

  ctx.font = '900 22px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const cName = (oferta.comercioNombre || 'Comercio').slice(0, 24);
  ctx.fillText(cName, 68, height - 54);

  // Badge de Distrito / Distancia a la derecha con marco ámbar
  const distText = oferta.distanciaTexto ? `${oferta.distanciaTexto} · ` : '10 km · ';
  const distBadgeLabel = `${distText}${oferta.distrito || 'Lima'}`;
  ctx.font = '900 16px sans-serif';
  const distTextW = ctx.measureText(distBadgeLabel).width;
  const distBadgeW = distTextW + 48;
  const distBadgeH = 42;
  const distBadgeX = width - 32 - distBadgeW;
  const distBadgeY = height - 76;

  // Fondo translúcido con blur simulado
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  roundRect(ctx, distBadgeX, distBadgeY, distBadgeW, distBadgeH, 14);
  ctx.fill();

  // Borde ámbar brillante
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)'; // Ámbar 400
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Icono MapPin vectorial ámbar
  drawMapPin(ctx, distBadgeX + 18, distBadgeY + distBadgeH / 2 + 1, 6, '#FBBF24');

  // Texto del distrito
  ctx.fillStyle = '#FCD34D'; // Ámbar 300
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(distBadgeLabel, distBadgeX + 32, distBadgeY + distBadgeH / 2);
  ctx.restore();

  // Guardar en disco para acceso estático y CDN
  const buffer = canvas.toBuffer('image/jpeg');
  try {
    const cardsDir = path.resolve(process.cwd(), 'public', 'cards');
    if (!fs.existsSync(cardsDir)) {
      fs.mkdirSync(cardsDir, { recursive: true });
    }
    const cleanId = (oferta.id || 'card').replace(/[^a-zA-Z0-9_-]/g, '_');
    fs.writeFileSync(path.join(cardsDir, `card_${cleanId}.jpg`), buffer);
  } catch (saveErr) {
    console.warn('[CardRenderer] No se pudo guardar tarjeta en disco:', saveErr);
  }

  return buffer;
}
