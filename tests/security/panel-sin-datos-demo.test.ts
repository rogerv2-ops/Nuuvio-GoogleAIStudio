/**
 * El panel NO tiene datos de demostracion.
 *
 * Que se midio (2026-10-21, revisando el panel del dueno): habia datos
 * inventados por todas partes, y algunos se veian como si fueran reales.
 *
 *  1. `coreEvents` sembraba 21 eventos automaticos en CADA carga de pagina
 *     ("Carlos Vasquez / carlos.vasquez@gmail.com" en Miraflores). El
 *     panel de atribucion los leia y los mostraba como leads.
 *  2. El widget UTM: `visitasTotales = Math.max(eventos.length * 18 + 142, 198)`
 *     (minimo 198 visitas inventadas) y la tasa de conversion se calculaba
 *     sobre ese numero.
 *  3. El widget ejecutivo: un GRAFICO DE 6 MESES (Mayo-Octubre 2026)
 *     fabricated multiplicando el valor actual por porcentajes fijos.
 *  4. El dashboard de Analitica: una serie diaria con una progresion
 *     inventada y leads "estimados" (`ofertas * 4.2 + (i % 3) * 6`).
 *  5. Los "periodos anteriores" de las tendencias: `Math.max(1, actual * 0.79)`.
 *
 * Ahora: lo que no se puede medir dice "sin medir" o "sin dato", y los
 * graficos se arman con las fechas de la base.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, get } from "./_helpers.ts";

const ROOT = path.resolve(import.meta.dir, "../..");

function leer(relativo: string): string {
  return fs.readFileSync(path.join(ROOT, relativo), "utf8");
}

/**
 * El archivo SIN COMENTARIOS.
 *
 * Los comentarios documentan que habia antes (por ejemplo la formula
 * inventada de las visitas), asi que buscar el texto viejo en todo el
 * archivo daria falsos positivos. Lo que se vigila es el CODIGO.
 */
function leerSinComentarios(relativo: string): string {
  return leer(relativo)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);

describe("Panel: sin datos de demostracion", () => {
  test("D1: no se siembran eventos de ejemplo al cargar la pagina", () => {
    const eventos = leer("src/core/events.ts");
    // El arreglo de eventos semilla tiene que estar VACIO.
    expect(eventos).toContain("const eventosSemilla=[];");
    // Y no puede quedar ningun dato de persona inventada en el codigo.
    expect(eventos).not.toContain("carlos.vasquez@gmail.com");
    expect(eventos).not.toContain("usr_demo_");
    expect(eventos).not.toContain("VUUY-CV88");
  });

  test("D2: el widget UTM no inventa visitas", () => {
    const widget = leerSinComentarios("src/components/UtmAttributionDashboardWidget.tsx");
    // La formula de "visitas * 18 + 142" y el minimo de 198.
    expect(widget).not.toMatch(/eventosVisitasUtm\.length\s*\*\s*\d+/);
    expect(widget).not.toMatch(/Math\.max\([^)]*,\s*1\d\d\s*\)/);
    // Y las visitas se declaran como no medibles.
    expect(widget).toContain("const visitasTotales: number | null = null;");
    expect(widget).toContain("sin medir");
  });

  test("D3: el grafico de 6 meses del widget ejecutivo usa la serie real", () => {
    const widget = leerSinComentarios("src/components/gestion/ExecutiveMetricsRechartsWidget.tsx");
    // El bloque que multiplicaba el valor actual por porcentajes fijos.
    expect(widget).not.toMatch(/usuariosRegistrados:\s*Math\.round\(totalUsuariosCount/);
    expect(widget).not.toMatch(/comerciosActivos:\s*Math\.round\(comerciosActivosCount/);
    // Y pide la serie al servidor.
    expect(widget).toContain("/api/analitica/series");
  });

  test("D4: el dashboard de Analitica no inventa la serie diaria", () => {
    const dash = leerSinComentarios("src/components/AdminRechartsDashboard.tsx");
    expect(dash).not.toContain("factorProgreso");
    expect(dash).not.toMatch(/\*\s*4\.2/);
    expect(dash).toContain("/api/analitica/serie-diaria");
  });

  test("D5: las tendencias no comparan contra un periodo anterior inventado", () => {
    const dash = leerSinComentarios("src/components/AdminRechartsDashboard.tsx");
    const widget = leerSinComentarios("src/components/UtmAttributionDashboardWidget.tsx");
    for (const archivo of [dash, widget]) {
      expect(archivo).not.toMatch(/prior\w+\s*=\s*Math\.max\(1,/);
    }
    // Y el badge distingue "sin dato" de "0% sin cambio".
    const badge = leer("src/components/common/TrendBadge.tsx");
    expect(badge).toContain("sin dato");
    expect(badge).toContain("hayComparacion");
  });

  test.skipIf(!online || !hayAdmin)(
    "D6: la serie mensual y la diaria salen de la base y no inventan meses",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const rMes = await get("/api/analitica/series?meses=6", token);
      expect(rMes.status).toBe(200);
      const mes: any = await rMes.json();
      expect(mes.ok).toBe(true);
      expect(mes.serie.length).toBe(6);
      for (const m of mes.serie) {
        // Los valores son numeros que vienen de la base (0 si no hay datos).
        expect(typeof m.usuarios).toBe("number");
        expect(typeof m.leads).toBe("number");
        expect(typeof m.ofertas).toBe("number");
        expect(m.usuarios).toBeGreaterThanOrEqual(0);
        expect(m.leads).toBeGreaterThanOrEqual(0);
        expect(m.ofertas).toBeGreaterThanOrEqual(0);
      }

      const rDia = await get("/api/analitica/serie-diaria?dias=30", token);
      expect(rDia.status).toBe(200);
      const dia: any = await rDia.json();
      expect(dia.ok).toBe(true);
      expect(dia.serie.length).toBe(30);
      // Los acumulados crecen (o se quedan) pero nunca retroceden.
      for (let i = 1; i < dia.serie.length; i++) {
        expect(dia.serie[i].ofertasAcumuladas).toBeGreaterThanOrEqual(dia.serie[i - 1].ofertasAcumuladas);
        expect(dia.serie[i].leadsAcumulados).toBeGreaterThanOrEqual(dia.serie[i - 1].leadsAcumulados);
      }
    },
  );

  test("D7: la venta del boton 'Probar Alerta' se marca como prueba", () => {
    const vista = leer("src/components/comercio/views/VentasComercioView.tsx");
    expect(vista).toContain("origen: 'prueba'");
  });
});
