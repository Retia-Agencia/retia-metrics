---
id: 080
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-4 · insumo §9"
depends: [078]
status: en curso
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
- [x] Los encabezados corridos de ComunicArte estan revisados a mano (30-sep: la Categoria vive en `Registro 2`, ver abajo).
- [x] Los 12 "cohorte pasada" tienen su fila de historial (una nota del sistema "Movido desde la cohorte C1", ver la tabla).
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

---

## ✅ Decisión de Mani, 28-sep: qué del Setteo se migra como deal (reemplaza la enmienda del 24-sep)

Medido ese día en las dos hojas (solo agregados). ComunicArte: 973 filas (Pendiente 716, En proceso 196,
No interesado 57, Cerrado 3). Tactical: 1.520 (Pendiente 708, En proceso 738, Agendado 58, No interesado 11,
Cerrado 4). Con actividad (fecha de contacto o algún Registro): 283 y 1.220. Ya son lead en el CRM: 959 y 1.490.

**Alcance por defecto, "lo trabajado + lo reciente":**
- **Deal** para todo `En proceso` y todo lo que tenga actividad de un closer (fecha de contacto o algún
  `Registro`), y para los `Pendiente` de los **últimos 30 días** aunque no tengan actividad.
- **Solo lead, sin deal:** los `Pendiente` de más de 30 días sin actividad (la cola vieja que nadie tocó).
  Se encuentran desde Leads; no ensucian el Inbox.
- **`No interesado` y `Cerrado`: solo lead, sin deal.** Un Cierre Perdido migrado movería la conversión del
  embudo con un motivo que la hoja no dice; las ventas reales entran por Estudiantes. Es la regla de
  siempre: lo que no se puede clasificar queda visible, no se inventa.
- `Agendado` (58 de Tactical, todos de hace más de 60 días) tiene actividad: cae en la regla de arriba y su
  etapa la decide la llamada, no el texto (una cita de hace dos meses no es un deal en Agendado).
- **El dueño** sale de `Closer asignado` / `Responsable` SOLO si ese nombre es un usuario del CRM (`mismoCloser`,
  ADR 0030); Michael, Alejo, Sebastian, Dana o Juanjo no lo son todos, y el deal nace sin dueño (Inbox).
- **Una fila `Pendiente` con notas de un closer** (~410 en Tactical, 26 en ComunicArte) es un estado
  inconsistente de la hoja: entra por la regla de actividad y **queda marcada como rareza**, no adivinada.
- La duda de "`En proceso` sin nota" casi no existe: son 2 filas, las dos de Tactical.

**Puerta abierta a la migración TOTAL (Mani): el alcance es un PARÁMETRO del script, no código fijo.** El
script de la migración (077/078) recibe el alcance (`trabajado-y-reciente` por defecto, `total` para todo el
Setteo abierto) y los días de corte (30 por defecto). Pasar a total es correr con otro flag y el mismo
camino de ingesta, sin reescribir nada. `total` no cambia lo de `No interesado`/`Cerrado`: eso es una decisión
aparte.

---

## ✅ Decisiones caso por caso (29-sep, Alejo; medido con los templates del 29-sep, solo conteos)

La etapa de un deal del **Setteo** (Pendiente Setteo o En Contacto) la decide su **última llamada** del
`Registro de llamadas`, colgada por correo (solo si el correo tiene UN deal migrado, ADR 0027). La última es la
de fecha más reciente; sin fecha, la de fila más baja. A un deal de Estudiantes su etapa se la da la pestaña de
Estudiantes y ninguna llamada la cambia. Afecta a pocos: ~5 deals en CA y ~40 en TI.

