---
id: 314
etapa: hub
serves: "Alejo (Alertas Paid Media, 26-oct): separar lanzamiento de pauta de agenda en el semáforo · Mani, 26-oct: las campañas nuevas se clasifican desde WhatsApp · enmienda HQ-4"
depends: [258, 267]
status: doing
---

# 314 — Campañas de agenda y de lanzamiento en el semáforo

## Por qué

El costo por agenda del semáforo divide el gasto de **todas** las campañas del programa entre las agendas de Meta
(HQ-4, 15-oct; `NOTA_HQ4` en `lib/semaforo/costo-por-agenda.ts`). Las campañas de lanzamiento ("Registro
Lanzamiento · Comunicarte", "Registros · Tactical Investor Week") buscan **registros**, no agendas: siempre salen con
0 agendas e inflan el costo. Cierre del 25-oct: Comunicarte $179.385 con todo, $114.845 sin el lanzamiento; Tactical
$103.544 contra $91.181. Con los USD 5k que Pauta quiere ponerle al lanzamiento de Comunicarte, el rojo dejaría de
decir algo. Alejo, 26-oct: "mejor aparte".

**Meta no las distingue:** las 10 campañas activas del 26-oct tienen `objetivo = OUTCOME_LEADS` (medido en
producción). Solo el nombre las separa, y un nombre de campaña escrito en el código es el olor del contrato C-1
(`docs/hub.md` §8). Por eso la clasificación es un **dato de cada campaña** (ADR 0012) que decide una persona, y el
sistema le pregunta por WhatsApp cada vez que aparece una nueva, para que nadie tenga que revisar el CRM.

## Alcance

### Dato

- Migración: `pauta_objetos.proposito`, `pgEnum("proposito_campana", ["agenda", "lanzamiento"])`, **nulo = sin
  clasificar**. CHECK: solo una campaña lo lleva (`proposito is null or nivel = 'campana'`), como `objetivo`. Sin
  backfill: las campañas de hoy arrancan sin clasificar y se clasifican por el mismo camino que una nueva.
- `origen_cambio` gana el valor `whatsapp`.
- **La sincronización nunca lo toca:** `sincronizar.ts` no lo pone en `values` ni en el `set` del
  `onConflictDoUpdate`. Test: una campaña clasificada sigue clasificada después de sincronizar.
- Toda la lógica de la clasificación vive en un módulo, `lib/pauta/proposito.ts`: leer, escribir y el código corto.

### Cálculo (`lib/semaforo/costo-por-agenda.ts`)

- Las campañas se agrupan en dos: **agenda** (`agenda` **y sin clasificar**) y **lanzamiento**.
- **El costo por agenda, su color, la comparación, la racha y la trayectoria salen solo del grupo de agenda.** Gasto
  de agenda ÷ agendas Meta de esas campañas.
- **Una campaña sin clasificar cuenta como agenda.** Es lo que pasa hoy, así que nada sale del costo sin que una
  persona lo decida. Al revés, una campaña de agenda escondida por error bajaría el costo sin que nadie lo vea.
- El gasto manual de área Paid (sin campaña) cuenta como agenda.
- La clasificación se lee al calcular, no se guarda con el gasto: reclasificar cambia también los días pasados, así
  que "ayer a esta hora" y la racha se comparan con la misma regla.
- `CostoPorAgenda` gana `lanzamiento: { gasto, campanas[] }` y `gastoTotal`, y cada campaña gana `codigo` y
  `proposito` (`agenda | lanzamiento | null`). Sale la nota `NOTA_HQ4`.

### Mensaje (`lib/reporte-whatsapp/mensaje.ts`, contrato en `contrato.ts`)

Por programa, en este orden (molde aprobado por Mani el 26-oct; cifras del cierre del 25-oct):

```
*Comunicarte*
🆕 Campañas nuevas: ¿agenda o lanzamiento?
#4521 Posts IG Rosario · $38.000 COP
#8830 Invite · Collab · $63.240 COP
Responde citando este mensaje, por ejemplo: agenda 4521, lanzamiento 8830
🔴 Costo por agenda: $114.845 COP · 35% más caro que la meta
Meta $85.000 COP · aceptable $105.000 COP
Gasto de agenda $574.226 COP · agendas Meta 5 · CRM 5
• #2210 Metodo · Rosario · Agenda…: $215.492 COP · 0 ag · sin agendas
• #7731 Invite: $182.662 COP · 2 ag · $91.331 COP c/u
Ayer a esta hora: …
🚀 Lanzamiento: $322.697 COP
• #5102 Registro Lanzamiento: $322.697 COP
Gasto total del programa: $896.923 COP
```

- **El bloque 🆕** lista las campañas sin clasificar con gasto ese día y se repite en cada envío hasta que alguien las
  clasifique. Sin campañas nuevas, no sale.
- **El código `#NNNN`** es el final del `id_meta` de la campaña: 4 dígitos, o más si dos campañas del mismo programa
  chocan. Va en cada línea de campaña, también en las ya clasificadas, para que un error se corrija igual que se
  clasifica (`lanzamiento 7731`).
- **🚀 Lanzamiento** sin color ni costo (la métrica de registros queda pendiente de Pauta). Sin campañas de
  lanzamiento, el bloque no sale, y tampoco "Gasto total".
- "Gasto total del programa" = agenda + lanzamiento. Conserva lo que pidió HQ-4 (ver todo el gasto).
- Pie: "Costo por agenda = gasto de campañas de agenda ÷ agendas Meta (pixel). El lanzamiento va aparte y no entra al
  costo." Sale la línea "El gasto incluye todas las campañas del programa".
- El contrato `.strict()` crece con esos campos. Ninguno es de una persona.
- La vista previa de Programa › General usa la misma función, así que cambia sola.

### Clasificar desde WhatsApp

- **CRM:** `POST /api/semaforo/clasificar`, mismo secreto que `/api/semaforo/envios` (`x-semaforo-secreto`, tiempo
  constante, 401 sin cuerpo). Cuerpo validado con zod:
  `{ texto: string, destino: string | null, autor: { nombre: string | null, telefono: string | null } }`.
  Devuelve `{ texto }`, la respuesta que Juanito manda tal cual, o `{ texto: null }` si el mensaje no es una
  clasificación (enmienda del 28-oct). **El parseo vive en el CRM**, igual que el texto del
  semáforo (267): Juanito no interpreta nada.
- **Frontera de programa:** un código solo se busca en los programas cuyo reporte de WhatsApp va a ese `destino`
  (nulo = el grupo por defecto). Desde el grupo de SBJ no se puede clasificar una campaña de Retia.
- **Gramática**, sin tildes ni mayúsculas: `agenda` (o `a`) y `lanzamiento` (o `l`, `lanz`) fijan el tipo de los
  números que los siguen. Separadores libres: comas, espacios, saltos de línea, `#`.
  `agenda 4521 7731, lanzamiento 8830` · `a 4521 l 8830`. Un número antes de cualquier palabra, o un código que no
  existe o es ambiguo, se reporta sin abortar los demás.
  **Enmienda del 28-oct (formato estricto):** cada palabra del mensaje tiene que ser un código de 4 o más dígitos
  (`#` opcional) o una marca (`a`, `l`, `agenda`, `lanzamiento`, `lanz`). Si sobra cualquier otra cosa (una palabra,
  una mención `@id`, un número corto), el mensaje **no es una clasificación**: el endpoint responde `{ texto: null }`
  sin tocar la base y Juanito no contesta. 🩸 El 28-oct un comentario de Daniel que citaba el semáforo y mencionaba a
  César pasó como clasificación (la mención es un número largo y la preposición "a" coincidía con la marca) y Juanito
  respondió "No encontré 250 / No encontré 159459485712556"; con un código real, "el 9375 a qué se debe?" habría
  marcado la campaña como agenda sin error.
- **Respuesta:** `✅ Posts IG Rosario → Agenda · Invite · Collab → Lanzamiento. Cuenta desde el próximo semáforo.`
  más una línea `⚠️ No encontré 9999` si aplica. Si no reconoce nada, explica el formato en una línea.
- **Rastro:** cada cambio va a `change_log` en la misma transacción, con el valor viejo y el nuevo
  (`textoDeBitacora`), `origen = 'whatsapp'`, `user_id` nulo y en `etiqueta` el nombre de la campaña y quién lo
  escribió ("Posts IG Rosario · Alejo Carvajal por WhatsApp"). Sin cambio real, no se escribe nada.
- **Juanito** (repo `30X/repos/Juanito`, otro ticket allá): en un grupo de semáforo (`RETIA_SEMAFORO_GRUPO` o un
  `destino` de la última configuración), si el mensaje **cita** un texto que contiene `🆕 Campañas nuevas` o un
  código `#NNNN`, manda el texto al endpoint con el destino y el autor y responde citando con el `texto` que vuelve.
  Desde el 28-oct Juanito ya no filtra el texto: reenvía toda respuesta que cite el semáforo, contesta solo si vuelve
  un `texto` y calla con `null`. Si el CRM no responde, lo loguea y no contesta (ya no puede saber si era una
  clasificación).

## Fuera

- La métrica de registros y el costo por registro del lanzamiento: Pauta tiene que decir qué evento cuenta (lead de
  Meta, registro completo del pixel o envíos del formulario). Hoy solo se lee `invitee_meeting_scheduled`.
- Un selector en Hub › Pauta: no hay tabla de campañas ahí. WhatsApp cubre clasificar y corregir.
- El costo por agenda del Hub (denominador del CRM, ADR 0088) no cambia.

## Done cuando

- Tests de `costo-por-agenda`: lanzamiento no cambia ni costo ni color; sin clasificar cuenta como agenda; agenda +
  lanzamiento = total; reclasificar cambia la comparación de ayer con la misma regla.
- Test de sincronización: la clasificación sobrevive a un `onConflictDoUpdate`.
- Tests del parseo (puros) y del endpoint por la ruta real: 401 sin secreto, frontera de destino, código ambiguo,
  `change_log` con origen `whatsapp`, nada escrito sin cambio.
- `tests/semaforo-endpoint.test.ts` sigue verde con los campos nuevos en la lista blanca.
- Test del mensaje: el bloque 🆕 sale solo con campañas sin clasificar con gasto; 🚀 y total solo con lanzamiento.
- `docs/metricas.md` §3.3 y `docs/hub.md` (HQ-4) dicen la regla nueva; `AGENTS.md` nombra la excepción del endpoint
  en "Nada de la app es público".
- Typecheck, lint y `npm run build` (toca un archivo que importa la vista previa del cliente).
