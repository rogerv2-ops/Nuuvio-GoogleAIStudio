#!/usr/bin/env node
/**
 * Verifica que una corrida de tests REALMENTE ejecuto tests.
 *
 * El problema que esto evita: los tests de contrato son black-box y se saltan
 * solos (`describe.skipIf`) cuando el servidor no esta levantado o faltan
 * credenciales. Una suite verde puede no haber corrido nada. Medido el
 * 2026-10-19 en este repo:
 *
 *   - servidor arriba + credenciales -> 88 tests, 0 saltados
 *   - servidor caido                 -> 91 tests, 23 saltados, 0 fallos  <- VERDE Y VACIA
 *
 * O sea: el "verde" no dice nada. Este script convierte el reporte JUnit
 * de `bun test` en una condicion que puede fallar.
 *
 * Uso:
 *   node scripts/ci/assert-tests-ran.mjs results/security.xml --min 80
 *
 * Falla (exit 1) si: hay fallos, hay tests saltados, o se ejecutaron menos
 * tests que el minimo exigido. Falla (exit 2) si el archivo no es un JUnit
 * legible (eso es un error de la instrumentacion, no un test roto).
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const archivos = [];
let minimo = 0;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--min") {
    const valor = Number(args[++i]);
    if (!Number.isFinite(valor) || valor < 0) {
      console.error("[ci] --min necesita un numero >= 0");
      process.exit(2);
    }
    minimo = valor;
    continue;
  }
  archivos.push(args[i]);
}

if (archivos.length === 0) {
  console.error("uso: assert-tests-ran.mjs <junit.xml> [--min N]");
  process.exit(2);
}

/** Lee un atributo numerico de la cabecera <testsuites>. */
function atributo(cabecera, nombre) {
  const m = cabecera.match(new RegExp(`\\b${nombre}="(\\d+)"`));
  return m ? Number(m[1]) : null;
}

let totalTests = 0;
let totalFallos = 0;
let totalSaltados = 0;

for (const archivo of archivos) {
  let xml;
  try {
    xml = readFileSync(archivo, "utf8");
  } catch (err) {
    console.error(`[ci] no se pudo leer ${archivo}: ${err.message}`);
    process.exit(2);
  }

  const cabecera = xml.match(/<testsuites\b[^>]*>/);
  if (!cabecera) {
    console.error(`[ci] ${archivo} no parece un JUnit de bun (no trouve <testsuites>)`);
    process.exit(2);
  }

  const tests = atributo(cabecera[0], "tests");
  if (tests === null) {
    console.error(`[ci] ${archivo} no declara tests= en <testsuites>`);
    process.exit(2);
  }
  const fallos = atributo(cabecera[0], "failures") ?? 0;
  const saltadosPorAtributo = atributo(cabecera[0], "skipped") ?? 0;
  // Doble conteo a proposito: si una version de bun no emitiera el atributo
  // `skipped`, los <skipped/> sueltos del XML delatan los tests saltados.
  const saltadosPorEtiqueta = (xml.match(/<skipped\b/g) || []).length;
  const saltados = Math.max(saltadosPorAtributo, saltadosPorEtiqueta);

  console.log(
    `[ci] ${archivo}: ${tests} tests, ${fallos} fallos, ${saltados} saltados`
  );

  totalTests += tests;
  totalFallos += fallos;
  totalSaltados += saltados;
}

console.log(
  `[ci] total: ${totalTests} tests, ${totalFallos} fallos, ${totalSaltados} saltados (minimo exigido: ${minimo})`
);

if (totalFallos > 0) {
  console.error(`[ci] FALLA: ${totalFallos} test(s) roto(s).`);
  process.exit(1);
}

if (totalSaltados > 0) {
  console.error(
    `[ci] FALLA: ${totalSaltados} test(s) se saltaron. Una suite verde con tests saltados ` +
      `no verifica nada: revisa que el servidor este levantado y que las credenciales ` +
      `VUUV_ADMIN_* / VUUV_COMMERCE_* esten definidas.`
  );
  process.exit(1);
}

if (totalTests < minimo) {
  console.error(
    `[ci] FALLA: se ejecutaron ${totalTests} test(s) y el minimo exigido es ${minimo}. ` +
      `Si se borro o desactivo media suite, actualiza el minimo a proposito y dejalo escrito.`
  );
  process.exit(1);
}

console.log("[ci] OK: los tests se ejecutaron de verdad (sin saltados).");
