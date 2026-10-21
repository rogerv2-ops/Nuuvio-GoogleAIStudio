/**
 * Rutas de facturacion (packs de clics).
 *
 * POR QUE EXISTE ESTE ARCHIVO
 *
 * El saldo de clics de un comercio es DINERO: es lo que el comercio paga y
 * lo que se descuenta cuando un lead llega. La verdad de ese saldo esta en
 * la tabla `click_packs` (depositada con un UPDATE atomico, ver
 * `debitarClicAtomico` en `src/db/repo.ts`).
 *
 * El problema que se vino a corregir (medido el 2026-10-21): el panel NUNCA
 * leia esa tabla. `facturacionModule` no puede tocar la base desde el
 * navegador (guarda deliberada: si importara el Pool de Postgres en el
 * bundle, la SPA quedaria en blanco), asi que en el navegador su cache se
 * quedaba con la SEMILLA de `src/data/seedData.ts`.
 *
 *   pack_01  la base dice 80 clics   la pantalla decia 81
 *   pack_02  la base dice 70 clics   la pantalla decia 72
 *   pack_03  la base dice 34 clics   la pantalla decia 34
 *
 * O sea: el comercio veia un saldo que NO era el suyo, y el administrador
 * veia lo mismo en "Campanas y Cobro". Con un saldo equivocado, el comercio
 * no sabe cuanto le queda y el admin no sabe cuanto ha vendido.
 *
 * La regla que queda: el SALDO SE LEE DE LA BASE, SIEMPRE. La semilla es
 * solo para sembrar la tabla la primera vez (en el servidor), nunca para
 * mostrarse.
 *
 * NOTA DE ALCANCE: este archivo expone SOLO la lectura. La compra de packs
 * (`POST`) NO se expone todavia, y a proposito: hoy no hay pasarela de pago
 * y acreditar un pack desde el navegador seria darle clics gratis a
 * cualquiera con una cuenta de comercio. Cuando se implemente la compra,
 * el endpoint tiene que validar un pago confirmado por el servidor.
 */
import { listarClickPacks } from "../db/repo.ts";

let _rateLimit: any;
function rateLimit(...args: any[]): any {
  return _rateLimit(...args);
}

export function registrarRutasFacturacion(app: any, ctx: any): void {
  _rateLimit = ctx.rateLimit;

  /**
   * GET /api/facturacion/packs
   *
   * Devuelve los packs REALES desde `click_packs`.
   *
   * Alcance:
   *  - admin: ve todos los packs, o los de un comercio si pide
   *    `?comercioId=`.
   *  - comercio: ve SOLO los suyos (el `merchantId` de su credencial).
   *    Nunca los de otro.
   */
  app.get("/api/facturacion/packs", async (req: any, res: any) => {
    try {
      const auth = (req as any).auth || {};
      const packs = await listarClickPacks();
      const esAdmin = auth.rol === "admin";
      const pedido = String(req.query?.comercioId || "").trim();

      let visibles = packs;
      if (!esAdmin) {
        const comercioId = String(auth.merchantId || "").trim();
        if (!comercioId) {
          res.status(403).json({
            ok: false,
            error: "Tu cuenta de comercio no tiene un comercio asociado.",
          });
          return;
        }
        visibles = packs.filter((p: any) => p.comercioId === comercioId);
      } else if (pedido) {
        visibles = packs.filter((p: any) => p.comercioId === pedido);
      }

      // El saldo total es el de los packs ACTIVOS: un pack agotado no aporta.
      const saldoTotal = visibles
        .filter((p: any) => p.estado === "activo")
        .reduce((acc: number, p: any) => acc + Number(p.saldoClics || 0), 0);

      res.json({ ok: true, packs: visibles, saldoTotal, origen: "base" });
    } catch (err) {
      console.error("[Facturacion] Error consultando los packs de clics:", err);
      res.status(500).json({ ok: false, error: "Error obteniendo los packs de clics." });
    }
  });
}
