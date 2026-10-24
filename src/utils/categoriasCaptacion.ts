/**
 * Categorías de captación del embudo de prerregistro de comercios (yuddit.com).
 *
 * Fuente: decisión de Roger del 2026-10-24 11:13 (WhatsApp) — densidad en
 * Miraflores con estas 17 categorías. Texto EXACTO (p. ej. "Herramientas,
 * Autos y Motos"); no "corregir" tildes ni separadores.
 *
 * OJO: no son las categorías que usan las ofertas del piloto ("Gastronomía y
 * Café", etc.). El mapping entre ambas se define al validar la conversión
 * prerregistro → alta formal con yuddit OS; hasta entonces no se mezclan.
 */
export const CATEGORIAS_CAPTACION = [
  "Tecnología y Electrónica",
  "Hogar y Cocina",
  "Electrodomésticos",
  "Moda y Calzado",
  "Accesorios",
  "Videojuegos",
  "Deportes y Aire Libre",
  "Herramientas, Autos y Motos",
  "Salud y Belleza",
  "Supermercado y Alimentos",
  "Aplicaciones y Software",
  "Educación y Cursos",
  "Entretenimiento y Ocio",
  "Comida y Restaurantes",
  "Experiencias y Servicios",
  "Juguetes y Niños",
  "Viajes",
] as const;

export type CategoriaCaptacion = (typeof CATEGORIAS_CAPTACION)[number];

export const esCategoriaCaptacion = (v: unknown): v is CategoriaCaptacion =>
  typeof v === "string" && (CATEGORIAS_CAPTACION as readonly string[]).includes(v);
