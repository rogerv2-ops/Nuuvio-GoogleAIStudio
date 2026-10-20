// Los endpoints fueron extraidos de server.ts a src/routes/*.ts (punto 10 de la auditoria).
// Los tests que inspeccionan el codigo fuente del servidor leen la union de
// server.ts y todos los modulos de rutas: siguen vigilando el mismo codigo
// sin importar el archivo donde viva.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");

export function leerTextoServidor(): string {
  const parte = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const rutas = fs.readdirSync(path.join(ROOT, "src/routes")).filter((f: string) => f.endsWith(".ts")).sort();
  return [parte("server.ts"), ...rutas.map((f) => parte("src/routes/" + f))].join("\n");
}
