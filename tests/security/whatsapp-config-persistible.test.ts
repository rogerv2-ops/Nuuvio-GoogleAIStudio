/**
 * El serializador que decide QUE se guarda en `app_settings.whatsapp_config`.
 *
 * La fila es texto: `JSON.stringify(waConfig)`. Los tres secretos
 * (`metaConfig.accessToken`, `metaConfig.verifyToken`, `wahaConfig.apiKey`) no
 * pueden viajar en claro ni siquiera hasta la base, asi que se cifran con los
 * helpers de PII que ya usa el resto del repo (`src/utils/pii.ts`, sobre
 * `VUUV_PII_KEY`, formato `enc:v1:<iv>:<tag>:<ct>`).
 *
 * La decision que importa: sin clave NO se escribe el secreto nuevo, pero
 * TAMPOCO se borra el que ya estaba en la fila. Las dos mitades son
 * obligatorias:
 *   - escribir en claro reproduce el bug que esto corrige;
 *   - borrar el que estaba rompe una credencial que funcionaba, y encima el
 *     endpoint respondia "guardado exitosamente" (lo encontraron las tres
 *     lentes de la revision nativa: R1-001, R3-001 y R4-001).
 * El secreto nuevo queda en memoria y el endpoint devuelve un `aviso`.
 *
 * Compatibilidad: las filas viejas estan en claro. `configWhatsappDesdeFila`
 * las lee igual (texto plano pasa sin cambios), asi que actualizar la app no
 * deja al bot sin token; la proxima escritura las cifra.
 */
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import crypto from "node:crypto";
import {
  configWhatsappParaGuardar,
  configWhatsappDesdeFila,
  configWhatsappTieneSecretosEnClaro,
} from "../../src/utils/configWhatsappPersistible.ts";

// Clave ficticia generada en cada corrida: nunca una clave real en el repo.
const CLAVE = crypto.randomBytes(32).toString("hex");
const PREFIJO_CIFRADO = "enc:v1:";

let claveOriginal: string | undefined;

beforeEach(() => {
  claveOriginal = process.env.VUUV_PII_KEY;
});

afterEach(() => {
  if (claveOriginal === undefined) delete process.env.VUUV_PII_KEY;
  else process.env.VUUV_PII_KEY = claveOriginal;
});

function configDePrueba() {
  return {
    modoActivo: "meta",
    numeroTelefono: "+51987654321",
    metaConfig: {
      phoneNumberId: "1234",
      wabaId: "999",
      webhookUrl: "/api/whatsapp/webhook",
      accessToken: "EAAG-token-secreto",
      verifyToken: "verify-secreto",
    },
    wahaConfig: {
      endpointUrl: "http://localhost:3000/api/waha",
      sessionName: "default",
      webhookUrl: "/api/waha/webhook",
      apiKey: "api-key-secreta",
    },
  };
}

describe("con VUUV_PII_KEY, los secretos se guardan cifrados", () => {
  beforeEach(() => {
    process.env.VUUV_PII_KEY = CLAVE;
  });

  test("la fila serializada no contiene ningun secreto en claro", () => {
    const { config, secretosSinPersistir } = configWhatsappParaGuardar(configDePrueba());
    const serializado = JSON.stringify(config);

    expect(serializado).not.toContain("EAAG-token-secreto");
    expect(serializado).not.toContain("verify-secreto");
    expect(serializado).not.toContain("api-key-secreta");

    expect(String(config.metaConfig.accessToken).startsWith(PREFIJO_CIFRADO)).toBe(true);
    expect(String(config.metaConfig.verifyToken).startsWith(PREFIJO_CIFRADO)).toBe(true);
    expect(String(config.wahaConfig.apiKey).startsWith(PREFIJO_CIFRADO)).toBe(true);

    // Habia clave: no hay nada que avisar.
    expect(secretosSinPersistir).toEqual([]);
  });

  test("lo que no es secreto se guarda igual que antes", () => {
    const { config } = configWhatsappParaGuardar(configDePrueba());
    expect(config.modoActivo).toBe("meta");
    expect(config.numeroTelefono).toBe("+51987654321");
    expect(config.metaConfig.phoneNumberId).toBe("1234");
    expect(config.metaConfig.wabaId).toBe("999");
    expect(config.metaConfig.webhookUrl).toBe("/api/whatsapp/webhook");
    expect(config.wahaConfig.endpointUrl).toBe("http://localhost:3000/api/waha");
    expect(config.wahaConfig.sessionName).toBe("default");
  });

  test("guardar y volver a leer devuelve el mismo secreto", () => {
    const original = configDePrueba();
    const leido = configWhatsappDesdeFila(configWhatsappParaGuardar(original).config);
    expect(leido.metaConfig.accessToken).toBe(original.metaConfig.accessToken);
    expect(leido.metaConfig.verifyToken).toBe(original.metaConfig.verifyToken);
    expect(leido.wahaConfig.apiKey).toBe(original.wahaConfig.apiKey);
  });

  test("no muta el objeto vivo del servidor", () => {
    // waConfig es estado del motor: si el helper lo mutara, el bot intentaria
    // mandar mensajes con un token cifrado y todo fallaria con 401 de Meta.
    const original = configDePrueba();
    const copia = JSON.parse(JSON.stringify(original));
    configWhatsappParaGuardar(original);
    expect(original).toEqual(copia);
  });
});

