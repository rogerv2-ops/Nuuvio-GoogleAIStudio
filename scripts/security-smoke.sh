#!/usr/bin/env bash
# Smoke test de seguridad contra un servidor en ejecucion.
# Uso: BASE_URL=https://yuddit.com ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/security-smoke.sh
set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ok   $desc ($actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $desc (esperado $expected, obtenido $actual)"
    FAIL=$((FAIL + 1))
  fi
}

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "[1] Rutas publicas responden"
check "GET /api/version" 200 "$(code "$BASE_URL/api/version")"
check "GET /api/banners" 200 "$(code "$BASE_URL/api/banners")"
check "GET /api/ofertas" 200 "$(code "$BASE_URL/api/ofertas")"

echo "[2] Rutas protegidas sin token => 401"
check "GET /api/auth/me" 401 "$(code "$BASE_URL/api/auth/me")"
check "GET /api/audience/users" 401 "$(code "$BASE_URL/api/audience/users")"

echo "[3] Cabeceras de seguridad"
HDRS="$(curl -s -D - -o /dev/null "$BASE_URL/api/version")"
if echo "$HDRS" | grep -qi "x-content-type-options: nosniff"; then echo "  ok   nosniff"; PASS=$((PASS+1)); else echo "  FAIL nosniff ausente"; FAIL=$((FAIL+1)); fi
if echo "$HDRS" | grep -qi "x-frame-options: SAMEORIGIN"; then echo "  ok   x-frame-options"; PASS=$((PASS+1)); else echo "  FAIL x-frame-options ausente"; FAIL=$((FAIL+1)); fi
if echo "$HDRS" | grep -qi "content-security-policy"; then echo "  ok   csp"; PASS=$((PASS+1)); else echo "  FAIL csp ausente"; FAIL=$((FAIL+1)); fi

echo "[4] Traversal de media bloqueado"
check "GET /api/media/video/..%2f..%2fetc%2fpasswd" 400 "$(code "$BASE_URL/api/media/video/..%2f..%2fetc%2fpasswd")"

echo "[5] Webhook verify con token incorrecto => 403"
check "GET /api/whatsapp/webhook (bad token)" 403 "$(code "$BASE_URL/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=1")"

echo "[6] Login (si se entregan credenciales)"
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  TOKEN="$(curl -s -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if [ -n "$TOKEN" ]; then
    echo "  ok   login admin"
    PASS=$((PASS + 1))
    check "GET /api/auth/me (con token)" 200 "$(code -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth/me")"
  else
    echo "  FAIL login admin"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  skip login (sin ADMIN_EMAIL/ADMIN_PASSWORD)"
fi

echo
echo "Resultado: $PASS ok, $FAIL fallidos"
[ "$FAIL" -eq 0 ]
