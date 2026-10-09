---
id: 217
etapa: O8
serves: "A-118, A-119, A-130; ADR 0081 puntos 1, 3 a 6"
depends: [215]
status: review
---

# 217 — Anotar: el botón, su diálogo y la Transición con dos gestos

## Por qué existe

La Transición tiene tres bloques de botones. Mani: *"o se mueve de etapa o no se mueve, pero se le hace una
anotación"*. Este ticket construye el segundo gesto y deja la tarjeta con los botones de etapa y **Anotar**.

## Alcance

- **Transición** (`components/deals/ficha/ficha-transicion.tsx`): se quitan "Registrar actividad" y "Dejar en
  espera". Quedan los botones de etapa (y Corregir, ADR 0078) y un botón **Anotar** con una línea que diga para
  qué es ("Deja un comentario o el próximo paso sin cambiar la etapa"). La tarjeta debe quedar mucho más baja.
- **Diálogo Anotar** (Base UI `Dialog`, sistema Tinta), con lo que la etapa permite:
  - **Comentario**: texto libre, siempre.
  - **Próximo contacto** (fecha, Bogotá): si viene, el deal queda con Seguimiento y `deals.fecha_seguimiento`.
    Michael en la reunión: el seguimiento lleva **razón** (*"toca cambiar eso de origen y toca poner Razón"*), así
    que con próximo contacto el comentario es obligatorio y hace de razón (validado en el servidor).
  - **Quiere la próxima cohorte** (casilla): Próxima Cohorte, con su cohorte destino como hoy.
  - **En Agendado o Atendido:** "La llamada no se hizo / se reagenda", con motivo (lista de tipo `reagenda`, 218
    agrega los nuevos y "Otro") y, opcional, la fecha de la llamada nueva, que se crea ahí (también un Meet que
    no pasó por Calendly). Pone Re-agenda. La llamada que no se hizo queda con su resultado (no-show o
    reagendada), como hoy en `lib/deals/llamadas.ts`.
  - Se ofrece solo lo que el motor acepta desde esa etapa (las flechas `PR*`, `PS*`, `PC` de `lib/deals/etapas.ts`);
    lo que no aplica no se muestra.
- **Una server action, una transacción:** escribe la actividad (`nota`) por `crearConRastro` y, si hay dato de
  pendiente, llama a `moverEtapa` con la misma etapa y el pendiente. Nada de escribir `deals.pendiente` a mano.
- **Potencial o Registrado → En gestión**: una anotación cuenta como gestión y mueve el deal (la regla de
  `actividad-mueve.ts`, ahora sobre la nota). Devuelve qué cambió para el aviso del 220.
- **Actividades** (`ficha-actividades.tsx`): cada anotación muestra fecha, quién, comentario y el pendiente que
  puso con su fecha ("Seguimiento · 12-oct"). **Migración** (la genera la sesión principal): en
  `deal_actividades`, `proximo_contacto date` y `pendiente_puesto pendiente_deal`, ambas nulas. Así la historia
  no depende de unir con `deal_etapa_historial` por la hora.
- El Kanban y el arrastre no cambian en este ticket (son del 219).

## Done cuando

- [ ] La Transición tiene solo botones de etapa, Corregir cuando aplica y Anotar.
- [ ] Anotar con fecha deja Seguimiento; con la casilla, Próxima Cohorte; con "no se hizo", Re-agenda con motivo y
      la llamada nueva si hay fecha. Cada caso con test contra el motor.
- [ ] Un deal en Registrado pasa a En gestión al anotar.
- [ ] Actividades muestra comentario y pendiente de cada anotación; dos seguimientos son dos filas con su fecha.
- [ ] Recorrido en `dev:local` como closer: abrir el diálogo en cada etapa, consola limpia, 390 px.
