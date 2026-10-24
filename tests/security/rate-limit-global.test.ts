import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { leerTextoServidor } from "./server-code";

const ROOT = path.resolve(import.meta.dir, "../..");
const SERVER = leerTextoServidor();
const VAR = "RATE_LIMIT_GLOBAL" + "_MAX"; // dinamico para no autodetectarse

function archivosDelRepo(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".git", "dist", "results", "auth_info_baileys"].includes(e.name)) continue;
      archivosDelRepo(rel, acc);
    } else if (/\.(ts|tsx|js|mjs|cjs|sh|yml|yaml|json|env|example|md)$/.test(e.name)) {
      acc.push(rel);
    }
  }
  return acc;
}

describe("YUD-52 - bucket global configurable sin filtrar relajacion de CI", () => {
  test("el default de produccion sigue en 300 peticiones/minuto", () => {
    // El env solo puede RELAJARSE explicitamente; sin variable, 300.
    const i = SERVER.indexOf("LIMITE_GLOBAL_API");
    expect(i).toBeGreaterThan(-1);
    const bloque = SERVER.slice(i, i + 400);
    expect(bloque).toContain(VAR);
    expect(bloque).toContain(":300");
    // Un valor invalido (vacio, texto, 0, negativo, NaN) NO puede desactivar el limite:
    expect(bloque).toContain("Number.isFinite(n)&&n>0?n:300");
    expect(SERVER).toContain('app.use("/api",rateLimit("global",LIMITE_GLOBAL_API,60000))');
  });

  test("la relajacion vive solo en el script de CI y en server.ts; workflows no la fijan", () => {
    const permitidos = new Set([
      path.join(ROOT, "server.ts"),
      path.join(ROOT, "scripts/ci/run-contract-tests.sh"),
    ]);
    const infractores: string[] = [];
    for (const f of archivosDelRepo(ROOT)) {
      if (permitidos.has(f)) continue;
      if (f.includes("rate-limit-global.test.ts")) continue; // este archivo
      if (fs.readFileSync(f, "utf8").includes(VAR)) infractores.push(path.relative(ROOT, f));
    }
    expect(infractores).toEqual([]);
  });

  test("el script de CI relaja solo ese bucket y lo documenta", () => {
    const ci = fs.readFileSync(path.join(ROOT, "scripts/ci/run-contract-tests.sh"), "utf8");
    expect(ci).toContain(`${VAR}:-100000`);
    expect(ci).toContain("bucket global");
  });
});
