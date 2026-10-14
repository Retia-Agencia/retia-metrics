---
id: 258
etapa: hub
serves: "ADR 0089 puntos 1, 5 y 6 · ADR 0088 · docs/hub.md §5.2 (semáforo, días seguidos) · semaforo-30x-analisis del vault"
depends: [122, 123, 245, 262]
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
