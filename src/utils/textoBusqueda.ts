// Normaliza un texto para comparar búsquedas: minúsculas y sin diacríticos,
// de modo que "cafe" encuentre "café". El servidor usa la misma normalización
// en los filtros de ofertas (server.ts, normalizarBusqueda); este helper cubre
// el filtro local del frontend público.
export const normalizarTextoBusqueda = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
