import { test, expect, describe } from "bun:test";
import { esIntencionOfertas } from "../../src/utils/securityGuards.ts";

const CON_INTENCION = [
  "Hola, quiero ofertas",
  "hola ofertas",
  "¿Qué ofertas hay?",
  "muéstrame promociones",
  "hay descuentos",
  "ver ofertas",
  "dame promos",
  "ofertas cerca de mi",
];

const SIN_INTENCION = [
  "mi compra llegó tarde",
  "promociono mi negocio",
  "quiero información de facturación",
  "hola, buenos días",
  "necesito soporte técnico",
  "¿cómo está el clima?",
  "vendo productos al por mayor",
  "mi oferta académica terminó",
];

describe("US3 - deteccion de intencion de ofertas", () => {
  test("detecta mensajes con intencion real", () => {
    for (const t of CON_INTENCION) {
      expect(esIntencionOfertas(t), t).toBe(true);
    }
  });

  test("no se activa con mensajes no relacionados (<1% falsos positivos)", () => {
    for (const t of SIN_INTENCION) {
      expect(esIntencionOfertas(t), t).toBe(false);
    }
  });
});
