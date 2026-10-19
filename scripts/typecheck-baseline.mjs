#!/usr/bin/env node
/**
 * Gate de tipos con baseline (punto 11 de docs/auditoria-2026-10-19.md).
 *
 * Por que existe: `lint` era `tsc --noEmit || true`, que siempre sale 0. Hoy hay 51
 * errores de tipos preexistentes, asi que sacar el `|| true` sin mas romperia todo.
 * Este gate congela esos 51 y falla solo si aparece uno NUEVO, de forma que el codigo
 * no empeore mientras el punto 10 (extraccion del monolito) los va reduciendo.
 *
 * Las huellas NO incluyen linea ni columna a proposito: server.ts y otros archivos son
 * bundles minificados de una sola linea de ~28 KB, donde un cambio de un caracter corre
 * todas las columnas y volveria la baseline inutilizable en el primer commit.
 *
 * Uso:
 *   node scripts/typecheck-baseline.mjs            # falla si hay errores nuevos
 *   node scripts/typecheck-baseline.mjs --update   # regenera la baseline
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "typecheck-baseline.json");
const TSC = path.join(ROOT, "node_modules", ".bin", "tsc");

const LINEA = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function correrTsc() {
  try {
    return execFileSync(TSC, ["--noEmit", "--pretty", "false"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    // tsc sale con codigo != 0 cuando hay errores; el detalle viene por stdout.
    return String(err.stdout || "");
  }
}

function huellas(salida) {
  const cuenta = new Map();
  const detalle = new Map();
  for (const linea of salida.split("\n")) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const rel = path.relative(ROOT, path.resolve(ROOT, m[1])).split(path.sep).join("/");
    const codigo = m[4];
    const mensaje = m[5].replace(/\s+/g, " ").trim();
    const clave = `${rel}|${codigo}|${mensaje}`;
    cuenta.set(clave, (cuenta.get(clave) || 0) + 1);
    if (!detalle.has(clave)) detalle.set(clave, { rel, codigo, mensaje });
  }
  return { cuenta, detalle };
}

if (!fs.existsSync(TSC)) {
  console.error(`[typecheck] No se encontro tsc en ${path.relative(ROOT, TSC)}. Corre "npm install".`);
  process.exit(2);
}

const { cuenta, detalle } = huellas(correrTsc());
const total = [...cuenta.values()].reduce((a, b) => a + b, 0);

if (process.argv.includes("--update")) {
  const salida = {
    nota: "Baseline de errores de tipos preexistentes. Regenerar con: npm run typecheck:baseline",
    actualizado: new Date().toISOString().slice(0, 10),
    total,
    huellas: Object.fromEntries([...cuenta.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(BASELINE, JSON.stringify(salida, null, 2) + "\n");
  console.log(`[typecheck] baseline actualizada: ${total} errores en ${cuenta.size} huellas.`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error("[typecheck] No hay baseline. Generala con: npm run typecheck:baseline");
  process.exit(2);
}
const base = JSON.parse(fs.readFileSync(BASELINE, "utf8")).huellas || {};

const nuevos = [];
const mejoras = [];
for (const [clave, n] of cuenta) {
  const previo = base[clave] || 0;
  if (n > previo) nuevos.push({ ...detalle.get(clave), nuevos: n - previo });
}
for (const [clave, previo] of Object.entries(base)) {
  const actual = cuenta.get(clave) || 0;
  if (actual < previo) mejoras.push({ clave, previo, actual });
}

const resueltos = [...Object.entries(base)].length - [...cuenta.keys()].length;

if (mejoras.length > 0) {
  console.log(`[typecheck] ${mejoras.length} huella(s) con menos errores que la baseline:`);
  for (const m of mejoras) console.log(`  - ${m.clave} (${m.previo} -> ${m.actual})`);
}

if (nuevos.length === 0) {
  console.log(`[typecheck] OK: ${total} errores preexistentes, 0 nuevos.`);
  if (resueltos > 0) console.log(`[typecheck] Ya no aparecen ${resueltos} huella(s) de la baseline.`);
  process.exit(0);
}

console.error(`[typecheck] FALLO: ${nuevos.length} error(es) de tipos NUEVOS (no estan en la baseline):`);
for (const n of nuevos) {
  const veces = n.nuevos > 1 ? ` x${n.nuevos}` : "";
  console.error(`  ${n.rel} ${n.codigo}: ${n.mensaje}${veces}`);
}
console.error("");
console.error("[typecheck] Arreglalos, o si son deuda aceptada, actualiza la baseline con:");
console.error("           npm run typecheck:baseline   (revisar el diff antes de commitear)");
process.exit(1);
