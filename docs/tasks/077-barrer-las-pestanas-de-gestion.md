---
id: 077
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-1 · insumo §9, spec §7 (enmendada)"
depends: [111]
status: todo
---

# 077 — Barrer las pestanas de gestion de las dos hojas

> **Va de ULTIMO, con el scaffold completo.** Es la enmienda de la spec §7: el "historico de C2"
> crece de alcance y se convierte en la migracion one-time.

## Objetivo

Traer al CRM lo que vive en las pestanas de gestion: `Setteo`, `Registro de llamadas`,
`Estudiantes` y `Forms viejo`, de los dos programas.

## Las coordenadas (copiadas del ticket 039 antes de borrar esas filas de `sources`)

| programa | que | archivo | pestana |
|---|---|---|---|
| comunicarte | Estudiantes | `1NN6rlZXJJ…` | `Estudiantes Agosto` |
| comunicarte | Registro de llamadas | `1NN6rlZXJJ…` | `Registro de llamadas` |
| comunicarte | Formulario anterior | `1NN6rlZXJJ…` | `Forms viejo` |
| comunicarte | Pauta | `1NN6rlZXJJ…` | `ROAS ESTUDIASTES AGOSTO` |
| tactical-investor | Estudiantes C1 | `1DBKL4zwWW…` | `Estudiantes Cohort Julio` |
| tactical-investor | Estudiantes C2 | `1DBKL4zwWW…` | `Septiembre Estudiantes Cohort` |
| tactical-investor | Registro de llamadas | `1DBKL4zwWW…` | `Registro de llamadas` |
| tactical-investor | Pauta C1 | `1DBKL4zwWW…` | `ROAS COHORT JULIO` |

(Los ids completos estan en `docs/estructura-bbdd.md`. `Forms viejo` sigue siendo una fila
**inactiva** de `sources`, no una coordenada suelta: por eso sus envios tienen donde apuntar.)

## Alcance

- **Dentro:** leer las pestanas con Google Workspace MCP o con el lector del repo, y **mapear cada
  una** al modelo nuevo.
- **Dentro:** lo que no se pueda clasificar queda **visible con su rareza**. ⚠️ **No se anula**:
  anular significa "esto nunca paso", y de la hoja **si paso** (ADR 0038).
- **Fuera:** inserts crudos. Eso es el ticket 078.
- **Fuera:** apagar las pestanas. Eso es el ticket 082, y va despues de verificar.

## Done cuando

- [ ] Las ocho pestanas estan leidas y su mapeo, escrito.
- [ ] Ninguna fila se descarta en silencio: lo que no entra queda listado con la razon.

## Kiro

Si, **con los casos raros revisados uno por uno**.

---

## Nota 2026-09-24: la migración trae los deals históricos

Por la decisión de Mani del 24-sep, el sync abre deals solo para leads nuevos desde el corte. Los
deals de los leads viejos de Setteo **nacen aquí**, desde la pestaña Setteo, respetando su "Estado
gestión" (ver el ticket 080).


---

## Enmienda 2026-09-28 (plan de reparto §3, ok de Mani)

Depende del traslado (111) y de las mutaciones de E4 (060, 069, 070), no del 075. Los tickets 077 a 081 se corren en el corte del hito B: sin lo abierto de hoy (Setteo, agendados, estudiantes con saldo) los closers llegarían al CRM sin su pipeline.

## Idea de Mani, 28-sep: un template de importación

Recopilar la gestión (setteo, llamadas, estudiantes, pagos) en un **template canónico** desde otra
sesión, y después **subirlo** para inyectarlo. La recomendación de la sesión 42: sí para la gestión
(heterogénea, pide criterio; separar "recopilar" de "inyectar" hace revisable lo primero y deja el
importador fijo, idempotente y con ensayo, que es lo que pide el 078), **no** para leads y envíos (el
traslado 111 ya los lee directo de la fuente; un paso de copiado solo agrega errores). Decisión previa
que merece ADR: un deal histórico "nace" en su etapa por migración, porque no puede recorrer las
transiciones del motor. Diseñarlo con `/grill-with-docs` al abrir E7. `tipo_fuente` ya tiene `upload`.
