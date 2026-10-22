/**
 * Que se guarda, y que NO, en `app_settings.whatsapp_config`.
 *
 * El panel guarda la configuracion con `saveSetting("whatsapp_config", waConfig)`.
 * Eso es `JSON.stringify` de un objeto que tambien lleva los tres secretos
 * (`metaConfig.accessToken`, `metaConfig.verifyToken`, `wahaConfig.apiKey`), asi
 * que la fila los dejaba EN CLARO: un backup, un `select`, una copia de staging
 * o el panel de la base entregaban tokens usables. Cerrar el GET (hallazgo
 * R1-001) tapo la puerta HTTP, no la del almacenamiento.
 *
 * Reglas de este modulo:
 *   1. Con `VUUV_PII_KEY` los secretos se guardan cifrados con el sobre de
 *      `src/utils/pii.ts` (`enc:v1:<iv>:<tag>:<ct>`), el mismo que ya protege
 *      la PII de audiencia.
 *   2. SIN clave el secreto NO se guarda. El repo dice que la clave es
 *      obligatoria donde haya datos reales, pero un despliegue sin ella no
 *      puede degradar a texto plano: seria escribir justo el bug que esto
 *      corrige. El secreto queda en memoria y el entorno sigue mandando.
 *   3. Las filas viejas estan en claro y se siguen leyendo: actualizar la app no
 *      puede dejar al bot sin token. La proxima escritura las cifra.
 *   4. Un secreto cifrado que no se puede descifrar NO se usa como si fuera el
 *      token: se descarta y el entorno manda, en vez de mandar el sobre a Meta
 *      para comerse un 401 incomprensible.
 *
 * Modulo PURO: no toca base ni entorno salvo leer `VUUV_PII_KEY` a traves de
 * los helpers de PII. Se puede probar sin servidor.
 */
import { cifrarCampo, descifrarCampo, estaCifrado, piiHabilitado } from "./pii.ts";

/** Rutas de los secretos dentro del objeto de configuracion de WhatsApp. */
const SECRETOS: ReadonlyArray<readonly [string, string]> = [
  ["metaConfig", "accessToken"],
  ["metaConfig", "verifyToken"],
  ["wahaConfig", "apiKey"],
];

let avisoSinClaveEmitido = false;

type ConfigWhatsapp = Record<string, any>;

/** Copia de la configuracion con los subobjetos que se tocan ya separados. */
function copiarConfig(config: ConfigWhatsapp | null | undefined): ConfigWhatsapp {
  const base = (config || {}) as ConfigWhatsapp;
  return {
    ...base,
    metaConfig: { ...(base.metaConfig || {}) },
    wahaConfig: { ...(base.wahaConfig || {}) },
  };
}

function esSecretoUtil(valor: unknown): boolean {
  return typeof valor === "string" && valor.trim() !== "";
}

/**
 * Version que se puede escribir en `app_settings`: secretos cifrados, o fuera
 * si no hay con que cifrarlos. Nunca muta el objeto recibido (es el estado vivo
 * del motor: si se cifrara ahi, el bot mandaria un sobre a Meta).
 */
export function configWhatsappParaGuardar(config: ConfigWhatsapp | null | undefined): ConfigWhatsapp {
  const copia = copiarConfig(config);
  const conClave = piiHabilitado();

  for (const [grupo, campo] of SECRETOS) {
    const valor = copia[grupo]?.[campo];
    if (!esSecretoUtil(valor)) {
      delete copia[grupo][campo];
      continue;
    }
    if (estaCifrado(valor)) continue;
    if (!conClave) {
      delete copia[grupo][campo];
      continue;
    }
    copia[grupo][campo] = cifrarCampo(valor);
  }

  if (!conClave && !avisoSinClaveEmitido) {
    const haySecretos = SECRETOS.some(([grupo, campo]) => esSecretoUtil(config?.[grupo]?.[campo]));
    if (haySecretos) {
      console.warn(
        "[WhatsApp] Sin VUUV_PII_KEY no se guardan los secretos en app_settings: " +
          "quedan en memoria y el entorno sigue siendo la fuente de verdad. " +
          "Define VUUV_PII_KEY para que se guarden cifrados."
      );
      avisoSinClaveEmitido = true;
    }
  }

  return copia;
}

/**
 * Version que se puede usar en memoria: descifra lo que venga cifrado y deja
 * pasar el texto plano de las filas viejas. Un sobre que no se puede descifrar
 * se descarta (ver regla 4).
 */
export function configWhatsappDesdeFila(fila: ConfigWhatsapp | null | undefined): ConfigWhatsapp {
  const copia = copiarConfig(fila);

  for (const [grupo, campo] of SECRETOS) {
    const valor = copia[grupo]?.[campo];
    if (!esSecretoUtil(valor)) {
      delete copia[grupo][campo];
      continue;
    }
    if (!estaCifrado(valor)) continue;

    const descifrado = descifrarCampo(valor);
    if (descifrado && !estaCifrado(descifrado)) {
      copia[grupo][campo] = descifrado;
    } else {
      // Sin la clave (o con otra) el sobre no sirve como token.
      delete copia[grupo][campo];
      console.warn(
        `[WhatsApp] El secreto ${grupo}.${campo} esta cifrado y no se pudo descifrar; ` +
          "se ignora y se usa el valor del entorno."
      );
    }
  }

  return copia;
}

/** Indica si la fila guardada todavia tiene algun secreto en texto plano. */
export function configWhatsappTieneSecretosEnClaro(fila: ConfigWhatsapp | null | undefined): boolean {
  return SECRETOS.some(([grupo, campo]) => {
    const valor = fila?.[grupo]?.[campo];
    return esSecretoUtil(valor) && !estaCifrado(valor);
  });
}
