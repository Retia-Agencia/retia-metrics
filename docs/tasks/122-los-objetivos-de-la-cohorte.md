---
id: 122
etapa: E7
serves: "ADR 0063 puntos 4, 5 y 6 · docs/analytics.md PT-40, PT-44, PT-48"
depends: [083]
status: todo
---

# 122 — Los objetivos de la cohorte y el reparto de cupos por área

## Objetivo

Que la meta repartida por canal y los umbrales de Pauta (meta y aceptable) sean datos de la cohorte, y que
una sola función diga si algo va "en ruta" o "atrasado".

> ✅ Todo decidido (Mani, 29-sep): reparto en cupos, tabla `objetivos` (DP-23) y semáforo (DP-24).

## Alcance

- **Dentro:** tabla `objetivos` por el molde (ADR 0012): cohorte, área (nula = total), métrica, meta,
  aceptable (nulo), moneda (nula). Único `(cohorte, área, métrica)` con `NULLS NOT DISTINCT`.
- **Dentro:** la métrica es un **tipo** en el código con su sentido (menor es mejor en costos): cupos,
  agendas por día, costo por agenda, costo por lead, ROAS. Una métrica nueva es código; sus valores, filas.
- **Dentro:** la suma de los cupos por área no pasa `cohorts.meta_cupos`; se valida en la misma
  transacción que escribe (leer, decidir y escribir juntos). Lo no repartido se muestra "sin asignar".
- **Dentro:** "copiar los objetivos de la cohorte anterior" al crear una cohorte.
- **Dentro:** la función pura del semáforo, con tests: `exito`, `alerta` o `peligro` según meta y aceptable;
  para cupos, contra lo esperado a la fecha.
- **Dentro:** la pantalla, en la cohorte (`/ajustes/programas` o la tab Programs, 100).
- **Fuera:** los paneles que la usan (124, 090).

## Done cuando

- [ ] Repartir 36/24/10 de una meta de 70 se guarda; 40/40 de 70 lo rechaza con un mensaje claro.
- [ ] El semáforo da lo esperado en los dos sentidos (costo y cupos), con test.
- [ ] Cada cambio queda en `change_log`.

## Kiro

Sí. La migración, la sesión principal.


---

## Respuestas de Mani, 29-sep

- Métricas adicionales: **`conversion_agenda_venta`** (declarada por cohorte y área; la usa el 124) y **`costo_por_venta`** (cierres).

---

## Enmienda 14-oct (audit del Hub, `docs/hub.md` §5.2 y §6)

- **El objetivo `costo_por_agenda` es el umbral del semáforo** (258): meta = verde, aceptable = amarillo. Los valores
  son datos de cada cohorte (HQ-1, con la línea base de `docs/hub.md` §2.4); el CRM nunca trae uno escrito.
- **`conversion_agenda_venta`** la usa el 253 (agendas requeridas) además del 124.
- **Dónde va la pantalla** (ADR 0077): en la tab Programa, junto a la cohorte (Programa › Ventas), no en
  `/ajustes/programas`.
- Un programa nuevo arranca sin objetivos y el Hub lo dice ("sin umbral"); "copiar los de la cohorte anterior" sirve
  solo dentro del mismo programa (frontera).
