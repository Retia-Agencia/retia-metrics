# Revisión del Hub, las métricas y el MCP (13-nov-2026)

> Revisión de solo lectura pedida por Mani. No se tocó código, tracker ni tickets. Es un reporte, no un plan aprobado:
> en la jerarquía del ADR 0115 (N8) mandan ADR vigente > ticket > este documento.
>
> **Cómo se hizo.** Leí `docs/tasks/README.md`, las entradas del 9 al 13-nov de `docs/agents/handoff.md`, `docs/hub.md` §0,
> `docs/weekly-2026-11-03.md`, `docs/audit-hub-2026-11-10.md`, `docs/contrato-metricas-y-datos.md`, `docs/mcp.md`, las casillas
> de 29 tickets, y contrasté con el código por `grep`, `git tag` y `gh run list`.
> **Lo que NO hice:** abrir la app, correr tests ni consultar producción. Todo lo que dice "medido" aquí es medido en el repo;
> lo que viene de un documento lo cito.

## 1. En una pantalla

| Frente | Estado | Lo que falta para darlo por cerrado |
|---|---|---|
| **Métricas** (una definición por cifra) | Sólido. Auditoría 385 `done`, trinquete del registro en 0, 10 tests de paridad y dorados | Marcar 403 `done` (ya tiene su checkpoint), cerrar 390 y 401, y cuatro guardianes que el contrato aún lista como propuestos |
| **Hub comercial** (pedido de Gerencia, 3-nov) | Fase 1 entera en `done` (12 tickets) | Sentarse con Daniel Tovar a usarlo (paso 5 de la fase 1, sin evidencia en el repo) y 376 (productos y SKUs) |
| **Hub › Pauta** (pedido de Paid Media, 7-nov) | En curso. 412 en `main`, 419/420/414 a medias | Respuestas de Paid Media (Q-1 a Q-9, DM-8), «Ver solo», 415, 416, 422, y el cuadre contra el Excel |
| **UI estándar** (la Cifra) | **A medias y con un hueco de alcance**: la forma nueva solo existe en Pauta y el semáforo | Decidir quién migra Hoy, Comercial y Dinero (hallazgo H-1) |
| **MCP** | Lectura abierta y 12 escrituras en `main`, CI verde | F3 a F5 del 411, conectar clientes reales (383), y la cobertura de escrituras que aún no pasa por el MCP |

**Estado de `main`:** `fdc36b0d` tiene el CI en verde (`gh run list`, 13-nov 15:20 UTC). Mientras escribía entró `65c2c3af`
(416, Pauta por cuenta), cuyo CI no revisé. Hay 15 commits después del último checkpoint `cp-20261112-2`, así que falta un
tag nuevo sobre la punta que salga verde. La casilla F2 del 411, que se marcó con el CI corriendo, queda
confirmada: no hay que desmarcarla.

## 2. Lo que pidieron Gerencia y Pauta, y dónde está

### 2.1 Gerencia (weekly con Daniel Tovar, 3-nov). Fuente: `docs/hub.md` §0, tabla G-1 a G-14

| Pedido | Ticket | Estado en el tracker |
|---|---|---|
| G-1, G-2 Periodo y cohorte separados, con la primera venta de la cohorte | 377 | done · 9-nov (humo sin correr) |
| G-3 Vendido, Recaudado, Por cobrar; nunca "Monto" | 369, 374 | done |
| G-4 a G-6 Gráficas que siguen los filtros, en cupos y en plata, por día | 370 | done · 12-nov (su alcance 6, comparar contra producción, quedó sin casilla) |
| G-7 Bloque fijo "¿Vamos a llegar?", mes y cohorte × cupos y USD | 371 | done |
| G-8, G-9 Comercial dice su periodo; completos y parciales aparte | 372, 379, 381 | done |
| G-10 Reporte diario en PDF desde Hub › Hoy | 373, 378 | done |
| G-11 Un nombre por cifra | 374, 397 | done |
| G-12 ROAS que avisa agendas pendientes, y ROAS proyectado | 355, 375 | done |
| G-13 Productos y SKUs por persona | **376** | **todo** · fase 2 · pide ADR antes de construir |
| G-14 Certeza de que la data está bien | 352 a 356, 385 y sus hijos | done, salvo 390, 401 y 403 (abajo) |

