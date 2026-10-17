import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

/**
 * DTO de entrada para el render de tarjetas y mosaicos.
 * Deriva de Offer; solo los campos usados por el arte generado.
 */
export interface OfferCardData {
  id?: string;
  titulo: string;
  precioNormal: number;
  precioOferta: number;
  comercioNombre?: string;
  distrito?: string;
  imagen?: string;
  imagenes?: string[];
  imagenUrl?: string;
  categoria?: string;
  creadaEn?: string;
  venceEn?: string;
  descuentoPct?: number;
  etiqueta?: string;
}

export function formatLimaExpirationDate(venceEn?: string): string {
  if (!venceEn) return "⏰ Válida por tiempo limitado";
  const d = new Date(venceEn);
  if (isNaN(d.getTime())) return "⏰ Válida por tiempo limitado";
  const optionsDate = {
    timeZone: "America/Lima",
    day: "2-digit" as const,
    month: "short" as const
  };
  const optionsTime = {
    timeZone: "America/Lima",
    hour: "2-digit" as const,
    minute: "2-digit" as const,
    hour12: true
  };
  const now = new Date();
  const dateStr = d.toLocaleDateString("es-PE", optionsDate);
  const timeStr = d.toLocaleTimeString("es-PE", optionsTime).toLowerCase();
  const nowLimaStr = now.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
  const dLimaStr = d.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
  if (nowLimaStr === dLimaStr) {
    return `⏰ Válida hasta hoy ${timeStr}`;
  }
  return `⏰ Válida hasta el ${dateStr}, ${timeStr}`;
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
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

function drawSparkle(ctx: any, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
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

function drawStoreIcon(ctx: any, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.45);
  ctx.lineTo(x + w * 0.1, y);
  ctx.lineTo(x + w * 0.9, y);
  ctx.lineTo(x + w, y + h * 0.45);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.rect(x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.55);
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x + w * 0.35, y + h * 0.6, w * 0.3, h * 0.4);
  ctx.fill();
  ctx.restore();
}

