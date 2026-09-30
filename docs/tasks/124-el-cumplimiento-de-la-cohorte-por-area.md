---
id: 124
etapa: E8
serves: "ADR 0063 · docs/analytics.md PT-41 a PT-47"
depends: [122, 123]
status: todo
---

# 124 — El cumplimiento de la cohorte por área ("Cierre por canal")

## Objetivo

El panel diario que hoy arma Pauta a mano (captura 4 de `docs/analytics.md`): cuánto va cada área contra su
parte de la meta, qué hace falta por día y a qué ritmo se va.

## Alcance

- **Dentro:** por área de la cohorte activa (y total): meta, vendidas, cumplimiento, faltan, estado
  (semáforo del 122), ventas por día requeridas (meta dinámica, 020), agendas faltantes y agendas por día
  requeridas, ritmo actual, brecha y proyección. Fórmulas en `docs/analytics.md` §6.
- **Dentro:** la tabla día a día de la cohorte por área: dejaron datos, completaron, agendaron, ventas.
- **Dentro:** la venta sin atribución suma al total y a ningún área; el reparto no asignado se ve.
- **Dentro:** comparativo con la cohorte anterior en el mismo día hábil.
- **Fuera:** cortesías (DP-15, sin decidir).

## Por decidir con Pauta (PQ3)

Qué conversión agenda→venta usa "agendas requeridas" (la de esta cohorte, la de la anterior o una
declarada), qué ventana define el ritmo actual y cuántos días antes del cierre dejan de contar las agendas.
Hasta que respondan, la pantalla dice qué supuesto usa.

## Done cuando

- [ ] Con una cohorte armada a mano, las cifras cuadran con un cálculo hecho aparte, con test.
- [ ] Una cohorte sin reparto por área muestra solo el total y lo dice.
- [ ] Recorrido en celular y escritorio.

## Kiro

Sí, con revisión visual.


---

## Respuesta de Mani, 29-sep

- La conversión agenda→venta **se declara en los objetivos** (122). Cada agenda cuenta para la cohorte de su deal; si el deal aún no tiene cohorte (se asigna en el primer abono), cuenta para la cohorte activa el día en que se agendó. Siguen abiertas la ventana del ritmo y el desfase.