Lo único de Gerencia sin construir es G-13 (376). Lo que el repo no registra es **el paso 5 de la fase 1**: "sentarse con
Daniel Tovar a usarlo" (`docs/hub.md` §0). Sin eso no hay prueba de que el Hub ya le sirve, que fue la queja original
("no está tal cual lo que yo necesito ver").

### 2.2 Pauta (reunión del 7-nov y Excels). Fuente: `docs/paid-media-2026-11-09.md`, `docs/paid-media-excels-2026-11-10.md`

| Pedido | Ticket | Estado |
|---|---|---|
| Pauta y Origen en una pestaña; la tabla semanal reemplaza el Excel | 412 | en main · falta el cuadre fila por fila contra una semana cerrada del Excel |
| Una forma de métrica, explicada al abrirla | 419 | en curso · 3 casillas abiertas |
| Pauta en dos vistas (Resultados, Origen y calidad) | 420 | en curso · falta «Ver solo» (cuenta, canal, campaña, conjunto, anuncio) |
| Tabla por día | 414 | en curso · falta igualarla al boceto; el cuadre espera DM-8 |
| Inversión por cuenta | 416 | en curso · 13-nov (`65c2c3af`): interruptor Total / Por cuenta en la tabla y en el CSV, «Ver por Cuenta», y el test de que las cuentas suman el total. Falta «Ver solo» (compartido con el 420) y Q-8 |
| Costo por venta (CAC) | 415 | todo |
| Plan de inversión diario | 417 | bloqueado · Q-4 (Paid Media) |
| Cuadre del Excel y su retiro | 418 | todo · carril de Mani con Paid Media |
| Una sola cita con estados, y la confirmada | 421 | bloqueado · DM-8 (Michael y Paid Media) · migración |
| Hub de todos los programas con la misma forma | 422 | todo · espera al 420 |
| Historia del lead descargable | 424 | en main · falta el sí de Dani Rodríguez con una semana real |
| ROAS por anuncio y campaña, registro exportable | 350 | en main · 5 casillas sin marcar |

**El cuello de botella de Pauta no es código, son respuestas.** Q-1 a Q-9 (`paid-media-excels-2026-11-10.md` líneas 325 a 333)
y DM-8 siguen abiertas, y bloquean 417, 418, 421 y el cierre del 412 y el 414. Además el cuadre del 12-nov dejó una pregunta
viva: ComunicArte trae 41 ventas en el Excel contra 28 en el CRM (fila 412 del tracker).

## 3. Tickets: cerrados y abiertos

### 3.1 Cerrados (verificado en el tracker y en el `status:` de cada archivo)

- **Métricas:** 351 a 356, 360 a 362, 385, 388, 389, 391 a 400, 402, 404 a 406.
- **Hub comercial:** 369 a 375, 377 a 382.
- **MCP:** 399, 400, 409. Del 411: F0, F1 y F2 (olas 1 y 2).
- **Recientes:** 423 (`cp-20261112-2`).

### 3.2 Abiertos, ordenados por lo que les falta

**A. Solo les falta un trámite (minutos, sin código)**

| # | Qué falta | Fuente |
|---|---|---|
| 403 | Todas las casillas marcadas desde el 10-nov; pedía un checkpoint verde y ya hubo dos (`cp-20261112-1` y `-2`). Pasar a `done` | handoff 10-nov, `git tag` |
| 367 | "en main", 0 casillas abiertas, pedía checkpoint. Pasar a `done` | archivo del ticket |
| 368 | "en main" desde el 3-nov con sus nueve casillas sin marcar: marcarlas con evidencia | archivo del ticket |
| 411 | Decía `todo` con F0 a F2 hechas. **Corregido el 13-nov** a `en curso`, en el archivo y en el tracker | archivo del ticket |
| Checkpoint | Tag nuevo sobre `fdc36b0d` | `gh run list` |

**B. Les falta verificación o un recorrido (horas)**

