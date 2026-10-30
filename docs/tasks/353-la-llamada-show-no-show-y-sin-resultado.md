---
id: 353
etapa: hub
serves: "ADR 0115 N1, N2 · auditoría 30-oct C-03, C-05, C-06, C-15, R-04, R-05, U-05"
depends: []
status: todo
---

# 353 — La llamada: show, no show y sin resultado, una vez cada uno

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **C-03 / R-05:** el % de show tiene tres fórmulas con el mismo nombre (por deal, `tasas-del-grupo.ts`; por cita,
  `tasa-show-por-cita.ts`; Pauta, `pauta-interina.ts`) y el no show cuatro (`pauta-interina.tsx:140-146`,
  `vista-metrica.ts:375`, `dashboard.ts:677`). Hoy muestra 56,9 % y 10,5 % lado a lado en ComunicArte. El no show no está
  en el diccionario.
- **R-04:** "ocurrió" se envuelve ≥ 8 veces sobre `RESULTADOS_QUE_OCURRIERON` (`mover-etapa.ts:964`).
- **C-06:** cuatro definiciones de "cita pasada sin resultado" (251 contra 255 en ComunicArte); la bandera del Hub cambia
  con el periodo y el Inbox no.
- **C-05:** la escalera mete en el escalón 7 los deals con cita vencida sin marcar (245 de 999 en ComunicArte).
- **C-15:** las reagendas cuentan como agendas nuevas (336 agendas, 320 deals) y el mensaje de horas lista cada una,
  aunque el 298 dice que conserva la primera.

## Decisiones abiertas

- **DA-3:** "el" % de show de Hoy. Propuesta: **por deal** como cifra (ADR 0079, el de las tasas) y por cita dentro de
  "Cómo se calcula".
- **DA-4:** la unidad de agenda (cita creada o deal que agendó). Se decide con Pauta: cambia el costo por agenda y las
  horas.

## Alcance

1. Un módulo de resultados (`ocurrio`, `ocurrioSql`, `noAsistio`, y su lista) que importan los 8 lugares de R-04.
2. `showPorDeal`, `showPorCita` y el % de no show como complemento nombrado de una de ellas, con su fila en
   `metricas.md`. Pauta, el comparativo semanal y la escalera las importan; se borran las fórmulas sueltas.
3. `citaVencidaSinResultado(ahora)` única (con `coalesce(fecha_agenda, fecha_llamada)`), y que Inbox y bandera digan
   explícitamente si excluyen deals cerrados o si siguen el periodo.
4. La escalera muestra "cita pasada sin resultado" aparte del escalón 7, con su lista.
5. La agenda según DA-4, usada por costo por agenda, horas y Deals contra agendas.
6. Guardián (N1) sobre la lista de resultados y sobre el predicado de cita sin resultado.

## Done cuando

- [ ] Test de paridad: el mismo set de citas da el mismo show en Hoy, Comercial, Pauta y escalera, por fórmula.
- [ ] Test: una reagenda cuenta según DA-4 en las tres pantallas que la usan.
- [ ] Test: Inbox y bandera dan la misma cifra con el mismo criterio declarado.
- [ ] Guardianes mordidos en los dos sentidos.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
