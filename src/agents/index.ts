/**
 * MODULO 13: Agentes de IA (ia-usuarios, ia-comercios, ia-gestion)
 * Regla de oro R6: La IA asiste, redacta y propone. NUNCA publica, aprueba ni cobra por su cuenta.
 */
import { Offer, OfferType } from '../types';

export interface ProposalExtraction {
  titulo: string;
  descripcion: string;
  tipo: OfferType;
  precioNormal: number;
  precioOferta: number;
  categoria: string;
  valido: boolean;
  observaciones: string[];
}

export interface ReviewProposal {
  ofertaId: string;
  recomendacion: 'aprobar' | 'rechazar';
  confianza: number; // 0 - 100
  motivo: string;
  puntosPositivos: string[];
  riesgosDetectados: string[];
}

/**
 * 13a. Agente IA de Audiencia (ia-usuarios)
 */
export class IaUsuariosAgent {
  public interpretarMensaje(texto: string, distritoUsuario: string = 'Miraflores'): {
    intencion: 'oferta' | 'puntos' | 'canjear' | 'ayuda' | 'baja' | 'pregunta_libre';
    respuestaTexto?: string;
    categoriaSugerida?: string;
  } {
    const t = texto.toLowerCase().trim();

    if (t.includes('oferta') || t.includes('promo') || t.includes('descuento') || t.includes('comida') || t.includes('almuerzo')) {
      let categoriaSugerida: string | undefined;
      if (t.includes('café') || t.includes('comida') || t.includes('almuerzo') || t.includes('hamburguesa')) {
        categoriaSugerida = 'Gastronomía y Café';
      } else if (t.includes('ropa') || t.includes('zapatillas') || t.includes('polo')) {
        categoriaSugerida = 'Moda y Calzado';
      } else if (t.includes('spa') || t.includes('masaje') || t.includes('corte')) {
        categoriaSugerida = 'Belleza y Bienestar';
      }
      return { intencion: 'oferta', categoriaSugerida };
    }

    if (t.includes('punto') || t.includes('saldo') || t.includes('cuanto tengo')) {
      return { intencion: 'puntos' };
    }

    if (t.includes('canjear') || t.includes('premio') || t.includes('recompensa')) {
      return { intencion: 'canjear' };
    }

    if (t.includes('baja') || t.includes('stop') || t.includes('salir')) {
      return { intencion: 'baja' };
    }

    if (t.includes('ayuda') || t.includes('hola') || t.includes('como funciona')) {
      return {
        intencion: 'ayuda',
        respuestaTexto: `¡Hola! Soy el asistente de vuuy para ${distritoUsuario}. 🌟\n\nAquí puedes:\n• Escribir *Oferta* para recibir hasta 5 oportunidades cercanas con fotos y descuentos.\n• Escribir *puntos* para revisar tu saldo acumulado por compartir.\n• Escribir *canjear* para redimir premios en comercios de tu zona.`
      };
    }

    return {
      intencion: 'pregunta_libre',
      respuestaTexto: `Entendido. Te muestro las mejores oportunidades vigentes cerca de ti en ${distritoUsuario}.`
    };
  }
}

/**
 * 13b. Agente IA de Comercios (ia-comercios)
 */