| # | Qué falta |
|---|---|
| 419 | Fichas con `que`, `formula`, `variables`; comparar tarjeta, barra y celda con el boceto en claro, oscuro y 375 px; Rams, build, `test:humo` |
| 414 | Igualar al boceto |
| 412 | Tabla semanal en producción fila por fila; nota del ROAS en "Cómo se calcula" |
| 350 | Las 5 casillas: caso armado a mano, anulados y otro programa, CSV sin columnas de persona, cobertura, recorrido |
| 248 | 3 casillas: el par `instagram francisco`, la suma por par con test, recorrido |
| 390 | Medir la cobertura antes y después; el "parcial" en toda razón que dependa del resultado |
| 348, 383 | Conectar clientes reales (Claude Code, claude.ai, ChatGPT), comparar una cifra con el Hub, `test:humo`, guía en `operations.md` |
| 424 | El sí de Dani Rodríguez |

**C. Les falta construir**

| # | Qué | Frena |
|---|---|---|
| 420 y 416 | «Ver solo» (cuenta, canal, campaña, conjunto, anuncio): es la única casilla abierta de los dos | nada; Q-8 solo ajusta la presentación |
| 415 | CAC de Pauta | nada |
| 422 | Hub de todos con la forma nueva | 420 |
| 411 F3 a F5 | Guardián de cobertura, medición (migración), descubrimiento | nada |
| 401 | Migraciones M9 a M14 (el código ya dejó de leer) | despliegue antes de cada migración |
| 358, 359 | Formato único y regla del vacío; pantalla sin jerga, fuera del Hub | DA-7 (Gerencia), DA-6 (Mani) |
| 376 | Productos y SKUs | ADR |
| 386, 387, 407 | Integridad por rol, administración visual, MCP analítico | van detrás del 411 (decisión de Mani, 9-nov) |

**D. Bloqueados por una respuesta de fuera:** 417 (Q-4), 418 (Excel y fecha), 421 (DM-8).

**E. Pausados a propósito** (`docs/hub.md` §0, fase 2): 257, 261, 286, 288, 123, 124, 125, 249, 284, 285, 300.

## 4. Hallazgos: dónde puede haber errores

Ordenados por riesgo. Cada uno dice cómo lo sé.

### H-1 · La "forma única de métrica" hoy solo existe en Pauta (riesgo alto para el objetivo de UI)

- **Qué vi.** El contrato `CifraDeMetrica` solo se construye en `lib/pauta/cifras-de-origen.ts`, `lib/pauta/cifras-de-proyeccion.ts`,
  `lib/pauta/cifra-de-celda-semanal.ts` y `lib/semaforo/cifras-del-semaforo.ts`. La pieza nueva `<Cifra>` vive en
  `components/cifra-con-lista.tsx:60`, pero el componente viejo `CifraConLista` (mismo archivo, línea 36) sigue importado en
  14 archivos y `CifraDeRazon` en 7. Hoy, Comercial y Dinero no arman ninguna `CifraDeMetrica`.
- **Por qué importa.** El 419 se titula "en todo el Hub" y `AGENTS.md` (línea 2d) dice que el boceto es la referencia de
  **todos** los componentes. Pero el "Done cuando" del 419 solo exige las cifras de Pauta, y dice que "el resto lo completa el
  403 F4". El 403 ya tiene todas sus casillas marcadas. **Nadie es dueño de migrar Hoy, Comercial y Dinero.** Si se cierran 419
  y 403 tal cual, el Hub queda con dos formas de cifra y dos "Cómo se calcula", que es justo lo que Gerencia y tú quieren evitar.
- **Segundo síntoma.** El 419 (alcance 2) pide los campos `que`, `formula` y `variables` dentro de `FichaDeMetrica`
  (`lib/metricas/registro.ts`). Hoy las 52 fichas no tienen ningún `que:`, y las explicaciones viven aparte en
  `lib/metricas/explicaciones-de-pauta.ts`. Dos lugares para describir una métrica es el olor que N1 prohíbe.
- **Cómo atacarlo.** Decisión tuya primero (D-1 abajo). Luego un ticket hijo del 419: mover las explicaciones a la ficha,
  construir la `CifraDeMetrica` de las 43 claves del Hub en `lib/`, migrar pestaña por pestaña y borrar `CifraConLista`,
  `CifraDeRazon` y el diálogo viejo (N7: reemplazar es borrar), con un guardián que falle si alguien vuelve a importarlos.

### H-2 · El Hub de todos los programas sigue con la Pauta vieja (riesgo medio)

