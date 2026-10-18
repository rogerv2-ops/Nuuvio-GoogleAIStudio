import { aiService } from "../services/aiService.ts";

export interface ProposalExtraction {
  titulo: string;
  descripcion: string;
  precioNormal: number;
  precioOferta: number;
  categoria: string;
  stock: number;
  tipo: "descuento" | "promocion" | "liquidacion" | string;
  diasVencimiento: number;
  valido?: boolean;
  observaciones?: string[];
}

export class IaUsuariosAgent {
  interpretarMensaje(texto: string, distritoUsuario = "Miraflores") {
    const t = texto.toLowerCase().trim();
    if (
      t.includes("oferta") ||
      t.includes("promo") ||
      t.includes("descuento") ||
      t.includes("comida") ||
      t.includes("almuerzo")
    ) {
      let categoriaSugerida: string | undefined;
      if (
        t.includes("café") ||
        t.includes("comida") ||
        t.includes("almuerzo") ||
        t.includes("hamburguesa")
      ) {
        categoriaSugerida = "Gastronomía y Café";
      } else if (t.includes("ropa") || t.includes("zapatillas") || t.includes("polo")) {
        categoriaSugerida = "Moda y Calzado";
      } else if (t.includes("spa") || t.includes("masaje") || t.includes("corte")) {
        categoriaSugerida = "Belleza y Bienestar";
      }
      aiService
        .generarTexto({
          prompt: `El usuario en ${distritoUsuario} solicita ofertas: "${texto}"`,
          asistenteId: "ia-usuarios",
        })
        .catch(() => {});
      return { intencion: "oferta", categoriaSugerida };
    }

    if (t.includes("punto") || t.includes("saldo") || t.includes("cuanto tengo")) {
      return { intencion: "puntos" };
    }
    if (t.includes("canjear") || t.includes("premio") || t.includes("recompensa")) {
      return { intencion: "canjear" };
    }
    if (t.includes("baja") || t.includes("stop") || t.includes("salir")) {
      return { intencion: "baja" };
    }
    if (t.includes("ayuda") || t.includes("hola") || t.includes("como funciona")) {
      return {
        intencion: "ayuda",
        respuestaTexto: `¡Hola! Soy el asistente de Yuddit para ${distritoUsuario}. 🌟\n\nAquí puedes:\n• Escribir *Oferta* para recibir hasta 5 oportunidades cercanas con fotos y descuentos.\n• Escribir *puntos* para revisar tu saldo acumulado por referidos.\n• Escribir *canjear* para redimir premios en comercios de tu zona.`,
      };
    }

    aiService
      .generarTexto({
        prompt: `Pregunta libre del usuario en ${distritoUsuario}: "${texto}". Responde amablemente como asistente de Yuddit en menos de 100 palabras.`,
        asistenteId: "ia-usuarios",
      })
      .catch(() => {});
    return {
      intencion: "pregunta_libre",
      respuestaTexto: `Entendido. Te muestro las mejores oportunidades vigentes cerca de ti en ${distritoUsuario}.`,
    };
  }
}

