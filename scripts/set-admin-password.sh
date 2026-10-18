#!/usr/bin/env bash
# Cambia la contrasena de un usuario de vuuy SIN escribirla a disco.
#
# La clave nunca toca un archivo: se lee de forma silenciosa (read -s), viaja por
# HTTPS con --data @- (no aparece en `ps`) y en el servidor queda hasheada con
# scrypt en app_settings.auth_users (Postgres). En claro no se persiste en ningun lado.
#
# Uso:
#   BASE_URL=https://yuddit.com ./scripts/set-admin-password.sh [email]
#
set -u

BASE_URL="${BASE_URL:-https://yuddit.com}"
EMAIL="${1:-${VUUV_ADMIN_EMAIL:-}}"

if [ -z "$EMAIL" ]; then read -rp "Email del usuario: " EMAIL; fi
read -rsp "Contrasena actual: " CURRENT; echo
read -rsp "Nueva contrasena (min 8): " NEW1; echo
read -rsp "Repite la nueva contrasena: " NEW2; echo

if [ "$NEW1" != "$NEW2" ]; then echo "ERROR: las contrasenas no coinciden."; exit 1; fi
if [ "${#NEW1}" -lt 8 ]; then echo "ERROR: usa al menos 8 caracteres."; exit 1; fi

TOKEN="$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$CURRENT" \
  | curl -s -m 20 -X POST "$BASE_URL/api/auth/login" \
      -H 'Content-Type: application/json' --data @- \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token','') or '')")"
unset CURRENT

if [ -z "$TOKEN" ]; then echo "ERROR: login fallido (credenciales incorrectas o cuenta bloqueada)."; exit 1; fi

printf '{"email":"%s","password":"%s"}' "$EMAIL" "$NEW1" \
  | curl -s -m 20 -X POST "$BASE_URL/api/auth/password" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' --data @- \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('OK: contrasena actualizada' if d.get('ok') else 'ERROR: '+str(d.get('error')))"
unset NEW1 NEW2
