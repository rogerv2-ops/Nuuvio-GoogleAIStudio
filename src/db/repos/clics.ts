/**
 * Capa de datos — clics e interacciones de la oferta (el interes de la persona).
 *
 * Extraido verbatim de src/db/repo.ts (mejora de arquitectura, 2026-10-21): ese archivo
 * mezclaba 71 funciones de 12 dominios, asi que tocar el saldo obligaba a abrir el mismo
 * archivo de 1.058 lineas que el login. El movimiento es byte a byte; src/db/repo.ts queda
 * como re-export de compatibilidad para no tocar ningun consumidor.
 */
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});
import{db}from"../index.ts";
import{offers,clickLogs}from"../schema.ts";
import{eq,and,gte,sql}from"drizzle-orm";

const inMemoryClickLogs=[];

async function registerOfferClick(arg1: any, arg2?: string, arg3?: string): Promise<{ facturable: boolean; codigoCanje: string; nuevo: boolean }

> {
  let ofertaId = "";
  let comercioId = "";
  let telefono = "";

  let saldoDisponible = true;
  if (typeof arg1 === "object" && arg1 !== null) {
    ofertaId = arg1.ofertaId || "";
    comercioId = arg1.comercioId || "merch_01";
    telefono = arg1.usuarioTelefono || arg1.telefono || "anonimo";
    saldoDisponible = arg1.saldoDisponible !== false;
  } else {
    ofertaId = String(arg1 || "");
    comercioId = String(arg2 || "merch_01");
    telefono = String(arg3 || "anonimo");
  }

  const now = new Date();
  const hace24Horas = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cleanPhone = telefono.replace(/\D/g, "") || telefono || "anonimo";

  // Codigo de canje unico global: NV- + 6 chars de alfabeto sin ambiguos (32^6 ~ 1.07e9).
  const _codAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random6 = "";
  for (let _i = 0; _i < 6; _i++) random6 += _codAlphabet[Math.floor(Math.random() * _codAlphabet.length)];
  const codigoCanje = `NV-${random6}`;
  const id = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Consultar la ventana de 24h y dejar el registro son UNA sola operación.
  //
  // Antes eran un SELECT y después un INSERT, con una ventana entre los dos: dos
  // clics concurrentes del mismo (oferta, teléfono) veían los dos la ventana libre,
  // los dos devolvían facturable:true, y el llamador debitaba el pack dos veces.
  // Medido antes del arreglo: 12 de 20 clics concurrentes facturaban.
  //
  // No alcanza con un índice único en (oferta_id, telefono): la ventana es móvil de
  // 24h, así que ese índice bloquearía para siempre el segundo cobro legítimo. Y un
  // índice parcial no puede llevar now() en el predicado, porque los predicados de
  // índice tienen que ser inmutables.
  //
  // El lock es por (oferta, teléfono): serializa solo los clics que compiten por la
  // misma ventana. Teléfonos distintos u ofertas distintas no se esperan entre sí.
  // Con el lock ya tomado, el SELECT ve lo que el otro clic commiteó, y el INSERT
  // ocurre dentro de la misma transacción.
  //
  // Fail-closed: si algo falla no se commitea ni la decisión ni el registro, así que
  // no se factura. Nunca facturar por encima de un error de base de datos.
  let facturable = false;
  let registroPersistido = false;
  // `nuevo`: el clic es un interes QUE NO SE HABIA REGISTRADO en la ventana.
  // `false` = la misma persona volvio a hacer clic en la misma oferta dentro
  // de las 24h: no se cuenta otra vez.
  let esNuevo = false;
  let codigoExistente = codigoCanje;
  try {
    facturable = await db.transaction(async (tx: any) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"clic:" + ofertaId + ":" + cleanPhone})::bigint)`
      );
      const rows = await tx
        .select()
        .from(clickLogs)
        .where(
          and(
            eq(clickLogs.ofertaId, ofertaId),
            eq(clickLogs.usuarioTelefono, cleanPhone),
            eq(clickLogs.facturable, true),
            gte(clickLogs.creadoEn, hace24Horas)
          )
        );
      // La ventana se ancla al último clic facturable; los no facturables no la reinician.
      const existeClicEn24h = !!(rows && rows.length > 0);

      if (existeClicEn24h) {
        // MISMO INTERES DENTRO DE LA VENTANA: no se inserta otra fila.
        //
        // Antes se insertaba una fila con facturable=false por cada clic
        // repetido. Medido el 2026-10-21: tres clics de la misma persona en
        // la misma oferta dejaron TRES filas en click_logs y tres codigos de
        // canje distintos (el segundo y el tercero no significaban nada), y el
        // contador `oferta.clics` sumo tres.
        //
        // Ahora la ventana ES la fila: un interes, una fila. Y se devuelve el
        // codigo de canje que ya existe, para que siga siendo atribuible.
        codigoExistente = rows[0].codigoCanje;
        esNuevo = false;
        return false;
      }

      const debeFacturar = saldoDisponible;
      await tx.insert(clickLogs).values({
        id,
        ofertaId,
        comercioId,
        usuarioTelefono: cleanPhone,
        codigoCanje,
        facturable: debeFacturar,
        creadoEn: now
      } as any);
      esNuevo = true;
      return debeFacturar;
    });
    registroPersistido = true;
  } catch (dbErr) {
    console.error("[DB Repo] Error registrando el clic en click_logs (no se factura):", dbErr);
  }

  if (!registroPersistido) {
    // Sin fila en click_logs no existe ventana de 24h: facturar acá sería cobrar sin
    // registro y habilitar un segundo cobro al mismo teléfono. Fail-closed.
    return { facturable: false, codigoCanje, nuevo: false };
  }

  // Si el clic ya estaba dentro de la ventana, se devuelve el codigo de canje
  // que ya existe (no uno nuevo): el mismo interes, el mismo codigo.
  return { facturable, codigoCanje: esNuevo ? codigoCanje : codigoExistente, nuevo: esNuevo };
}__name(registerOfferClick,"registerOfferClick");
async function registerQualifiedLead(arg1, arg2, arg3) {
  return registerOfferClick(arg1, arg2, arg3);
}
__name(registerQualifiedLead, "registerQualifiedLead");

async function incrementOfferLikes(ofertaId) {
  try {
    const rows = await db
      .update(offers)
      .set({ likes: sql`coalesce(${offers.likes}, 0) + 1` })
      .where(eq(offers.id, ofertaId))
      .returning({ likes: offers.likes });
    if (rows && rows.length > 0) {
      return Number(rows[0].likes || 0);
    }
  } catch (error) {
    console.error("[DB Repo] Error incrementando likes:", error);
  }
  return null;
}
__name(incrementOfferLikes, "incrementOfferLikes");

export{registerOfferClick,registerQualifiedLead,incrementOfferLikes};
