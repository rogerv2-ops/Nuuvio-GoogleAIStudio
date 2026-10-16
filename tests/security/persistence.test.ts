import { test, expect, describe } from "bun:test";
import { servidorOnline, get } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online)("Flujo - estado persistente responde", () => {
  test("/api/version responde con ok", async () => {
    const res = await get("/api/version", null);
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.ok === true || typeof j.version === "string").toBe(true);
  });

  test("/api/banners devuelve un arreglo", async () => {
    const res = await get("/api/banners", null);
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(Array.isArray(j.banners)).toBe(true);
  });

  test("/api/ofertas devuelve un arreglo", async () => {
    const res = await get("/api/ofertas", null);
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(Array.isArray(j.ofertas)).toBe(true);
  });
});
