import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const fuente = leerTextoServidor();

describe("ISSUE 4 - secreto HMAC sin fallback hardcodeado", () => {
  test("el string de fallback hardcodeado ya no existe en el repo", () => {
    expect(fuente.includes("vuuy-dev-fallback-secret")).toBe(false);
  });

  test("getAuthSecret falla cerrado (AUTH_SECRET_UNAVAILABLE), no cae a un valor conocido", () => {
    const i = fuente.indexOf("function getAuthSecret");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = fuente.slice(i, i + 900);
    expect(cuerpo).toContain("AUTH_SECRET_UNAVAILABLE");
    expect(cuerpo).not.toContain("vuuy-dev-fallback-secret");
  });

  test("login y guardias traducen AUTH_SECRET_UNAVAILABLE a 503", () => {
    expect(fuente).toContain("Servicio de autenticacion temporalmente no disponible");
    const usos = fuente.match(/esErrorSecretoAuth\(err\)/g) || [];
    expect(usos.length).toBeGreaterThanOrEqual(4);
  });
});
