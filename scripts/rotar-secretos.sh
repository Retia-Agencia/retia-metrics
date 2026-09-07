#!/usr/bin/env bash
# Rota AUTH_GOOGLE_SECRET y regenera AUTH_SECRET, sin tocar el resto de .env.local.
# El secreto se lee sin eco: no aparece en pantalla ni en el historial del shell.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-env.sh
source "$(dirname "$0")/lib-env.sh"
ARCHIVO=".env.local"

[[ -f "$ARCHIVO" ]] || { echo "  No existe $ARCHIVO. Corre primero: npm run setup"; exit 1; }

echo ""
echo "  Rotacion de secretos"
echo "  ─────────────────────────────────────────────"
echo "  Solo se tocan AUTH_GOOGLE_SECRET y AUTH_SECRET."
echo "  DATABASE_URL, AUTH_GOOGLE_ID y el correo se quedan como estan."
echo ""

nuevo=""
while true; do
  echo "  Pega el secreto NUEVO de Google (empieza con GOCSPX-)."
  echo "  No se ve al pegar. Es normal."
  printf "  > "
  IFS= read -rs nuevo
  echo ""
  nuevo="$(printf '%s' "$nuevo" | tr -d '[:space:]')"
  if [[ "$nuevo" =~ ^GOCSPX-.+ ]]; then
    echo "  ✓ Recibido (${#nuevo} caracteres)"
    break
  fi
  echo "  ✗ Debe empezar con GOCSPX-. Intenta de nuevo."
  echo ""
done

# El || true es deliberado: si la variable no esta en el archivo, `anterior` queda
# vacio y la comparacion de abajo simplemente no coincide. Con set -e y pipefail,
# sin esto el grep sin resultados abortaria el script.
anterior="$(grep -E '^AUTH_GOOGLE_SECRET=' "$ARCHIVO" | cut -d= -f2- | tr -d '"' || true)"
if [[ "$nuevo" == "$anterior" ]]; then
  echo ""
  echo "  ⚠ Ese es el MISMO secreto que ya estaba. No se cambio nada."
  echo "    Vuelve a Google Cloud y copia el secreto nuevo, no el viejo."
  exit 1
fi

respaldar_env "$ARCHIVO"

nuevo_auth_secret="$(openssl rand -base64 32)"

umask 077
# Los secretos van por el entorno del proceso hijo, no como argumentos: los
# argumentos de un proceso son visibles en `ps aux` para cualquier usuario de la
# maquina mientras el script corre.
GOOGLE_NUEVO="$nuevo" SESION_NUEVA="$nuevo_auth_secret" \
python3 - "$ARCHIVO" <<'PY'
import os, sys, re
archivo = sys.argv[1]
google, sesion = os.environ["GOOGLE_NUEVO"], os.environ["SESION_NUEVA"]
with open(archivo) as f: s = f.read()
# El reemplazo va como funcion: el string de reemplazo de re.sub interpreta \1,
# \g<1> y \n, asi que un secreto con backslash se escribiria mutilado y sin error.
s = re.sub(r'^AUTH_GOOGLE_SECRET=.*$', lambda _: f'AUTH_GOOGLE_SECRET="{google}"', s, flags=re.M)
s = re.sub(r'^AUTH_SECRET=.*$',        lambda _: f'AUTH_SECRET="{sesion}"',        s, flags=re.M)
with open(archivo, "w") as f: f.write(s)
PY
chmod 600 "$ARCHIVO"

echo ""
echo "  ✓ AUTH_GOOGLE_SECRET actualizado."
echo "  ✓ AUTH_SECRET regenerado (se te va a cerrar la sesion local, es esperado)."
echo "  Respaldo previo: $RESPALDO"
echo ""
echo "  Verificacion:"
node -e '
require("dotenv").config({path:".env.local",quiet:true});
const r={DATABASE_URL:/^postgresql:\/\/[^:]+:[^@]+@[^\/]+\/.+/,AUTH_SECRET:/.{20,}/,AUTH_GOOGLE_ID:/\.apps\.googleusercontent\.com$/,AUTH_GOOGLE_SECRET:/^GOCSPX-.+/,SEED_GERENTE_EMAIL:/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i};
let ok=true;
for(const[k,re]of Object.entries(r)){const v=process.env[k]||"";const g=re.test(v);if(!g)ok=false;console.log("  "+(g?"OK   ":"MAL  ")+k+"  ("+v.length+" caracteres)")}
console.log(ok?"\n  Listo.":"\n  Algo quedo mal.");
'
echo ""
