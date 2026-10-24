/**
 * Módulo de Gestión de Banners del Feed
 * Almacenamiento persistente, sincronización multi-navegador con el servidor y orden de rotación
 */

export interface FeedBanner {
  id: string;
  titulo: string;
  subtitulo?: string;
  imagenUrl: string;
  enlaceUrl?: string; // Enlace opcional al hacer clic
  activado: boolean;
  orden: number;
  creadoEn: string;
}

/**
 * Logo de la landing (cabecera publica).
 *
 * Se configura en la seccion de Banners y se guarda en el servidor
 * (app_settings.landing_logo) junto al resto de la configuracion del sitio.
 * Solo se guarda el ALTO: el ancho lo calcula el navegador, asi la imagen
 * siempre mantiene su proporcion y nunca se deforma.
 */
export interface LogoLanding {
  imagenUrl: string;
  altoPx: number;
  iconUrl?: string;
}

export const LOGO_LANDING_ALTO_MIN = 24;
export const LOGO_LANDING_ALTO_MAX = 160;

export const DEFAULT_LOGO_LANDING: LogoLanding = {
  imagenUrl: '',
  altoPx: 40,
  iconUrl: ''
};

const LOCAL_STORAGE_KEY_LOGO = 'vuuy_landing_logo_v1';

/**
 * Color de fondo de la landing.
 *
 * Se configura en la seccion de Banners (debajo del logo) y se guarda en el
 * servidor (app_settings.landing_fondo) junto al resto de la configuracion.
 * Se acepta solo hexadecimal: `#rrggbb` o la forma corta `#rgb`, que se
 * expande a `#rrggbb`. Cualquier otra cosa no es un color y se rechaza.
 */
export const FONDO_LANDING_DEFAULT = '#d9f3dd';

const LOCAL_STORAGE_KEY_FONDO = 'vuuy_landing_fondo_v1';

export function normalizarColorFondo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const hex = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return null;
}

/** Convierte `#rrggbb` en `rgba(r, g, b, alfa)` para las capas con transparencia. */
export function colorConAlfa(hex: string, alfa: number): string {
  const color = normalizarColorFondo(hex) || FONDO_LANDING_DEFAULT;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

function normalizarLogo(raw: unknown): LogoLanding {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LOGO_LANDING };
  const datos = raw as Partial<LogoLanding>;
  const imagenUrl = typeof datos.imagenUrl === 'string' ? datos.imagenUrl.trim() : '';
  const alto = Math.round(Number(datos.altoPx));
  const altoPx = Number.isFinite(alto)
    ? Math.min(LOGO_LANDING_ALTO_MAX, Math.max(LOGO_LANDING_ALTO_MIN, alto))
    : DEFAULT_LOGO_LANDING.altoPx;
  const iconUrl = typeof datos.iconUrl === 'string' ? datos.iconUrl.trim() : '';
  return { imagenUrl, altoPx, iconUrl };
}

const LOCAL_STORAGE_KEY_BANNERS = 'vuuy_feed_banners_v2';

export const DEFAULT_BANNERS: FeedBanner[] = [
  {
    id: 'banner_01',
    titulo: 'Ofertas cerca de ti - Yuddit',
    subtitulo: 'Solo cuando las quieres. Sin spam ni perder tiempo. En tu zona.',
    imagenUrl: '/banner-ficha-oferta-mujer.webp',
    enlaceUrl: '',
    activado: true,
    orden: 1,
    creadoEn: new Date().toISOString()
  },
  {
    id: 'banner_02',
    titulo: 'Gastronomía y Café en Lima',
    subtitulo: 'Descubre los mejores combos con hasta 50% de descuento',
    imagenUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&h=400&q=80',
    enlaceUrl: '',
    activado: true,
    orden: 2,
    creadoEn: new Date().toISOString()
  },
  {
    id: 'banner_03',
    titulo: 'Belleza y Cuidado Personal',
    subtitulo: 'Tratamientos y promociones en centros autorizados',
    imagenUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&h=400&q=80',
    enlaceUrl: '',
    activado: true,
    orden: 3,
    creadoEn: new Date().toISOString()
  }
];

class BannersModule {
  private banners: FeedBanner[] = [];
  private logo: LogoLanding = { ...DEFAULT_LOGO_LANDING };
  private fondo: string = FONDO_LANDING_DEFAULT;
  private listeners: (() => void)[] = [];
  private sincronizadoConServidor = false;

  constructor() {
    this.cargar();
    this.cargarLogo();
    this.cargarFondo();
    this.sincronizarConServidor();
  }

  private cargarFondo() {
    try {
      if (typeof window !== 'undefined') {
        const color = normalizarColorFondo(localStorage.getItem(LOCAL_STORAGE_KEY_FONDO));
        if (color) this.fondo = color;
      }
    } catch {
      // Usar el fondo por defecto
    }
  }