- **Qué vi.** `soloConteos` aparece en 5 archivos y `OrigenPorPrograma` en 2. El 422 los manda a borrar y está en `todo`.
- **Por qué importa.** Gerencia abre `/hub` para ver los tres programas. Hoy ve una forma en `/hub` y otra en `/p/<programa>/hub`.
- **Cómo atacarlo.** 422, en cuanto el 420 esté en `main`. Sus tests (ninguna tasa combinada, total = suma de programas) son
  la garantía del ADR 0048.

### H-3 · Los enlaces de las celdas de la tabla semanal no están verificados contra su lista (riesgo medio)

- **Qué vi.** Deuda escrita en el handoff del 11-nov: "ninguna otra celda de la tabla semanal tiene su enlace verificado contra
  su lista". Ese día la fila de Asistencia enlazaba a una lista que daba 404 y la barra de agendas decía 4 con una lista de 3.
- **Por qué importa.** Es el contrato "toda cifra abre su lista" (ADR 0067). Una celda que abre una lista con otro conteo es
  el frontend mintiendo, y ningún test lo ve.
- **Cómo atacarlo.** Un test de paridad que recorra las 16 filas de `ClavePautaSemanal`: para cada una, la cifra de la celda
  contra el conteo de la lista a la que enlaza. Es el mismo molde de `tests/metricas-con-filas.test.ts`.

### H-4 · Cuatro guardianes que el contrato lista como "solo propuestos" (riesgo medio, silencioso)

Fuente: `docs/contrato-metricas-y-datos.md` líneas 256 a 262, verificado en `tests/` el 12-nov.

1. Guardián por concepto para show y cita sin resultado.
2. Números dorados de llamadas, shows y citas sin resultado de Hub › Comercial, y del mensaje del semáforo entero.
3. Título del ADR contra la fila del diccionario.
4. Que toda superficie consuma el registro: **el mensaje de WhatsApp no lo lee** y ningún test lo exige.

El 4 es el que más pesa: el semáforo por WhatsApp es lo que el equipo lee cada hora, y hoy puede nombrar o calcular una cifra
distinto al Hub sin que nada falle.

### H-5 · El MCP no cubre todavía lo que la app permite (riesgo medio para "lo mismo que la app")

- **Qué vi.** La app exporta unas 150 server actions. El MCP tiene 12 acciones (`lib/mcp/acciones/`). De la operación diaria
  del closer faltan, entre otras: anotar una actividad, reclamar un deal, editar el deal y su acuerdo de pago, crear un deal o
  una persona, agendar y reagendar, completar una agendada, confirmar un comprobante, marcar onboarded, cambiar de cohorte,
  crear un deal desde una llamada suelta o descartarla. Toda la configuración (grupo C) también.
- **Por qué importa.** El ADR 0129 dice que el MCP no limita acciones. Sin el guardián de cobertura (411 F3), cada acción
  nueva de la app nace fuera del MCP y nadie se entera.
- **Cómo atacarlo.** F3 primero, antes de sumar más acciones: un registro exhaustivo que clasifique cada server action como
  "expuesta", "pendiente" o "fuera con razón" (igual que `lib/deshacer/registro.ts`), con un trinquete que solo encoja.
  Con eso la lista de pendientes deja de ser memoria y pasa a ser un número.

### H-6 · `docs/mcp.md` se contradice (riesgo bajo, N8)

§3 lista las 12 acciones; §7 todavía dice que la escritura "ya tiene su primer caso de uso, mover de etapa". El 411 tiene la
casilla abierta ("`docs/mcp.md` reescrito en el mismo commit"). Como el MCP se orienta por sus propias instrucciones, un
documento viejo termina en un modelo que responde mal.

### H-7 · Bug de la app encontrado y sin ticket (riesgo bajo, real)

Deshacer el resultado de una llamada no show o cancelada la devuelve a agendada pero deja el pendiente Re-agenda puesto.
Está fijado como "hallazgo" en `tests/mcp-acciones-ola2.test.ts` (handoff 13-nov). Merece ticket propio: afecta el Kanban y
la bandeja del closer.

### H-8 · Deudas chicas con nombre

- `components/deals/inbox-perdidos-en-calendly.tsx:15` infiere "Sin UTM" de tres campos nulos, fuera del módulo del concepto
  (N1). `inbox-sin-dueno.tsx:64` igual. Deuda nombrada en el 403.
