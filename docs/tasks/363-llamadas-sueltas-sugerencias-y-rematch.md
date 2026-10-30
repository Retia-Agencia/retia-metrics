---
id: 363
etapa: crm
serves: "ADR 0049 (llamadas sueltas) · diagnóstico del Inbox de Comunicarte, 30-oct"
depends: []
status: todo
---

# 363 — Llamadas sueltas: sugerencias que distingan y re-emparejar cuando llega el formulario

## Por qué (medido en producción, 30-oct, solo lecturas, Comunicarte)

El Inbox › Llamadas › Sin deal tenía 5 llamadas de Calendly con `deal_id` nulo y vigentes. Cada una sacaba botones
"Colgar aquí · Nombre" repetidos (`lib/queries/inbox.ts:447`, `components/deals/inbox-llamadas-sueltas.tsx:112`):

1. **La sugerencia casa por nombre exacto del invitado o por teléfono, y el invitado de Calendly trae solo un nombre de
   pila.** "Sandra" casa con tres leads distintos con deal abierto; "Santiago" con dos. El botón muestra solo el nombre,
   así que los botones se ven iguales y uno de ellos cuelga la llamada a otra persona. El teléfono casi nunca ayuda:
   `calls.raw.telefono` vino nulo en las 5.
2. **Las llamadas sueltas se emparejan una sola vez, cuando llega el webhook de Calendly.** El 20-oct la cita de Sandra
   (`sr.newbusiness@gmail.com`) se creó a las 00:09:00 y el formulario completo con ese mismo correo llegó a las 00:09:03.
   Hoy ese correo ya es un contacto **confirmado** de un lead con un solo deal abierto (emparejaría sin duda), pero nadie
   reintenta. Lo mismo con Santiago el 8-oct: cita 04:14:26, formulario 04:14:30.
3. **Dos de esos deals no están en Agendado aunque el formulario trajo el link de la cita** (`Agenda aquí tu entrevista`
   con el uuid del invitado y `variable:etapa = Agendado`): el de Santiago nació Calificado y el de Sandra Registrado,
   ambos sin ninguna llamada. ADR 0069 y el ticket 052 dicen que esto debía abrir Agendado con su llamada. **No sé aún
   por qué no pasó**; es el primer punto a investigar. **Causa raíz (cerrada, 30-oct):** fue una carrera entre las dos
   entregas. La ingesta resuelve Calendly una sola vez, antes de su transacción; si el webhook todavía no había terminado
   de guardar la llamada, buscaba la cita con el correo del formulario (distinto al correo usado al reservar), abría el
   deal en Registrado/Calificado y no reintentaba. El webhook terminaba después y dejaba la llamada `sin_lead`. El fix del
   9-oct reconocía el UUID en ambos órdenes **secuenciales**, pero no cerraba esta simultaneidad ni reprocesaba lo anterior.
   Santiago ocurrió antes de ese fix; Sandra reprodujo la ventana concurrente. Ambos links tienen la forma
   `calendly.com/d/.../invitees/<uuid>` y la adopción no dependía de dueño, etapa ni cohorte: simplemente ninguno de los
   dos caminos volvía a mirar después de que el otro había confirmado.
4. Las otras tres sueltas son re-reservas con otro correo del deal **ya Agendado**: `admonjennylopez489@gmail.com`
   (deal de `admonjennylopez@hotmail.com`, 3.ª cita) y `pretelt76@gmail.com` (deal de `pretelt_76@hotmail.com`, 3.ª
   cita), más `test@example.com` (cita de prueba del 8-oct, sin lead). No afectan la etapa, pero esa cita no cuenta para
   show / no show hasta que se cuelgue.

## Principio (Mani, 30-oct): esto no puede volver a pasar

**El id que une el formulario y Calendly ya existe: el uuid del invitado.** El link de la pregunta `agenda` del
formulario termina en `/invitees/<uuid>` y la llamada de Calendly lleva la huella `calendly:<uuid>`. Con eso la cita se
empareja **sin importar el correo, el teléfono o el nombre** que haya escrito la persona, y sin importar quién llegó
primero. Ya hay dos piezas que lo usan: `dealDelEnvioConLaCita` (webhook → deal, `colgar-llamada.ts`) y
`adoptarSueltaDeCita` (formulario → llamada suelta, `regla-de-deals.ts:340`, `llamadas.ts:142,596`). Y aun así quedaron
sueltas dos citas cuyo envío traía el link. Hay que averiguar por qué y cerrar **todos** los caminos, no solo estos dos.

Las invariantes que debe garantizar el sistema (cada una con su prueba y su alarma):

- **I1.** Una llamada de Calendly vigente nunca queda suelta si algún envío del programa trae su uuid en el link de agenda.
- **I2.** Un deal abierto cuyo envío trae el link de una cita vigente tiene esa llamada y está en Agendado (o más
  adelante), nunca en Registrado / Calificado / Potencial.