describe("sin VUUV_PII_KEY, el secreto nuevo no se escribe", () => {
  beforeEach(() => {
    delete process.env.VUUV_PII_KEY;
  });

  test("la fila serializada no contiene el secreto nuevo", () => {
    const { config } = configWhatsappParaGuardar(configDePrueba());
    const serializado = JSON.stringify(config);

    expect(serializado).not.toContain("EAAG-token-secreto");
    expect(serializado).not.toContain("verify-secreto");
    expect(serializado).not.toContain("api-key-secreta");
  });

  test("avisa cuales quedaron sin persistir", () => {
    const { secretosSinPersistir } = configWhatsappParaGuardar(configDePrueba());
    expect(secretosSinPersistir).toEqual([
      "metaConfig.accessToken",
      "metaConfig.verifyToken",
      "wahaConfig.apiKey",
    ]);
  });

  test("el resto de la configuracion si se guarda", () => {
    const { config } = configWhatsappParaGuardar(configDePrueba());
    expect(config.modoActivo).toBe("meta");
    expect(config.metaConfig.phoneNumberId).toBe("1234");
    expect(config.wahaConfig.sessionName).toBe("default");
  });

  test("NO borra el secreto que ya estaba en la fila", () => {
    // El caso que rompia: el panel guarda con el campo vacio (o con un token
    // nuevo) en un despliegue sin clave, y la fila perdia la credencial que
    // estaba funcionando. Perder el token es peor que el texto plano que ya
    // existia, y encima el endpoint respondia "guardado exitosamente".
    const filaPrevia = configDePrueba();
    filaPrevia.metaConfig.accessToken = "token-que-ya-funcionaba";
    filaPrevia.wahaConfig.apiKey = "api-key-que-ya-funcionaba";

    const { config } = configWhatsappParaGuardar(configDePrueba(), filaPrevia);
    expect(config.metaConfig.accessToken).toBe("token-que-ya-funcionaba");
    expect(config.wahaConfig.apiKey).toBe("api-key-que-ya-funcionaba");
  });

  test("tampoco borra un campo que el panel manda vacio", () => {
    const filaPrevia = configDePrueba();
    const nuevo = configDePrueba();
    nuevo.metaConfig.accessToken = "";
    nuevo.metaConfig.verifyToken = "";
    nuevo.wahaConfig.apiKey = "";

    const { config, secretosSinPersistir } = configWhatsappParaGuardar(nuevo, filaPrevia);
    expect(config.metaConfig.accessToken).toBe("EAAG-token-secreto");
    expect(config.metaConfig.verifyToken).toBe("verify-secreto");
    expect(config.wahaConfig.apiKey).toBe("api-key-secreta");
    // Vacío no es "no se pudo": es "no lo cambies", y no se avisa de eso.
    expect(secretosSinPersistir).toEqual([]);
  });
});

describe("compatibilidad con las filas viejas en claro", () => {
  test("una fila en claro se sigue leyendo", () => {
    // Es el estado de app_settings hoy: si esto no funcionara, actualizar la app
    // dejaria al bot sin token hasta que alguien vuelva a guardar el panel.
    const leido = configWhatsappDesdeFila(configDePrueba());
    expect(leido.metaConfig.accessToken).toBe("EAAG-token-secreto");
    expect(leido.wahaConfig.apiKey).toBe("api-key-secreta");
  });

  test("una fila en claro se detecta como pendiente de cifrar", () => {
    expect(configWhatsappTieneSecretosEnClaro(configDePrueba())).toBe(true);
  });

  test("una fila cifrada no se marca como pendiente", () => {
    process.env.VUUV_PII_KEY = CLAVE;
    const { config } = configWhatsappParaGuardar(configDePrueba());
    expect(configWhatsappTieneSecretosEnClaro(config)).toBe(false);
    delete process.env.VUUV_PII_KEY;
  });

  test("un secreto cifrado que no se puede descifrar no se usa como token", () => {
    // Sin la clave, descifrar devuelve el sobre crudo. Usarlo como token daria
    // 401 en Meta con un mensaje incomprensible: mejor no tener token y que el
    // entorno mande.
    process.env.VUUV_PII_KEY = CLAVE;
    const { config } = configWhatsappParaGuardar(configDePrueba());
    delete process.env.VUUV_PII_KEY;

    const leido = configWhatsappDesdeFila(config);
    expect(leido.metaConfig.accessToken).toBeUndefined();
    expect(leido.wahaConfig.apiKey).toBeUndefined();
  });

  test("un sobre que no se puede descifrar tampoco se borra de la fila al guardar", () => {
    // Si se borrara, una clave mal configurada por un rato destruiria la
    // credencial para siempre. Se conserva el sobre y se cifra el nuevo cuando
    // la clave vuelva.
    process.env.VUUV_PII_KEY = CLAVE;
    const { config: filaCifrada } = configWhatsappParaGuardar(configDePrueba());
    delete process.env.VUUV_PII_KEY;

    const { config } = configWhatsappParaGuardar(configDePrueba(), filaCifrada);
    expect(config.metaConfig.accessToken).toBe(filaCifrada.metaConfig.accessToken);
  });
});
