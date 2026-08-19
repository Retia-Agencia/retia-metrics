#!/usr/bin/env bash
# Carga la llave JSON de la cuenta de servicio de Google en .env.local, en base64.
# Nunca imprime el contenido. Borra el archivo original al terminar.
set -uo pipefail

cd "$(dirname "$0")/.."
ARCHIVO=".env.local"

echo ""
echo "  Cuenta de servicio de Google"
echo "  ─────────────────────────────────────────────"

# Busca el JSON mas reciente en Descargas que parezca una llave de cuenta de servicio.
LLAVE=""
while IFS= read -r f; do
  if grep -q '"type"[[:space:]]*:[[:space:]]*"service_account"' "$f" 2>/dev/null; then
    LLAVE="$f"; break
  fi
done < <(ls -t "$HOME/Downloads"/*.json 2>/dev/null)

if [[ -z "$LLAVE" ]]; then
  echo "  No encontre ninguna llave de cuenta de servicio en ~/Downloads."
  echo "  Descargala primero desde Google Cloud (IAM > Cuentas de servicio > Claves > JSON)."
  exit 1
fi

CORREO="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('client_email',''))" "$LLAVE")"
PROYECTO="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('project_id',''))" "$LLAVE")"

echo "  Llave encontrada:"
echo "    archivo : $(basename "$LLAVE")"
echo "    proyecto: $PROYECTO"
echo "    correo  : $CORREO"
echo ""
echo "  Ese correo es el que hay que compartir en las dos BBDD, con permiso de EDITOR."
echo ""
printf "  Cargar esta llave en .env.local? [s/N] "
read -r r
[[ "$r" =~ ^[sS]$ ]] || { echo "  Cancelado. No se toco nada."; exit 0; }

B64="$(base64 -i "$LLAVE" | tr -d '\n')"

cp "$ARCHIVO" "${ARCHIVO}.bak-$(date +%Y%m%d-%H%M%S)"
umask 077
python3 - "$ARCHIVO" "$B64" <<'PY'
import sys, re
archivo, val = sys.argv[1], sys.argv[2]
with open(archivo) as f: s = f.read()
linea = f'GOOGLE_SERVICE_ACCOUNT_JSON_B64="{val}"'
if re.search(r'^#?\s*GOOGLE_SERVICE_ACCOUNT_JSON_B64=.*$', s, flags=re.M):
    s = re.sub(r'^#?\s*GOOGLE_SERVICE_ACCOUNT_JSON_B64=.*$', linea, s, flags=re.M)
else:
    s = s.rstrip("\n") + "\n" + linea + "\n"
with open(archivo, "w") as f: f.write(s)
PY
chmod 600 "$ARCHIVO"

rm -f "$LLAVE"

echo ""
echo "  ✓ Llave cargada en .env.local (${#B64} caracteres en base64)."
echo "  ✓ El JSON original se borro de ~/Downloads."
echo ""
echo "  Correo a compartir en las dos hojas, como EDITOR:"
echo "    $CORREO"
echo ""
