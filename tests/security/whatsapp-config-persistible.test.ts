/**
 * El serializador que decide QUE se guarda en `app_settings.whatsapp_config`.
 *
 * La fila es texto: `JSON.stringify(waConfig)`. Los tres secretos
 * (`metaConfig.accessToken`, `metaConfig.verifyToken`, `wahaConfig.apiKey`) no
 * pueden viajar en claro ni siquiera hasta la base, asi que se cifran con los
 * helpers de PII que ya usa el resto del repo (`src/utils/pii.ts`, sobre
 * `VUUV_PII_KEY`, formato `enc:v1:<iv>:<tag>:<ct>`).
 *
 * La decision que importa: sin clave NO se guarda el secreto. El repo declara
 * que `VUUV_PII_KEY` es obligatoria donde haya datos reales, pero un despliegue
 * sin ella no puede degradar a "texto plano": escribiendo el token en claro se
 * produce exactamente el bug que este modulo corrige. Sin clave el secreto vive
 * solo en memoria y el entorno sigue siendo la fuente de verdad.
 *
 * Compatibilidad: las filas viejas estan en claro. `configWhatsappDesdeFila`
 * las lee igual (texto plano pasa sin cambios), asi que actualizar la app no
 * deja al bot sin token; la proxima escritura las cifra.
 */
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  configWhatsappParaGuardar,
  configWhatsappDesdeFila,
  configWhatsappTieneSecretosEnClaro,
} from "../../src/utils/configWhatsappPersistible.ts";

const CLAVE = "60b095f6d395439248dfc75b35693692aea0d37577e62ae1cb856a063d050f94";
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
    const guardable = configWhatsappParaGuardar(configDePrueba());
    const serializado = JSON.stringify(guardable);

    expect(serializado).not.toContain("EAAG-token-secreto");
    expect(serializado).not.toContain("verify-secreto");
    expect(serializado).not.toContain("api-key-secreta");

    expect(String(guardable.metaConfig.accessToken).startsWith(PREFIJO_CIFRADO)).toBe(true);
    expect(String(guardable.metaConfig.verifyToken).startsWith(PREFIJO_CIFRADO)).toBe(true);
    expect(String(guardable.wahaConfig.apiKey).startsWith(PREFIJO_CIFRADO)).toBe(true);
  });

  test("lo que no es secreto se guarda igual que antes", () => {
    const guardable = configWhatsappParaGuardar(configDePrueba());
    expect(guardable.modoActivo).toBe("meta");
    expect(guardable.numeroTelefono).toBe("+51987654321");
    expect(guardable.metaConfig.phoneNumberId).toBe("1234");
    expect(guardable.metaConfig.wabaId).toBe("999");
    expect(guardable.metaConfig.webhookUrl).toBe("/api/whatsapp/webhook");
    expect(guardable.wahaConfig.endpointUrl).toBe("http://localhost:3000/api/waha");
    expect(guardable.wahaConfig.sessionName).toBe("default");
  });

  test("guardar y volver a leer devuelve el mismo secreto", () => {
    const original = configDePrueba();
    const leido = configWhatsappDesdeFila(configWhatsappParaGuardar(original));
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

describe("sin VUUV_PII_KEY, el secreto no se persiste", () => {
  beforeEach(() => {
    delete process.env.VUUV_PII_KEY;
  });

  test("la fila serializada no contiene el secreto", () => {
    const guardable = configWhatsappParaGuardar(configDePrueba());
    const serializado = JSON.stringify(guardable);

    expect(serializado).not.toContain("EAAG-token-secreto");
    expect(serializado).not.toContain("verify-secreto");
    expect(serializado).not.toContain("api-key-secreta");
  });

  test("el resto de la configuracion si se guarda", () => {
    const guardable = configWhatsappParaGuardar(configDePrueba());
    expect(guardable.modoActivo).toBe("meta");
    expect(guardable.metaConfig.phoneNumberId).toBe("1234");
    expect(guardable.wahaConfig.sessionName).toBe("default");
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
    const guardable = configWhatsappParaGuardar(configDePrueba());
    expect(configWhatsappTieneSecretosEnClaro(guardable)).toBe(false);
    delete process.env.VUUV_PII_KEY;
  });

  test("un secreto cifrado que no se puede descifrar no se usa como token", () => {
    // Sin la clave, descifrar devuelve el sobre crudo. Usarlo como token daria
    // 401 en Meta con un mensaje incomprensible: mejor no tener token y que el
    // entorno mande.
    process.env.VUUV_PII_KEY = CLAVE;
    const guardable = configWhatsappParaGuardar(configDePrueba());
    delete process.env.VUUV_PII_KEY;

    const leido = configWhatsappDesdeFila(guardable);
    expect(leido.metaConfig.accessToken).toBeUndefined();
    expect(leido.wahaConfig.apiKey).toBeUndefined();
  });
});
