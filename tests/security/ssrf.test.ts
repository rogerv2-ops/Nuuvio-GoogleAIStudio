import { test, expect, describe, beforeAll } from "bun:test";
import { servidorOnline, login, post, ADMIN } from "./_helpers.ts";

const online = await servidorOnline();

describe.skipIf(!online || !ADMIN.email)("US2 - proteccion SSRF en proveedores de IA", () => {
  let token: string | null = null;
  beforeAll(async () => {
    token = await login(ADMIN.email, ADMIN.password);
  });

  test("baseUrl interno/metadata es rechazado (400)", async () => {
    if (!token) return;
    for (const baseUrl of [
      "http://169.254.169.254/latest/meta-data",
      "http://localhost:5432",
      "http://127.0.0.1/",
      "https://evil.example.com/v1",
    ]) {
      const res = await post("/api/ai/test", { providerId: "gemini", modelId: "gemini-1.5-flash", baseUrl }, token);
      expect(res.status, baseUrl).toBe(400);
    }
  });
});
