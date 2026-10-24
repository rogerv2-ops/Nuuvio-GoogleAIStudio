/**
 * /api/ofertas/sync NO puede cambiar el estado de una oferta.
 *
 * Politica vigente (verificada en codigo): una oferta nace "en_validacion"
 * (src/modules/ofertas.ts), el listado publico exige estado "activa" y la
 * activacion pasa por /api/ofertas/activar con rol admin. Antes de este fix,
 * un comercio podia escribir estado:"activa" directo por sync y saltarse la
 * moderacion; tambien podia APAGAR sin querer una oferta que el admin ya
 * habia activado, si su copia local estaba vieja.
 *
 * Regla probada aqui: en sync, el estado lo manda el servidor:
 *  1) oferta NUEVA del comercio -> queda "en_validacion" aunque el payload
 *     diga "activa" (y NO aparece en el listado publico);
 *  2) oferta EXISTENTE -> conserva el estado que el servidor tiene, aunque
 *     el payload del comercio diga otra cosa;
 *  3) admin no esta limitado por esta regla (su canal ES la moderacion).
 */
import { describe, expect, test } from "bun:test";
import { servidorOnline, login, get, post, ADMIN, COMERCIO } from "./_helpers.ts";

const online = await servidorOnline();

function ofertaBase(id: string, estado: string, comercioId = "merch_01") {
  return {
    id,
    codigoUrl: `test-estado-${id}`,
    comercioId,
    comercioNombre: "Comercio de prueba",
    comercioWhatsapp: "+51987654321",
    titulo: `Oferta estado ${id}`,
    descripcion: "Oferta creada por un test",
    tipo: "descuento_porcentaje",
    precioNormal: "50",
    precioOferta: "30",
    stock: 10,
    categoria: "Gastronomia y Cafe",
    distrito: "Miraflores",
    provincia: "Lima",
    lat: "-12.12",
    lng: "-77.03",
    imagenes: [],
    venceEn: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    estado,
    likes: 0,
    vistas: 0,
    clics: 0,
    leadsCalificados: 0,
  };
}

async function estadoEnGestion(id: string, tokenAdmin: string | null): Promise<string | null> {
  const r = await get("/api/ofertas/gestion", tokenAdmin);
  if (r.status !== 200) return null;
  const j: any = await r.json();
  const o = (j?.ofertas || []).find((x: any) => x.id === id);
  return o ? String(o.estado) : null;
}

async function apareceEnPublico(id: string): Promise<boolean> {
  const r = await get("/api/ofertas");
  if (r.status !== 200) return false;
  const j: any = await r.json();
  return (j?.ofertas || []).some((x: any) => x.id === id);
}

describe.skipIf(!online)("Sync de ofertas: el estado lo manda el servidor (moderacion)", () => {
  test("oferta NUEVA del comercio queda en_validacion aunque pida activa", async () => {
    const tc = await login(COMERCIO.email, COMERCIO.password);
    const ta = await login(ADMIN.email, ADMIN.password);
    if (!tc || !ta) return;

    const id = `of_sync_nueva_${Date.now()}`;
    const r = await post("/api/ofertas/sync", { ofertas: [ofertaBase(id, "activa")] }, tc);
    expect(r.status).toBe(200);

    // El servidor la guardo con el estado de la politica, no el pedido.
    expect(await estadoEnGestion(id, ta)).toBe("en_validacion");
    // Y por lo tanto NO sale en el listado publico.
    expect(await apareceEnPublico(id)).toBe(false);
  });

  test("oferta EXISTENTE conserva el estado del servidor ante sync del comercio", async () => {
    const ta = await login(ADMIN.email, ADMIN.password);
    const tc = await login(COMERCIO.email, COMERCIO.password);
    if (!ta || !tc) return;

    const id = `of_sync_exist_${Date.now()}`;
    // Admin la crea ya activa (su canal es la moderacion).
    const alta = await post("/api/ofertas/sync", { ofertas: [ofertaBase(id, "activa")] }, ta);
    expect(alta.status).toBe(200);
    expect(await estadoEnGestion(id, ta)).toBe("activa");
    expect(await apareceEnPublico(id)).toBe(true);

    // El comercio sincroniza su copia local (vieja) que dice en_validacion:
    // antes del fix esto APAGABA la oferta publicada. Ahora no debe cambiar.
    const r = await post("/api/ofertas/sync", { ofertas: [ofertaBase(id, "en_validacion")] }, tc);
    expect(r.status).toBe(200);

    expect(await estadoEnGestion(id, ta)).toBe("activa");
    expect(await apareceEnPublico(id)).toBe(true);
  });

  test("un comercio no puede inyectar ofertas de otro comercio", async () => {
    const tc = await login(COMERCIO.email, COMERCIO.password);
    const ta = await login(ADMIN.email, ADMIN.password);
    if (!tc || !ta) return;

    const id = `of_sync_ajena_${Date.now()}`;
    const r = await post("/api/ofertas/sync", { ofertas: [ofertaBase(id, "activa", "merch_ajeno_99")] }, tc);
    expect(r.status).toBe(200);

    // La oferta ajena se descarta del sync (aislamiento de propietario).
    expect(await estadoEnGestion(id, ta)).toBe(null);
  });
});
