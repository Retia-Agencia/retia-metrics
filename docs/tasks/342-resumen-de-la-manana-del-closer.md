---
id: 342
etapa: avisos
serves: "ADR 0114 punto 5 (segunda mitad)"
depends: [340, 341]
status: todo
---

# 342 — El resumen de la mañana del closer

## Alcance

- A la primera hora hábil, un aviso por closer y programa con los conteos de **su pestaña Notificaciones**
  (`lib/mi-espacio/notificaciones.ts`, la única respuesta por chip) más las llamadas sin resultado, y un enlace a Mi
  espacio. Llave `resumen:<usuario>:<programa>:<día>`.
- Cero pendientes: no se manda nada.

## Done cuando

- Test: los conteos del aviso son los mismos que los de la pestaña para el mismo closer y día (una cifra, una
  definición, ADR 0024).
