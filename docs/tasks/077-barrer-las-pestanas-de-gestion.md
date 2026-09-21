---
id: 077
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-1 · insumo §9, spec §7 (enmendada)"
depends: [075]
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
