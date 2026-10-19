#!/usr/bin/env bash
# Levanta el servidor, espera a que responda, corre los tests de contrato y lo baja.
#
# Por que un script y no pasos sueltos del workflow: los tests de este repo son
# black-box y se saltan solos (`describe.skipIf`) si el servidor no esta
# levantado o si faltan credenciales. El "verde" de esa suite no significa
# nada. Este script deja el servidor en pie, espera a que responda de verdad y
# solo despues corre los tests; si el servidor no levanta, falla el paso.
#
# Uso:
#   TEST_BASE_URL=http://127.0.0.1:3000 VUUV_ADMIN_EMAIL=... VUUV_ADMIN_PASSWORD=... \
#     ./scripts/ci/run-contract-tests.sh
#
# Variables que lee:
#   TEST_BASE_URL   base del servidor (default http://127.0.0.1:3000)
#   RESULTS_DIR     donde deja el JUnit y el log del servidor (default results)
#   NODE_ENV        modo del servidor (default production: sirve dist/ como en produccion)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BASE_URL="${TEST_BASE_URL:-http://127.0.0.1:3000}"
RESULTS_DIR="${RESULTS_DIR:-results}"
SERVER_LOG="${RESULTS_DIR}/server.log"
mkdir -p "$RESULTS_DIR"

SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    # El servidor arranca como `bun run start` -> `tsx server.ts`, o sea un
    # proceso padre y un hijo. Se bajan los dos, sin `pkill` global, para no
    # tocar un servidor de desarrollo que este corriendo en otra terminal.
    pkill -P "$SERVER_PID" 2>/dev/null || true
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[ci] levantando el servidor (log: $SERVER_LOG)"
NODE_ENV="${NODE_ENV:-production}" bun run start > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

echo "[ci] esperando a $BASE_URL/api/version"
LISTO=0
for _ in $(seq 1 60); do
  if curl -sf -m 2 "$BASE_URL/api/version" > /dev/null 2>&1; then
    LISTO=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[ci] ERROR: el servidor se murio durante el arranque."
    tail -n 40 "$SERVER_LOG" || true
    exit 1
  fi
  sleep 1
done

if [ "$LISTO" -ne 1 ]; then
  echo "[ci] ERROR: el servidor no respondio en 60s."
  tail -n 40 "$SERVER_LOG" || true
  exit 1
fi
echo "[ci] servidor listo"

set +e
bun test tests/security --reporter=junit --reporter-outfile="$RESULTS_DIR/security.xml"
CODIGO=$?
set -e

exit "$CODIGO"
