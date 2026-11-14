# 0117 — Deshacer: un botón en el log, en cualquier momento, con motivo opcional

**Fecha:** 2026-11-03 · **Estado:** aceptado (Mani, 3-nov, pedido de Michael Castellanos) · **Ticket:** 368 ·
**Enmienda:** ADR 0026 (el motivo de anular es opcional, el closer anula sin ventana de cohorte, las actividades se
anulan), ADR 0078 (corregir la etapa no es solo el último movimiento ni vuelve solo al `de`) · **Confirma:** ADR 0037,
0038 y 0042

## El problema

Michael, 3-nov: *"que no sea como si marca algo mal... que lo pueda revertir. Es deshacerlo con un motivo y ya."* Las
reversiones existían pero repartidas: anular abono (motivo obligatorio y solo con la cohorte activa), anular deal,
corregir solo el último movimiento de etapa (ADR 0078), corregir el resultado de una cita, desmarcar onboarding. Una nota
o un contacto mal puesto no se podía quitar, ni una llamada asignada al deal equivocado, ni un cambio de dueño sin
volver a editarlo a mano. Para quien no es técnico, cada error tenía un camino distinto o ninguno.

Mani, 3-nov: *"que se pueda en cualquier momento y que no sea solo el último movimiento... no puede ser como el save
final. Un deshacer no se deshace, sí queda como registro. El motivo, opcional, texto libre. Súper sencillo y a futuro
para que no haya errores."*

## Decidimos

**1. Un solo gesto: "Deshacer" en cada fila del Log de eventos del deal.** Abre un diálogo que dice qué cambia (lo de
ahora y cómo queda), un motivo opcional en texto libre y el botón. Los botones de anular que ya existen (abono, deal)
abren el mismo diálogo. Nada se borra: deshacer es una escritura nueva con rastro.

**2. En cualquier momento.** No hay ventana de tiempo, ni de cohorte, ni exigencia de que sea lo último. Si después hubo
otros cambios, deshacer igual aplica y el diálogo muestra el valor que se pisa.

**3. Qué hace deshacer, según lo que se deshace.** La respuesta vive en UN registro tipado (`lib/deshacer/`), exhaustivo
sobre las columnas de cada tabla con rastro: una columna nueva no compila hasta que alguien decide si se restaura y
cómo, o por qué no.

| Evento del log | Deshacer |
|---|---|
| Se creó un abono | Se anula (el motor recalcula la etapa, A1 y A2) |
| Se creó un deal a mano | Se anula, con sus llamadas y abonos (ADR 0038) |
| Se registró una llamada en el CRM | Se anula |
| Se colgó una llamada de Calendly de este deal | Vuelve a las sueltas del Inbox (no se anula: la cita existe) |
| Se registró una nota o un contacto | Se anula (las actividades ganan la marca de anulado y `vigente()`) |
| Se editó un campo (dueño, setter, cohorte, onboarding, acuerdo, fecha límite, link enviado, valor vendido, Grain, comprobante...) | El campo vuelve a su valor anterior, por la función de dominio que valida ese campo |
| Se marcó cortesía | Se quita la cortesía y el deal sale de Completo a la etapa en que estaba |
| Movimiento de etapa | Corrección: el diálogo propone volver a la etapa de origen y deja escoger otra |

Al deshacer el resultado no show o cancelada de una llamada, si el deal sigue en Re-agenda y no queda otra llamada vigente
con uno de esos resultados, también se restaura el pendiente anterior que registró la misma operación; si ese rastro no
aparece, queda sin pendiente. Es una regla puntual en `lib/deshacer/` hasta que el ticket 411 construya la reversión
compuesta de operaciones.

**4. La etapa se corrige libre, salvo donde manda el dinero.** La corrección (`moverEtapa` con la flecha `CORR`) va a
cualquier etapa, en cualquier momento, también desde un botón "Corregir etapa" de la ficha sin escoger fila. Tres
excepciones, porque ahí la etapa es la consecuencia de un hecho y no una opinión: no se corrige **hacia** Ganado
Parcial, Ganado Completo ni Cierre Perdido, y no se corrige **desde** una etapa ganada. Entrar o salir de ganado lo
deciden los abonos y la cortesía (anular el abono o quitar la cortesía); perder exige motivo de negocio (ADR 0038).
Sin esa reja, un deal en Ganado sin abono se contaría como venta sin un peso, sin error visible.

**5. Un deshacer no se deshace, y queda registrado.** Cada deshacer escribe una fila en `reversiones` (quién, cuándo,
qué evento, motivo opcional) y marca con su id las filas de `change_log` y `deal_etapa_historial` que escribió. Esas
filas no muestran "Deshacer"; el evento deshecho muestra "Deshecho" con quién y por qué. Una anulación tampoco se
revierte. La base garantiza que un evento se deshace una sola vez (índice único). Lo que siempre se puede es volver a
hacer la acción normal, o volver a corregir la etapa.

**6. Quién.** Quien hizo la acción, el dueño del deal o quien administra (`esAdministrador`, que incluye al developer).
Para el onboarding, además, quien puede marcarlo (`puedeMarcarOnboarding`). Lo decide UNA función de
`lib/deals/permiso.ts`. Lo hecho por el sistema (sync, webhook, motor) no muestra el botón: se deshace su causa, o se
corrige la etapa.

**7. El motivo es opcional y es texto libre.** En blanco se guarda `null`, nunca un texto inventado. Los CHECK de
anulación de `deals`, `calls` y `abonos` siguen exigiendo quién y cuándo, ya no el motivo. El catálogo de motivos de
tipo `correccion` deja de usarse para corregir (reemplazar es borrar, N7): sus filas viejas se siguen mostrando en el
historial.

## Fuera de alcance

- **Confirmar o separar un correo** (identidad del lead): cambia qué lead es quién y no pasa por el rastro operativo.
  Se corrige con su propia pantalla.
- **Catálogo, ajustes y Media:** tienen editar y desactivar del molde (ADR 0012).
- **Lo que entra por webhook o sincronización:** es del sistema; su error se corrige en la fuente o anulando lo creado.

## Consecuencias

- **A favor:** un error tiene un solo remedio, en el lugar donde se ve el error, y no inventa hechos de negocio.
- **A favor:** el registro exhaustivo hace que una columna nueva no pueda quedar sin decidir.
- **En contra:** deshacer un cambio viejo pisa los cambios posteriores del mismo campo. Es la decisión de Mani; el diálogo
  lo muestra antes de confirmar y el rastro conserva ambos.
- **En contra:** sin motivo obligatorio se pierde parte del porqué. Quién y cuándo siguen siendo obligatorios en la base.
