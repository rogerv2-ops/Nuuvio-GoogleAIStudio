/**
 * Textos del bot de WhatsApp de Yuddit.
 *
 * Por que viven aca y no dispersos en `server.ts`:
 *
 *  1. Son las palabras que ve la persona. Necesitan un solo lugar para
 *     revisarse, ajustarse y mantener un tono coherente.
 *  2. `server.ts` esta minificado y se parchea con ediciones quirurgicas:
 *     meter logica de copy ahi la hace mas dificil de revisar.
 *
 * Reglas de copy que este archivo respeta:
 *
 *  - NO se pide lo que ya se sabe. El bot ya conoce el nombre de la persona
 *    (viene en el perfil de WhatsApp): pedirlo es hacer perder un dato.
 *  - El saludo es cordial y usa el nombre cuando se conoce.
 *  - Cada entrega de oferta incluye la linea de opt-out: es lo que pide la
 *    politica de WhatsApp de Meta (que la persona sepa como darse de baja)
 *    y es una cortesia que cuela sin parecer un aviso legal.
 */

/** El nombre que YA conocemos de la persona (perfil de WhatsApp). */
export function nombreDeSaludo(nombre?: string | null): string {
  const n = String(nombre || '').trim();
  if (!n) return '';
  if (n === 'Amigo/a' || n === 'Usuario WhatsApp' || n === 'Usuario Prueba') return '';
  return n;
}

/**
 * Saludo y pedido de los datos que FALTAN.
 *
 * Con el nombre ya conocido (perfil de WhatsApp) se piden solo edad y distrito: el
 * nombre ya lo tenemos y pedirlo otra vez hace que la persona escriba de
 * menos. Sin nombre conocido se piden los tres.
 */
export function saludoPedirDatos(nombre?: string | null): string {
  const n = nombreDeSaludo(nombre);
  const saludo = n ? `¡Hola ${n}! 👋` : '¡Hola! 👋';
  const campos = n
    ? '1️⃣ *Edad* (ej: 28)\n2️⃣ *Distrito* (ej: Miraflores)'
    : '1️⃣ *Nombre* (ej: Carlos)\n2️⃣ *Edad* (ej: 28)\n3️⃣ *Distrito* (ej: Miraflores)';
  const ejemplo = n ? '"28, Miraflores"' : '"Carlos, 28, Miraflores"';
  return (
    `${saludo} Qué gusto saludarte 😊 Para mostrarte las mejores ofertas cerca de ti, ` +
    `respóndeme en un solo mensaje:\n\n${campos}\n\n*(Ejemplo: ${ejemplo})*`
  );
}

/** Cuando ya tenemos el nombre y la edad, y solo falta la zona. */
export function saludoPedirDistrito(nombre?: string | null): string {
  const n = nombreDeSaludo(nombre);
  return (
    `¡Gracias${n ? ` ${n}` : ''}! 📍 Solo me falta tu *distrito o zona* para mostrarte las ` +
    `ofertas correctas.\n\n*(Ejemplo: Miraflores, Surco, San Isidro, San Miguel, Los Olivos...)*`
  );
}

/**
 * Linea de opt-out.
 *
 * Va en CADA entrega de oferta. Motivo: la politica de WhatsApp de Meta pide
 * que la persona sepa de antemano como dejar de recibir mensajes, y asi se
 * cumple sin que la linea parezca un aviso legal.
 *
 * "BAJA" es la palabra que el bot ya entiende (`stop|baja|cancelar|salir|
 * desuscribir|detener`), asi que la promesa se cumple.
 */
export function lineaOptOut(): string {
  // PULL, NO PUSH: no se promete ningun envio proactivo. Lo que se ofrece es
  // dejar de RESPONDER.
  return (
    '📩 Si prefieres que no te respondamos más, escribe *BAJA* y te sacamos de la lista al instante. ' +
    '¡Gracias por escribirnos! 😊'
  );
}

/**
 * Respuesta a quien esta dado de baja y escribe.
 *
 * Un dado de baja NO se reactiva solo: sigue dado de baja hasta que pide
 * volver de forma explicita. Antes, cualquier mensaje lo reactivaba (eso
 * hacia que la baja no sirviera de nada).
 */
export function mensajeDesuscrito(nombre?: string | null): string {
  const n = nombreDeSaludo(nombre);
  return (
    `Hola${n ? ` ${n}` : ''} 😊 Veo que estás dado de baja de las ofertas de Yuddit, ` +
    'así que no te voy a mandar más. Si cambiaste de opinión, escribe *OFERTAS* y ' +
    'te llegan de nuevo. ¡Gracias por tu preferencia!'
  );
}
