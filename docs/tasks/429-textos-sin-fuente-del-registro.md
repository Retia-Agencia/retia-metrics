---
id: 429
etapa: hub
serves: "Mani, 13-nov (carril D): lo que el 419 E-1 dejó con el texto de §2.2 y sin fuente en el diccionario · N8 (ADR 0115)"
depends: [419]
status: todo
---

# 429 — Tres textos del registro que no tienen fuente

## Por qué

El 419 E-1 pasó el texto de cada explicación a la ficha del registro. Tres quedaron con el texto aprobado en
`docs/diseno-cifra-y-pauta.md` §2.2 pero **sin una fila del diccionario que los respalde** (ticket 419, "Avance"). Un texto sin fuente
es el caso que el ADR 0115 N8 prohíbe: la ficha dice una cosa y nadie puede decir de dónde sale.

## Los tres puntos

1. **Envíos: ¿solo completos o también parciales?** El diccionario (`docs/metricas.md`) se contradice. Es la duda de Daniel Tovar en el
   weekly del 3-nov (`docs/weekly-2026-11-03.md`, "→ 397"; `docs/tasks/372-comercial-con-su-periodo-y-parciales-aparte.md`). Hay que medir
   cuál cuenta hoy el código (`lib/queries/hechos/`), decidir la definición y reescribir una sola fila; la cifra y el texto salen de ella.
2. **Compensación exacta de `objetivo_semana`.** El texto cita "la regla del 146" y la fila del diccionario no la escribe. Hay que leer
   la función que la calcula (`lib/metricas/pendientes.ts`, concepto `objetivo_semana`), escribir la regla con un ejemplo numérico en
   el diccionario y copiarla a la ficha.
3. **`agendas_meta` (agenda del pixel de Meta).** Quedó como variante de `costo_agenda_meta` según el mapa del 419, pero es otro número.
   Si se pinta solo en alguna pantalla, merece clave propia en el registro y su fila.

## Decisiones abiertas (no se asumen)

- **D-1.** Envíos: ¿completos solamente, o completos y parciales con los parciales aparte (como Comercial en el 372)? Decide Mani con
  la medición de (1) delante.
- **D-2.** `agendas_meta`: ¿clave propia ahora, o solo cuando una pantalla la pinte sola?

## Done cuando

- [x] D-1 y D-2 respondidas (14-nov; D-2 recomendada por Claude, confirmable).
- [x] Las tres filas del diccionario reescritas con su fuente, y la ficha igual que la fila en el mismo commit (N8: título del ADR, índice,
      vocabulario de `overview.md` §11). **Hecho el 14-nov (`f2372cc3`); la de Envíos es PROVISIONAL, ver «Hallazgo del 14-nov» abajo.**
- [x] Un test o la prueba existente (`tests/explicacion-sin-jerga.test.ts`, `tests/registro-de-metricas.test.ts`) cubre el cambio; si la
      definición de Envíos cambia una cifra, se detiene y se anota (la regla del 419: ninguna cifra se mueve sin avisar).
- [ ] Tracker y `status:` coinciden (N9).

## Decisiones (14-nov, Mani)
- **D-1: Envíos cuenta completos y parciales, con los parciales aparte**, porque así los recibe el CRM (el formulario manda un parcial cuando la persona se va a mitad). Es la misma regla de Comercial en el 372. Falta medir qué cuenta hoy el código y reescribir una sola fila.
- **D-2 (Mani preguntó qué es): `agendas_meta` es el número de agendas que reporta el pixel de Meta, distinto de las agendas que cuenta el CRM.** Hoy se trata como variante de `costo_agenda_meta` (= gasto ÷ `agendas_meta`), pero el mensaje de WhatsApp lo pinta solo ("agendas Meta N", `lib/reporte-whatsapp/mensaje.ts:111`). Dar "clave propia" es registrarlo como métrica con su nombre, definición y explicación, como cualquier otra. **Recomendación: sí, clave propia**, porque la regla que Mani aprobó el 13-nov es "todo lo visible, registrado" y esta cifra ya es visible sola. Queda así salvo que Mani diga que no.
- Brief: `docs/agents/briefs-codex-14-nov.md`, B-6 (casi todo documentos).

