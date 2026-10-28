---
id: 322
etapa: media
serves: "ADR 0111 puntos 2a, 2b, 3 y 5"
depends: [316]
status: todo
---

# 322 — El esquema del cockpit en el CRM y el traslado único

## Alcance

- Inventario (solo lectura) de las tablas vivas del cockpit y su volumen, con el mapa tabla del cockpit → tabla del
  CRM en el vocabulario del CRM. Va en este archivo antes de la migración.
- Migración: referentes y su salud, candidatos, transcripciones de referentes, guiones limpios, colecciones,
  calificaciones y su aprendizaje, cada uno colgado de `creadores`. Sin RLS ni tenencia: la frontera es el programa del
  creador.
- Script de traslado, una vez, con huella para deshacerlo (molde de `migracion:deshacer`), que crea los creadores por
  `lib/catalogo/` con `actorDelScript()`. Corre primero contra la base local; en producción, con el ok de Mani.

## Done cuando

- El traslado contra la base local cuadra en conteos con el cockpit, tabla por tabla, y se deshace limpio.
- El SQL de la migración se leyó antes de aplicarla (AGENTS.md).
