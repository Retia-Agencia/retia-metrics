---
id: 020
fase: F2
serves: "spec §1 pilar 2 — meta y meta dinámica"
depends: [008]
status: todo
---

# 020 — Días hábiles y meta dinámica

## Objetivo
Funciones puras que responden "¿qué día hábil de la cohorte, la semana y el mes es hoy?" y "¿cuánto
hay que vender por día para llegar a la meta?".

## Alcance
- Dentro: `lib/dias-habiles.ts`: `esDiaHabil`, `diasHabilesEntre`, `diaHabilDe(fecha, inicio, fin)`
  en zona `America/Bogota`. Solo excluye sábado y domingo (los festivos cuentan).
- Dentro: `metaDinamica({ meta, vendidos, diasHabilesRestantes })` y `metaLineal(...)`.
- Fuera: consultas a la base (004).

## Done cuando
- [ ] TDD. Los casos salen del reporte del 15-sep: "día 11 de 22 hábiles" en septiembre,
      "TI C2 20 de 30", "Comunicarte C2 23 de 27", meta 2,8 cupos con 28 faltantes en 10 días.
- [ ] Con 0 días restantes no divide por cero.
