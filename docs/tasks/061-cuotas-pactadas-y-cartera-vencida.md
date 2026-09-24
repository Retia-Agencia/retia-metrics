---
id: 061
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-5 · ADR 0041 (D5), insumo §7"
depends: [060]
status: todo
---

# 061 — Cuotas pactadas y la vista de cartera vencida

## Objetivo

Que el CRM sepa **que se prometio pagar y cuando**, cuota por cuota, y que un closer pueda
perseguir la plata por cuota y no por el total.

```
cuotas_pactadas (deal_id, numero, monto, fecha_pactada, abono_id?)
```

## Por que filas y no `num_cuotas` + una fecha

Dividir `saldo / num_cuotas` **asume cuotas iguales**, y en el momento en que un plan real no lo
sea, ese numero **es falso y no lanza ningun error** (ADR 0041). Y la cartera solo podria
preguntar *"¿entro todo antes de esa fecha?"*, cuando lo que hace falta es *"le falta la cuota 2,
vencia el 5 de octubre"*.

## Alcance

- **Dentro:** pactar cuotas, marcarlas cumplidas (`abono_id`) y la consulta de **cartera vencida**:
  cuotas con `fecha_pactada` pasada y `abono_id` nulo.
- **Dentro:** un boton que **propone** el reparto en cuotas iguales y **deja editar**. Proponer no
  es asumir; el caso comun no debe costar teclear cada fila.
- **Dentro:** si la suma de las cuotas no cuadra con el saldo, **se muestra, no se bloquea**
  (misma logica del ADR 0034: una reja de configuracion no frena un cobro real).
- **Dentro:** al anular el abono de una cuota, el `abono_id` se limpia y la cuota vuelve a estar
  pendiente.
- **Fuera:** `num_cuotas` en el deal. Es `count()`.
- **Fuera:** la pantalla de cartera en el dia del closer. Eso es el ticket 071.

## Done cuando

- [ ] Un plan desigual (500 + 200) se guarda tal cual y **ningun numero calculado lo contradice**.
- [ ] Cartera vencida responde **por cuota**, no solo por el total.
- [ ] Anular un abono devuelve su cuota a pendiente.
- [ ] Las cuotas no se confunden con los abonos en ninguna consulta: lo prometido y lo recibido
      son dos cosas (ADR 0013).

## Kiro

Si.

## ⚠️ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../insumos/fleeting/2026-09-24-reunion-closers-crm.md), resumen en la propuesta §0): el proceso real no tiene cuotas

Los acuerdos de pago se **conversan**, no se pactan en cuotas fijas (*"paga el otro 30% en tal
fecha y el 20% restante en tal otra"*). Regla: pagar todo **antes del inicio del programa**, como
máximo **a la mitad**. Lo que pidieron: **una nota del acuerdo** y **una fecha límite** en el deal.

🟡 **Propuesta, la decide Mani:** este ticket cambia de alcance a
`deals.acuerdo_pago` (texto) + `deals.fecha_limite_pago` (fecha, prellenada con el inicio de clases
de la cohorte y editable), y **cartera vencida = saldo > 0 con la fecha límite pasada**. Las filas de
`cuotas_pactadas` salen de v1: la tabla existe y se queda quieta hasta que alguien pida cobrar cuota
por cuota. Por qué: una estructura que el proceso no tiene es un campo que nadie llena, y un dato que
nadie llena miente en la cartera sin lanzar un error. Migración: la sesión principal.
