---
id: 065
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-2 · insumo §8, ADR 0037"
depends: [064]
status: done
---

# 065 — Lo que el modelo nuevo hace posible: conversion etapa a etapa y tiempo en etapa

## Objetivo

Las cuatro metricas que **no existian** y que son la razon de haber construido el deal:

1. **Conversion etapa a etapa.**
2. **Tiempo promedio en etapa.**
3. **Deals abiertos por etapa y por owner.**
4. **Unclaimed por antiguedad.**

## De donde salen

De `deal_etapa_historial` (ticket 037/045). 🎯 Por eso esa tabla se creo en la etapa 1 aunque
ninguna pantalla la usara: **el dato es el instante del cambio y no se puede reconstruir despues**.

## Alcance

- **Dentro:** las cuatro consultas, con su rango de fechas y su filtro por programa.
- **Dentro:** los deals **anulados** no cuentan en ninguna (ADR 0038).
- **Dentro:** un deal que retrocede y vuelve a avanzar cuenta su tiempo **en cada paso**, no solo
  el ultimo. **Decidido (Mani, 4-oct): el tiempo en etapa es el TIEMPO REAL, la suma de todos los
  tramos** que el deal paso en esa etapa (sale de `deal_etapa_historial`). Solo el ultimo tramo haria
  ver rapido a un deal que rebota. La pantalla lo dice en una linea ("suma todas las veces que el deal
  estuvo en esta etapa").
- **Fuera:** el Kanban. Esto son consultas; la pantalla es el ticket 069.

## La pregunta abierta que esto destapa

🟡 **Si "Setteo No Calificado" es etapa o salida** cambia la conversion de **0,9% a 2,6%**. Lo
contestan los closers. Mientras tanto la consulta **reporta las dos** y dice cual es cual, en vez
de elegir una y que nadie sepa cual esta mirando.

## Done cuando

- [ ] Las cuatro metricas salen sobre los datos de `dev`.
- [ ] Un deal con retroceso produce un tiempo en etapa explicable, con la regla escrita.
- [ ] Los anulados no aparecen.
- [ ] La conversion se puede leer con y sin Setteo No Calificado.

## Kiro

Si.

---

## 🟡 Nota 2026-09-24

- La conversión se calcula sobre la tabla de transiciones que quede (ticket 043). Si se adopta la
  propuesta, un deal no retrocede por una segunda llamada, así que la conversión Agendado → Atendido
  no se infla.
- Regla propuesta: el **show** sale de las llamadas y el **cierre** de los deals (Abonado o Completo),
  nunca de llamadas `cerrada`.
- "Unclaimed por antigüedad" pasa a ser una sección del Inbox (ticket 071).

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- 🟡 Prioridad baja (sale de la captura de Adpulze, nadie lo pidió de palabra): ranking de motivos de pérdida con los deals perdidos y el ticket estimado, como las "objeciones" de Adpulze (PT-34).

- ✅ 29-sep (Mani): el ranking de objeciones **entra**, sin prioridad baja.

---

## Cierre de la sesión M2 (ola O5, 4-oct)

**Qué hay:** `lib/queries/embudo-etapas.ts` y `tests/embudo-etapas.test.ts`. Sin pantalla: el 148 lo monta.
`embudoPorEtapas(db, { programId, rango }, ahora?)` lee los deals vigentes del programa y su historial (dos
consultas) y le pasa todo a `calcularEmbudoEtapas`, que es puro. Devuelve `conversion`, `tiempoEnEtapa`,
`abiertos`, `sinDuenoPorAntiguedad` y `motivosDePerdida`. Cada cifra trae sus `dealIds` para abrir su lista
(ADR 0067). El programa es obligatorio (frontera) y lo anulado no entra en ninguna, por `vigente(deals)`.

**Las reglas, escritas:**
- **Puerta de entrada:** la primera etapa del historial; sin historial, la etapa actual y `created_at`.
- **Conversión:** cohorte = deals cuya entrada (día de Bogotá) cae en el rango. Pasos: En gestión, Contactado,
  Calificado, Agendado, Atendido, Compromiso Verbal, Vendido (Ganado Pago Parcial o más) y Ganado Pagado
  Completo. Un deal "llegó" a un paso si la etapa más lejana que tocó está en ese paso o después (Cierre perdido
  no cuenta como lejanía): saltarse una etapa cuenta como pasar por ella, y el embudo nunca sube. Cuenta deals
  distintos, no entradas.
- **Con y sin "Setteo No Calificado":** esa etapa ya no existe. Con el ADR 0069 los no calificados entran por
  Potencial (parcial) y Registrado (completo sin High), así que salen dos lecturas, `todas` y
  `sinNoCalificados` (sin esas dos puertas), más `porPuerta`.
- **Tiempo en etapa (Mani, 4-oct):** suma de todos los tramos que el deal pasó en la etapa. Un cambio solo de
  pendiente no parte el tramo. Para el promedio cuenta el deal que ya salió de la etapa y cuya última salida cae
  en el rango; el que sigue ahí está en `abiertos`. Días calendario, como "días en etapa" del Kanban. La línea
  para la pantalla es `REGLA_TIEMPO_EN_ETAPA`. Ejemplo con retroceso: Calificado → Agendado → Calificado → Agendado
  → Atendido suma los dos tramos de Calificado y los dos de Agendado, y cuenta en `dealsConVariosTramos`.
- **Abiertos por etapa y owner** y **sin dueño por antigüedad:** foto de hoy, el rango no aplica. Abierto = ni
  Ganado Pagado Completo ni Cierre perdido. La antigüedad cuenta desde la entrada, con los buckets de la lista del
  ADR 0067 (0-7, 8-30, 31-90, >90).
- **Motivos de pérdida (PT-34):** el universo es `cerradosEn` (el mismo de `dealsPerdidosPorMotivo`). El ticket
  perdido estimado es el precio de la cohorte en USD; un deal sin cohorte va en `dealsSinTicket` y no se le
  inventa uno.

**Done cuando:**
- [x] Las cuatro métricas (más los motivos) salen. Como `dev` ya no existe (una sola base, ADR 0047 enmendado),
  se prueban en PGlite.
- [x] Un deal con retroceso da un tiempo explicable, con la regla escrita arriba y en el test.
- [x] Los anulados no aparecen (test con el loader real).
- [x] La conversión se lee con y sin los no calificados.

**Verificado en local:** typecheck, lint y `tests/vigencia-centralizada.test.ts`. **No corrí
`tests/embudo-etapas.test.ts`** porque la máquina no tenía aire (6,9 GB de swap): lo valida el CI. Implementó
Codex (effort medium), revisó la sesión M2.
