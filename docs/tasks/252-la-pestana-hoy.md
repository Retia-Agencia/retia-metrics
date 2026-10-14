---
id: 252
etapa: hub
serves: "ADR 0086 punto 3 · docs/hub.md O1, §2.3 (el reporte diario contra el CRM)"
depends: [250]
status: en curso
quien: Alejandro (14-oct)
---

# 252 — Hub › Hoy: el reporte diario sale del CRM

## Objetivo

Que la pestaña Hoy reproduzca la estructura del reporte diario de septiembre (el del 15-sep es la referencia) con lo
que el CRM ya calcula, para que nadie tenga que armarlo a mano.

## Alcance

- **Dentro, en este orden:**
  1. **La línea de contexto:** "Semana: día 3 de 5 · Octubre: día 10 de 22 hábiles · TI C3: día 13 de 32" (el 14-oct), por
     programa, con los días hábiles de Retia (solo se excluyen sábado y domingo).
  2. **El día, la semana, la cohorte y el mes:** cupos (y leads cuando el 253 dé su meta) con meta, real y
     cumplimiento; la meta del día es la dinámica (020) y la de la semana, la compensación semanal (146).
  3. **La operación del día** por programa y por closer: agendas, realizadas, show, ventas y % de cierre (ADR 0079),
     cada cifra con su lista.
  4. **La caja del día** y lo que la compone (abonos que completan una venta anterior se ven como tales).
  5. **Las banderas rojas y las alertas por persistencia** (lo que hoy está en Pulso).
  6. **Los lugares reservados** para la proyección y los requeridos (253), el origen del cierre (254) y las acciones
     abiertas (257), que se llenan con sus tickets.
- **Dentro:** "todos los programas" muestra los programas lado a lado y solo suma lo sumable (ADR 0048).
- **Dentro:** cada cifra de Hoy tiene meta, umbral o dueño (ADR 0086 punto 3); lo que no, se queda en su pestaña.
- **Fuera:** cifras nuevas (253, 254), las acciones (257), las gráficas nuevas (256).

## Done cuando

- [ ] Con los datos de producción, Hoy contesta cada fila del reporte del 15-sep que el CRM ya sabe calcular (§2.3 de
  `docs/hub.md`); las que faltan muestran su lugar y el ticket que las trae (nota de cierre con la comparación).
- [ ] Las cifras de Hoy son las mismas que las de su pestaña de origen, con test sobre las consultas (no se recalcula).
- [ ] Recorrido en escritorio y 375 px, con clic en cada cifra; `npm run test:humo` en verde.
