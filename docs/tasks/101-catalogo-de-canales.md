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
