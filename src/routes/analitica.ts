/**
 * Metricas del panel, medidas en la base de datos.
 *
 * QUE RESUELVE
 *
 * Los KPIs del panel se calculaban con `coreEvents` (eventos EN MEMORIA del
 * navegador) y con minimos inventados puestos a mano:
 *
 *   usuariosRegistrados: Math.max(usuarios, 240)
 *   totalVistasOfertas:  Math.max(mostradas, 625)
 *   ventasConfirmadas:   Math.max(ventas, 12)
 *   ctrPromedioGlobal:   ctr > 0 ? ctr : 13.6
 *   comerciosActivos:    4
 *   ofertasActivas:      4
 *
 * Con la base VACIA, el panel se veia lleno. Medido en produccion: la base
 * tenia 0 usuarios, 0 vistas y 0 ventas, y el panel mostraba 240, 625 y 12.
 * Decidir con esos numeros es decidir sobre datos que no existen.
 *
 * Ahora las mide el SERVIDOR (el unico que puede ver la base) y lo que no
 * se puede medir se devuelve como `null`: la pantalla dice "sin medir" en
 * vez de inventar un numero.
 */
import {
  obtenerMetricasComercio,
  obtenerMetricasGlobales,
  obtenerSerieDiaria,
  obtenerSerieMensual,
} from "../db/repo.ts";

export function registrarRutasAnalitica(app: any, ctx: any): void {
  const requireAdmin = ctx.requireAdmin;
  const rateLimit = ctx.rateLimit;

  /**
   * GET /api/analitica/kpis
   * GET /api/analitica/kpis?comercioId=merch_01
   */
  app.get(
    "/api/analitica/kpis",
    requireAdmin,
    rateLimit("analitica", 60, 60000),
    async (req: any, res: any) => {
      try {
        const comercioId = String(req.query?.comercioId || "").trim();
        if (comercioId) {
          const metricas = await obtenerMetricasComercio(comercioId);
          if (!metricas) {
            res.status(500).json({ ok: false, error: "No se pudieron calcular las metricas." });
            return;
          }
          res.json({ ok: true, alcance: "comercio", metricas });
          return;
        }
        const metricas = await obtenerMetricasGlobales();
        if (!metricas) {
          res.status(500).json({ ok: false, error: "No se pudieron calcular las metricas." });
          return;
        }
        res.json({ ok: true, alcance: "global", metricas });
      } catch (error) {
        console.error("[Analitica] Error serviendo las metricas:", error);
        res.status(500).json({ ok: false, error: "Error obteniendo las metricas." });
      }
    },
  );

  /**
   * GET /api/analitica/series?meses=6
   *
   * La serie mensual REAL, para el grafico de evolucion. Antes el widget
   * fabricaba seis meses de historia multiplicando el valor actual por
   * porcentajes fijos.
   */
  app.get(
    "/api/analitica/series",
    requireAdmin,
    rateLimit("analitica", 60, 60000),
    async (req: any, res: any) => {
      try {
        const meses = Number(req.query?.meses || 6);
        const serie = await obtenerSerieMensual(meses);
        res.json({ ok: true, serie });
      } catch (error) {
        console.error("[Analitica] Error sirviendo la serie mensual:", error);
        res.status(500).json({ ok: false, error: "Error obteniendo la serie mensual." });
      }
    },
  );

  /**
   * GET /api/analitica/serie-diaria?dias=30
   *
   * La serie diaria REAL. Antes el dashboard de Analitica fabricaba una
   * progresion por dias y unos leads "estimados".
   */
  app.get(
    "/api/analitica/serie-diaria",
    requireAdmin,
    rateLimit("analitica", 60, 60000),
    async (req: any, res: any) => {
      try {
        const dias = Number(req.query?.dias || 30);
        const serie = await obtenerSerieDiaria(dias);
        res.json({ ok: true, serie });
      } catch (error) {
        console.error("[Analitica] Error sirviendo la serie diaria:", error);
        res.status(500).json({ ok: false, error: "Error obteniendo la serie diaria." });
      }
    },
  );
}