- **I3.** El orden de llegada no importa: webhook antes que formulario, formulario antes que webhook, reintentos,
  entregas simultáneas, parcial y completo del mismo lead.
- **I4.** Cuando no hay uuid (cita reservada sin pasar por el formulario) la llamada sigue suelta **a propósito**, pero
  nunca en silencio: el Inbox ya la muestra y debe avisar cuánto lleva suelta.

## Alcance

1. **Causa raíz con los dos casos reales** (Santiago `santiago.fr10@hotmail.com`, 8-oct; Sandra
   `varigroupdigital@gmail.com`, 20-oct; Comunicarte). Hipótesis a descartar: (a) son anteriores al arreglo del 9-oct y
   quedaron sin reprocesar; (b) el link del envío tiene otra forma que `.../invitees/<uuid>` (el de Sandra es un
   `calendly.com/d/...` igual que el de Santiago, verificarlo); (c) la llamada la creó el webhook sin lead y el envío
   no la adoptó porque `adoptarSueltaDeCita` exige algo que no se cumplió (deal sin dueño, etapa, cohorte); (d) el
   formulario completo llegó con Calendly ya en `sin_lead` y nada lo reintenta. Entregable: la causa escrita aquí y un
   test que reproduce el caso real con la ruta real (`tests/webhook-matriz.test.ts` es el molde) y falla antes del arreglo.
2. **Barrido de reconciliación**, una sola función en `lib/calendly/` (el único lugar que decide): para cada llamada
   suelta vigente del programa, (a) busca el uuid de su huella en los envíos del programa y la cuelga al deal único que
   lo trae; (b) si no, aplica el emparejador de siempre por correo confirmado (el contacto pudo confirmarse después). Lo
   llaman: el final de `ingerirEntradas` (para los leads que acaba de tocar), el procesamiento de cada webhook de
   Calendly, y un cron diario como red de seguridad. Idempotente; cada cuelgue deja su rastro (`crearConRastro`).
3. **Reparación de deals** (I2): el mismo barrido busca deals abiertos en Registrado / Calificado / Potencial cuyo envío
   trae el link de una cita vigente y, si la llamada existe o se puede leer por uuid, la cuelga y mueve a Agendado con
   `moverEtapa` y nota del sistema. Nunca escribe `deals.etapa` a mano.
4. **Alarma (I4 y respaldo de I1/I2):** el Inbox y `salud-fuentes` (o donde viva la alarma de formulario roto) avisan
   de llamadas sueltas con más de N horas y de deals con link de cita sin llamada. N se decide con el dato, no se inventa.
5. **Sugerencias que distinguen** (lo que sigue suelto sin uuid): el botón muestra nombre y correo; una sugerencia por
   nombre solo se ofrece con nombre y apellido o cuando casa con un solo deal abierto; la de teléfono no cambia. Con
   varias candidatas, la fila dice "2 posibles" en vez de repetir el mismo botón.
6. **Matriz de casos** como test, uno por fila, todos por la ruta real: webhook antes / después del formulario; correo
   distinto en Calendly; mismo correo; parcial y luego completo; reintento del webhook; dos entregas simultáneas; reagenda
   con otro correo (el deal ya Agendado cuelga la nueva cita por uuid); cita cancelada antes de que llegue el formulario;
   un uuid que aparece en envíos de dos leads (duda: queda suelta y avisa); cita de otro programa (nunca cruza); sin uuid.

## Fuera de alcance

- Asignar a mano las 4 llamadas reales de hoy: es una escritura en producción y la hace Mani desde el Inbox, o el
  barrido una vez desplegado (con el ok de Mani). La de `test@example.com` se anula.
- Emparejar por nombre o teléfono sin un humano (ADR 0049): sigue siendo solo sugerencia.

## Done cuando

- [x] Causa raíz documentada y arreglada, con el test del caso real que falla antes y pasa después.
- [x] El barrido existe, es idempotente y lo llaman la ingesta, el webhook y un cron; tests de cada llamador.
- [x] La matriz de casos (punto 6) cubierta por la ruta real; I1 a I4 cada una con una prueba mordida en los dos sentidos.
- [x] Alarma visible para llamadas sueltas viejas y deals con cita sin llamada.
- [x] El botón muestra el correo y las sugerencias por nombre ya no repiten botones indistinguibles.
- [ ] Typecheck, lint, tests del cambio y `npm run build` (toca un componente cliente). La suite completa la valida el CI.
- [x] N8: si cambia una regla, ADR 0049 / 0069 y `docs/overview.md` §11 se reescriben en el mismo commit.

> Verificación local de la ronda 2: typecheck y lint limpios. El runner no alcanzó a iniciar los tests porque
> `scripts/test.mjs` recibió `spawnSync ps EPERM`; por instrucción del ticket no se intentó un rodeo. La casilla
> de build queda abierta para la validación de Claude en el checkout principal.
