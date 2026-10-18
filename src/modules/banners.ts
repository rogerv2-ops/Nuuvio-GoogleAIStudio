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
  private listeners: (() => void)[] = [];
  private sincronizadoConServidor = false;

  constructor() {
    this.cargar();
    this.sincronizarConServidor();
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

  private guardarEnServidor() {
    if (typeof window === 'undefined') return;

    fetch('/api/banners/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banners: this.banners })
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
