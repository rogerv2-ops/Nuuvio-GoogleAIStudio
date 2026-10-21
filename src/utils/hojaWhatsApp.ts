/**
 * Hoja de eleccion de app para los ENLACES FIRMADOS de oferta (`/c/:id`).
 *
 * POR QUE EXISTE
 *
 * La hoja del SPA (`src/components/WhatsAppChooser.tsx`) cubre los botones de
 * la landing. Pero los enlaces que el bot manda por WhatsApp (`/c/:id?u=&s=`)
 * son otra cosa: son un 302 del servidor, no un boton de React. Antes ese 302
 * iba a `https://wa.me/...`, que NO ofrece selector: abria la app directo
 * (la normal, o la de negocios si esa fuera la predeterminada) sin darle a
 * la persona la eleccion.
 *
 * Medido por el dueno el 2026-10-21: "los enlaces de esas ofertas no abren
 * en la hoja de seleccion de whatsapp normal o business".
 *
 * REGLA INQUEBRANTABLE (ver AGENTS.md): TODO enlace a WhatsApp deja elegir
 * la app.
 * - Android: el esquema nativo `whatsapp://` lo resuelven WhatsApp y
 *   WhatsApp Business, asi que el sistema muestra el selector. Ahi no hace
 *   falta esta hoja: el servidor responde con un 302 al esquema.
 * - iOS y web: el sistema NO ofrece selector para esquemas propios, asi que
 *   la eleccion la pone esta hoja.
 *
 * REGLA 2 (el telefono nunca se expone): el numero del comercio NO aparece
 * en este HTML. Cada boton vuelve al servidor (`/c/:id?...&dest=app`) y el
 * servidor responde con el enlace YA ARMADO, en el `Location` de un 302.
 *
 * Modulo PURO: no toca la base de datos ni la red. Lo importa el servidor.
 */
import {
  opcionesWhatsAppPorPlataforma,
  type DestinoWhatsApp,
  type PlataformaWhatsApp,
} from './whatsappLinks.ts';

/** Escapa texto que viene de la base (un comercio puede escribir HTML). */
export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parametros del enlace firmado de oferta.
 *
 * Son un CONTRATO (los arma el bot, los valida el servidor, y aparecen en la
 * documentacion): van con nombre, no como cadenas sueltas por ahi.
 */
export const PARAM_USUARIO = 'u';
export const PARAM_FIRMA = 's';

/**
 * Base del enlace firmado, con los tokens intactos y SIN destino.
 *
 * La hoja solo le agrega `dest=`, asi que el servidor vuelve a validar la
 * firma cuando la persona elige app. El telefono del comercio NO va aqui:
 * se resuelve en el servidor, en el momento del clic.
 */
export function urlBaseEnlaceFirmado(
  ofertaId: string,
  usuario?: string | null,
  firma?: string | null,
): string {
  const params = new URLSearchParams();
  if (usuario) params.set(PARAM_USUARIO, String(usuario));
  if (firma) params.set(PARAM_FIRMA, String(firma));
  const query = params.toString();
  return `/c/${encodeURIComponent(String(ofertaId || ''))}${query ? '?' + query : ''}`;
}

/**
 * URL de una opcion de la hoja.
 *
 * `urlBase` es el enlace firmado SIN el destino (`/c/<id>?u=...&s=...`). La
 * hoja solo le agrega `dest=`, asi que los tokens viajan intactos y el
 * servidor vuelve a validar la firma al resolver el destino.
 */
export function urlOpcionHoja(urlBase: string, destino: DestinoWhatsApp): string {
  const sep = String(urlBase || '').includes('?') ? '&' : '?';
  return `${urlBase}${sep}dest=${encodeURIComponent(destino)}`;
}

export interface ParametrosHojaWhatsApp {
  /** Enlace firmado sin el destino: `/c/<id>?u=...&s=...`. */
  urlBase: string;
  /** Plataforma de quien toco el enlace (define el orden de las opciones). */
  plataforma?: PlataformaWhatsApp;
  /** Titulo de la oferta (es publico: sale en la landing). */
  tituloOferta?: string | null;
}

/**
 * HTML de la hoja de eleccion de app.
 *
 * Sin JavaScript: cada opcion es un `<a>` que va al servidor. El servidor
 * responde con el `Location` del 302 y el telefono nunca pasa por el HTML.
 */
export function htmlHojaWhatsApp(params: ParametrosHojaWhatsApp): string {
  const plataforma: PlataformaWhatsApp = params.plataforma || 'web';
  const opciones = opcionesWhatsAppPorPlataforma(plataforma);
  const titulo = params.tituloOferta ? String(params.tituloOferta).trim() : '';

  const filas = opciones
    .map((op) => {
      const url = escaparHtml(urlOpcionHoja(params.urlBase, op.destino));
      return `      <a class="op" href="${url}" rel="noreferrer">
        <span class="ico" aria-hidden="true">&#128172;</span>
        <span class="txt">
          <strong>${escaparHtml(op.etiqueta)}</strong>
          <span>${escaparHtml(op.detalle)}</span>
        </span>
      </a>`;
    })
    .join('\n');

  const bloqueOferta = titulo
    ? `    <p class="oferta">Oferta: <strong>${escaparHtml(titulo)}</strong></p>\n`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="referrer" content="no-referrer" />
<title>Yuddit - Abrir en WhatsApp</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #F7F5F0; color: #1C1917;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .caja {
    width: 100%; max-width: 420px; background: #fff; border: 1px solid #EAE5D9;
    border-radius: 24px; padding: 24px 20px; box-shadow: 0 10px 30px rgba(28, 25, 23, .08);
  }
  h1 { font-size: 18px; font-weight: 800; margin: 0 0 6px; letter-spacing: -.01em; }
  .sub { font-size: 13px; color: #78716C; margin: 0 0 18px; line-height: 1.5; }
  .oferta {
    font-size: 12px; color: #57534E; background: #F7F5F0; border-radius: 12px;
    padding: 10px 12px; margin: 0 0 16px; line-height: 1.4;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .op {
    display: flex; align-items: center; gap: 12px; padding: 13px 14px; margin-bottom: 8px;
    border: 1px solid #EAE5D9; border-radius: 16px; text-decoration: none; color: inherit;
    transition: background-color .12s ease, border-color .12s ease;
  }
  .op:hover, .op:focus-visible { background: #F7F5F0; border-color: rgba(21, 128, 61, .45); outline: none; }
  .ico {
    width: 38px; height: 38px; border-radius: 12px; background: rgba(37, 211, 102, .15);
    color: #15803D; display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex: 0 0 auto;
  }
  .txt { min-width: 0; }
  .txt strong { display: block; font-size: 14px; font-weight: 700; }
  .txt span { display: block; font-size: 12px; color: #78716C; }
  .nota { font-size: 11px; color: #A8A29E; margin: 16px 0 0; text-align: center; line-height: 1.5; }
</style>
</head>
<body>
  <main class="caja">
    <h1>¿Con qué app querés abrir WhatsApp?</h1>
    <p class="sub">Elegí la que tengas. El chat y tu código de canje son los mismos en todas.</p>
${bloqueOferta}${filas}
    <p class="nota">Si no tenés WhatsApp instalado, usá WhatsApp Web: funciona en el navegador.</p>
  </main>
</body>
</html>
`;
}
