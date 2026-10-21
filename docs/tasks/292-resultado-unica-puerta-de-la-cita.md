---
id: 292
etapa: llamadas
serves: "Mover o resolver una cita se hace solo desde Resultado; el selector de horas dice de dónde salen y deja poner una hora fuera de Calendly (ADR 0101, parte B)"
depends: [177, 280]
status: done
---

# 292 — Resultado es la única puerta de la cita: horario visible y hora fuera de Calendly

## Por qué

El 20-oct Juanjo quiso mover una cita de las 7:30pm a las 8pm del mismo día. Entró por Anotar (motivo, después hora)
porque hay dos puertas que hacen lo mismo, y solo vio horas del día siguiente sin saber por qué: su horario de Calendly
permitía las 8pm, lo más probable es el aviso mínimo de su evento, que la API no expone. No tuvo salida (ADR 0101).

## Alcance

- **Anotar** (`components/deals/dialogo-anotar.tsx`, `lib/deals/anotar.ts`):
  - Se quita el `SelectorDeHora` y el campo `reagenda.fechaLlamada` (esquema, rama de `reagendarLlamada` y de
    `agregarLlamada` dentro de la reagenda). Quitar solo lo que queda huérfano.
  - Si el deal tiene una llamada `agendada` vigente, la opción "La llamada no se hizo / se reagenda" no se ofrece; en su
    lugar una línea: "Esta cita se resuelve desde Resultado, en la llamada." La página que arma Anotar ya tiene las
    llamadas del deal; pasar el dato por props, no consultar en el cliente.
  - Sin cita viva, la opción queda como hoy sin hora: deja el pendiente Re-agenda con su motivo.
  - El servidor rechaza (409) una reagenda de Anotar sobre un deal con cita `agendada`: esconder la opción no es la reja.
- **Horario visible** (`components/calendly/selector-de-hora.tsx` + `lib/calendly/escritura.ts`):
  - `horarioDelEvento(token, eventTypeUri)`: `GET /event_type_availability_schedules?event_type=…`, devuelve por día de
    la semana los intervalos en hora de Bogotá (convertir si la regla viene en otra zona) y las fechas puntuales
    (`type: "date"`) de los próximos 7 días. Sin datos o error: `null`, el selector sigue funcionando.
  - `horasDisponiblesAccion` devuelve también el horario. El selector muestra, arriba de las horas: la etiqueta del
    evento que ya existe, el horario ("Lun a Mié 7:00pm a 10:00pm · Jue 6:30pm a 10:00pm · …") y la línea fija
    "Calendly además esconde horas por aviso mínimo, buffers, límites diarios y choques con tu calendario. Eso se cambia
    en Calendly." Con un round robin, el horario de cada host no se enumera: la línea dice que Calendly reparte entre
    los closers del evento.
- **Hora fuera de Calendly**, en el mismo selector:
  - Un enlace "Poner una hora fuera de Calendly" abre: fecha y hora (Bogotá, `hoyEnBogota()` como mínimo de fecha) y el
    link de la reunión (obligatorio, URL). Aviso visible: "Esta hora no queda bloqueada en Calendly: otro lead puede
    reservarla."
  - El valor del selector pasa a ser `{ tipo: "calendly"; fecha } | { tipo: "manual"; fecha; link }`, y las tres
    acciones que lo usan (`reagendarLlamadaAccion`, `agendarLlamadaAccion`, la de Mover a Agendado en
    `components/deals/dialogo-mover.tsx`) aceptan las dos formas. La manual no llama `reservarParaDeal`: usa
    `reagendarLlamada` / `agregarLlamada` con `fechaAgenda` y `linkCalendly` (el link de la reunión), origen `crm`. La
    regla de una sola cita activa (ADR 0100) y la cancelación de la vieja en Calendly no cambian.
  - La fecha y hora se arman como instante de Bogotá con `-05:00` explícito (nunca `new Date(a, m, d)`); reusar
    `instante(dia, hora)` de las acciones si sirve.
  - Permiso: el mismo de la acción que la usa (quien puede trabajar el deal). Zod en el borde: el link es URL y la
    fecha no está en el pasado.

## Tests

- Anotar: reagenda sin cita viva deja Re-agenda con motivo; con cita `agendada` el servidor responde 409 y no mueve
  nada; el esquema ya no acepta `fechaLlamada`.
- `horarioDelEvento` con un `fetch` falso: reglas por día en Bogotá, regla en otra zona convertida, respuesta vacía o
  error → `null`.
- Hora manual: `reagendarLlamada` con `fechaAgenda` + link crea la nueva con origen `crm` y el link, deja la vieja
  `reagendada`, no llama a la reserva de Calendly (el `fetch` falso no recibe POST a `/invitees`); link inválido o
  fecha pasada → 400.
- `npm run build` antes de empujar: el selector es componente cliente (AGENTS.md, 2-oct).

## Done cuando

En una cita de Juanjo, Resultado → Reagendada muestra su horario de Calendly y la línea de por qué faltan horas; con
"Poner una hora fuera de Calendly" se crea la cita de las 8pm con su link, la vieja queda reagendada y cancelada en
Calendly; y en Anotar ya no aparece selector de hora.

## Relacionado

ADR 0101, 0100, 0096. 177 (Reagendar en Resultado), 220 (Anotar con hora, que se enmienda), 280 (cancelar en
Calendly), 291 (la otra mitad del ADR).
