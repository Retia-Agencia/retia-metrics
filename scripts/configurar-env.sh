#!/usr/bin/env bash
# Configura .env.local de forma interactiva.
# Los secretos se leen sin eco: no aparecen en pantalla ni en el historial del shell.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-env.sh
source "$(dirname "$0")/lib-env.sh"
ARCHIVO=".env.local"

echo ""
echo "  Configuracion de Retia Metrics"
echo "  ─────────────────────────────────────────────"
echo "  Pega cada valor y dale Enter."
echo "  Los secretos NO se ven al pegar. Es normal: se estan escribiendo."
echo ""

# --- Utilidades -------------------------------------------------------------

pedir_visible() { # nombre, ayuda, regex, ejemplo
  local valor=""
  while true; do
    echo "  $2"
    printf "  > "
    IFS= read -r valor
    valor="$(printf '%s' "$valor" | tr -d '[:space:]')"
    if [[ "$valor" =~ $3 ]]; then RESPUESTA="$valor"; echo ""; return 0; fi
    echo "  ✗ No tiene la forma esperada. Debe verse como: $4"
    echo ""
  done
}

pedir_oculto() { # nombre, ayuda, regex, ejemplo
  local valor=""
  while true; do
    echo "  $2"
    printf "  > "
    IFS= read -rs valor
    echo ""
    valor="$(printf '%s' "$valor" | tr -d '[:space:]')"
    if [[ "$valor" =~ $3 ]]; then
      RESPUESTA="$valor"
      echo "  ✓ Recibido (${#valor} caracteres)"
      echo ""
      return 0
    fi
    echo "  ✗ No tiene la forma esperada. Debe verse como: $4"
    echo ""
  done
}

# --- 1. Neon ----------------------------------------------------------------

pedir_oculto "DATABASE_URL" \
  "1/4  Cadena de conexion de Neon (empieza con postgresql://)" \
  '^postgresql://[^:]+:[^@]+@[^/]+/.+' \
  "postgresql://usuario:clave@ep-xxx.neon.tech/neondb?sslmode=require"
DATABASE_URL="$RESPUESTA"

# --- 2. Client ID -----------------------------------------------------------

pedir_visible "AUTH_GOOGLE_ID" \
  "2/4  ID de cliente de Google (termina en .apps.googleusercontent.com)" \
  '\.apps\.googleusercontent\.com$' \
  "123456-abcdef.apps.googleusercontent.com"
AUTH_GOOGLE_ID="$RESPUESTA"

# --- 3. Client Secret -------------------------------------------------------

pedir_oculto "AUTH_GOOGLE_SECRET" \
  "3/4  Secreto de cliente de Google (empieza con GOCSPX-)" \
  '^GOCSPX-.+' \
  "GOCSPX-abc123..."
AUTH_GOOGLE_SECRET="$RESPUESTA"

# --- 4. Correo del gerente --------------------------------------------------

pedir_visible "SEED_GERENTE_EMAIL" \
  "4/4  Tu correo de Google (con el que vas a entrar a la app)" \
  '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' \
  "michael@retiagrowth.com"
SEED_GERENTE_EMAIL="$(printf '%s' "$RESPUESTA" | tr '[:upper:]' '[:lower:]')"

# --- Secreto de sesion: se genera solo --------------------------------------

AUTH_SECRET="$(openssl rand -base64 32)"
echo "  Secreto de sesion generado automaticamente."
echo ""

# --- Respaldo del archivo anterior ------------------------------------------

if [[ -f "$ARCHIVO" ]]; then
  respaldar_env "$ARCHIVO"
  echo "  Respaldo del archivo anterior: $RESPALDO"
  echo "  (queda uno solo, con permisos 600; borralo con: npm run limpiar-respaldos)"
fi

# --- Escritura --------------------------------------------------------------

umask 077
cat > "$ARCHIVO" <<EOF
# ---- Base de datos (Neon Postgres) ----
DATABASE_URL="${DATABASE_URL}"

# ---- Auth.js ----
AUTH_SECRET="${AUTH_SECRET}"
AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID}"
AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET}"

# ---- Seed del primer gerente ----
SEED_GERENTE_EMAIL="${SEED_GERENTE_EMAIL}"
SEED_GERENTE_NOMBRE="Michael Castellanos"

# ---- Fase 1 en adelante (todavia sin usar) ----
# GOOGLE_SERVICE_ACCOUNT_JSON_B64=""
# CRON_SECRET=""
EOF
chmod 600 "$ARCHIVO"

echo "  ✓ $ARCHIVO escrito."
echo ""
echo "  Verificacion:"
node -e '
require("dotenv").config({path:".env.local"});
const placeholders=[/usuario:clave/,/ep-xxx/,/^aqui/,/placeholder/i,/123456-abcdef/,/<tu-dominio>/];
const r={
  DATABASE_URL:/^postgresql:\/\/[^:]+:[^@]+@[^\/]+\/.+/,
  AUTH_SECRET:/.{20,}/,
  AUTH_GOOGLE_ID:/\.apps\.googleusercontent\.com$/,
  AUTH_GOOGLE_SECRET:/^GOCSPX-.+/,
  SEED_GERENTE_EMAIL:/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i
};
let ok=true;
for(const[k,re]of Object.entries(r)){
  const v=process.env[k]||"";
  const esEjemplo=placeholders.some(p=>p.test(v));
  const g=re.test(v)&&!esEjemplo;
  if(!g)ok=false;
  const nota=esEjemplo?"  <-- sigue siendo el texto de ejemplo":"";
  console.log("  "+(g?"OK   ":"MAL  ")+k+"  ("+v.length+" caracteres)"+nota);
}
console.log(ok?"\n  Listo. Sigue con: npm run db:migrate":"\n  Revisa las lineas marcadas MAL.");
'
echo ""
