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
 */
let sesionAdminCache: { email: string; password: string; token: string | null } | null = null;

export async function login(email: string, password: string): Promise<string | null> {
  if (sesionAdminCache && sesionAdminCache.email === email && sesionAdminCache.password === password) {
    if (sesionAdminCache.token) return sesionAdminCache.token;
  }
  const token = await loginSinCache(email, password);
  if (email === ADMIN.email && password === ADMIN.password) {
    sesionAdminCache = { email, password, token };
  }
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

export const ADMIN = {
  email: process.env.VUUV_ADMIN_EMAIL || "",
  password: process.env.VUUV_ADMIN_PASSWORD || "",
};
export const COMERCIO = {
  email: process.env.VUUV_COMMERCE_EMAIL || "",
  password: process.env.VUUV_COMMERCE_PASSWORD || "",
};
