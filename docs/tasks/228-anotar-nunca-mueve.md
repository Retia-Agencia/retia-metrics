---
id: 228
etapa: O8
serves: "A-136; decisión de Mani del 9-oct"
depends: []
status: todo
---

# 228 — Anotar nunca mueve; En gestión entra por Mover a

## Por qué existe

La tarjeta Transición dice que Anotar *"deja un comentario o el próximo paso sin cambiar la etapa"*, pero en
**Potencial y Registrado** `anotar()` mueve el deal a En gestión (`lib/deals/anotar.ts`, la rama
`etapa === "potencial" || etapa === "registrado"`). El botón dice una cosa y el motor hace otra.
Mani (9-oct): *"anotar NUNCA mueve. Tiene que ser parte del pop up de transición en Mover a de su respectiva etapa"*.

## Alcance

- `lib/deals/anotar.ts`: se quita la rama que mueve a En gestión. Anotar escribe la nota y, si pide uno, el
  pendiente sobre la **misma** etapa. Se puede seguir reclamando el deal sin dueño (reclamar no es mover).
  Los pendientes que Potencial y Registrado ofrecen (`pendientesParaAnotar`: solo Próxima cohorte) siguen igual.
- **Mover a → En gestión** desde Potencial y Registrado: una respuesta nueva en `PREGUNTA_DE_ETAPA`
  (`components/deals/pregunta-de-etapa.ts`), etiqueta "Lo estoy trabajando", que pide un **comentario obligatorio**
  dentro del diálogo de mover, escribe la nota y mueve por la flecha `E1` (dueño + actividad: la nota del closer
  cuenta como actividad, `mover-etapa.ts`). `E1` pasa de `sistema` a `ambos` en `lib/deals/etapas.ts`.
  El botón sale en "Mover a" con la descripción que ya existe para `en_gestion`.
- Registrar contacto desde Potencial y Registrado sigue llevando a Contactado (no cambia).
- `tests/pregunta-de-etapa.test.ts` sigue verde: ninguna flecha de persona queda sin respuesta, ninguna respuesta
  apunta a una flecha que no existe.

## Done cuando

- [ ] Test: anotar (con o sin Próxima cohorte) un deal en Potencial o Registrado lo deja en esa etapa.
- [ ] Test: la respuesta "Lo estoy trabajando" lleva de Potencial y de Registrado a En gestión con la nota escrita;
  sin comentario se rechaza.
- [ ] En la ficha, Potencial muestra En gestión en "Mover a" y Anotar no cambia la etapa. `npm run build` limpio.
- [ ] El manual (sección de etapas) refleja la tabla de Mover a / Anotar por etapa.
