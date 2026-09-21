---
id: 074
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-6 · insumo §2.4 a §2.6, ADR 0042"
depends: [073]
status: todo
---

# 074 — Ficha del Deal: todo en una pantalla, mas el historial de etapas

## Objetivo

La pantalla donde un closer trabaja una oportunidad entera sin salir.

## Alcance

- **Dentro:** cabecera (lead, programa, cohorte, owner, etapa, producto), **Calls**, **abonos**,
  **cuotas pactadas**, **actividades**, y el **historial de etapas** completo.
- **Dentro:** **editar el deal** (producto, cohorte, owner, fechas, motivo). Un deal **no es
  inmutable** (ADR 0042): si editar fuera imposible, anular seria el unico remedio para un dato mal
  puesto y se usaria para todo, que es lo que el ADR 0038 evita.
- **Dentro:** **anular el deal**, con motivo, claramente distinto de **Cierre Perdido**. ⚠️ La
  pantalla tiene que hacer obvia la diferencia: *"me equivoque al registrar"* frente a *"el lead
  dijo que no"*, nunca "anular" y "perder" a secas.
- **Dentro:** las actividades (`contacto | nota`, con canal, autor y fecha) reemplazan las cinco
  columnas `Registro 1-5` de texto libre de la hoja.
- **Fuera:** cambiar la etapa sin pasar por el motor.

## Done cuando

- [ ] Todo lo de un deal se ve en una pantalla, sin navegar a otra.
- [ ] Editar deja fila en `change_log`; mover etapa deja fila en `deal_etapa_historial`.
- [ ] Anular pide motivo y **el deal deja de contar en el dashboard** (probado mirando la cifra
      antes y despues).
- [ ] Un closer no puede anular el registro de otro; **probado forjando la peticion**.

## Kiro

Si, con revision visual obligatoria.
