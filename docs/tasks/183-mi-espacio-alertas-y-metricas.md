---
id: 183
etapa: O4
serves: "docs/anotaciones.md A-87, A-90 (la mitad de Mi espacio); ADR 0023, 0048, 0067, 0077"
depends: []
status: todo
---

# 183 — Mi espacio: lo que necesita atención y las métricas de quien lo mira

Sesión **S3**, ola O4 parte 1. Sin migración.

## Por qué existe

Mani (3-oct, noche): las tabs de abajo de Mi espacio (Mis llamadas, Mis deals, Mis students) repiten lo que ya está
en las tabs del programa, que desde el 156 y el 170 le muestran al closer solo lo suyo. Mi espacio tiene que ser lo
que **agrupa las alertas y lo que necesita atención**, y donde el closer ve **sus métricas**.

## Alcance

1. **Fuera** `tab-mis-llamadas`, `tab-mis-deals` y `tab-mis-students` (y sus consultas si quedan huérfanas). El
   registro de secciones del 179 se queda; solo cambian las secciones.
2. **Necesita atención (arriba).** Lo que hoy está en Pendientes y en las alertas del deal, agrupado: alertas rojas y
   amarillas de sus deals (las mismas de `queLeFalta` y el Inbox, ticket 128: **se importan, no se recalculan**),
   llamadas sin resultado, sueltas suyas, y **posibles duplicados** de sus programas (A-90): cada fila enlaza a donde
   se decide (la ficha del deal o del lead, que hace el 184). La lista de duplicados sale de la consulta que ya usa
   Leads (`lib/queries/leads.ts`), importada tal cual.
3. **Mis métricas.** Para el closer (y para quien lo ve con "Ver como"): agendas, llamadas atendidas (show), no show,
   deals cerrados (Abonado o Completo, ADR 0037), % de cierre sobre atendidas, caja cobrada y comisión. Periodo:
   **hoy, semana, mes y cohorte** con el selector del 136 (`lib/periodo.ts`, Bogotá, días hábiles), A contra B con
   número y % (`Variacion`). **Por programa o "todos"**: en "todos" solo se suman conteos y caja (ADR 0048); tasas y
   comisión van **por programa, lado a lado**. Cada cifra abre su lista (ADR 0067, `metricas-filtros.ts`).
   **Ninguna métrica se calcula de nuevo:** salen de los mismos módulos que el dashboard (filtro por closer del 004,
   `comision.ts`, `metricas-filtros.ts`). Si una pregunta no existe en ellos, se agrega ahí y no en Mi espacio.
   La meta es de la cohorte y no se reparte (ADR 0023): Mi espacio muestra **contribución**, nunca "tu meta".
4. **Gerente y developer** siguen con su Mi espacio del 179 (Por decidir, etc.); las métricas por closer del gerente
   son el comparativo del dashboard, no esto. El paid trafficker igual que hoy.
5. Qué otras métricas por closer quedan anotadas para después (de `docs/comercial.md` §9.7: agendas futuras contra
   pasadas, resultado de agendas sin cerrar en rojo, tiempo hasta el primer contacto): se escriben en el ticket al
   cerrarlo, sin construirlas.

## Archivos (suyos en la ola)

`app/(app)/mi-espacio/*`, `components/mi-espacio/*`, `lib/queries/mi-espacio*.ts` si existe. Lee (no edita)
`lib/queries/leads.ts`, `dashboard.ts`, `comision.ts`, `metricas-filtros.ts`, `inbox.ts`. Si necesita una pregunta
nueva en `metricas-filtros.ts`, la agrega al final sin tocar las existentes y avisa (el 167 también la toca: quien
llegue segunda a `main` rebasa).

Tests: `tests/mi-espacio*.test.ts` (secciones por rol), un test que compara las métricas de Mi espacio de un closer
contra el dashboard filtrado por ese closer (mismas cifras), "todos" sin tasas (el tipo no compila con una tasa, como
el 095).

## Done cuando

- Mi espacio del closer sin Mis llamadas, Mis deals ni Mis students; arriba lo que necesita atención, con duplicados.
- Métricas del closer con hoy, semana, mes y cohorte; por programa o "todos" solo sumable; cada cifra abre su lista.
- Las cifras cuadran con el dashboard filtrado por el mismo closer (test).
- `npm run build` en verde; recorrido en `dev:local` como closer, gerente con "Ver como" y developer, escritorio y
  375 px, consola abierta.