- 377 se cerró con "humo sin correr" y 375 igual. `test:humo` no está en el CI (`AGENTS.md`), así que la interacción de esas
  pantallas no la ha probado nada automático.
- La frecuencia semanal queda en "—" hasta decidir si se pide el alcance por semana a Meta (D-5, I-6).
- 352 alcance 4: muestra mínima y días de madurez son columnas de `programs` sin pantalla de edición.

### Lo que revisé y está bien

- I-1, I-2 e I-8 del audit del 10-nov (show de Pauta con citas futuras, ROAS por fecha de venta, inversión 0 "ok"): decididos
  en D-A, D-B y D-E y cubiertos por `tests/paridad-pauta-comercial.test.ts` y `tests/numeros-dorados-pauta.test.ts` (403).
  No abrí la pantalla para confirmarlo con datos.
- El trinquete del registro está en 0 (`lib/metricas/pendientes.ts:14`).
- No hay `it.fails`, `it.skip` ni `it.todo` escondiendo un rojo; los cuatro `skipIf` son condicionales con razón.
- No queda "Monto" en el Hub; el único está en Programa › Plataformas, que es un campo de formulario.

## 5. Cómo retomar: el orden que recomiendo

El criterio es el de Daniel Tovar: "entrega algo, entrégalo bien hecho, terminadísimo". Por eso primero se cierra lo que está
a un paso, y no se abre nada nuevo de Pauta hasta que la forma de la cifra sea una sola.

**Paso 0 · Higiene (una sesión corta, sin código de producción)**
Tag de checkpoint sobre `fdc36b0d`; 403 y 367 a `done`; 411 a `en curso`; ticket para H-7. Verificación: `tests/tracker-coherente.test.ts` en verde.

**Paso 1 · Una sola forma de cifra en todo el Hub (H-1). Es el paso que más mueve tu objetivo.**
Cerrar el 419 en Pauta, y abrir su hijo para Hoy, Comercial y Dinero. Verificación: cada pestaña lado a lado con
`docs/bocetos/una-forma-de-metrica.html` en claro, oscuro y 375 px; `CifraConLista` y `CifraDeRazon` sin llamadores; guardián
que lo fije; `npm run build` y `test:humo`.

**Paso 2 · Cerrar Pauta en código: «Ver solo» (cierra 420 y 416 a la vez), luego 415 y 414.**
El 416 ya dejó la cuenta resuelta en un solo lugar (`cuentaDelGasto`, dimensión `cuenta_meta` del hecho de gasto), así que
«Ver solo» debe filtrar por esa misma dimensión. Verificación: las tres superficies (tabla, Ver por, Ver solo) sobre la misma
consulta, y el test de paridad de celdas contra listas (H-3), que ahora también cubre las subfilas por cuenta.

**Paso 3 · 422, el Hub de todos.** Verificación: sus dos tests del ADR 0048 y el recorrido del gerente con alcance limitado.

**Paso 4 · Blindar lo que ya está (H-4).** Los dorados de Comercial y del semáforo, y que WhatsApp consuma el registro.
Con esto, "el frontend no miente" queda garantizado por tests y no por revisión.

**Paso 5 · MCP: 411 F3 (guardián de cobertura), después F5 y el 383 con clientes reales.**
F3 antes que más acciones, por H-5. Reescribir `docs/mcp.md` §7 en ese commit (H-6).

**En paralelo, y solo tú (carril H):** llevar Q-1 a Q-9 y DM-8 a Michael y Paid Media, conseguir el Excel de una semana cerrada,
y sentarte con Daniel Tovar a usar el Hub comercial. Sin esto, 417, 418 y 421 no se mueven, y el Hub comercial sigue sin su
prueba de aceptación.

**Después:** 401 (migraciones, una por una con despliegue previo), 376 (ADR primero), 350, 248, 390, 358 y 359.

## 6. Decisiones que necesito de ti

