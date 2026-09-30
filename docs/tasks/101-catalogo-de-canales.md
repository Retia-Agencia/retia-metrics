---
id: 101
etapa: E1b
serves: "ADR 0051 punto 2 · ADR 0043 punto 3"
depends: [083]
status: todo
---

# 101 — El catálogo de Canales (el "Origen" del builder)

## Objetivo

Que cada par `utm_source + utm_medium` sea una fila con su **área**, para que el área de un lead se
derive y el builder ofrezca canales en vez de texto libre.

## Por qué "Canal" y no "Origen"

Ya existe la tabla `origenes` (catálogo del ADR 0015: "agenda del día", "follow-up"), con otro
significado. Dos cosas con el mismo nombre se confunden en el código y en la conversación.

## Alcance

- **Dentro:** tabla por el molde de `lib/catalogo/` (ADR 0012): `utm_source`, `utm_medium`, `area_id`,
  qué significa `utm_content` en ese canal (anuncio, closer, cuenta), `activo`, `change_log`.
- **Dentro:** índice único sobre `(utm_source, utm_medium)`.
- **Dentro:** el seed del catálogo inicial propuesto (documento del 24-sep §3.3), por la función del
  catálogo y con `actorDelScript()` (ADR 0029), **después** de que Alejo confirme las áreas.
- **Dentro:** las reglas para valores históricos (`instagram rosario / linktree`), que clasifican hacia
  atrás sin reescribir el crudo (ADR 0004).
- **Fuera:** escribir el área en `leads` o `deals`. Se deriva.
- **🔴 Qué pasa con `origenes`:** en el modelo de deals su uso (`calls.origen_id`) queda sin sentido.
  Decidir si se retira; no se toca en este ticket.

## Done cuando

- [ ] Dos canales con el mismo par los rechaza el índice, con test.
- [ ] El área de un envío sale del canal, con test, y un par sin canal da "(sin clasificar)".
- [ ] Cada alta queda en `change_log`.

## Kiro

Sí. **La migración la genera y aplica la sesión principal.**


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Siembra con los pares medidos el 29-sep (`docs/analytics.md` §2.1) y con los de la plantilla de Pauta: `fb`, `ig`, `an`, `msg` y `th` con `paid_social`, área Pauta.
- Cada canal **declara qué significan `utm_content` y `utm_term`** (DP-22): `paid_social`, anuncio y placement; `facebook / cpc` (histórico de Retia), conjunto y anuncio; `closer / referido`, el código del closer.
- Las filas de prueba (`prueba`, `test`, `test_url_parameter`) se listan para que el gerente decida; no se adivina un canal.

---

## Decisiones 2026-09-30 (Mani, sesión 54)

- **Un catálogo global**, no por programa: la convención de UTM es la misma en todos (ADR 0051), así que
  `ig / paid_social` significa lo mismo en ComunicArte y en Tactical. Las métricas se siguen cortando por
  programa: el programa viene del envío, no del canal.
- **Comodín de source:** `utm_source` nulo = cualquier source con ese medium. Es para `paid_social`, cuyo source
  lo llena Meta (`{{site_source_name}}`): un source nuevo de Meta no cae en "sin clasificar". El par exacto gana
  sobre el comodín; `canales_par_idx` (sobre `coalesce(lower(trim(source)), '')` y `lower(trim(medium))`) hace
  imposible el empate. Se compara con `lower(trim())`; el crudo no se reescribe (ADR 0004).
- **Formato de content/term: tres valores fijos** (`formato_utm`): `plantilla_pauta` (anuncio, placement),
  `meta_historico` (conjunto, anuncio) y `closer` (código opaco del closer, 086). Es un tipo porque dice EN QUÉ
  CAMPO viene cada cosa, no qué valores valen: los nombres de campaña, anuncio y placement se agrupan como llegan.
  Nulo = no se interpreta.
- **Siembra aprobada** con los pares medidos el 30-sep en producción (`scripts/cargar-canales.ts`). Las filas de
  prueba (`prueba`, `test`, `test_url_parameter`) y `null / linktree` quedan sin canal y **se ven** en
  `/ajustes/canales` con su conteo por programa.
- **Visibilidad de todo UTM:** todo par sin canal sale listado con su conteo y "crear canal".
- **Abierto (PQ9, Pauta):** que manden por escrito cómo agrupan, para confirmar formato y área de cada canal.
- Migración **0047** (tabla `canales`, enum `formato_utm`), aditiva.
