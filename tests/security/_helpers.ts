export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

export async function servidorOnline(): Promise<boolean> {
  try {
    const r = await fetch(BASE + "/api/version", { signal: AbortSignal.timeout(2500) });
    return r.status < 500;
  } catch {
    return false;
  }
}

/**
 * Sesion de admin cacheada por proceso de test.
 *
 * Por que: el login tiene un rate limit de 10 por 5 minutos (server.ts) y la
 * suite completa hace mas de 10 logins. Con el cache, cada archivo de tests
 * usa UNA sesion y la suite no choca con el limite por archivos que corren
 * en paralelo.
 *
 * OJO: el limite es POR IP y el servidor es local, asi que el cache es
 * justamente lo que evita que un testtumbe a los demas.
 *
 * El cache es de CUALQUIER credencial (admin y comercio): los archivos de
 * tests comparten la sesion y la suite gasta un solo login por cuenta.
 */
const cacheSesiones = new Map<string, string | null>();

export async function login(email: string, password: string): Promise<string | null> {
  const clave = `${email}|${password}`;
  if (cacheSesiones.has(clave)) {
    const token = cacheSesiones.get(clave) || null;
    if (token) return token;
  }
  const token = await loginSinCache(email, password);
  cacheSesiones.set(clave, token);
  return token;
}

async function loginSinCache(email: string, password: string): Promise<string | null> {
  try {
    const r = await fetch(BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    if (j && j.token) return String(j.token);
    const setCookie = r.headers.get("set-cookie");
    const cookie = setCookie ? setCookie.split(";")[0].trim() : "";
    return cookie || null;
  } catch {
    return null;
  }
}

function authHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) {
    if (token.startsWith("vuuy_sesion=")) headers.Cookie = token;
    else headers.Authorization = "Bearer " + token;
  }
  return headers;
}

export async function get(path: string, token?: string | null) {
  return fetch(BASE + path, { headers: authHeaders(token) });
}

export async function post(path: string, body: any, token?: string | null, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...authHeaders(token), ...(extraHeaders || {}) };
  return fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
}

/**
 * Crea una oferta de prueba y la devuelve.
 *
 * POR QUE EXISTE (lo dijo el CI el 2026-10-21)
 *
 * `POST /api/ofertas/sync` REEMPLAZA el catalogo completo. Un test que
 * espera encontrar ofertas en la base depende del estado ambiente: en la
 * base local yo habia sembrado tres ofertas a mano y los tests pasaban; en
 * el CI (base recien creada, sin ofertas) los mismos tests fallaban. Un test
 * que depende del ambiente no es un test: es una apuesta.
 *
 * Cada test que necesita ofertas crea la suya. Ojo: como el sync reemplaza
 * todo, la oferta se usa enseguida, sin esperas en el medio.
 */
export async function crearOfertaDePrueba(
  token: string | null | undefined,
  opts: { titulo?: string; distrito?: string; comercioId?: string } = {}
): Promise<{ id: string; titulo: string; distrito: string; codigoUrl: string }> {
  const id = `of_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const titulo = opts.titulo || `Oferta de prueba ${id}`;
  const distrito = opts.distrito || "Miraflores";
  const comercioId = opts.comercioId || "merch_01";
  const r = await post(
    "/api/ofertas/sync",
    {
      ofertas: [
        {
          id,
          codigoUrl: `test-${id}`,
          comercioId,
          comercioNombre: "Comercio de prueba",
          comercioWhatsapp: "+51987654321",
          titulo,
          descripcion: "Oferta creada por un test",
          tipo: "descuento_porcentaje",
          precioNormal: "50",
          precioOferta: "30",
          stock: 10,
          categoria: "Gastronomia y Cafe",
          distrito,
          provincia: "Lima",
          lat: "-12.12",
          lng: "-77.03",
          imagenes: [],
          venceEn: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
          estado: "activa",
          likes: 0,
          vistas: 0,
          clics: 0,
          leadsCalificados: 0,
        },
      ],
    },
    token
  );
  if (r.status !== 200) {
    throw new Error(`no se pudo crear la oferta de prueba (HTTP ${r.status})`);
  }
  return { id, titulo, distrito, codigoUrl: `test-${id}` };
}

/**
 * Ejecuta una accion con una oferta de prueba, reintentando si otra
 * sincronizacion se lleva el catalogo por delante.
 *
 * POR QUE HACE FALTA (el CI lo demostro el 2026-10-21)
 *
 * `POST /api/ofertas/sync` REEMPLAZA el catalogo completo, y bun corre los
 * archivos de test EN PARALELO. Si otro archivo sincroniza entre nuestro
 * mosaico y nuestro clic, la oferta desaparece y el clic responde 404.
 *
 * No se puede arreglar cambiando la app: el replace es el mecanismo de
 * BORRADO de ofertas (no hay un DELETE de ofertas; el panel borra
 * sincronizando la lista sin ella).
 *
 * Asi que la accion se reintenta: si falla porque la oferta ya no esta, se
 * crea de nuevo y se repite. La accion debe LANZAR cuando el estado no es el
 * esperado.
 */
export async function conOfertaDePrueba<T>(
  token: string | null | undefined,
  opts: { titulo?: string; distrito?: string; comercioId?: string },
  accion: (oferta: { id: string; titulo: string; distrito: string; codigoUrl: string }) => Promise<T>,
  intentos = 4
): Promise<T> {
  let ultimoError: unknown = null;
  for (let i = 0; i < intentos; i++) {
    const oferta = await crearOfertaDePrueba(token, opts);
    try {
      return await accion(oferta);
    } catch (e) {
      ultimoError = e;
      // Pausa corta: da tiempo a que el otro archivo termine su sync.
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error(String(ultimoError));
}

/**
 * Reapunta un enlace del bot al servidor bajo prueba.
 *
 * POR QUE (lo demostro el CI el 2026-10-21)
 *
 * Los enlaces que arma el bot salen de `APP_URL` (o `PUBLIC_URL`), y si no
 * estan definidos apuntan a `https://yuddit.com`. En el CI no se define, asi
 * que el test clickeaba PRODUCCION y recibia 404 (la oferta de prueba no
 * existe alla). En local mi env si define APP_URL, y por eso el test pasaba
 * en local y fallaba en el CI.
 *
 * Un test tiene que probar EL SERVIDOR QUE LEVANTO, no el de internet.
 */
export function aUrlLocal(enlace: string): string {
  const base = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return String(enlace || "").replace(/^https?:\/\/[^/]+/i, base);
}

export const ADMIN = {
  email: process.env.VUUV_ADMIN_EMAIL || "",
  password: process.env.VUUV_ADMIN_PASSWORD || "",
};
export const COMERCIO = {
  email: process.env.VUUV_COMMERCE_EMAIL || "",
  password: process.env.VUUV_COMMERCE_PASSWORD || "",
};