| # | Pregunta | Mi recomendación y por qué |
|---|---|---|
| D-1 | ¿Hoy, Comercial y Dinero migran a la Cifra antes de seguir con Pauta, o después? | **Antes** (paso 1). Mientras convivan dos formas, cada ticket nuevo de Pauta agranda la diferencia, y Gerencia abre Hoy y Dinero, no Pauta |
| D-2 | ¿Las explicaciones viven en la ficha del registro (como pide el 419) o se queda el archivo aparte? | **En la ficha.** Un concepto, un lugar (N1); el archivo aparte ya cubre solo Pauta |
| D-3 | ¿`test:humo` entra al CI? | **Sí, al menos en el checkpoint.** Dos tickets del Hub se cerraron sin correrlo y es la única prueba de interacción que hay |
| D-4 | ¿El 411 sigue antes que el resto del Hub? | **F3 sí (es chico y frena la deuda), F4 y F5 después del paso 3.** La prioridad que diste el 9-nov era desbloquear la escritura, y eso ya está |
| D-5 | ¿Se abre ticket para H-7? | Sí |

## 6 bis. Lo que se decidió y dónde quedó anotado (13-nov, misma sesión)

**Mani respondió D-1: sí, antes.** Hoy, Comercial y Dinero pasan a la Cifra antes de seguir con Pauta. Y pidió no abrir tickets
de cero donde ya hay uno que cubra. Por eso no hay tickets nuevos: cada hallazgo quedó como enmienda, con su detalle y sus
casillas, en el ticket que ya era su dueño.

| Hallazgo | Dónde quedó | Qué se anotó |
|---|---|---|
| H-1 La Cifra solo en Pauta | **419**, "Enmienda del 13-nov" | Inventario por archivo, decisiones DC-1 a DC-4, fases E-0 a E-8, riesgos, quién y en qué orden |
| H-2 `/hub` con la Pauta vieja | **422** y 419 E-4 | La costura entre los dos y el orden |
| H-3 Celdas sin verificar contra su lista | **414**, casilla nueva | Test exhaustivo por `ClavePautaSemanal`, incluidas las subfilas por cuenta |
| H-4 Guardianes solo propuestos | **390** (show, sin resultado, dorados de Comercial) y **358** (WhatsApp consume el registro; ADR contra diccionario) | Molde de cada test y qué línea del contrato pasa de 🟡 a 🔒 |
| H-5 Cobertura del MCP | **411**, "F3 en detalle" | Las server actions clasificadas por nombre, cómo se construye el guardián y el orden de las acciones pendientes |
| H-6 `docs/mcp.md` se contradice | **411**, misma sección | Se arregla en el commit de F3 |
| H-7 Re-agenda al deshacer | **368**, "Hallazgo del 13-nov" | Qué pasa, por qué, dos caminos para decidir |
| H-8 Inbox infiere «Sin UTM» | **359**, casilla nueva | El arreglo y las dos excepciones que se borran del guardián |
| Higiene (403, 367, 368, checkpoint) | `docs/plan-reparto.md` §4, "Reordenada el 13-nov", paso 0 | Qué, por qué y cómo se verifica |
| Orden y reparto para dos personas | `docs/plan-reparto.md` §4, misma sección | Orden por carril (propuesto), costuras, prueba de costura y los dos prompts |
| Memoria de la sesión | `docs/agents/handoff.md`, entrada del 13-nov y prompt de arranque | — |

**Respondidas por Mani el mismo día:** el botón Info de cada pestaña se retira (la explicación de cada cifra lo reemplaza); el
universo vive en la cifra y se pinta como en el boceto; los desgloses pasan a la cabecera de la lista; Mi espacio usa el universo
"tuyas"; y el 368 va por la regla puntual. Detalle en el 419 ("Respondidas por Mani") y en el 368.

D-2 (el texto vive en la ficha) quedó como regla del 419 E-1, porque ya era la del diseño. D-3 (`test:humo` en el CI) y D-5
(camino del 368) siguen abiertas y están en la tabla de decisiones de `plan-reparto.md`. D-4 quedó en el orden propuesto: del 411,
F3 primero.

## 7. Lo que este reporte no cubre

- No comparé ninguna cifra del Hub contra producción ni contra el MCP. La mejor prueba pendiente del frente de métricas es
  esa: la misma pregunta en el Hub, en el MCP y en el mensaje de WhatsApp, para un programa y un periodo cerrado.
- No leí completos `docs/hub.md` §2 a §8 ni las entradas del handoff anteriores al 9-nov.
- La cobertura del MCP en H-5 es por nombre de server action, no un cruce uno a uno con cada rol.
