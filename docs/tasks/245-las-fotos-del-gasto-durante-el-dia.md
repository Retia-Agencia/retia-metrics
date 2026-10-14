---
id: 245
etapa: hub
serves: "ADR 0089 puntos 2, 4 y 5 · docs/hub.md §4.1 · el semáforo compara contra ayer a la misma hora"
depends: [120]
status: todo
---

# 245 — Las fotos del gasto durante el día

## Objetivo

Que el CRM pueda decir cuánto se había gastado ayer **a esta misma hora**, por campaña, para que el semáforo del
día no use el umbral de cierre (el retraso de atribución lo volvería un falso rojo).

## Alcance

- **Dentro:** migración (sesión principal): `fotos_pauta` (cuándo se tomó, campaña de Meta, gasto acumulado del
  día y agendas según Meta acumuladas hasta ese momento). Se guarda a nivel campaña, no anuncio: es lo que el
  semáforo usa y pesa una fracción.
- **Dentro:** `sincronizarDiaEnCurso()`: lee de Meta el día en curso por campaña, actualiza el gasto del día (por
  la función única del 120) y guarda una foto. No corre si la última foto tiene menos de N minutos (dato en
  código, por defecto 20), para que dos llamadas seguidas no le peguen a Meta dos veces.
- **Dentro:** `gastoAEstaHora(campaña, fecha, hora)`: la foto más cercana sin pasarse; sin foto, lo dice.
- **Dentro:** las fotos de más de 30 días se borran en la misma corrida (no son historia: la historia es el gasto
  del día cerrado).
- **Fuera:** quién dispara la sincronización durante el día (259 y 260) y el semáforo (258).

## Done cuando

- [ ] Dos llamadas en menos de N minutos generan una sola lectura de Meta, con test.
- [ ] "Ayer a las 11" devuelve la foto de las 10:58 y no la de las 11:05, con test.
- [ ] El gasto del día cerrado no cambia por las fotos: lo sigue escribiendo solo el 120.

## Notas

Una cuenta en otra zona horaria haría que "ayer a esta hora" no signifique lo mismo: el 119 ya la marca. Hoy las
cuatro cuentas activas están en `America/Bogota`.
