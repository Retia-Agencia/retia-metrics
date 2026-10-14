---
id: 258
etapa: hub
serves: "ADR 0089 puntos 1, 5 y 6 · ADR 0088 · docs/hub.md §5.2 (semáforo, días seguidos) · semaforo-30x-analisis del vault"
depends: [122, 245, 262]  # v1; la v2 además 247
status: todo
---

# 258 — El semáforo de costo por agenda, calculado en el CRM

## Objetivo

Que el CRM calcule, por programa y por campaña, el color del costo por agenda contra su umbral, de día y al cierre, con
todo lo que hace útil al semáforo de 30X, y lo muestre en Hub › Pauta.

## Alcance

- **Dentro:** una función que arma el semáforo de un momento dado: por programa y campaña con gasto en el día, el
  gasto, las agendas del CRM, el costo, el umbral (objetivo `costo_por_agenda` de la cohorte activa, 122; meta = verde,
  aceptable = amarillo, encima = rojo) y el color.
- **Dentro:** **durante el día** el color sale de comparar contra **ayer a la misma hora** (fotos del 245 y agendas por
  su hora de creación), nunca contra el umbral de cierre (ADR 0089 punto 5). **Al cierre** (18 h) sale contra el umbral.
- **Dentro:** lo que hace accionable al semáforo: el conteo por color en el encabezado, el umbral al lado del número, el
  amarillo como % del umbral, "0 agendas" escrito así (un verde con 0 agendas no es verde), la trayectoria del día (las
  fotos), los **días hábiles seguidos en rojo** por campaña, y las agendas según Meta al lado como señal temprana.
- **Dentro:** **la nota de calidad del dato**: una sincronización que falló, una cuenta sin datos, una campaña sin
  umbral; y "sin errores en esta corrida" cuando no hubo.
- **Dentro:** la vista en Hub › Pauta (programa y "todos": los programas lado a lado, sin sumar costos, ADR 0048).
- **Fuera:** el endpoint (259), el mensaje de WhatsApp (260), el lazo con las acciones (261). Los umbrales reales son
  datos (HQ-1).

## Done cuando

- [ ] Un caso armado a mano (gasto, fotos y agendas) da el color esperado de día y al cierre, con test.
- [ ] El retraso de atribución no pinta un falso rojo: el mismo día leído a las 11 h y a las 18 h con los datos de
  30X del 19-sep (`semaforo-30x-analisis` §4), con test.
- [ ] Una campaña sin umbral o un programa sin cohorte activa se dicen como tales, nunca verde.

---

## Enmienda 14-oct (Mani): v1 por programa, v2 por campaña

Para que el semáforo llegue por WhatsApp sin esperar el embudo completo (123), el ticket se parte en dos. Del 123 el
semáforo solo necesita la definición del costo por agenda (`docs/hub.md` §5.2: gasto de Paid ÷ agendas del CRM de
Paid, por el envío que abrió el deal, ADR 0060), no el embudo ni sus pantallas.

- **v1, por programa.** Depende de 122 (umbral), 245 (fotos) y 262 (hechos), **ya no del 123**. Gasto del programa
  (`gasto_pauta`, 120) ÷ agendas del hecho `agenda` con `area = Paid` (262, regla del 246). **El costo por agenda vive
  en un módulo propio** que el 123 importará después (ADR 0024: una cifra, una definición); el 123 no la reescribe.
  Para "ayer a esta hora" el hecho `agenda` necesita cortar por la hora de creación de la cita, no solo por día: ese
  filtro entra aquí. El encabezado, el umbral al lado, "0 agendas", la nota de calidad del dato y los días seguidos en
  rojo van en la v1, por programa. El endpoint (259) y Juanito (260) arrancan con la v1.
- **v2, por campaña.** Depende además del 247 (el id de Meta → campaña). Agrega el detalle por campaña, sus días
  seguidos en rojo y su línea en el mensaje. Ni el 259 ni el 260 cambian de forma: la respuesta trae una lista de
  campañas que en la v1 viene vacía.
- **Abierto, HQ-4:** el gasto del programa es el de todas sus campañas o solo el de las que buscan agendas. Hasta que
  Pauta lo decida, la v1 usa **todas** y la nota de calidad lo dice.
- Done cuando de la v1: los tres criterios de arriba, por programa. Los de campaña pasan a la v2.
