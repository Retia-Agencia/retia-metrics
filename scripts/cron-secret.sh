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
  # La CLI actual enlaza con .vercel/repo.json; las versiones viejas con project.json.
  enlace="$(python3 -c 'import json,os
for f in (".vercel/repo.json", ".vercel/project.json"):
    if os.path.exists(f):
        d = json.load(open(f)); p = d["projects"][0] if "projects" in d else d
        print(p["projectId"] if "projectId" in p else p["id"], p["orgId"]); break' 2>/dev/null || true)"
  [[ -n "$enlace" ]] || { echo "  ✗ Este repo no esta enlazado a Vercel. Corre: vercel link"; exit 1; }
  read -r proyecto equipo <<<"$enlace"
  # Por la API y no con `vercel env add`: la CLI pide confirmaciones que un script no puede
  # responder. upsert=true reemplaza el valor si la variable ya existe.
  python3 -c 'import re,json,sys
s = open(sys.argv[1]).read()
v = re.search(r"^CRON_SECRET=\"?([^\"\n]+)", s, re.M).group(1)
print(json.dumps({"key": "CRON_SECRET", "value": v, "type": "sensitive", "target": ["production"]}))' "$ARCHIVO" \
    | vercel api "/v10/projects/$proyecto/env?teamId=$equipo&upsert=true" -X POST --input - --silent
  echo "  ✓ CRON_SECRET cargado en Vercel (Production). Hace falta un redeploy para que aplique."
fi
