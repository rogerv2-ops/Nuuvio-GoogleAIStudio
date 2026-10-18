/**
 * Utilidades para ofertas en Yuddit
 */

/**
 * Determina si una oferta fue agregada dentro de las últimas 24 horas.
 * Soporta timestamps ISO o strings de fecha válidos.
 */
export function esOfertaNueva(creadaEn?: string | null): boolean {
  if (!creadaEn) return false;
  const fecha = new Date(creadaEn).getTime();
  if (isNaN(fecha)) return false;
  
  const ahora = Date.now();
  const diffMs = ahora - fecha;
  
  // Rango: desde ahora (con tolerancia de 10 min por desfase horario de cliente) hasta 24 horas atrás
  const veinticuatroHorasMs = 24 * 60 * 60 * 1000;
  return diffMs >= -10 * 60 * 1000 && diffMs <= veinticuatroHorasMs;
}
