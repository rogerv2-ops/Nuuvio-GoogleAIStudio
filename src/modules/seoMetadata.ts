/**
 * MODULO: seoMetadata
 * Gestión centralizada de metadatos globales de la aplicación,
 * optimización SEO, OpenGraph, Twitter Cards y Schema.org (JSON-LD).
 */
import { coreEvents } from '../core/events';

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  ogType: string;
  twitterCard: 'summary_large_image' | 'summary';
  robots: string;
  author: string;
  geoRegion: string;
  geoPlacename: string;
  schemaType: 'WebApplication' | 'LocalBusiness' | 'Organization';
  ultimaActualizacion: string;
  actualizadoPor: string;
}

export interface SeoAnalysisItem {
  id: string;
  label: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
}

export interface SeoScoreResult {
  score: number;
  grade: 'Excelente' | 'Bueno' | 'Aceptable' | 'Requiere Mejora';
  items: SeoAnalysisItem[];
}

const STORAGE_KEY = 'yuddit_global_seo_metadata_v1';

const METADATOS_DEFECTO: SeoMetadata = {
  title: 'Yuddit — Descubre Ofertas y Promociones Cercanas en Lima',
  description: 'Asistente inteligente y directorio para descubrir las mejores ofertas, promociones y descuentos geolocalizados en Lima. Contacta directamente a comercios locales por WhatsApp.',
  keywords: [
    'ofertas lima',
    'descuentos lima',
    'promociones locales',
    'comercios miraflores',
    'san isidro ofertas',
    'restaurantes lima promociones',
    'asistente whatsapp ofertas',
    'compras lima cupones',
    'directorio comercios peru'
  ],
  canonicalUrl: 'https://yuddit.com',
  ogTitle: 'Yuddit — Descubre Ofertas y Promociones Cercanas en Lima',
  ogDescription: 'Descubre las mejores ofertas y descuentos en tu distrito de Lima con contacto instantáneo a comercios verificados por WhatsApp.',
  ogImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&h=630&q=80',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
  author: 'Yuddit Perú',
  geoRegion: 'PE-LIM',
  geoPlacename: 'Lima, Perú',
  schemaType: 'WebApplication',
  ultimaActualizacion: new Date().toISOString(),
  actualizadoPor: 'Sistema'
};

class SeoMetadataModule {
  private metadata: SeoMetadata;
  private listeners: (() => void)[] = [];

  constructor() {
    this.metadata = this.cargarDeAlmacenamiento();
  }

