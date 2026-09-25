---
id: 080
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-4 · insumo §9"
depends: [078]
status: todo
---

# 080 — Los casos raros que la migracion ya sabe que va a encontrar

## Objetivo

Resolver uno por uno los casos que el insumo §9 enumera. **Ninguno se decide "de paso" mientras se
corre el script**: cada uno se decide antes, se escribe y se prueba.

## La lista

| Caso | Que hay que decidir |
|---|---|
| Setteo `En proceso` **sin nota** | ¿entra igual como **En Contacto**, o queda en Pendiente Setteo? |
| `Show = Si, Cierre = No` | **Atendido** o **Cierre Perdido** segun la categoria |
| `Show = No` | **Pendiente Re-agenda** o **Cierre Perdido** |
| `Registro 1-5` (texto libre) | **una actividad por nota**. Fecha desconocida salvo la primera y la ultima 🩸 (Tactical tiene `Fecha de ultimo contacto`, ComunicArte **no**) |
| `Origen` de Estudiantes | es un VLOOKUP por correo y da **`#REF!`** en Septiembre. La atribucion **se RE-DERIVA desde el envio del Lead**, nunca se copia |
| `Estudiantes Septiembre` de ComunicArte | la columna `x` es la **fecha de venta sin encabezado** y `Numero de asistentes` es un **contador de filas**: no se leen como campos. Los 12 "cohorte pasada" entran con `cohort_id` = septiembre **y una fila de historial "movido desde agosto"** |
| `Registro de llamadas` de ComunicArte | tiene los **encabezados corridos** (bug del `onEdit`): mapear por posicion **y** por nombre, y revisar a mano |
| `_kpis` | apunta a pestanas equivocadas (`Estudiantes ComunicArte` esta **vacia**): leer las pestanas **con datos**, no las que el script nombra |
| Consolidados C2 de Michael vs la hoja | 🟡 **cuando difieran, decide Michael** |

## La regla que gobierna todos

**Lo que no se pueda clasificar queda VISIBLE con su rareza.** No se anula (anular significa "esto
nunca paso", y de la hoja si paso, ADR 0038) y no se adivina con una heuristica: emparejar por
cercania acierta casi siempre y **cuando falla, mueve la cifra equivocada sin avisar** (ADR 0027).

## Done cuando

- [ ] Cada fila de la tabla tiene su decision escrita **antes** de correr nada.
- [ ] Los encabezados corridos de ComunicArte estan revisados a mano.
- [ ] Los 12 "cohorte pasada" tienen su fila de historial.
- [ ] Existe una lista de lo que no se pudo clasificar, visible en la app.

## Kiro

Si, **con los casos raros revisados uno por uno**.

---

## Enmienda 2026-09-24: el estado de gestión de Setteo decide la etapa

Como los deals históricos nacen en la migración (decisión del 24-sep), la pestaña Setteo se mapea por
su "Estado gestión": `Pendiente` → Pendiente Setteo, `En proceso` → En Contacto (la duda de arriba
sigue: ¿sin nota también?), `Agendado` → Agendado, `No interesado` → Cierre Perdido con motivo,
`Cerrado` → se busca su venta. 🔴 **Pregunta para los closers:** ¿hasta cuántos días atrás vale la pena
recontactar? Los leads más viejos pueden entrar sin deal.
