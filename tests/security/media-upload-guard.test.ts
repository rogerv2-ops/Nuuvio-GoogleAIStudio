import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const SERVER = leerTextoServidor();

describe("M2 - /api/media/upload exige sesion valida y rate limit", () => {
  test("la ruta tiene guard de rol y rate limit antes del handler", () => {
    const i = SERVER.indexOf('app.post("/api/media/upload"');
    expect(i).toBeGreaterThan(-1);
    const cabecera = SERVER.slice(i, i + 120);
    expect(cabecera).toContain('requireRoles(["admin","comercio"])');
    expect(cabecera).toContain('rateLimit("upload",20,60000)');
  });

  test("el endpoint no esta en la lista de rutas publicas", () => {
    const i = SERVER.indexOf("function esRutaPublica");
    const j = SERVER.indexOf("return false}", i);
    expect(i).toBeGreaterThan(-1);
    expect(SERVER.slice(i, j).includes("media/upload")).toBe(false);
  });
});
