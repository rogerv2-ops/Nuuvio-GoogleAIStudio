import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const DIST = path.join(ROOT, "dist");

const SECRETOS_PROHIBIDOS = ["Pasion2271", "CREDENCIALES_SISTEMA", "rogerv707@gmail.com", "vuuy_verify_secret_2026", "vuuy-dev-fallback-secret"];

function recorrer(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...recorrer(full));
    else if (/\.(js|mjs|cjs|css|html|json|map)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

describe("US1 - el bundle no contiene credenciales", () => {
  test("dist/ existe y no incluye secretos hardcodeados", () => {
    const archivos = recorrer(DIST);
    // Antes esto era `if (archivos.length === 0) return;`: en un clon limpio dist/ no
    // existe (esta en .gitignore), asi que el test pasaba sin escanear nada y reportaba
    // verde. Un guard que se auto-anula no verifica: si no hay bundle, falla.
    expect(
      archivos.length,
      "No hay bundle en dist/ para escanear. Corre `npm run build` antes de los tests."
    ).toBeGreaterThan(0);
    const hallazgos: string[] = [];
    for (const f of archivos) {
      const contenido = fs.readFileSync(f, "utf8");
      for (const secreto of SECRETOS_PROHIBIDOS) {
        if (contenido.includes(secreto)) hallazgos.push(`${path.relative(ROOT, f)} -> ${secreto}`);
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