export class IaComerciosAgent {
  public analizarPublicacion(texto: string): ProposalExtraction {
    const lineas = texto.split('\n');
    const observaciones: string[] = [];

    // Extracción de precios
    const preciosMatch = texto.match(/s\/?\.?\s*(\d+(\.\d+)?)/gi);
    let precioNormal = 50;
    let precioOferta = 35;

    if (preciosMatch && preciosMatch.length >= 2) {
      const p1 = parseFloat(preciosMatch[0].replace(/[^0-9.]/g, ''));
      const p2 = parseFloat(preciosMatch[1].replace(/[^0-9.]/g, ''));
      precioNormal = Math.max(p1, p2);
      precioOferta = Math.min(p1, p2);
    }

    let titulo = lineas[0] || 'Promoción Especial';
    if (titulo.length > 50) titulo = titulo.substring(0, 48) + '...';

    let descripcion = lineas.slice(1).join(' ').trim() || texto;
    if (descripcion.length > 150) {
      observaciones.push('La descripción original superaba 150 caracteres y fue resumida.');
      descripcion = descripcion.substring(0, 147) + '...';
    }

    // Detección de tipo
    let tipo: OfferType = 'descuento';
    const tLower = texto.toLowerCase();
    if (tLower.includes('liquidac')) tipo = 'liquidacion';
    else if (tLower.includes('2x1') || tLower.includes('pack') || tLower.includes('promo')) tipo = 'promocion';
    else if (tLower.includes('combo')) tipo = 'oferta';

    // Detección de categoría
    let categoria = 'Gastronomía y Café';
    if (tLower.includes('chalina') || tLower.includes('ropa') || tLower.includes('zapatos')) categoria = 'Moda y Calzado';
    else if (tLower.includes('masaje') || tLower.includes('facial') || tLower.includes('spa')) categoria = 'Belleza y Bienestar';
    else if (tLower.includes('mueble') || tLower.includes('cojin') || tLower.includes('vela')) categoria = 'Hogar y Decoración';

    // Verificación de palabras o productos prohibidos
    const prohibidas = ['arma', 'pirata', 'ilegal', 'cigarrillo', 'droga'];
    const contieneProhibida = prohibidas.some(p => tLower.includes(p));
    if (contieneProhibida) {
      observaciones.push('Alerta: Contiene términos restringidos.');
    }

    return {
      titulo,
      descripcion,
      tipo,
      precioNormal,
      precioOferta,
      categoria,
      valido: !contieneProhibida && precioOferta < precioNormal,
      observaciones
    };
  }
}

/**
 * 13c. Agente IA de Gestión (ia-gestion)
 */
export class IaGestionAgent {
  public proponerValidacion(oferta: Offer): ReviewProposal {
    const riesgos: string[] = [];
    const positivos: string[] = [];

    // Regla 1: Descuento razonable
    const ahorro = oferta.precioNormal - oferta.precioOferta;
    const porcentaje = Math.round((ahorro / oferta.precioNormal) * 100);

    if (porcentaje >= 15 && porcentaje <= 75) {
      positivos.push(`Descuento atractivo y creíble del ${porcentaje}% (Ahorro: S/ ${ahorro}).`);
    } else if (porcentaje > 75) {
      riesgos.push(`Descuento muy alto (${porcentaje}%). Verificar si el precio original está inflado.`);
    } else {
      riesgos.push(`Descuento menor al 15% (${porcentaje}%). Podría generar bajo CTR.`);
    }

    // Regla 2: Extensión de descripción
    if (oferta.descripcion.length <= 150) {
      positivos.push(`Descripción concisa (${oferta.descripcion.length} caracteres), ideal para WhatsApp.`);
    }

    // Regla 3: Imágenes
    if (oferta.imagenes.length >= 1) {
      positivos.push(`Cuenta con ${oferta.imagenes.length} imagen(es) nítidas para portada y ficha web.`);
    }

    const aprobada = riesgos.length === 0 || (riesgos.length === 1 && porcentaje < 15);

    return {
      ofertaId: oferta.id,
      recomendacion: aprobada ? 'aprobar' : 'rechazar',
      confianza: aprobada ? 94 : 65,
      motivo: aprobada
        ? 'Cumple con todas las normas de contenido, precios coherentes y fotos de calidad.'
        : 'Requiere revisión humana por posible inconsistencia en precios.',
      puntosPositivos: positivos,
      riesgosDetectados: riesgos
    };
  }
}

export const iaUsuariosAgent = new IaUsuariosAgent();
export const iaComerciosAgent = new IaComerciosAgent();
export const iaGestionAgent = new IaGestionAgent();
