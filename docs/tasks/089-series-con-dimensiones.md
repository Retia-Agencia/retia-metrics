---
id: 089
etapa: E6
serves: "plan v2 §12.10.5 · el dashboard que no es estatico"
depends: [064, 085]
status: done
---

# 089 — Las consultas devuelven series con dimensiones, no escalares

## Objetivo

Que el dashboard se pueda filtrar y agrupar **sin reescribir las consultas**. Pedido de Mani: *"creo
que seria bueno si no fuese estatico sino que deja crear vistas y filtros a gusto."*

## La decision, y por que ahora

Un `{ leads: 412 }` **no se puede filtrar por nada**. Una serie con sus dimensiones pegadas —programa,
area, canal, closer, cohorte, fecha— se filtra, se agrupa y se guarda sin tocar la consulta.

⏳ **Es gratis mientras la capa de lectura se escribe (etapa 5) y es una reescritura completa despues.**
Misma clase de ventana que el origen humano del ticket 086.

## Alcance

- **Dentro:** `lib/queries/` devuelve filas con sus dimensiones; la agregacion la hace el llamador.
- **Dentro:** filtros **desde la URL**, que el ADR 0023 ya manda. Compartibles copiando el link, cero
  almacenamiento.
- **Fuera:** vistas guardadas. Se hacen cuando exista la queja de re-armar el filtro, no antes.
- **Fuera:** un constructor de consultas. **No, y probablemente nunca.**

## 🔒 La frontera que no es un filtro

El **programa** no se puede desactivar ni combinar. Ninguna vista, guardada o improvisada, cruza
ComunicArte con Tactical. **No basta con no ofrecerlo en la interfaz: el tipo de la consulta no debe
admitirlo** (ADR 0043 punto 4), igual que el comparativo entre closers del ADR 0023.

## ⚠️ Y la tension que hay que resolver con el ORDEN

Alejo dijo que lo tedioso es *"no saber que decisiones tomar"*. **Un lienzo en blanco de filtros es
exactamente lo contrario:** le entrega el trabajo de averiguar que mirar.

Se resuelve con el orden, no eligiendo uno: **el dashboard abre con la vista opinada** —las metricas
que pidieron, con su estado— y los filtros son la **salida de emergencia**. Puerta de entrada opinada,
techo abierto.

## Done cuando

> ⚠️ **Reemplazado por el "Done cuando" de la enmienda del 30-sep (al final).** Se deja para la historia:
> la primera casilla, aplicada al pie de la letra, obligaba a reescribir `lib/queries/dashboard.ts`.

- ~~Ninguna consulta de `lib/queries/` devuelve un escalar suelto donde habia una dimension.~~
- ~~Un filtro nuevo se agrega **sin tocar la consulta**, demostrado con uno.~~
- ~~El link con filtros aplicados **abre igual en otra sesion**.~~
- ~~Una consulta a la que se le quita el programa **no compila**, con test de tipos.~~

## Kiro

Si, con revision del contrato de salida.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- **Comparativos** (DP-16): cada KPI contra el periodo anterior del mismo largo y contra la cohorte anterior en el mismo día hábil. Es la misma consulta con otro rango: la serie con dimensiones lo hace gratis.

---

## Enmienda 2026-09-30: acotado (Mani)

**Por qué.** La ventana de "gratis" se cerró a medias: el 064 ya escribió `lib/queries/dashboard.ts` con
escalares (`EmbudoDelRango`, `LeadsDelRango`), probado. Reescribirlo es justo el costo que este ticket
quería evitar. Lo que sigue abierto son las consultas que **todavía no existen** (123, 124, 125, 095): el
valor del 089 hoy es fijar el contrato **antes** de que se escriban. El molde ya existe y funciona:
`lib/queries/pauta-interina.ts` (093) devuelve filas con día, UTM y categoría y filtra desde la URL.

**Alcance acotado:**

- **Dentro, el contrato:** un tipo de serie común (filas con dimensiones y medidas) donde `programId` es
  **obligatorio** en la entrada y en cada fila. Sin programa la consulta no compila. Juntar programas lo hace
  solo la función del agregado del 095 (ADR 0048), nunca esta consulta.
