import { BASE, servidorOnline, login, get, post, ADMIN } from "../security/_helpers.ts";

export { BASE, servidorOnline, login, get, post, ADMIN };

// Fixtures de prueba que siembra scripts/ofertas-tests.sh en la base de datos.
// Todas usan telefonos con prefijo 519990000 para poder limpiar click_logs facilmente.
export const FIXTURE = {
  offerFacturable: "ofr_test_cpc",
  offerSinSaldo: "ofr_test_ns",
  offerLike: "ofr_test_like",
  merchantFacturable: "merch_test_cpc",
  merchantSinSaldo: "merch_test_ns",
  merchantLike: "merch_test_like",
  phonePrefix: process.env.OFERTAS_TEST_PREFIX || "519990000",
};

// Telefono distinto por corrida para el flujo de bot (evita la dedupe en memoria
// "ultimasOfertasEnviadasPorUsuario"); mantiene el prefijo limpiable.
export const MOSAIC_PHONE =
  FIXTURE.phonePrefix + String(Date.now()).slice(-2);

export async function oferta(id: string): Promise<any | undefined> {
  const r = await get("/api/ofertas", null);
  const j: any = await r.json();
  return (j.ofertas || []).find((o: any) => o.id === id);
}

export function clicGet(ofertaId: string, telefono: string): Promise<Response> {
  return fetch(`${BASE}/c/${ofertaId}?u=${telefono}`, { redirect: "manual" });
}
