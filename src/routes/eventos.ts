/**
 * Eventos de negocio: lo que NO tiene tabla propia.
 *
 * POR QUE EXISTE
 *
 * Antes estos eventos vivian en un `Map` EN MEMORIA del navegador
 * (`coreEvents`): se perdian al recargar y no se podian medir. Por eso el
 * panel de atribucion UTM no tenia el numero de visitas y lo inventaba
 * (`visitas * 18 + 142`, con un minimo de 198), y las "vistas de oferta"
 * no tenian de donde salir (el contador `offers.vistas` no lo incrementa
 * nadie, asi que el CTR no se podia calcular).
 *
 * REGLA DE LA CASA
 *
 * Un dominio que tiene su PROPIA tabla no emite evento:
 *   - los clics van en `click_logs`
 *   - los chats en `chat_logs`
 *   - la audiencia en `audience_users`
 *   - los packs en `click_packs`
 *   - las ofertas y su estado en `offers`
 * Aqui va lo que no tiene tabla: las visitas a la landing, las impresiones
 * de una oferta, la entrega de una oferta al bot y los pasos del embudo.
 *
 * POR QUE EL ALTA DE EVENTOS ES PUBLICA
 *
 * La visita a la landing ocurre antes de que la persona tenga sesion (y
 * a veces nunca la tendra: puede entrar, ver una oferta e irse). Por eso
 * el alta no pide sesion. Eso obliga a blindarla:
 *
 *  1. LISTA BLANCA de tipos: solo se aceptan los que tienen sentido como
 *     evento. Un endpoint libre seria un'aljiber' de basura.
 *  2. POR TIPO, solo se aceptan las claves de datos permitidas: el cliente
 *     no decide que se guarda.
 *  3. Se borra lo que parezca PII (correos y telefonos) de los datos.
 *  4. Rate limit por IP y tope de eventos por peticion.
 */
import { indiceDeActor, insertarEventos } from "../db/repo.ts";
import { indiceCiego } from "../utils/pii.ts";

/** Los tipos de evento que se aceptan. Los demas se descartan. */
export const TIPOS_EVENTO_ACEPTADOS: Record<string, string[]> = {
  // La persona llego a la landing con parametros de campana.
  visita_landing_utm: ["afiliadoId", "source", "medium", "campaign", "term", "content", "url", "referrer"],
  // Se mostro una oferta (impresion). Con esto se mide el CTR de verdad.
  oferta_mostrada: ["ofertaId", "titulo", "distrito", "canal", "posicion"],
  // El bot entrego una oferta (con su enlace firmado).
  oferta_enviada: ["ofertaId", "titulo", "distrito", "canal", "provincia"],
  // Un paso del embudo de registro.
  embudo_registro_completado: ["paso", "origen", "canal"],
  // La persona se registro en la audiencia.
  usuario_registrado_utm: ["source", "medium", "campaign", "invitadoPor"],
  // La persona escribio desde una zona donde todavia no operamos: es la
  // senal de donde expandirse.
  zona_sin_servicio: ["distrito", "provincia"],
  // Una venta confirmada (la reporta el comercio).
  venta_confirmada: ["comercioId", "ofertaId", "codigoPersonal", "monto"],
};

/** Quita lo que parezca un correo o un telefono de un valor. */
function limpiarValor(valor: unknown): string | number | boolean | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" || typeof valor === "boolean") return valor;
  if (typeof valor !== "string") return null;
  const texto = valor.slice(0, 300);
  // Un correo no se guarda aqui: la PII se cifra en su tabla.
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto)) return null;
  // Un telefono tampoco: se reconoce porque son 9+ digitos y lo demas son
  // solo los separadores de un numero ("+51 987 654 321"). Un nombre de
  // campana con numeros ("promo_2026_10") NO se descarta: no es PII.
  const soloDigitos = texto.replace(/\D/g, "");
  const resto = texto.replace(/\d/g, "");
  if (soloDigitos.length >= 9 && /^[\s+.\-()]*$/.test(resto)) return null;
  return texto;
}

/** Limpia el objeto de datos segun las claves permitidas del tipo. */
function limpiarDatos(tipo: string, datos: any): Record<string, string | number | boolean | null> {
  const permitidas = TIPOS_EVENTO_ACEPTADOS[tipo] || [];
  const salida: Record<string, string | number | boolean | null> = {};
  if (!datos || typeof datos !== "object") return salida;
  for (const clave of permitidas) {
    if (!(clave in datos)) continue;
    const valor = limpiarValor(datos[clave]);
    if (valor !== null && valor !== "") salida[clave] = valor;
  }
  return salida;
}

export function registrarRutasEventos(app: any, ctx: any): void {
  const rateLimit = ctx.rateLimit;
  const clienteIp = ctx.clienteIp;

  /**
   * POST /api/eventos
   *
   * Acepta un evento o una tanda. Publico (la visita a la landing no tiene
   * sesion) y blindado: lista blanca de tipos, limpieza de datos y rate
   * limit.
   */
  app.post(
    "/api/eventos",
    rateLimit("eventos", 60, 60000),
    async (req: any, res: any) => {
      try {
        const cuerpo = req.body || {};
        const recibidos = Array.isArray(cuerpo.eventos) ? cuerpo.eventos : [cuerpo];
        if (recibidos.length === 0 || recibidos.length > 20) {
          res.status(400).json({ ok: false, error: "Se admiten entre 1 y 20 eventos por peticion." });
          return;
        }

        const validos = [];
        let descartados = 0;
        for (const e of recibidos) {
          const tipo = String(e?.tipoEvento || "").trim();
          if (!tipo || !TIPOS_EVENTO_ACEPTADOS[tipo]) {
            descartados++;
            continue;
          }
          // Hash de la IP (HMAC, no reversible): permite distinguir visitas
          // unicas y detectar que alguien esta inflando las metricas desde
          // una sola maquina. No es la IP: es un indice ciego.
          const datos = limpiarDatos(tipo, e.datos);
          const ipHash = indiceCiego(clienteIp(req));
          if (ipHash) datos.ipHash = ipHash.slice(0, 16);
          validos.push({
            tipoEvento: tipo,
            actorTipo: e.actorTipo ? String(e.actorTipo).slice(0, 20) : null,
            // El cliente no sabe el indice ciego (la clave PII es del
            // servidor): si manda un telefono o un id de audiencia, aqui se
            // convierte a indice ciego antes de tocar la base.
            actorId: indiceDeActor(e.actorId),
            distrito: e.distrito ? String(e.distrito).slice(0, 80) : null,
            provincia: e.provincia ? String(e.provincia).slice(0, 80) : null,
            origen: e.origen ? String(e.origen).slice(0, 40) : null,
            datos,
          });
        }

        if (validos.length === 0) {
          res.status(400).json({ ok: false, error: "Ningun evento con un tipo admitido." });
          return;
        }

        const r = await insertarEventos(validos);
        res.json({ ok: r.ok, guardados: r.guardados, descartados });
      } catch (error) {
        console.error("[Eventos] Error guardando los eventos:", error);
        res.status(500).json({ ok: false, error: "Error guardando los eventos." });
      }
    },
  );
}
