/**
 * Landing del embudo de prerregistro (/registro-comercio).
 *
 * QUE VIGILA
 *
 * La landing server-rendered detrás del flag EMBUDO_PREREGISTRO:
 *   P1. Responde 200 text/html con el formulario que postea a /api/preregistros.
 *   P2. Incluye honeypot anti-bots oculto (campo `empresa`).
 *   P3. El select de categoría NO preselecciona la primera opción: hay una
 *       opción placeholder deshabilitada y seleccionada con value vacío.
 *   P4. La página no referencia scripts externos (todo inline, sin terceros).
 *   P5. El logo se sirve desde la config del sitio (img o fallback tipográfico),
 *       nunca un data: URL.
 */
import { test, expect, describe } from "bun:test";
import { servidorOnline, get } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online)("Landing del embudo", () => {
  test("P1/P2: sirve HTML con formulario y honeypot", async () => {
    const res = await get("/registro-comercio", null);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(res.headers.get("content-type") || "").toContain("text/html");
    expect(html).toContain('action="/api/preregistros"');
    expect(html).toContain('name="empresa"');
    expect(html).toContain('name="categoria"');
    expect(html).toContain('name="consentimiento"');
    // WhatsApp obligatorio (decisión del dueño 2026-10-24); Instagram/TikTok opcionales.
    expect(html).toContain('name="whatsapp" required');
    expect(html).not.toMatch(/name="instagram"[^>]*required/);
    expect(html).not.toMatch(/name="tiktok"[^>]*required/);
  });

  test("P3: categoría sin preselección", async () => {
    const res = await get("/registro-comercio", null);
    const html = await res.text();
    expect(html).toContain('<option value="" disabled selected>');
  });

  test("P4: sin scripts externos", async () => {
    const res = await get("/registro-comercio", null);
    const html = await res.text();
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  test("P5: logo sin data URL", async () => {
    const res = await get("/registro-comercio", null);
    const html = await res.text();
    expect(html).not.toContain('src="data:');
  });
});