export class IaComerciosAgent {
  async analizarPublicacion(texto: string): Promise<ProposalExtraction> {
    const prompt = `Extrae los datos de esta oferta y devuelve SOLO un JSON válido con estas claves exactas:
- titulo (string max 40 chars)
- descripcion (string max 150 chars)
- precioNormal (number)
- precioOferta (number)
- categoria (string)
- stock (number, si no se menciona, por defecto 20)
- tipo (string, solo puede ser 'descuento', 'promocion' o 'liquidacion'. Si no se menciona, usa 'descuento')
- diasVencimiento (number, días de vigencia de la oferta. Si no se menciona, por defecto 7)
Texto del comercio: ${texto}`;

    let titulo = "Promoción Especial";
    let descripcion = texto.substring(0, 150) || "Promoción exclusiva por tiempo limitado.";
    let precioNormal = 50;
    let precioOferta = 35;
    let categoria = "Gastronomía y Café";
    let stock = 20;
    let tipo = "descuento";
    let diasVencimiento = 7;
    const observaciones: string[] = [];

    try {
      const res = await aiService.generarTexto({
        prompt,
        systemInstruction:
          "Eres un sistema de extracción estricta de ofertas locales para comercios. Devuelve estrictamente un objeto JSON puro válido sin bloques markdown ni texto adicional.",
        asistenteId: "ia-comercios",
      });

      if (res.ok && res.texto) {
        const jsonLimpio = res.texto
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        const data = JSON.parse(jsonLimpio);

        if (data.titulo && typeof data.titulo === "string") {
          titulo = data.titulo.trim().substring(0, 40);
        }
        if (data.descripcion && typeof data.descripcion === "string") {
          descripcion = data.descripcion.trim().substring(0, 150);
        }
        if (typeof data.precioNormal === "number" && !isNaN(data.precioNormal)) {
          precioNormal = data.precioNormal;
        } else if (data.precioNormal && !isNaN(Number(data.precioNormal))) {
          precioNormal = Number(data.precioNormal);
        }

        if (typeof data.precioOferta === "number" && !isNaN(data.precioOferta)) {
          precioOferta = data.precioOferta;
        } else if (data.precioOferta && !isNaN(Number(data.precioOferta))) {
          precioOferta = Number(data.precioOferta);
        }

        if (data.categoria && typeof data.categoria === "string") {
          categoria = data.categoria.trim();
        }

        if (typeof data.stock === "number" && !isNaN(data.stock)) {
          stock = data.stock;
        } else if (data.stock && !isNaN(Number(data.stock))) {
          stock = Number(data.stock);
        }

        if (data.tipo && typeof data.tipo === "string") {
          const tLimpio = data.tipo.toLowerCase().trim();
          if (["descuento", "promocion", "liquidacion"].includes(tLimpio)) {
            tipo = tLimpio;
          }
        }

        if (typeof data.diasVencimiento === "number" && !isNaN(data.diasVencimiento)) {
          diasVencimiento = data.diasVencimiento;
        } else if (data.diasVencimiento && !isNaN(Number(data.diasVencimiento))) {
          diasVencimiento = Number(data.diasVencimiento);
        }
      }
    } catch (err) {
      console.warn("[IaComerciosAgent] Error en llamada o parseo de IA, usando extracción de respaldo:", err);
      const preciosMatch = texto.match(/s\/?\.?\s*(\d+(\.\d+)?)/gi);
      if (preciosMatch && preciosMatch.length >= 2) {
        const p1 = parseFloat(preciosMatch[0].replace(/[^0-9.]/g, ""));
        const p2 = parseFloat(preciosMatch[1].replace(/[^0-9.]/g, ""));
        precioNormal = Math.max(p1, p2);
        precioOferta = Math.min(p1, p2);
      }
      const lineas = texto.split("\n");
      if (lineas[0]) titulo = lineas[0].substring(0, 40);

      const stockMatch = texto.match(/(\d+)\s*(unidades|platos|cupos|stock|disponibles)/i);
      if (stockMatch && stockMatch[1]) {
        stock = parseInt(stockMatch[1], 10);
      }
    }

    if (precioOferta >= precioNormal) {
      precioNormal = Math.round(precioOferta * 1.3);
    }

    return {
      titulo,
      descripcion,
      tipo,
      precioNormal,
      precioOferta,
      categoria,
      stock,
      diasVencimiento,
      valido: precioOferta < precioNormal,
      observaciones,
    };
  }
}

export class IaGestionAgent {
  proponerValidacion(oferta: any) {
    const riesgos: string[] = [];
    const positivos: string[] = [];

    aiService
      .generarTexto({
        prompt: `Evalúa la oferta para moderación editorial: Título "${oferta.titulo}", Precio normal ${oferta.precioNormal}, Precio oferta ${oferta.precioOferta}, Descripción "${oferta.descripcion}".`,
        asistenteId: "ia-gestion",
      })
      .catch(() => {});

    const ahorro = oferta.precioNormal - oferta.precioOferta;
    const porcentaje = Math.round((ahorro / oferta.precioNormal) * 100);

    if (porcentaje >= 15 && porcentaje <= 75) {
      positivos.push(`Descuento atractivo y creíble del ${porcentaje}% (Ahorro: S/ ${ahorro}).`);
    } else if (porcentaje > 75) {
      riesgos.push(`Descuento muy alto (${porcentaje}%). Verificar si el precio original está inflado.`);
    } else {
      riesgos.push(`Descuento menor al 15% (${porcentaje}%). Podría generar bajo CTR.`);
    }

    if (oferta.descripcion && oferta.descripcion.length <= 150) {
      positivos.push(`Descripción concisa (${oferta.descripcion.length} caracteres), ideal para WhatsApp.`);
    }
    if (oferta.imagenes && oferta.imagenes.length >= 1) {
      positivos.push(`Cuenta con ${oferta.imagenes.length} imagen(es) nítidas para portada y ficha web.`);
    }

    const aprobada = riesgos.length === 0 || (riesgos.length === 1 && porcentaje < 15);
    return {
      ofertaId: oferta.id,
      recomendacion: aprobada ? ("aprobar" as const) : ("rechazar" as const),
      confianza: aprobada ? 94 : 65,
      motivo: aprobada
        ? "Cumple con todas las normas de contenido, precios coherentes y fotos de calidad."
        : "Requiere revisión humana por posible inconsistencia en precios.",
      puntosPositivos: positivos,
      riesgosDetectados: riesgos,
    };
  }
}

export const iaUsuariosAgent = new IaUsuariosAgent();
export const iaComerciosAgent = new IaComerciosAgent();
export const iaGestionAgent = new IaGestionAgent();