| Caso | Decisión |
|---|---|
| Setteo `En proceso` sin nota | Entra en **En Contacto** como cualquier `En proceso` (2 filas, TI). |
| `Show = Sí, Cierre = No` | **Atendido** siempre (TI 27, CA 4). La categoría queda en la llamada como texto. Si es de pérdida (`RECHAZO DIRECTO`, `FIT/PRODUCTO`, `FINANCIERO`) → rareza `perdida_por_decidir`: la cierra un closer, no el script (el 28-sep: un Cierre Perdido migrado movería la conversión). |
| `Show = No` | **Pendiente Re-agenda** siempre (TI 19, CA 5). `RECHAZO DIRECTO` → rareza `perdida_por_decidir`. |
| `Show = Sí, Cierre = Sí` sin fila en Estudiantes | **Atendido** y rareza `cerrada_sin_estudiante`: la venta sin su pago no se inventa. |
| Última llamada `agendada` (Show vacío) | No cambia la etapa (la cita ya pasó); su rareza `sin_resultado` ya existe. |
| Setteo `Agendado` (58 TI) | Si tiene llamada, la decide la llamada y la rareza `agendado_por_decidir` desaparece; si no, En Contacto con la rareza. |
| `Registro 1-5` | Una nota por registro; fecha solo en el primero (y el último en TI). Hecho en el 078. |
| `Origen` de Estudiantes | No se lee: el origen es el envío más reciente del lead (`submissionOrigenId`, ADR 0060). Hecho en el 078. |
| CA `Estudiantes Septiembre` | La `x` es la fecha de venta; `Numero de asistentes` no se lee (078). **Los 12 "cohorte pasada" los marca el extractor** (30-sep; antes era a mano en el template): la `x` trae una celda combinada "Cohorte pasada" que abre el bloque, y el bloque termina en la primera fila con fecha. Esas filas salen con `movidoDesde: "C1"` (`cohortePasadaDesde` de la pestaña en `scripts/migrar-gestion.ts`; si una pestaña trae el bloque sin esa configuración, el extractor falla ruidosamente). El deal lleva una nota del sistema *"Movido desde la cohorte C1"*, y si el mismo correo también tiene deal en la pestaña de esa cohorte, ese deal no se crea (`sinDeal: movido_de_cohorte`) y no hay rareza `en_dos_cohortes`. Sin marca, entran como estudiantes de septiembre. |
| `Registro de llamadas` de CA | Encabezados corridos mapeados por forma (078). **Falta la revisión a mano** en el ensayo. |
| `_kpis` | No se lee: se leen las pestañas con datos. |
| Consolidados C2 de Michael | Gana la hoja (Mani, 28-sep). |
| Subcategorías con código (`FU-3`, `RD-1`, 14 filas) | No se cruzan con `motivos` (no tiene código): van como texto en `motivo_perdida`, que no mueve la etapa. |
| La lista visible | **`/ajustes/migracion`**, solo administración (gerente y developer), selector de programa obligatorio, filtro por tipo, enlace al lead/deal. Solo lectura. |

**Construido (29-sep, Alejo):**
- `lib/migracion/consolidar.ts`: la última llamada decide la etapa del Setteo según la tabla de arriba; rarezas
  nuevas `perdida_por_decidir` y `cerrada_sin_estudiante`; `movidoDesde` (campo opcional del template, a mano).
  Sobre los templates del 29-sep: TI 16 en Pendiente Re-agenda, 24 en Atendido, 4 posibles pérdidas; los
  `agendado_por_decidir` bajan de 58 a 31. CA 3 y 1.
- `/ajustes/migracion` (`lib/migracion/rarezas.ts`): conteo por tipo y lista (hasta 500) con enlace al deal y al
  lead; guarda de administración en `tests/paginas.test.ts`, consulta en `tests/migracion-rarezas.test.ts`.
  Probada en la base local con 2.112 rarezas de TI (render del servidor, filtro, tipo ajeno).
- `scripts/dev-local.ts`: `shell` en Windows (el spawn de `npx` fallaba con ENOENT).

**30-sep (Alejo):** el extractor lee el bloque "Cohorte pasada" de la hoja (filas 2 a 13 de `Estudiantes
Septiembre`): el template del 30-sep sale con los 12 marcados (C1 → C2), y el de Tactical no trae el bloque.
Tests en `tests/migracion-extractor.test.ts`.

**30-sep (Alejo), revisión a mano de los encabezados corridos de CA** (perfil por columna de la hoja real, solo
conteos y valores repetidos, sin datos personales): el mapeo de J como Registro 3 y de N como la subcategoría de
verdad se sostiene, pero **la Categoría vive casi siempre en la col I (`Registro 2`)**: 76 filas de toda la hoja
(3 a 305) contra 15 en `Categoría` (208 a 232). Decisión de Alejo: con la forma corrida, si `Categoría` está vacía
y `Registro 2` es **exactamente** una de las cinco categorías de la lista cerrada (`CATEGORIAS_DE_LLAMADA` en
`lib/migracion/extraer-llamadas.ts`), se lee como categoría y deja de ser nota; cualquier otro texto sigue siendo
nota. Llamadas de CA con categoría: de 15 a 91 (RECHAZO DIRECTO 3, FIT/PRODUCTO 5, FINANCIERO 2: las posibles
pérdidas que antes no llegaban a `perdida_por_decidir`). Tactical está limpio (la categoría solo en su columna).
🩸 **El template de CA hay que regenerarlo** (`npm run migracion:extraer -- --programa comunicarte`) antes del
ensayo y del corte.

**Falta:** recorrido en navegador (claro/oscuro, 390 px, consola; la extensión no estaba conectada).
