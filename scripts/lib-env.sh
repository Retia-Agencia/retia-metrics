#!/usr/bin/env bash
# Utilidades compartidas por los scripts que escriben .env.local.
# Se usa con `source`, no se ejecuta directo.

# Respalda .env.local dejando UN SOLO respaldo, con permisos 600.
#
# Antes cada script dejaba un .env.local.bak-<fecha> y ninguno lo borraba, asi que
# se acumulaban en claro con los secretos viejos Y los nuevos. Eso vacia de sentido
# la rotacion: si el archivo con la contrasena anterior sigue en el disco, rotar
# sirve contra quien vio la pantalla, no contra quien tiene acceso a la maquina.
respaldar_env() {
  local archivo="$1"
  [[ -f "$archivo" ]] || return 0

  borrar_respaldos "$archivo"

  local respaldo="${archivo}.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$archivo" "$respaldo"
  chmod 600 "$respaldo"
  RESPALDO="$respaldo"
}

# Borra los respaldos de .env.local. Sobrescribe antes de borrar donde se puede.
#
# Ojo con la expectativa: en un SSD con wear leveling la sobrescritura no garantiza
# que el contenido viejo desaparezca del medio fisico. Es mejor que un rm pelado y
# no es borrado seguro de verdad. Lo que de verdad cierra el riesgo es rotar.
borrar_respaldos() {
  local archivo="$1"
  local viejo
  for viejo in "${archivo}".bak-*; do
    [[ -e "$viejo" ]] || continue
    rm -P "$viejo" 2>/dev/null || rm -f "$viejo"
  done
}
