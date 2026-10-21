/**
 * El selector de provincia -> distrito.
 *
 * Que reporto el dueno (2026-10-21, en produccion): "hay fallos con el
 * selector de provincias y distritos, primero, filtra las provincias
 * activas, segundo no se puede seleccionar nada".
 *
 * LAS DOS CAUSAS
 *
 * 1. Mostraba TODAS las provincias (196), no solo las encendidas. Si una
 *    persona se registra en una provincia sin servicio, el bot le responde
 *    "todavia no operamos en tu zona": el registro se pierde.
 *
 * 2. "No se puede seleccionar nada": una CARRERA. `cargarGeografia` hacia
 *    `if (estado.cargando) return;`, asi que cuando el selector pedia los
 *    distritos de la provincia elegida MIENTRAS el catalogo de provincias
 *    todavia estaba cargando, la peticion se perdia y el desplegable de
 *    distritos se quedaba vacio.
 */
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline } from "./_helpers.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const online = await servidorOnline();

// El modulo usa rutas relativas ("/api/geo/provincias"): en el test se las
// antepone el servidor local.
const fetchOriginal = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = ((input: any, init?: any) => {
    const url = typeof input === "string" && input.startsWith("/") ? `${BASE}${input}` : input;
    return fetchOriginal(url, init);
  }) as any;
});
afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

describe("Selector de provincia -> distrito", () => {
  test.skipIf(!online)(
    "S1: pedir los distritos mientras el catalogo carga NO los pierde (la carrera)",
    async () => {
      const geo = await import("../../src/modules/geo.ts");

      // Esto es EXACTAMENTE lo que hace el navegador: el componente pide el
      // catalogo al montar y, en cuanto el usuario elige una provincia, pide
      // sus distritos. Si las dos cosas se solapan, la segunda se perdia.
      const [, distritos] = await Promise.all([
        geo.cargarGeografia(),
        geo.cargarDistritos("150100"),
      ]);

      expect(Array.isArray(distritos)).toBe(true);
      expect(distritos.length).toBe(43);
      expect(distritos.find((d: any) => d.nombre === "Miraflores")?.codigo).toBe("150122");
    },
  );

  test.skipIf(!online)(
    "S2: las provincias se cargan y se distinguen las activas de las que no",
    async () => {
      const geo = await import("../../src/modules/geo.ts");
      await geo.cargarGeografia();

      const todas = geo.provinciasActivas();
      // Solo las activas: las que el negocio tiene encendidas.
      expect(todas.length).toBeGreaterThan(0);
      for (const p of todas) {
        expect(p.activo).toBe(true);
      }
      // La de Lima es la que esta encendida hoy.
      expect(todas.find((p: any) => p.codigo === "150100")).toBeTruthy();
    },
  );

  test.skipIf(!online)(
    "S3: los distritos de la zona salen de la provincia activa",
    async () => {
      const geo = await import("../../src/modules/geo.ts");
      const zona = await geo.cargarDistritosDeZona();
      expect(zona.length).toBeGreaterThan(0);
      expect(zona).toContain("Miraflores");
      // Y NO traen distritos de provincias sin servicio.
      expect(zona).not.toContain("Arequipa");
    },
  );

  test("S4: el selector muestra solo las provincias activas por defecto", () => {
    const selector = fs.readFileSync(
      path.join(ROOT, "src/components/common/SelectorProvinciaDistrito.tsx"),
      "utf8",
    );
    // Por defecto, solo las encendidas.
    expect(selector).toMatch(/soloActivas\s*=\s*true/);
    // Y el filtro se aplica de verdad.
    expect(selector).toContain("soloActivas ? provincias.filter((p) => p.activo) : provincias");
    // Si no hay ninguna encendida, se explica en vez de dejar un desplegable
    // vacio sin explicacion.
    expect(selector).toContain("Todavía no hay zonas de servicio activas");
  });

  test("S6: provincia y distrito se actualizan en UNA sola llamada (el bug del estado viejo)", () => {
    // Sin comentarios (los comentarios citan el API viejo, y buscarlos
    // daria falsos positivos).
    const sinComentarios = (relativo: string) =>
      fs
        .readFileSync(path.join(ROOT, relativo), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
    const selector = sinComentarios("src/components/common/SelectorProvinciaDistrito.tsx");
    // Un solo callback: con dos, el segundo usaba el estado viejo del
    // formulario y BORRABA la provincia recien elegida.
    expect(selector).toContain("onChange: (valores: { provincia: string; distrito: string }) => void;");
    expect(selector).not.toContain("onProvinciaChange");
    expect(selector).not.toContain("onDistritoChange");
    expect(selector).toContain("onChange({ provincia: e.target.value, distrito: '' })");

    // Y los formularios que lo usan pasan los dos valores juntos.
    for (const padre of [
      "src/components/PublicWeb.tsx",
      "src/components/UserRegistrationFunnelModal.tsx",
    ]) {
      const texto = sinComentarios(padre);
      expect(texto, `${padre} debe usar un solo onChange`).not.toContain("onProvinciaChange");
      expect(texto, `${padre} debe usar un solo onChange`).not.toContain("onDistritoChange");
    }
    const web = sinComentarios("src/components/PublicWeb.tsx");
    expect(web).toContain("onChange={(v) => setFormUser({ ...formUser, ...v })}");
  });

  test("S5: la carga del catalogo se ESPERA, no se pierde", () => {
    // Sin comentarios: los comentarios documentan que habia antes (y citan
    // el codigo viejo), asi que buscarlos daria falsos positivos.
    const modulo = fs
      .readFileSync(path.join(ROOT, "src/modules/geo.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    // El `return` en seco era la carrera.
    expect(modulo).not.toMatch(/if\s*\(estado\.cargando\)\s*return;/);
    // Y ahora se espera a la carga en curso.
    expect(modulo).toContain("await promesaEnCurso");
  });
});
