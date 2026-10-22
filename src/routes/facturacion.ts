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
 * NOTA DE ALCANCE: este archivo expone SOLO la lectura, mas la acreditacion
 * MANUAL que el admin hace (POST /api/facturacion/packs/acreditar). La compra
 * de packs con pasarela (`POST` de compra) NO se expone, y a proposito: hoy no
 * hay pasarela de pago y comprar desde el navegador seria darle clics gratis a
 * cualquiera con una cuenta de comercio. Cuando se implemente la compra, el
 * endpoint tiene que validar un pago confirmado por el servidor.
 */
import { listarClickPacks, insertarClickPack } from "../db/repo.ts";
import { facturacionModule } from "../modules/facturacion";

let _rateLimit: any;
function rateLimit(...args: any[]): any {
  return _rateLimit(...args);
}
let _requireAdmin: any;
function requireAdmin(...args: any[]): any {
  return _requireAdmin(...args);
}
let _logEventoSeguridad: any;
function logEventoSeguridad(...args: any[]): any {
  return _logEventoSeguridad ? _logEventoSeguridad(...args) : undefined;
}

export function registrarRutasFacturacion(app: any, ctx: any): void {
  _rateLimit = ctx.rateLimit;
  _requireAdmin = ctx.requireAdmin;
  _logEventoSeguridad = ctx.logEventoSeguridad;

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

  /**
   * POST /api/facturacion/packs/acreditar
   *
   * Acredita saldo de clics a un comercio. SOLO el administrador.
   *
   * POR QUE EXISTE (decision del dueno, 2026-10-21)
   *
   * `/api/ofertas/publicas` filtra por `comercioTieneSaldo`: la oferta activa
   * de un comercio SIN saldo no llega a la landing. Un comercio nuevo (el que
   * se registra por WhatsApp) no tiene pack, asi que su oferta aprobada se
   * quedaba invisible sin aviso: el admin aprobaba y no pasaba nada.
   *
   * El dueno eligio la via manual ("Boton de acreditar pack (admin)"): el
   * admin le carga N clics al comercio y el cobro real ocurre FUERA de la app
   * (Yape/transferencia); la app solo lo registra. Cuando exista pasarela de
   * pago, esta misma ruta pasa a registrar una compra verificada por el
   * servidor.
   *
   * La acreditacion escribe un PACK NUEVO en `click_packs` (la verdad del
   * saldo) con id `pack_acc_*`: asi queda en el historial de "Pagos y cobros"
   * como cualquier pack y el debito por clic lo consume igual.
   *
   * Fail-closed: comercio vacio, clics fuera de 1..10000 o monto negativo se
   * rechazan con 400 y NO se escribe nada en la base.
   */
  app.post(
    "/api/facturacion/packs/acreditar",
    requireAdmin,
    rateLimit("facturacion_acreditar", 30, 60000),
    async (req: any, res: any) => {
      try {
        const body = req.body || {};
        const comercioId = String(body.comercioId || "").trim();
        const clics = Math.floor(Number(body.clics));
        const monto = Number(body.monto ?? 0);

        if (!comercioId) {
          res.status(400).json({ ok: false, error: "Falta el comercio a acreditar." });
          return;
        }
        if (!Number.isFinite(clics) || clics <= 0 || clics > 10000) {
          res.status(400).json({
            ok: false,
            error: "La cantidad de clics debe estar entre 1 y 10000.",
          });
          return;
        }
        if (!Number.isFinite(monto) || monto < 0) {
          res.status(400).json({ ok: false, error: "El monto cobrado no puede ser negativo." });
          return;
        }

        const actor = (req as any).auth || {};
        const pack = {
          id: `pack_acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          comercioId,
          totalClics: clics,
          saldoClics: clics,
          precioUnitario: Math.round((monto / clics) * 100) / 100,
          montoTotal: Math.round(monto * 100) / 100,
          estado: "activo",
          compradoEn: new Date().toISOString(),
        };

        // --- GUARDAR EL CREDITO (lo critico) ---
        // El guardado del pack es lo que importa: si falla AQUI, el credito no
        // existe y se responde 500 (no se debito nada). Todo lo que sigue es
        // "mejor esfuerzo": jamas se responde 500 despues de un guardado
        // exitoso, porque eso es lo que hace que el admin reintente y duplique
        // los clics.
        try {
          await insertarClickPack(pack as any);
        } catch (err) {
          console.error("[Facturacion] Error guardando el pack de clics:", err);
          res.status(500).json({ ok: false, error: "No se pudo guardar el pack de clics. No se acredito nada." });
          return;
        }

        // --- MEJOR ESFUERZO: cache, auditoria y lectura del saldo ---
        // Si algo de esto falla, el credito YA esta guardado. Se responde 200
        // con el pack y un aviso, para que el admin no reintente a ciegas.
        const avisos: string[] = [];

        try {
          await facturacionModule.recargarCache();
        } catch (e) {
          console.warn("[Facturacion] No se pudo recargar la cache tras acreditar:", e);
          avisos.push("El saldo quedo guardado, pero la oferta puede tardar en verse hasta el proximo arranque.");
        }

        try {
          await logEventoSeguridad({
            operadorId: actor.usuarioId,
            operadorNombre: actor.nombre,
            accion: "Saldo de clics acreditado",
            entidad: "facturacion",
            entidadId: comercioId,
            detalles: `${clics} clic(s) por S/. ${pack.montoTotal} (pack ${pack.id})`,
          });
        } catch (e) {
          console.warn("[Facturacion] No se pudo escribir la auditoria del credito:", e);
          avisos.push("El credito se guardo pero el registro de auditoria no se pudo escribir.");
        }

        let saldoTotal = Number(pack.saldoClics);
        try {
          const packs = await listarClickPacks();
          saldoTotal = packs
            .filter((p: any) => p.comercioId === comercioId && p.estado === "activo")
            .reduce((acc: number, p: any) => acc + Number(p.saldoClics || 0), 0);
        } catch (e) {
          console.warn("[Facturacion] No se pudo leer el saldo tras acreditar:", e);
        }

        res.json({
          ok: true,
          pack,
          saldoTotal,
          aviso: avisos.length > 0 ? avisos.join(" ") : undefined,
        });
      } catch (err) {
        console.error("[Facturacion] Error acreditando saldo de clics:", err);
        res.status(500).json({ ok: false, error: "Error acreditando el saldo de clics." });
      }
    }
  );
}
