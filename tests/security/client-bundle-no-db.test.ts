/**
 * Regresion del incidente del 2026-10-19: "yuddit.com esta en blanco".
 *
 * La fase 3 (debito atomico de clics, T4) agrego un `import` estatico de
 * `../db/repo` en `src/modules/facturacion.ts`. Ese modulo lo importa el panel
 * del comercio, asi que el bundle del navegador empezo a incluir la capa de base
 * completa: el Pool de Postgres, Drizzle y el esquema.
 *
 * `src/db/index.ts` crea el Pool en el ambito del modulo y usa `global`, que NO
 * existe en el navegador. Un error al evaluar un modulo es un error de carga: no
 * lo atrapa ningun `try/catch` de la aplicacion, no lo ve el ErrorBoundary, y
 * muere el script entero. `#root` quedaba vacio y el sitio entero se veia en
 * blanco. Las tres fases anteriores se verificaron con `curl`, que devuelve 200
 * aunque la pagina este rota: HTTP OK no significa que la SPA arranque.
 *
 * Este test recorre el grafo de imports ESTATICOS desde la entrada del frontend
 * y falla si algun archivo alcanzable llega a `src/db/`. Un import estatico se
 * evalua al cargar, asi que la garantia que hay que sostener es la del conjunto
 * de modulos que el navegador carga, no la de una llamada puntual.
 *
 * No necesita base de datos ni navegador: lee los archivos del repo.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dir, "../..");
const ENTRADA = path.join(RAIZ, "src/main.tsx");
const CARPETA_BASE = path.join(RAIZ, "src/db") + path.sep;

const CANDIDATOS = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

/** Quita comentarios para que un `from '...'` escrito en prosa no cuente como import. */
function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Resuelve un especificador relativo o con el alias `@` a un archivo real. */
function resolver(desde: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) {
    base = path.join(RAIZ, especificador.slice(2));
  } else if (especificador.startsWith(".")) {
    base = path.resolve(path.dirname(desde), especificador);
  } else {
    return null; // paquete externo: no se sigue
  }
  for (const ext of CANDIDATOS) {
    const candidato = base + ext;
    if (existsSync(candidato) && !candidato.endsWith(path.sep)) return candidato;
  }
  return null;
}

/** Imports estaticos: `from '...'` e `import '...'`. NO sigue los dinamicos `import()`. */
function importsEstaticos(codigo: string): string[] {
  const limpio = sinComentarios(codigo);
  const encontrados: string[] = [];
  for (const m of limpio.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) encontrados.push(m[1]);
  for (const m of limpio.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) encontrados.push(m[1]);
  return encontrados;
}

function alcanzablesDesdeEntrada(): Set<string> {
  const vistos = new Set<string>();
  const pendientes = [ENTRADA];

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (vistos.has(actual)) continue;
    vistos.add(actual);

    let codigo: string;
    try {
      codigo = readFileSync(actual, "utf8");
    } catch {
      continue;
    }

    for (const especificador of importsEstaticos(codigo)) {
      const destino = resolver(actual, especificador);
      if (destino && !vistos.has(destino)) pendientes.push(destino);
    }
  }

  return vistos;
}

describe("el navegador no carga la capa de base de datos", () => {
  const alcanzados = alcanzablesDesdeEntrada();

  test("el recorrido llega de verdad a los modulos del panel (no pasa en vacio)", () => {
    // Sin esta verificacion, un error en el recorrido haria pasar el test de
    // abajo sin haber mirado nada, que es peor que no tener el test.
    expect(alcanzados.has(path.join(RAIZ, "src/modules/facturacion.ts"))).toBe(true);
    expect(alcanzados.has(path.join(RAIZ, "src/modules/clics.ts"))).toBe(true);
    expect(alcanzados.size).toBeGreaterThan(30);
  });

  test("ningun import ESTATICO desde la entrada llega a src/db/", () => {
    const culpables = Array.from(alcanzados).filter((archivo) => archivo.startsWith(CARPETA_BASE));
    expect(culpables).toEqual([]);
  });

  test("facturacion.ts accede a la base solo en forma diferida y detras del guard de servidor", () => {
    const codigo = readFileSync(path.join(RAIZ, "src/modules/facturacion.ts"), "utf8");
    const limpio = sinComentarios(codigo);

    // Diferido: `import('../db/repo')`, nunca `from '../db/repo'`.
    expect(limpio).toContain("import('../db/repo')");
    expect(limpio).not.toMatch(/\bfrom\s*['"]\.\.\/db\/repo['"]/);

    // Guard: en el navegador se rechaza antes de pedir el chunk, asi que el
    // codigo de base nunca se descarga ni se evalua del lado del cliente.
    expect(limpio).toMatch(/typeof\s+window\s*!==\s*['"]undefined['"]/);
    expect(limpio).toMatch(/typeof\s+document\s*!==\s*['"]undefined['"]/);
  });
});
