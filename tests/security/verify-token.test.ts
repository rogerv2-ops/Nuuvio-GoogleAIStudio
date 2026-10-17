import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
const PANEL = fs.readFileSync(path.join(ROOT, "src/components/WhatsAppConfigPanel.tsx"), "utf8");

describe("M1 - verify token de Meta sin fallback hardcodeado", () => {
  test("el token fijo ya no existe en server.ts ni en el panel", () => {
    expect(SERVER.includes("vuuy_verify_secret_2026")).toBe(false);
    expect(PANEL.includes("vuuy_verify_secret_2026")).toBe(false);
  });

  test("el handshake rechaza con 403 cuando no hay verify token configurado", () => {
    const i = SERVER.indexOf('app.get("/api/whatsapp/webhook"');
    expect(i).toBeGreaterThan(-1);
    const handler = SERVER.slice(i, i + 900);
    expect(handler).toContain("META_WA_VERIFY_TOKEN no configurada");
    expect(handler).toContain("status(403)");
    expect(handler).not.toContain('||"vuuy_verify_secret_2026"');
  });
});
