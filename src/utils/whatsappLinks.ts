/**
 * Reglas de construccion de enlaces a WhatsApp.
 *
 * Modulo PURO a proposito: lo importan el servidor (para resolver el destino
 * de un contacto) y el navegador (para el panel y para los enlaces cuyo
 * telefono ya se conoce). Sin APIs de navegador: se puede importar en Node.
 *
 * REGLA INQUEBRANTABLE (ver AGENTS.md, "Reglas inquebrantables"):
 * un enlace a WhatsApp SIEMPRE tiene que dejar elegir la app. En Android el
 * sistema muestra el selector (WhatsApp / WhatsApp Business) cuando se usa el
 * esquema nativo `whatsapp://`; en iOS y en la web el sistema NO ofrece
 * selector, asi que la eleccion la pone la interfaz (hoja de opciones).
 */

/** Destino elegido por la persona: la app, la app de negocio o la version web. */
export type DestinoWhatsApp = "app" | "business" | "web";

/** Plataforma desde la que se pide el contacto. */
export type PlataformaWhatsApp = "android" | "ios" | "web";

/** Normaliza el destino pedido. Cualquier valor desconocido cae en "app". */
export function normalizarDestino(valor: unknown): DestinoWhatsApp {
  return valor === "business" || valor === "web" ? valor : "app";
}

/**
 * Detecta la plataforma desde el user-agent.
 * - Android: el sistema muestra el selector de app con el esquema nativo.
 * - iOS: el sistema no ofrece selector; la eleccion la pone la interfaz.
 * - Resto (web, escritorio): idem iOS, con la version web como primera opcion.
 */
export function detectarPlataformaDesdeUA(userAgent: string): PlataformaWhatsApp {
  const ua = String(userAgent || "");
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "web";
}

/**
 * Construye el enlace de WhatsApp. Modo puro: no toca la red ni el DOM.
 *
 * - destino "app":      `whatsapp://send` (Android: selector del sistema).
 * - destino "business": `whatsappbusiness://send`.
 * - destino "web":      `https://web.whatsapp.com/send` (funciona siempre).
 *
 * Devuelve "" si no hay telefono: es preferible un enlace vacio (el boton
 * avisa) que un enlace a un numero inventado.
 */
export function construirUrlWhatsApp(
  destino: DestinoWhatsApp,
  plataforma: PlataformaWhatsApp,
  telefono: string,
  texto = "Ofertas",
): string {
  const clean = String(telefono || "").replace(/\D/g, "");
  if (!clean) return "";
  const mensaje = encodeURIComponent(String(texto || "Ofertas"));

  if (destino === "business") {
    return `whatsappbusiness://send?phone=${clean}&text=${mensaje}`;
  }
  if (destino === "web") {
    return `https://web.whatsapp.com/send?phone=${clean}&text=${mensaje}`;
  }
  // destino "app": en Android el sistema resuelve el esquema y muestra el
  // selector (WhatsApp / WhatsApp Business). En iOS y escritorio abre la app
  // instalada; si no hay ninguna, el boton ofrece la version web.
  void plataforma;
  return `whatsapp://send?phone=${clean}&text=${mensaje}`;
}

/**
 * Mensaje que se manda al bot al pedir contacto.
 *
 * IMPORTANTE: el bot solo responde con las ofertas cuando el mensaje dispara
 * su intencion de "pedir ofertas" (`esIntencionOfertas`, en
 * `src/utils/securityGuards.ts`). Medido el 2026-10-19:
 *
 *   "Hola quiero aprovechar esta oferta: Bowl Acai"        -> NO dispara
 *   "Hola, quiero ver las ofertas de Yuddit: Bowl Acai"    -> SI dispara
 *
 * O sea: el mensaje tiene que llevar la palabra en plural. Por eso el texto
 * empieza siempre con "quiero ver las ofertas", y recien despues va el
 * titulo de la oferta concreta.
 */
export function construirMensajeContactoWhatsApp(params: {
  titulo?: string | null;
  ref?: string | null;
  codigoCanje?: string | null;
}): string {
  const titulo = String(params.titulo || '').trim();
  const ref = String(params.ref || '').trim();
  const codigo = String(params.codigoCanje || '').trim();

  const base = titulo
    ? `Hola, quiero ver las ofertas de Yuddit: ${titulo}${ref ? ` (ref ${ref})` : ''}`
    : 'Hola, quiero ver las ofertas de Yuddit';

  return codigo ? `${base}. Mi codigo es ${codigo}` : base;
}

/** Opciones que la interfaz ofrece segun la plataforma. */
export function opcionesWhatsAppPorPlataforma(plataforma: PlataformaWhatsApp): {
  destino: DestinoWhatsApp;
  etiqueta: string;
  detalle: string;
}[] {
  if (plataforma === "android") {
    // En Android el selector lo pone el sistema: una sola accion.
    return [
      { destino: "app", etiqueta: "WhatsApp", detalle: "Elige la app: WhatsApp o WhatsApp Business" },
    ];
  }
  if (plataforma === "ios") {
    return [
      { destino: "app", etiqueta: "Abrir en WhatsApp", detalle: "La app de WhatsApp" },
      { destino: "business", etiqueta: "Abrir en WhatsApp Business", detalle: "La app de WhatsApp Business" },
      { destino: "web", etiqueta: "Abrir en WhatsApp Web", detalle: "En el navegador" },
    ];
  }
  return [
    { destino: "web", etiqueta: "Abrir en WhatsApp Web", detalle: "En el navegador" },
    { destino: "app", etiqueta: "Abrir en la app de WhatsApp", detalle: "Si la tenes instalada" },
    { destino: "business", etiqueta: "Abrir en WhatsApp Business", detalle: "Si la tenes instalada" },
  ];
}
