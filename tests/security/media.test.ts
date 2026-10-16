import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online)("US2 - servido de media (traversal / range)", () => {
  test("path traversal codificado es rechazado", async () => {
    const res = await fetch(`${BASE}/api/media/video/..%2f..%2f..%2fetc%2fpasswd`);
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  test("archivo inexistente devuelve 404", async () => {
    const res = await fetch(`${BASE}/api/media/video/__no_existe_${Date.now()}`);
    expect(res.status).toBe(404);
  });

  test("rango invalido sobre archivo inexistente no produce 5xx", async () => {
    const res = await fetch(`${BASE}/api/media/video/__no_existe_${Date.now()}`, {
      headers: { Range: "bytes=abc" },
    });
    expect(res.status).toBeLessThan(500);
  });
});
