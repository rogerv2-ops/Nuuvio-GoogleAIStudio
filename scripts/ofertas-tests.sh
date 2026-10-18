#!/usr/bin/env bash
# Orquesta los tests de ofertas (T017 CPC, T025 Me Gusta, T016/US1 mosaico):
#   1) siembra fixtures de prueba en la DB de prod   (scripts/ofertas_fixtures.py seed)
#   2) reinicia la app para cargar offers/packs en memoria
#   3) corre `bun test tests/ofertas`
#   4) verifica efectos en DB                        (scripts/ofertas_fixtures.py assert)
#   5) SIEMPRE limpia fixtures/click_logs y reinicia (trap EXIT)
#
# Uso:
#   BASE_URL=https://yuddit.com \
#   VUUV_ADMIN_EMAIL=... VUUV_ADMIN_PASSWORD=... \
#   ./scripts/ofertas-tests.sh
#
# Sin credenciales admin, el test de mosaico (US1) se omite.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${BASE_URL:-https://yuddit.com}"
export TEST_BASE_URL="$BASE_URL"
export OFERTAS_TEST_PREFIX="${OFERTAS_TEST_PREFIX:-519990000}"
export DOCKER="${DOCKER:-sudo -n docker}"
export PG_CONTAINER="${PG_CONTAINER:-oa0t0nzguh49o1fim0juu5nj}"

BUN="${BUN:-$(command -v bun || echo "$HOME/.bun/bin/bun")}"
PY="python3"

app_container() {
  ${DOCKER} ps --format '{{.Names}}' | grep '^pnpsnjshl9otauk7y7m5dqtf-' | sort | tail -1
}
APP_CONTAINER="${APP_CONTAINER:-$(app_container)}"

restart_app() {
  [ -z "${APP_CONTAINER:-}" ] && { echo "  (sin contenedor de app; omito reinicio)"; return 0; }
  echo "  reiniciando $APP_CONTAINER ..."
  ${DOCKER} restart "$APP_CONTAINER" >/dev/null 2>&1
  for _ in $(seq 1 24); do
    sleep 5
    if [ "$(curl -s -o /dev/null -w '%{http_code}' -m 8 "$BASE_URL/api/version")" = "200" ]; then
      echo "  app arriba"
      return 0
    fi
  done
  echo "  ADVERTENCIA: la app no respondio 200 tras el reinicio"
  return 1
}

cleanup() {
  echo "[cleanup] limpiando fixtures y reiniciando app..."
  "$PY" "$ROOT/scripts/ofertas_fixtures.py" cleanup || echo "  ADVERTENCIA: cleanup de DB fallo"
  restart_app || true
}
trap cleanup EXIT

echo "[1] Sembrando fixtures de prueba (${OFERTAS_TEST_PREFIX}xxx)"
"$PY" "$ROOT/scripts/ofertas_fixtures.py" seed

echo "[2] Reiniciando app para cargar fixtures en memoria"
restart_app

echo "[3] bun test tests/ofertas"
set +e
"$BUN" test tests/ofertas
RC=$?
set -e

echo "[4] Verificando efectos en DB"
"$PY" "$ROOT/scripts/ofertas_fixtures.py" assert || RC=1

echo
if [ "$RC" -eq 0 ]; then
  echo "Resultado: tests de ofertas OK"
else
  echo "Resultado: tests de ofertas con FALLOS (rc=$RC)"
fi
exit "$RC"
