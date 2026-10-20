import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const SERVER = leerTextoServidor();
const CLIENT = fs.readFileSync(path.join(ROOT, "src/core/security.ts"), "utf8");

describe("Fase 1 - sesion en cookie HttpOnly + anti-CSRF", () => {
  test("la cookie de sesion es HttpOnly + SameSite=Strict + Secure", () => {
    const i = SERVER.indexOf("function construirCookieSesion");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = SERVER.slice(i, i + 300);
    expect(cuerpo).toContain("HttpOnly");
    expect(cuerpo).toContain("SameSite=Strict");
    expect(cuerpo).toContain("Secure");
    expect(cuerpo).toContain("Path=/");
  });

  test("login ya no devuelve el token en el cuerpo (solo cookie)", () => {
    const i = SERVER.indexOf('app.post("/api/auth/login"');
    const j = SERVER.indexOf('app.post("/api/auth/logout"', i);
    const body = SERVER.slice(i, j);
    expect(body).toContain("Set-Cookie");
    expect(body).not.toContain("token:token");
    expect(body).not.toContain("token:token,");
  });

  test("el middleware valida mismo origen para metodos mutantes con cookie", () => {
    expect(SERVER).toContain("peticionMismoOrigen(req)");
    expect(SERVER).toContain("CSRF bloqueado");
    expect(SERVER).toContain("extraerCookieSesion(req)");
  });

  test("el cliente ya no persiste el token (vive en la cookie)", () => {
    expect(CLIENT).toContain("token: ''");
    expect(CLIENT).not.toContain("token: data.token");
  });
});
