import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline } from "./_helpers.ts";

const online = await servidorOnline();
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

describe.skipIf(!online)("US2 - webhooks", () => {
  test("GET verify con token incorrecto responde 403", async () => {
    const url = `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=token-incorrecto-xyz&hub.challenge=123`;
    const res = await fetch(url);
    expect(res.status).toBe(403);
  });

  test.skipIf(!verifyToken)("GET verify con token correcto devuelve el challenge", async () => {
    const url = `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=hola123`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hola123");
  });

  test("POST webhook Meta sin firma no produce 5xx", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
    });
    expect(res.status).toBeLessThan(500);
  });

  test("POST webhook WAHA sin secreto no produce 5xx", async () => {
    const res = await fetch(`${BASE}/api/waha/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "message", payload: {} }),
    });
    expect(res.status).toBeLessThan(500);
  });
});
