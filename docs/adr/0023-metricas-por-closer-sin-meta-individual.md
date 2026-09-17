# 0023 — Las metricas por closer salen de las mismas consultas, y la meta no se reparte

**Fecha:** 2026-09-17 · **Estado:** aceptado (Mani, en la sesion del ticket 005)

El ticket 005 pedia un selector de closer en el dashboard. Las consultas del ticket 004 solo
sabian responder por programa y rango: la unica cifra individual era `embudoPorCloser`, el
comparativo. La primera propuesta fue filtrar en memoria sobre ese comparativo y dejar los leads
y la cohorte a nivel programa. Mani la rechazo: **saber todas las metricas a nivel individual de
closer es no negociable.**

## Decidimos

**1. El filtro por closer vive dentro de las consultas del dashboard, en su `Alcance`.**
`lib/queries/dashboard.ts` pasa de `(programId, rango, db)` a
`Alcance = { programId, rango, closerId? }`, y cada consulta agrega su condicion: `abonos.closerId`
para la caja, `calls.closerId` para el embudo, los motivos, los origenes y los compromisos,
`sales.closerId` para las ventas y la contribucion a la cohorte, y `people.responsableCloserId`
para los leads. Sin `closerId` la consulta es identica a la del 004, asi que el filtro no puede
cambiar el total del programa.

La alternativa era un modulo aparte (`dashboard-por-closer.ts`) que respetara la regla de la
sesion de no tocar `dashboard.ts`. Se descarto: dejaria dos implementaciones del anclaje de fecha
en Bogota, del universo del embudo y del agrupado por moneda, y esas tres se desincronizan sin que
nadie lo note. Una sola fuente de verdad vale mas que la regla de reparto de archivos de un dia.

**2. No existe meta individual.** La meta de cupos y la meta de leads por dia habil son de la
cohorte (ADR 0022) y la base no tiene ningun reparto por closer. Con un closer seleccionado,
`vistaDeCohorteActiva` devuelve `vendidosDelCloser` (su **contribucion**) y deja intactos
`vendidos`, `meta`, la meta dinamica, el esperado y el cumplimiento, que se siguen midiendo contra
la cohorte completa. Se descarto repartir la meta entre los closers activos: ese numero no existe
en ningun lado y se usaria para medir a personas.

**3. El comparativo entre closers no se puede filtrar, y lo impide el tipo.** El alcance de
`embudoPorCloser` es `Omit<Alcance, "closerId">`. Filtrarlo lo dejaria en una fila, y el
comparativo completo es justo lo que garantiza "todos ven todo" (ADR 0009). Es una garantia del
compilador, no una convencion que haya que recordar.

**4. Los leads de un closer son las personas de las que es responsable** (ADR 0021). Como "sin
responsable" es un estado valido, **la suma de los leads de todos los closers no da el total del
programa**, y el dashboard lo dice en pantalla en vez de dejar que alguien lo descubra restando.

**5. El filtro vive en la URL, nunca en la sesion.** El rango y el closer son parametros de
`/programas/[slug]` (`?rango=&desde=&hasta=&closer=`). Un closer que entra sin filtro ve el
programa completo, igual que un gerente. Se descarto filtrar por el closer logueado: seria
volver a ADR 0003 por la puerta de atras, y un dashboard filtrado no se podria compartir ni
recargar. El armado de la vista (`armarVistaDelDashboard`) no recibe rol ni sesion, asi que no hay
donde esconder una diferencia entre lo que ve un gerente y lo que ve un closer.

## Consecuencias

- Sin migracion: todas las columnas de closer ya existian (ADR 0011, ADR 0021).
- Cualquier consulta nueva del dashboard nace con `Alcance`: si el codigo necesita un filtro mas,
  crece el objeto, no la lista de argumentos.
- Un preset de rango que no se puede cumplir (cohorte sin ventana de venta, fechas invalidas,
  rango invertido) cae a "hoy" **y el selector muestra "hoy"**: la pantalla nunca dice que estas
  viendo algo distinto de lo que ves.
- El dia que el negocio quiera meta por closer, hay que decidirla y guardarla como dato (ADR
  0012), no derivarla en el codigo.
