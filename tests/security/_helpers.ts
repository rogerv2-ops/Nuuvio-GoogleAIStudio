export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

export async function servidorOnline(): Promise<boolean> {
  try {
    const r = await fetch(BASE + "/api/version", { signal: AbortSignal.timeout(2500) });
    return r.status < 500;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string): Promise<string | null> {
  try {
    const r = await fetch(BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j && j.token ? String(j.token) : null;
  } catch {
    return null;
  }
}

export async function get(path: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(BASE + path, { headers });
}

export async function post(path: string, body: any, token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
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
