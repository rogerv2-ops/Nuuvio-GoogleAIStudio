import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online)("US2 - cabeceras de seguridad y CORS", () => {
  test("respuesta incluye cabeceras de endurecimiento", async () => {
    const res = await fetch(`${BASE}/api/version`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    const csp = res.headers.get("content-security-policy") || "";
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  test("OPTIONS no produce 5xx", async () => {
    const res = await fetch(`${BASE}/api/version`, { method: "OPTIONS" });
    expect(res.status).toBeLessThan(500);
  });
});
