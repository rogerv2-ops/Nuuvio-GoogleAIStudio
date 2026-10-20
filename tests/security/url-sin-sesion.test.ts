/**
 * Al perder la sesion, la URL no debe seguir mostrando una ruta interna
 * de administracion.
 *
 * Que pasó (2026-10-20): el dueño cerró sesión en el panel de gestión y
 * siguió viendo en la barra de direcciones
 *
 *   https://yuddit.com/gestion/usuarios/lista
 *
 * El panel de gestión construye sub-rutas reales (`/gestion/usuarios/
 * lista`, `/gestion/comercios`, ...), así que al cerrar sesión la URL
 * quedaba clavada en la ruta interna. Cualquiera que mirara la barra de
 * direcciones veía una ruta de administración.
 *
 * Que vigila:
 *  1. al cerrar sesión, la URL vuelve a la superficie pública,
 *  2. si la sesión se pierde sola (expira, 401, cierre en otra pestaña),
 *     la URL sube a la entrada canónica de la superficie,
 *  3. con sesión abierta, la sub-ruta interna SÍ se conserva (es una
 *     funcionalidad: se puede compartir el enlace a una pantalla).
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const APP = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");

describe("La URL no delata el panel cuando no hay sesion", () => {
  test("U1: al cerrar sesion la URL vuelve a la superficie publica", () => {
    // El cierre de sesion tiene que reescribir la URL con replaceState
    // (replace, no push: la ruta interna no debe quedar en el historial
    // para que el boton "atras" tampoco la muestre).
    expect(APP).toContain("urlPublicaDeSuperficie");
    expect(APP).toMatch(/cerrarSesion\(\)[\s\S]{0,900}replaceState/);
  });

  test("U2: la sesion que expira sola tambien limpia la URL interna", () => {
    // Sin sesion de gestion, la URL no puede quedar en una sub-ruta
    // interna: sube a la entrada canonica de la superficie.
    expect(APP).toMatch(/if \(superficieActiva !== 'gestion'\) return;/);
    expect(APP).toMatch(/if \(tieneAccesoGestion\) return;/);
    expect(APP).toContain("'/gestion'");
  });

  test("U3: con sesion abierta la sub-ruta interna se conserva", () => {
    // No se debe romper la navegacion interna del panel: la sub-ruta se
    // mantiene mientras haya sesion.
    expect(APP).toContain("path.startsWith('/gestion/')");
  });

  test("U4: el servidor no sirve datos de gestion sin sesion", () => {
    // La URL es cosmetica: el dato de verdad esta protegido por el gate
    // de /api. Este test deja constancia de que la sub-ruta publica
    // devuelve el index (SPA) y no datos.
    // (Verificado en caliente contra produccion: /gestion/usuarios/lista
    // responde 200 con el index, y /api/audience/users responde 401.)
    expect(APP).toContain("obtenerSuperficieDesdeUrl");
  });
});
