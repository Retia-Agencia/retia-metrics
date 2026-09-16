#!/usr/bin/env bash
# Genera CRON_SECRET en .env.local si falta, y con --vercel lo sube a Production.
# El valor nunca se imprime: viaja por el entorno del proceso hijo y por stdin.
#
#   npm run cron-secret               genera el secreto local si no existe
#   npm run cron-secret -- --nuevo    lo regenera aunque exista (rotacion)
#   npm run cron-secret -- --vercel   sube el valor actual al proyecto enlazado
#
# Solo Production: Vercel Cron solo dispara en el deployment de produccion.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-env.sh
source "$(dirname "$0")/lib-env.sh"
ARCHIVO=".env.local"

[[ -f "$ARCHIVO" ]] || { echo "  No existe $ARCHIVO. Corre primero: npm run setup"; exit 1; }

nuevo=false; vercel=false
for arg in "$@"; do
  case "$arg" in
    --nuevo) nuevo=true ;;
    --vercel) vercel=true ;;
    *) echo "  Opcion desconocida: $arg"; exit 1 ;;
  esac
done

if $nuevo || ! grep -qE '^CRON_SECRET=.+' "$ARCHIVO"; then
  respaldar_env "$ARCHIVO"
  umask 077
  SECRETO="$(openssl rand -base64 32)" python3 - "$ARCHIVO" <<'PY'
import os, sys, re
archivo, secreto = sys.argv[1], os.environ["SECRETO"]
with open(archivo) as f: s = f.read()
linea = f'CRON_SECRET="{secreto}"'
if re.search(r'^CRON_SECRET=', s, flags=re.M):
    s = re.sub(r'^CRON_SECRET=.*$', lambda _: linea, s, flags=re.M)
else:
    s = s.rstrip("\n") + "\n" + linea + "\n"
with open(archivo, "w") as f: f.write(s)
PY
  chmod 600 "$ARCHIVO"
  echo "  ✓ CRON_SECRET escrito en $ARCHIVO (respaldo: $RESPALDO)"
else
  echo "  CRON_SECRET ya existe en $ARCHIVO. Usa --nuevo para rotarlo."
fi

if $vercel; then
  [[ -f .vercel/project.json ]] || { echo "  ✗ Este repo no esta enlazado a Vercel. Corre: vercel link"; exit 1; }
  grep -E '^CRON_SECRET=' "$ARCHIVO" | cut -d= -f2- | tr -d '"\n' \
    | vercel env add CRON_SECRET production --force --sensitive >/dev/null
  echo "  ✓ CRON_SECRET cargado en Vercel (Production). Hace falta un redeploy para que aplique."
fi