  private cargarDeAlmacenamiento(): SeoMetadata {
    if (typeof window === 'undefined') return { ...METADATOS_DEFECTO };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...METADATOS_DEFECTO,
          ...parsed,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : METADATOS_DEFECTO.keywords
        };
      }
    } catch {
      // Fallback a defecto
    }
    return { ...METADATOS_DEFECTO };
  }

  public inicializar() {
    this.aplicarEnDOM();
  }

  public obtenerMetadatos(): SeoMetadata {
    return { ...this.metadata, keywords: [...this.metadata.keywords] };
  }

  public guardarMetadatos(nuevos: Partial<SeoMetadata>, usuario: string = 'Super Admin'): SeoMetadata {
    this.metadata = {
      ...this.metadata,
      ...nuevos,
      keywords: nuevos.keywords ? [...nuevos.keywords] : this.metadata.keywords,
      ultimaActualizacion: new Date().toISOString(),
      actualizadoPor: usuario
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metadata));
      } catch (e) {
        console.error('Error guardando metadatos SEO en localStorage:', e);
      }
    }

    this.aplicarEnDOM();

    coreEvents.emitir({
      tipoEvento: 'SEO_METADATOS_ACTUALIZADOS',
      actorTipo: 'gestion',
      actorId: usuario,
      origen: 'panel',
      datos: {
        title: this.metadata.title,
        descriptionLen: this.metadata.description.length,
        keywordsCount: this.metadata.keywords.length,
        actualizadoPor: usuario
      }
    });

    this.notificar();
    return this.obtenerMetadatos();
  }

  public restaurarPredeterminados(usuario: string = 'Super Admin'): SeoMetadata {
    this.metadata = {
      ...METADATOS_DEFECTO,
      ultimaActualizacion: new Date().toISOString(),
      actualizadoPor: usuario
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Error al resetear metadatos SEO:', e);
      }
    }

    this.aplicarEnDOM();

    coreEvents.emitir({
      tipoEvento: 'SEO_METADATOS_RESTAURADOS',
      actorTipo: 'gestion',
      actorId: usuario,
      origen: 'panel',
      datos: { motivo: 'Restauración a valores predeterminados de fábrica' }
    });

    this.notificar();
    return this.obtenerMetadatos();
  }

  public aplicarEnDOM() {
    if (typeof document === 'undefined') return;

    try {
      // 1. Title
      document.title = this.metadata.title;

      // Helper para actualizar o crear meta tag
      const setMetaTag = (attr: 'name' | 'property', key: string, content: string) => {
        let meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute(attr, key);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      // 2. Meta básicos
      setMetaTag('name', 'description', this.metadata.description);
      setMetaTag('name', 'keywords', this.metadata.keywords.join(', '));
      setMetaTag('name', 'author', this.metadata.author);
      setMetaTag('name', 'robots', this.metadata.robots);
      setMetaTag('name', 'geo.region', this.metadata.geoRegion);
      setMetaTag('name', 'geo.placename', this.metadata.geoPlacename);

      // 3. OpenGraph
      setMetaTag('property', 'og:title', this.metadata.ogTitle || this.metadata.title);
      setMetaTag('property', 'og:description', this.metadata.ogDescription || this.metadata.description);
      setMetaTag('property', 'og:type', this.metadata.ogType || 'website');
      setMetaTag('property', 'og:site_name', 'Yuddit');
      if (this.metadata.ogImageUrl) {
        setMetaTag('property', 'og:image', this.metadata.ogImageUrl);
      }
      if (this.metadata.canonicalUrl) {
        setMetaTag('property', 'og:url', this.metadata.canonicalUrl);

        // Canonical link tag
        let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (!linkCanonical) {
          linkCanonical = document.createElement('link');
          linkCanonical.setAttribute('rel', 'canonical');
          document.head.appendChild(linkCanonical);
        }
        linkCanonical.setAttribute('href', this.metadata.canonicalUrl);
      }

      // 4. Twitter Cards
      setMetaTag('name', 'twitter:card', this.metadata.twitterCard);
      setMetaTag('name', 'twitter:title', this.metadata.ogTitle || this.metadata.title);
      setMetaTag('name', 'twitter:description', this.metadata.ogDescription || this.metadata.description);
      if (this.metadata.ogImageUrl) {
        setMetaTag('name', 'twitter:image', this.metadata.ogImageUrl);
      }

      // 5. Schema.org JSON-LD
      const jsonLdData = this.generarJsonLdObjeto();
      let scriptLd = document.getElementById('yuddit-seo-schema-ld') as HTMLScriptElement | null;
      if (!scriptLd) {
        scriptLd = document.createElement('script');
        scriptLd.id = 'yuddit-seo-schema-ld';
        scriptLd.type = 'application/ld+json';
        document.head.appendChild(scriptLd);
      }
      scriptLd.textContent = JSON.stringify(jsonLdData, null, 2);
    } catch (e) {
      console.error('Error aplicando metadatos SEO al DOM:', e);
    }
  }

  public generarJsonLdObjeto() {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yuddit.com';
    const baseUrl = this.metadata.canonicalUrl || origin;

    if (this.metadata.schemaType === 'LocalBusiness') {
      return {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Yuddit — Red de Ofertas Cercanas',
        description: this.metadata.description,
        url: baseUrl,
        image: this.metadata.ogImageUrl,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Lima',
          addressRegion: 'Lima',
          addressCountry: 'PE'
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: -12.046374,
          longitude: -77.042793
        },
        currenciesAccepted: 'PEN',
        priceRange: 'S/.'
      };
    }

    if (this.metadata.schemaType === 'Organization') {
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Yuddit',
        url: baseUrl,
        logo: this.metadata.ogImageUrl,
        description: this.metadata.description,
        sameAs: [
          'https://instagram.com/yuddit',
          'https://facebook.com/yuddit'
        ]
      };
    }

    // Default: WebApplication
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Yuddit',
      alternateName: this.metadata.title,
      applicationCategory: 'ShoppingApplication',
      operatingSystem: 'All',
      url: baseUrl,
      description: this.metadata.description,
      image: this.metadata.ogImageUrl,
      keywords: this.metadata.keywords.join(', '),
      inLanguage: 'es-PE',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'PEN',
        description: 'Búsqueda gratuita de ofertas y descuentos en Lima'
      }
    };
  }

  public generarHtmlSnippet(): string {
    const jsonLd = JSON.stringify(this.generarJsonLdObjeto(), null, 2);
    return `<!-- Metadatos SEO Principales -->
<title>${this.metadata.title}</title>
<meta name="description" content="${this.metadata.description}" />
<meta name="keywords" content="${this.metadata.keywords.join(', ')}" />
<meta name="author" content="${this.metadata.author}" />
<meta name="robots" content="${this.metadata.robots}" />
<link rel="canonical" href="${this.metadata.canonicalUrl}" />

<!-- OpenGraph (WhatsApp, Facebook, LinkedIn) -->
<meta property="og:type" content="${this.metadata.ogType}" />
<meta property="og:site_name" content="Yuddit" />
<meta property="og:title" content="${this.metadata.ogTitle || this.metadata.title}" />
<meta property="og:description" content="${this.metadata.ogDescription || this.metadata.description}" />
<meta property="og:url" content="${this.metadata.canonicalUrl}" />
<meta property="og:image" content="${this.metadata.ogImageUrl}" />

<!-- Twitter / X Card -->
<meta name="twitter:card" content="${this.metadata.twitterCard}" />
<meta name="twitter:title" content="${this.metadata.ogTitle || this.metadata.title}" />
<meta name="twitter:description" content="${this.metadata.ogDescription || this.metadata.description}" />
<meta name="twitter:image" content="${this.metadata.ogImageUrl}" />

<!-- Datos Estructurados Schema.org -->
<script type="application/ld+json">
${jsonLd}
</script>`;
  }

  public calcularPuntuacion(meta: SeoMetadata = this.metadata): SeoScoreResult {
    const items: SeoAnalysisItem[] = [];
    let score = 0;

    // 1. Title analysis (30-60 chars)
    const titleLen = (meta.title || '').trim().length;
    if (titleLen >= 30 && titleLen <= 65) {
      score += 25;
      items.push({
        id: 'title',
        label: 'Título de la página (<title>)',
        status: 'passed',
        message: `Longitud perfecta (${titleLen} caracteres). Entre 30 y 65 caracteres es el rango óptimo para Google SERP.`
      });
    } else if (titleLen > 0 && titleLen < 30) {
      score += 12;
      items.push({
        id: 'title',
        label: 'Título de la página (<title>)',
        status: 'warning',
        message: `Algo corto (${titleLen} caracteres). Añade más contexto o marca (e.g. 35-60 caracteres).`
      });
    } else if (titleLen > 65) {
      score += 15;
      items.push({
        id: 'title',
        label: 'Título de la página (<title>)',
        status: 'warning',
        message: `Título extenso (${titleLen} caracteres). Google suele truncar títulos mayores a 60-65 caracteres.`
      });
    } else {
      items.push({
        id: 'title',
        label: 'Título de la página (<title>)',
        status: 'failed',
        message: 'El título está vacío. Es un factor crítico para el posicionamiento.'
      });
    }

    // 2. Meta description analysis (120-165 chars)
    const descLen = (meta.description || '').trim().length;
    if (descLen >= 120 && descLen <= 165) {
      score += 25;
      items.push({
        id: 'description',
        label: 'Meta Descripción (<meta name="description">)',
        status: 'passed',
        message: `Longitud óptima (${descLen} caracteres). No se truncará en snippets de Google (120-160 caracteres).`
      });
    } else if (descLen >= 70 && descLen < 120) {
      score += 15;
      items.push({
        id: 'description',
        label: 'Meta Descripción (<meta name="description">)',
        status: 'warning',
        message: `Aceptable pero corta (${descLen} caracteres). Añade una propuesta de valor o llamada a la acción para alcanzar ~140 caracteres.`
      });
    } else if (descLen > 165) {
      score += 15;
      items.push({
        id: 'description',
        label: 'Meta Descripción (<meta name="description">)',
        status: 'warning',
        message: `Extensa (${descLen} caracteres). Puede aparecer truncada con puntos suspensivos en móviles.`
      });
    } else {
      items.push({
        id: 'description',
        label: 'Meta Descripción (<meta name="description">)',
        status: 'failed',
        message: 'Descripción muy corta o vacía. Los buscadores necesitan un resumen convincente.'
      });
    }

    // 3. Keywords analysis (>= 5 keywords)
    const kwCount = (meta.keywords || []).filter(k => k.trim().length > 0).length;
    if (kwCount >= 5 && kwCount <= 18) {
      score += 20;
      items.push({
        id: 'keywords',
        label: 'Palabras Clave (Keywords)',
        status: 'passed',
        message: `Excelente (${kwCount} palabras clave configuradas). Cubre términos de búsqueda locales y de intención.`
      });
    } else if (kwCount > 0 && kwCount < 5) {
      score += 10;
      items.push({
        id: 'keywords',
        label: 'Palabras Clave (Keywords)',
        status: 'warning',
        message: `Pocas palabras clave (${kwCount}). Te recomendamos al menos 5 para abarcar distritos y categorías de Lima.`
      });
    } else if (kwCount > 18) {
      score += 12;
      items.push({
        id: 'keywords',
        label: 'Palabras Clave (Keywords)',
        status: 'warning',
        message: `Demasiadas palabras clave (${kwCount}). Evita el keyword stuffing excesivo para no diluir relevancia.`
      });
    } else {
      items.push({
        id: 'keywords',
        label: 'Palabras Clave (Keywords)',
        status: 'failed',
        message: 'No hay palabras clave configuradas.'
      });
    }

    // 4. OpenGraph & Redes Sociales
    if (meta.ogTitle && meta.ogDescription && meta.ogImageUrl && meta.ogImageUrl.startsWith('http')) {
      score += 15;
      items.push({
        id: 'opengraph',
        label: 'Tarjetas Sociales (OpenGraph & Twitter)',
        status: 'passed',
        message: 'Configurado con imagen de vista previa, título y descripción para WhatsApp, Facebook y X.'
      });
    } else {
      score += 5;
      items.push({
        id: 'opengraph',
        label: 'Tarjetas Sociales (OpenGraph & Twitter)',
        status: 'warning',
        message: 'Falta configurar una imagen OpenGraph válida o títulos para vista previa social.'
      });
    }

    // 5. Canonical URL & Schema.org JSON-LD
    if (meta.canonicalUrl && meta.schemaType) {
      score += 15;
      items.push({
        id: 'canonical',
        label: 'URL Canónica & Datos Estructurados (JSON-LD)',
        status: 'passed',
        message: `URL Canónica activa (${meta.canonicalUrl}) y marcado Schema.org (${meta.schemaType}) habilitado.`
      });
    } else {
      score += 5;
      items.push({
        id: 'canonical',
        label: 'URL Canónica & Datos Estructurados (JSON-LD)',
        status: 'warning',
        message: 'Configura la URL canónica principal para evitar contenido duplicado.'
      });
    }

    let grade: SeoScoreResult['grade'] = 'Excelente';
    if (score < 50) grade = 'Requiere Mejora';
    else if (score < 75) grade = 'Aceptable';
    else if (score < 90) grade = 'Bueno';

    return { score, grade, items };
  }

  public suscribir(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notificar() {
    this.listeners.forEach(l => l());
  }
}

export const seoMetadataModule = new SeoMetadataModule();
