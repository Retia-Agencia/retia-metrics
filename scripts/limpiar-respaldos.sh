#!/usr/bin/env bash
# Borra los respaldos .env.local.bak-* que hayan quedado en la maquina.
# Correlo al final de cada rotacion de secretos.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-env.sh
source "$(dirname "$0")/lib-env.sh"

ARCHIVO=".env.local"

encontrados=0
for f in "${ARCHIVO}".bak-*; do
  [[ -e "$f" ]] || continue
  encontrados=$((encontrados + 1))
done

if [[ "$encontrados" -eq 0 ]]; then
  echo "  No hay respaldos que borrar."
  exit 0
fi

borrar_respaldos "$ARCHIVO"
echo "  ✓ $encontrados respaldo(s) borrado(s)."
echo "    Recorda que en SSD la sobrescritura es best-effort: lo que cierra el"
echo "    riesgo de verdad es que los secretos viejos esten rotados."