function drawMapPin(ctx: any, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.5, r, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.lineTo(cx, cy + r * 1.1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.5, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function renderOfferCardImage(oferta: any): Promise<Buffer> {
  const width = 800;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  let imgLoaded = false;
  const imgSource = oferta.imagenUrl || (oferta.imagenes && oferta.imagenes[0]) || "";
  if (imgSource) {
    try {
      let resolvedSource = imgSource;
      if (imgSource.startsWith("/")) {
        const localPath = path.resolve(process.cwd(), "public", imgSource.replace(/^\/+/, ""));
        if (fs.existsSync(localPath)) {
          resolvedSource = localPath;
        }
      }
      const img = await loadImage(resolvedSource);
      const scale = Math.max(width / img.width, height / img.height);
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      imgLoaded = true;
    } catch (err) {
      console.warn(`[CardRenderer] Error cargando imagen (${imgSource}), usando respaldo:`, err);
    }
  }

  if (!imgLoaded) {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#1B4332");
    bgGrad.addColorStop(0.6, "#133526");
    bgGrad.addColorStop(1, "#081C13");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.arc(580, 240, 240, 0, Math.PI * 2);
    ctx.fill();
  }

  const pNorm = Number(oferta.precioNormal) || 0;
  const pOfer = Number(oferta.precioOferta) || 0;
  const descuentoPct = pNorm > pOfer && pNorm > 0 ? Math.round(((pNorm - pOfer) / pNorm) * 100) : 0;

  // Badges superiores izquierdos (Nuevo y Expira)
  let badgeX = 26;
  const badgeY = 26;
  const badgeH = 34;

  const esNueva = oferta.creadaEn ? Date.now() - new Date(oferta.creadaEn).getTime() < 48 * 3600 * 1000 : true;
  if (esNueva) {
    ctx.save();
    ctx.font = "bold 13px sans-serif";
    const textNuevo = "NUEVO";
    const textW = ctx.measureText(textNuevo).width;
    const bWidth = textW + 36;
    ctx.fillStyle = "#059669";
    roundRect(ctx, badgeX, badgeY, bWidth, badgeH, 17);
    ctx.fill();
    ctx.strokeStyle = "#34D399";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawSparkle(ctx, badgeX + 16, badgeY + badgeH / 2, 7, "#A7F3D0");
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(textNuevo, badgeX + 26, badgeY + badgeH / 2);
    ctx.restore();
    badgeX += bWidth + 8;
  }

  ctx.save();
  ctx.font = "bold 13px sans-serif";
  let expText = "EXPIRA EN 2H 55M";
  if (oferta.venceEn) {
    const d = new Date(oferta.venceEn);
    if (!isNaN(d.getTime())) {
      const diffMs = d.getTime() - Date.now();
      if (diffMs > 0 && diffMs < 24 * 3600 * 1000) {
        const hrs = Math.floor(diffMs / (3600 * 1000));
        const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        expText = `EXPIRA EN ${hrs}H ${mins}M`;
      } else {
        const opts = { timeZone: "America/Lima", day: "2-digit" as const, month: "short" as const };
        expText = `EXPIRA ${d.toLocaleDateString("es-PE", opts).toUpperCase()}`;
      }
    }
  }
  const expTextW = ctx.measureText(expText).width;
  const expBWidth = expTextW + 24;
  ctx.fillStyle = "#B91C1C";
  roundRect(ctx, badgeX, badgeY, expBWidth, badgeH, 17);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(expText, badgeX + 12, badgeY + badgeH / 2);
  ctx.restore();

  // Price Tag en la esquina superior derecha
  ctx.save();
  const tagWidth = 175;
  const tagHeight = 76;
  const tagX = width - 26 - tagWidth;
  const tagY = 26;

  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#FF5722";
  roundRect(ctx, tagX, tagY, tagWidth, tagHeight, 20);
  ctx.fill();
  ctx.shadowColor = "transparent";

  const pNormText = `S/ ${pNorm.toFixed(2)}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(pNormText, tagX + tagWidth - 16, tagY + 12);

  const pNormWidth = ctx.measureText(pNormText).width;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tagX + tagWidth - 16 - pNormWidth - 2, tagY + 20);
  ctx.lineTo(tagX + tagWidth - 14, tagY + 20);
  ctx.stroke();

  const pOferText = `S/ ${pOfer.toFixed(2)}`;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 30px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(pOferText, tagX + tagWidth - 16, tagY + tagHeight - 8);
  ctx.restore();

  // Badge de Descuento (justo debajo del tag de precio, sin corazón)
  if (descuentoPct > 0 || oferta.tipo === "2x1") {
    ctx.save();
    const descText = oferta.tipo === "2x1" ? "2X1" : `${descuentoPct}% OFF`;
    ctx.font = "900 14px sans-serif";
    const descW = ctx.measureText(descText).width + 24;
    const descH = 34;
    const descX = width - 26 - descW;
    const descY = tagY + tagHeight + 10;

    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#D1FAE5";
    roundRect(ctx, descX, descY, descW, descH, 12);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = "#6EE7B7";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "#065F46";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(descText, descX + descW / 2, descY + descH / 2);
    ctx.restore();
  }

  // Degradado inferior para legibilidad en 800x800
  const scrimHeight = 360;
  const scrimGrad = ctx.createLinearGradient(0, height - scrimHeight, 0, height);
  scrimGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
  scrimGrad.addColorStop(0.3, "rgba(0, 0, 0, 0.75)");
  scrimGrad.addColorStop(0.65, "rgba(0, 0, 0, 0.92)");
  scrimGrad.addColorStop(1, "rgba(0, 0, 0, 0.98)");
  ctx.fillStyle = scrimGrad;
  ctx.fillRect(0, height - scrimHeight, width, scrimHeight);

  // Título de la oferta encuadrado
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 32px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  const maxTitleW = width - 64;
  const words = (oferta.titulo || "").toUpperCase().split(" ");
  let line1 = "";
  let line2 = "";

  for (const w of words) {
    const testLine = line1 ? `${line1} ${w}` : w;
    if (ctx.measureText(testLine).width <= maxTitleW && !line2) {
      line1 = testLine;
    } else {
      line2 = line2 ? `${line2} ${w}` : w;
    }
  }

  if (line2 && ctx.measureText(line2).width > maxTitleW) {
    while (ctx.measureText(line2 + "...").width > maxTitleW && line2.length > 0) {
      line2 = line2.slice(0, -1);
    }
    line2 += "...";
  }

  const titleBaseY = height - 105;
  if (line2) {
    ctx.fillText(line1, 32, titleBaseY - 38);
    ctx.fillText(line2, 32, titleBaseY);
  } else {
    ctx.fillText(line1, 32, titleBaseY);
  }
  ctx.restore();

  // Línea divisoria
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, height - 85);
  ctx.lineTo(width - 32, height - 85);
  ctx.stroke();
  ctx.restore();

  // Comercio y Badge inferior de Distrito (solo distrito, sin '10 km · ')
  ctx.save();
  drawStoreIcon(ctx, 32, height - 58, 24, 24, "#34D399");
  ctx.font = "900 20px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const cName = (oferta.comercioNombre || "Comercio").slice(0, 24);
  ctx.fillText(cName, 64, height - 46);

  const distBadgeLabel = (oferta.distrito || "Lima").trim();
  ctx.font = "900 15px sans-serif";
  const distTextW = ctx.measureText(distBadgeLabel).width;
  const distBadgeW = distTextW + 48;
  const distBadgeH = 38;
  const distBadgeX = width - 32 - distBadgeW;
  const distBadgeY = height - 65;

  ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
  roundRect(ctx, distBadgeX, distBadgeY, distBadgeW, distBadgeH, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(251, 191, 36, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawMapPin(ctx, distBadgeX + 16, distBadgeY + distBadgeH / 2 + 1, 6, "#FBBF24");
  ctx.fillStyle = "#FCD34D";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(distBadgeLabel, distBadgeX + 30, distBadgeY + distBadgeH / 2);
  ctx.restore();

  const buffer = canvas.toBuffer("image/jpeg");

  try {
    const cardsDir = path.resolve(process.cwd(), "public", "cards");
    if (!fs.existsSync(cardsDir)) {
      fs.mkdirSync(cardsDir, { recursive: true });
    }
    const cleanId = (oferta.id || "card").replace(/[^a-zA-Z0-9_-]/g, "_");
    fs.writeFileSync(path.join(cardsDir, `card_${cleanId}.jpg`), buffer);
  } catch (saveErr) {
    console.warn("[CardRenderer] No se pudo guardar tarjeta en disco:", saveErr);
  }

  return buffer;
}


/**
 * Renderiza un mosaico vertical de múltiples ofertas (1:1 apiladas) con numeración llamativa
 */
export async function renderMosaicImage(ofertas: OfferCardData[]): Promise<Buffer> {
  const count = Math.max(1, ofertas.length);
  const width = 800;
  const segmentHeight = 800;
  const totalHeight = segmentHeight * count;

  const mosaicCanvas = createCanvas(width, totalHeight);
  const ctx = mosaicCanvas.getContext("2d");

  for (let i = 0; i < ofertas.length; i++) {
    const oferta = ofertas[i];
    const yOffset = i * segmentHeight;

    // Renderizar tarjeta individual de 800x800
    const cardBuffer = await renderOfferCardImage(oferta);
    const cardImg = await loadImage(cardBuffer);

    // Dibujarla en el canvas general en su posición Y
    ctx.drawImage(cardImg, 0, yOffset, width, segmentHeight);

    // Línea divisoria elegante entre ofertas si no es la primera
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, yOffset);
      ctx.lineTo(width, yOffset);
      ctx.stroke();
      ctx.restore();
    }

    // Dibuja un círculo oscuro llamativo en la esquina superior izquierda con el número de oferta (1, 2 o 3)
    ctx.save();
    const badgeX = 54;
    const badgeY = yOffset + 54;
    const radius = 30;

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(17, 24, 39, 0.95)";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#F59E0B"; // Borde dorado llamativo
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.font = "900 28px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${i + 1}`, badgeX, badgeY);
    ctx.restore();
  }

  const mosaicBuffer = mosaicCanvas.toBuffer("image/jpeg");
  try {
    const cardsDir = path.resolve(process.cwd(), "public", "cards");
    if (!fs.existsSync(cardsDir)) {
      fs.mkdirSync(cardsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(cardsDir, "mosaic_latest.jpg"), mosaicBuffer);
  } catch {}

  return mosaicBuffer;
}