  private guardarFondoLocal() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY_FONDO, this.fondo);
      }
    } catch {
      // El fondo igual vive en el servidor
    }
  }

  private cargarLogo() {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGO);
        if (raw) {
          this.logo = normalizarLogo(JSON.parse(raw));
        }
      }
    } catch {
      // Usar el logo por defecto
    }
  }

  private guardarLogoLocal() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY_LOGO, JSON.stringify(this.logo));
      }
    } catch {
      // El logo igual vive en el servidor
    }
  }

  private migrarBannerUrls(lista: FeedBanner[]): FeedBanner[] {
    return lista.map(b => {
      if (b.imagenUrl && (b.imagenUrl.includes('sustrae.com') || b.imagenUrl.includes('banner.webp'))) {
        return {
          ...b,
          imagenUrl: '/banner-ficha-oferta-mujer.webp',
          titulo: b.titulo === 'Ofertas cerca de ti - Yuddit' ? 'Ofertas cerca de ti - Yuddit' : b.titulo
        };
      }
      return b;
    });
  }

  private cargar() {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY_BANNERS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.banners = this.migrarBannerUrls(parsed);
            return;
          }
        }
      }
    } catch {
      // Usar defaults
    }
    this.banners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
  }

  public async sincronizarConServidor() {
    if (typeof window === 'undefined') return;

    try {
      const resp = await fetch('/api/banners');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.ok && Array.isArray(data.banners)) {
          // El servidor es la fuente de verdad: reflejamos su lista, incluso si está vacía.
          const bannersServidor = this.migrarBannerUrls(data.banners);
          this.banners = bannersServidor;
          if (data.logo !== undefined && data.logo !== null) {
            this.logo = normalizarLogo(data.logo);
            this.guardarLogoLocal();
          }
          const fondoServidor = normalizarColorFondo(data.fondo);
          if (fondoServidor) {
            this.fondo = fondoServidor;
            this.guardarFondoLocal();
          }
          this.sincronizadoConServidor = true;
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_BANNERS, JSON.stringify(this.banners));
          } catch {}
          this.notificar();
          return;
        }
      }
    } catch (e) {
      console.warn('[Banners] Error al sincronizar con /api/banners:', e);
    }
  }

  /**
   * Guarda en el servidor. El logo viaja SOLO cuando se esta cambiando el
   * logo (`incluirLogo`): asi guardar un banner desde un navegador que todavia
   * no leyo la configuracion no pisa el logo que ya esta publicado.
   */
  private guardarEnServidor(opciones: { incluirLogo?: boolean; incluirFondo?: boolean } = {}) {
    if (typeof window === 'undefined') return;

    const payload: { banners: FeedBanner[]; logo?: LogoLanding; fondo?: string } = { banners: this.banners };
    if (opciones.incluirLogo) payload.logo = this.logo;
    if (opciones.incluirFondo) payload.fondo = this.fondo;

    fetch('/api/banners/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.warn('[Banners] Error guardando en servidor:', err);
    });
  }

  private guardar() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY_BANNERS, JSON.stringify(this.banners));
      }
    } catch (err) {
      console.warn('Error guardando banners:', err);
    }
    this.guardarEnServidor();
    this.notificar();
  }

  public suscribir(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notificar() {
    this.listeners.forEach(l => l());
  }

  public listarBanners(): FeedBanner[] {
    return [...this.banners].sort((a, b) => a.orden - b.orden);
  }

  public listarBannersActivos(): FeedBanner[] {
    return this.banners
      .filter(b => b.activado)
      .sort((a, b) => a.orden - b.orden);
  }

  public obtenerLogo(): LogoLanding {
    return { ...this.logo };
  }

  /**
   * Guarda el logo de la landing y lo sincroniza con el servidor.
   * El endpoint exige sesion de admin: desde la landing solo se lee.
   */
  public actualizarLogo(datos: Partial<LogoLanding>): LogoLanding {
    const base: LogoLanding = { ...this.logo };
    if (typeof datos.imagenUrl === 'string') base.imagenUrl = datos.imagenUrl;
    if (datos.altoPx !== undefined) base.altoPx = datos.altoPx;
    if (typeof datos.iconUrl === 'string') base.iconUrl = datos.iconUrl;
    this.logo = normalizarLogo(base);
    this.guardarLogoLocal();
    this.guardarEnServidor({ incluirLogo: true });
    this.notificar();
    return this.obtenerLogo();
  }

  /** Vuelve al logo por defecto (la "Y" + el nombre en la cabecera). */
  public quitarLogo(): LogoLanding {
    return this.actualizarLogo({ imagenUrl: '' });
  }

  public obtenerFondo(): string {
    return this.fondo;
  }

  /**
   * Guarda el color de fondo de la landing y lo sincroniza con el servidor.
   * Un valor que no es un color hexadecimal se ignora: devuelve el que ya
   * estaba, para que la landing nunca quede con un fondo invalido.
   */
  public actualizarFondo(color: string): string {
    const normalizado = normalizarColorFondo(color);
    if (!normalizado) return this.fondo;
    this.fondo = normalizado;
    this.guardarFondoLocal();
    this.guardarEnServidor({ incluirFondo: true });
    this.notificar();
    return this.fondo;
  }

  public crearBanner(datos: Omit<FeedBanner, 'id' | 'creadoEn'>): FeedBanner {
    const nuevo: FeedBanner = {
      ...datos,
      id: `banner_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      creadoEn: new Date().toISOString()
    };
    this.banners.push(nuevo);
    this.guardar();
    return nuevo;
  }

  public actualizarBanner(id: string, datosParciales: Partial<Omit<FeedBanner, 'id'>>): boolean {
    const idx = this.banners.findIndex(b => b.id === id);
    if (idx === -1) return false;

    this.banners[idx] = {
      ...this.banners[idx],
      ...datosParciales
    };
    this.guardar();
    return true;
  }

  public eliminarBanner(id: string): boolean {
    const inicial = this.banners.length;
    this.banners = this.banners.filter(b => b.id !== id);
    if (this.banners.length !== inicial) {
      this.guardar();
      return true;
    }
    return false;
  }

  public reordenar(nuevaLista: FeedBanner[]) {
    this.banners = nuevaLista.map((b, idx) => ({ ...b, orden: idx + 1 }));
    this.guardar();
  }

  public restaurarPredeterminados() {
    this.banners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
    this.guardar();
  }
}

export const bannersModule = new BannersModule();