## Hallazgo del 14-nov (tarde): D-1 contradice lo que cuenta el código — DECIDE MANI
**Qué se midió.** Envíos cuenta HOY solo formularios completos: `lib/queries/hechos/envio.ts:104` aplica `eq(submissions.esParcial, false)` y la
suma sale de la línea ~128. Los parciales no se muestran aparte en Envíos. El diccionario (`docs/metricas.md`, filas de Envíos) decía «completo o parcial»,
contra el código. Comercial sí separa los parciales (`lib/queries/embudo-comercial.ts:83`, `filtroDealsD…`, ticket 372).
**Lo que se hizo (sin mover ninguna cifra):** Codex se detuvo a propósito al ver la discrepancia (regla del brief); yo decidí documentar lo que el código hace:
fila de Envíos = «formularios completos; los parciales no entran en este número», con la nota «Pendiente de Mani: D-1 pidió completos y parciales con los parciales
aparte». Reescritas la fila de `docs/metricas.md` (~232 y ~307), la ficha de `lib/metricas/registro.ts` (~1090) y el vocabulario de `docs/overview.md` §11 (~449).
También quedaron: regla exacta de `objetivo_semana` con el ejemplo 7 ÷ 3 = 2,33 (`metricas.md` ~358, `registro.ts` ~1232: la compensación ocurre DENTRO de la semana) y
`agendas_meta` con clave propia (`registro.ts` ~946, `pendientes.ts:31` apunta a `"agendas_meta"`, vocabulario «Agendas según Meta», fila de `metricas.md` ~418).
**La decisión que falta (una sola pregunta para Mani):** ¿Envíos queda como completos solamente (con los parciales aparte en Comercial) o debe contar completos y parciales
con un desglose?
- **A (recomendada):** dejar Envíos = completos, cerrar D-1 como «completos; los parciales se miden aparte en Comercial (372)». No mueve nada; solo se quita la nota «Pendiente».
- **B:** cambiar el hecho de envíos para contar los dos con parciales aparte. Mueve cifras: exige consulta nueva, dorados y aviso (regla del 419: ninguna cifra se mueve sin avisar).
**Qué cierra el ticket:** la respuesta de Mani, quitar la nota provisional de las tres filas (`metricas.md`, `registro.ts`, `overview.md` §11) en el mismo commit (N8) y marcar tracker y `status:` (N9).
**Hueco relacionado, medido el 14-nov:** `agendas_meta` quedó declarada en `lib/mcp/cobertura.ts` con la razón «Cifra de resumen_del_hub» (el tipo `RazonSinLista` solo admite esa o «Se pide por consultar_hechos»),
pero `resumen_del_hub` NO devuelve hoy ninguna cifra de pauta (ni costos ni agendas Meta): el MCP no puede consultar `agendas_meta` todavía. `TOPE_DE_CONCEPTOS_SIN_LISTA_DEL_MCP` subió de 48 a 49.

## Respondido por Mani (14-nov, noche): opción B
**D-1: Envíos cuenta completos y parciales, y se muestran las dos cifras** (Envíos completos y Envíos parciales, cada una con su lista).
Mueve cifras: el total de Envíos deja de ser solo completos. Falta el código, en un solo commit (N8): el hecho de envíos (`lib/queries/hechos/envio.ts:104`)
con el desglose por `es_parcial`, la cifra de parciales con su ficha, quitar la nota «Pendiente de Mani» de `docs/metricas.md` (~307), `lib/metricas/registro.ts`
(~1090) y `docs/overview.md` §11, los dorados que cambien y el aviso de qué número se movió (regla del 419). No se hizo en este commit porque
`registro.ts` y `metricas.md` los está editando la sesión de las fichas de Comercial; va después.