- **Dentro, una consulta nueva de hechos del embudo:** una fila por día (Bogotá) × área × canal × dueño ×
  cohorte, con envíos, agendas, shows y ventas.
  - Área y canal salen de `emparejar()` (085) sobre el envío de origen del deal (115). Es su primer llamador
    real. "Sin UTM" y "sin clasificar" son valores de la dimensión, separados (ADR 0045), no filas perdidas.
  - El dueño es `deals.owner_user_id`, **nunca** el texto `closer_id` (ADR 0030).
  - La venta y su fecha salen de la MISMA definición que el dashboard (`vendidosEn`: primera entrada a
    Abonado o Completo). Si hay que moverla para compartirla, se mueve; no se copia.
  - Todo por `vigente()`.
- **Dentro, la demostración:** un filtro por área en la URL del dashboard, aplicado sobre la serie sin tocar
  la consulta.
- **Dentro, gratis:** el comparativo del DP-16 es la misma consulta con otro rango. Se deja un helper que dé
  el periodo anterior del mismo largo; la pantalla del comparativo es del 095.
- **Fuera:** reescribir `dashboard.ts`. Sus escalares migran a la serie cuando el 123 o el 095 los toquen.
  **Fuera:** la meta y la meta dinámica, que son de la cohorte (ADR 0022, 0023) y no una dimensión. **Fuera:**
  vistas guardadas y constructor de consultas (como antes).

**Done cuando (reemplaza al original):**

- [x] Existe el tipo de serie y un test de tipos (`@ts-expect-error`) prueba que la consulta sin `programId`
      no compila.
- [x] La consulta de hechos cuadra con el dashboard actual en el mismo rango y programa: sus agendas, shows y
      ventas sumadas dan lo mismo que `embudoDelRango`, con test.
- [x] Un envío con UTM de un canal cae en su área; uno sin UTM y uno sin clasificar caen en sus dos valores
      separados; un deal de otro programa no aparece; un deal anulado no cuenta. Con test.
- [x] Una venta de un dueño `mani` y otra de `Mani` son UN solo dueño en la serie, con test.
- [x] El filtro por área en la URL recorta la serie sin tocar la consulta, y el link abre igual en otra sesión.

---

## Cierre 2026-09-30 (Mani, sesión 58)

**Qué se hizo.** Lo implementó Codex y lo revisó Claude.
- `lib/queries/serie.ts`: `Serie<D, M>` (cada fila lleva `programId`), `AlcanceDeSerie` con `programId` obligatorio y
  `periodoAnterior` (el comparativo del DP-16; la pantalla es del 095).
- `lib/queries/hechos-embudo.ts`: `hechosDelEmbudo(db, { programId, rango })`, una fila por día (Bogotá) × área ×
  canal × origen × dueño × cohorte con envíos, agendas, shows y ventas. Área y canal por `emparejar()` sobre el envío
  de origen del deal (árbol de Meta vacío hasta el 120). `origen` separa `sin_utm`, `sin_clasificar` y
  `sin_envio_origen`.
- `lib/queries/dashboard.ts`: `fechaAnclaCall` exportada; `ventasConDiaEn` al lado de `vendidosEn`, las dos armadas
  con las mismas piezas (`esMovimientoDeVenta`, `diaDeVenta`, `vendidoEnElRango`).
- Dashboard: `?area=<uuid>` recorta la serie en la página, sin tocar la consulta; tarjeta mínima "Serie del embudo".

**Qué se decidió (Mani).** Agendas y shows por la fecha de la llamada (`coalesce(fechaAgenda, fechaLlamada)`), la
misma del embudo, para que cuadren; la fecha en que se agendó queda como otra medida cuando la pida el 123. Dueño =
`deals.owner_user_id`; una llamada suelta sale "sin dueño". Cohorte = la del deal; un envío no tiene cohorte.

**Qué quedó.**
- 🧪 El guardián de vigencia no lee subconsultas (`.as(...)`) y las marca: por eso las ventas no se leen desde una
  subconsulta y el día de la venta se une en memoria.
- Los envíos se agrupan en SQL también por `respuestas` (jsonb), así que en la práctica sale una fila por envío. A
  ~5.000 envíos no pesa; revisar si el volumen crece ×10.
- La tarjeta es solo la demostración del filtro; la pantalla de verdad es del 095.
- Verificado: 1.685 tests, typecheck, lint y build limpios; recorrido en la base local (3 ventas cuadran con el
  comparativo de closers; `?area=` con un uuid recorta a 0, uno inválido se ignora; consola limpia).
