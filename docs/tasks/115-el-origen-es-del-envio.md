---
id: 115
etapa: E6
serves: "ADR 0060 · plan.md §7.1 D5"
depends: []
status: en curso
---

# 115 — El origen es del envío; el deal recuerda el envío que lo abrió

## Objetivo

Que ninguna cifra ni pantalla muestre un origen que no vino de un clic real, y que cada venta tenga una
sola campaña de origen (ADR 0060).

## Alcance

- **Dentro:** `aplicarReglaDeDeal` (`lib/ingesta/regla-de-deals.ts`) pasa a `abrirDeal` el id del envío
  que disparó la regla (`submissionOrigenId`). El alta manual y el importador histórico (078) pasan el
  envío más reciente del lead, o nulo si no hay.
- **Dentro:** relleno de los deals vivos sin origen (58 al 29-sep): el envío del lead más reciente con
  `fecha_envio` anterior o igual a la creación del deal. Por script, con `actorDelScript()` y el ok de Mani
  antes de escribir en producción.
- **Dentro:** `lib/queries/kanban.ts` y `lib/queries/inbox-sin-dueno.ts` leen el origen del deal (join
  por `submission_origen_id`), no `leads.utm_*`.
- **Dentro:** `resumirEnvios` deja de calcular UTM, y una migración quita `leads.utm_source`,
  `utm_medium` y `utm_campaign` **después** de mover los lectores (la sesión principal la genera y la
  aplica; se lee el SQL).
- **Fuera:** el emparejador (084, 085) y las métricas de pauta (088, 093): ya nacen leyendo envíos.
- **Fuera:** la pantalla de separar o confirmar duplicados (050, 072). Anotado para ese ticket: la usa
  también el closer (Mani, 29-sep).

## Done cuando

- [x] Un test: lead con dos envíos de UTM distintas; el deal que abre el segundo tiene como origen **ese**
      envío completo, y ninguna consulta devuelve una combinación de los dos.
- [x] Un test: lead con deal en Completo que vuelve a enviar abre un deal nuevo cuyo origen es el envío
      nuevo; el deal cerrado no cambia.
- [x] `grep` sin resultados de lecturas de `leads.utm` en `lib/`, `app/` y `components/`.
- [x] Todos los deals vivos tienen `submission_origen_id`, o nulo con motivo (sin envíos), verificado con
      una consulta después del relleno.

## Kiro

Sí para el código y los tests. La migración y el relleno en producción, la sesión principal con el ok de
Mani.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Un deal que abre el envío parcial previo al Calendly (117) tiene ese parcial como envío de origen: es la misma sesión y trae las mismas UTM que su completa.
- El 117 toca también `regla-de-deals.ts` y va después de este ticket.

---

## Avance 2026-09-29 (Mani, sesión principal)

- En `main` (`0413c67`, `625795e`): la regla de deals pasa el envío más reciente del lote que la disparó;
  `abrirDeal` rechaza un envío de otro lead; Kanban, Inbox sin dueño y Ficha leen el origen del deal; la
  ingesta dejó de escribir `leads.utm_*`. El importador del 078 ya pasaba su origen (Alejo, `8898ff1`).
- Relleno aplicado en producción con el ok de Mani: 69 de 69 deals vivos rellenados, 0 sin envíos previos.
  Verificado: 0 deals vivos sin origen de 71, 71 filas en `change_log`, 0 cruzados de lead o programa.
- **Falta:** la migración que quita `leads.utm_source/medium/campaign` (con el ok de Mani, SQL leído).
- Nota: el Inbox sin dueño muestra "Sin UTM" también para un deal sin envío de origen; hoy no hay ninguno.
