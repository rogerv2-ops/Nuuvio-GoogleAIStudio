import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const server = leerTextoServidor();

function cuerpoInitDatabaseState(): string {
  const i = server.indexOf("async function initDatabaseState(){");
  const j = server.indexOf('__name(initDatabaseState,"initDatabaseState")');
  return i >= 0 && j > i ? server.slice(i, j) : "";
}

describe("Sin siembra: el arranque nunca resucita datos borrados", () => {
  test("audiencia no se siembra en el arranque", () => {
    const cuerpo = cuerpoInitDatabaseState();
    expect(cuerpo.length).toBeGreaterThan(0);
    expect(cuerpo).not.toContain("seedAudienceUsersIfEmpty");
    expect(server).not.toContain("SEED_AUDIENCE_USERS");
    expect(server).toContain('saveSetting("audience_initialized",true)');
  });

  test("comercios no se siembran en el arranque", () => {
    const cuerpo = cuerpoInitDatabaseState();
    expect(cuerpo).not.toContain("savePersistedMerchants(");
    expect(cuerpo).not.toContain("savePersistedKanban(");
    expect(server).toContain('saveSetting("merchants_initialized",true)');
  });

  test("ofertas no se siembran en el arranque", () => {
    const cuerpo = cuerpoInitDatabaseState();
    expect(cuerpo).not.toContain("syncOffers(");
    expect(server).not.toContain("SEED_OFFERS");
    expect(server).toContain('saveSetting("offers_initialized",true)');
  });

  test("los seeds de usuarios/comercios/ofertas ya no existen", () => {
    expect(server).not.toContain("SEED_MERCHANTS");
    expect(server).not.toContain("SEED_USER");
  });

  test("credenciales admin usan bandera one-shot", () => {
    expect(server).toContain('getSetting("auth_users_initialized",false)');
    expect(server).toContain('saveSetting("auth_users_initialized",true)');
  });

  test("interruptor VUUV_SEED_ON_BOOT sigue gobernando la siembra de auth", () => {
    expect(server).toContain("siembraEnArranquePermitida");
    expect(server).toContain("VUUV_SEED_ON_BOOT");
  });

  test("el arranque no borra masivamente (sin replaceOffers)", () => {
    const cuerpo = cuerpoInitDatabaseState();
    expect(cuerpo.length).toBeGreaterThan(0);
    expect(cuerpo).not.toContain("replaceOffers(");
  });
});
