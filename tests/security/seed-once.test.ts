import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const server = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");

function cuerpoInitDatabaseState(): string {
  const i = server.indexOf("async function initDatabaseState(){");
  const j = server.indexOf('__name(initDatabaseState,"initDatabaseState")');
  return i >= 0 && j > i ? server.slice(i, j) : "";
}

describe("Siembra one-shot: el arranque no resucita datos borrados", () => {
  test("audiencia usa bandera one-shot", () => {
    expect(server).toContain('getSetting("audience_initialized",false)');
    expect(server).toContain('saveSetting("audience_initialized",true)');
  });

  test("comercios usa bandera one-shot", () => {
    expect(server).toContain('getSetting("merchants_initialized",false)');
    expect(server).toContain('saveSetting("merchants_initialized",true)');
  });

  test("credenciales admin usan bandera one-shot", () => {
    expect(server).toContain('getSetting("auth_users_initialized",false)');
    expect(server).toContain('saveSetting("auth_users_initialized",true)');
  });

  test("interruptor VUUV_SEED_ON_BOOT desactiva toda siembra", () => {
    expect(server).toContain("siembraEnArranquePermitida");
    expect(server).toContain("VUUV_SEED_ON_BOOT");
  });

  test("el arranque no borra masivamente (sin replaceOffers)", () => {
    const cuerpo = cuerpoInitDatabaseState();
    expect(cuerpo.length).toBeGreaterThan(0);
    expect(cuerpo).not.toContain("replaceOffers(");
  });
});
