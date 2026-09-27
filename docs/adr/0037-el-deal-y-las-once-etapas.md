# 0037 — El Deal es el objeto central: once etapas y un solo motor que las mueve

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (consolida las decisiones del 22 y el 24-sep y los
ADR retirados 0010, 0021 y 0027) · **Estado:** aceptado; las once etapas y la tabla de transiciones
se validaron con los closers y Mani las adoptó el 24-sep

## El problema

El modelo del MVP era `persona → llamada → venta → abonos`: la forma del **registro** que hace un
closer al colgar, no la de la **oportunidad** que trabaja durante dos semanas. Ninguna fila contestaba
*"¿en qué va este lead?"*, no había embudo, el responsable era de la persona (y nunca se usó: 0 filas)
y `sales` no sabía nada de lo que pasó antes.

## Decidimos

**1. El Deal es la oportunidad de venderle un programa a un Lead.** Tiene dueño, etapa, producto,
cohorte, envío de origen e historial. **Máximo un deal abierto por lead y programa**, garantizado por
el índice parcial `deals_uno_abierto_por_lead_y_programa_idx` (excluye Completo, Cierre Perdido y
los anulados, ADR 0038). Los cerrados se quedan: reaplicar después de un Cierre Perdido abre un deal
**nuevo** y la ficha muestra los anteriores.

**2. `sales` se eliminó.** Un deal tiene una sola venta, así que la venta **es** el deal: una venta es
un deal en **Abonado o Completo**, nunca un deal a secas. El ticket es el precio del producto
(ADR 0016). Una segunda venta a la misma persona es otro deal.

**3. Las once etapas son un `pgEnum`,** porque el código decide con ellas (embudo, Students, cartera,
movimientos automáticos). El número es un nombre, **no el orden**:

| # | Etapa | Entra cuando | La mueve |
|---|---|---|---|
| 1 | Pendiente Setteo | calificó pero no agendó, o deal a mano | sistema / closer |
| 2 | En Contacto | el dueño registra el primer contacto | closer |
| 4 | Agendado | hay una llamada con fecha | sistema / closer |
| 3 | Pendiente Re-agenda | la llamada falló o hace falta otra, siempre con motivo | sistema / closer |
| 5 | Atendido | la llamada ocurrió (se pegó el Grain) | sistema |
| 11 | Seguimiento | la llamada ocurrió y hay que volver a contactarlo | closer |
| 6 | Compromiso Verbal | dijo que sí: producto y fecha límite de pago (ADR 0053) | closer |
| 7 | Abonado | entró el primer pago y queda saldo | sistema |
| 8 | Completo | saldo en cero | sistema |
| 9 | Próxima Cohorte | quiere entrar, pero en la siguiente (con cohorte destino) | closer |
| 10 | Cierre Perdido | dijo que no; motivo obligatorio | closer |

El enum de la base tiene hoy diez valores; Seguimiento entra con el ticket 043. **El setteo vive en
el deal** (decidido el 22-sep): un lead de Setteo abre un deal en la etapa 1.

**4. `moverEtapa()` es el ÚNICO camino para cambiar `deals.etapa`** (`lib/deals/etapas.ts`, ticket
045). Contesta dos preguntas: *¿este deal puede pasar de A a B?* y *si no, ¿qué requisito le falta?*.
Valida, escribe el historial y devuelve el requisito que falta. Hay tres escritores (la ingesta, el
closer y el sistema al registrar un abono o una llamada), y si cada uno implementara el requisito
divergirían en silencio: es lo que ya pasó con el saldo (ADR 0024) y con la vigencia (ADR 0026). Un
guardián (ticket 046) falla si aparece un `update(deals).set({ etapa })` fuera del motor.

**5. La tabla de transiciones** (T1 a T29 sin la T11, que se reemplazó, más P, R, A1 y A2) vive en `docs/structure.md`, con
qué dispara cada una, quién la mueve, qué requisito exige y por qué existe. Reglas generales:

- **Un deal, muchas llamadas, nunca duplicado.** Una llamada nueva de un lead con deal abierto se
  agrega a ese deal y se avisa al dueño; en 1, 2, 3, 9 u 11 el deal pasa a Agendado; en 5, 6 o 7 la
  etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no
  infla ninguna tasa.
- **Re-agenda siempre lleva motivo. Completo es terminal. Abonado sí se puede perder** (lo abonado
  sigue contando en la caja).
- **No hay relojes:** lo vencido no se mueve solo; se pinta y cae al Inbox, y el closer decide.
- **Ninguna regla compara números de etapa** ("4 o más" no significa nada); toda regla nombra las
  etapas una por una.
- **Todo movimiento queda en `deal_etapa_historial`** con quién, cuándo y motivo. Sin eso no existen
  el tiempo en etapa ni la conversión etapa a etapa, y no se pueden reconstruir después.

**6. El dueño es de la oportunidad, no de la persona** (`deals.owner_user_id`, FK a `users`). Los deals
nacen sin dueño y un closer los **reclama** desde el Inbox (el reparto por turno de la hoja se retira,
confirmado por los closers el 24-sep). Un gerente asigna y reasigna. "Sin dueño" es un estado válido.
Excepción: un Agendado cuyo host de Calendly es closer registrado en el programa nace con ese dueño
(ADR 0049).

**7. Derivados, nunca guardados:** lo abonado, el saldo, "es Student" (etapa Abonado o Completo) y la
comisión (tasa del programa × precio del producto) se calculan (ADR 0024).

**8. Deals históricos:** el CRM abre deals solo para leads nuevos desde el corte. Los leads viejos de
Setteo entran con la migración de la etapa 7, respetando su estado de gestión, no como ~2.400 deals
iguales en Pendiente Setteo.

## La lección que se conserva del ADR 0027

**Nada de emparejar por heurística.** Persona + cohorte + cercanía de fecha acierta casi siempre y,
cuando falla, mueve la cosa equivocada sin avisar. Si dos hechos están relacionados, la relación se
**escribe**. En este modelo es estructural: la llamada y el abono cuelgan del deal.

## Abierto

- **D3:** hoy Abonado ocupa el cupo del lead y bloquea un segundo deal (upsell, mentoría) en el mismo
  programa. Depende de si venden una segunda cosa a la misma persona (`docs/plan.md` §7).

## Descartado

| Alternativa | Por qué no |
|---|---|
| Conservar `sales` y colgarle la etapa | Dos objetos donde el negocio ve uno |
| Etapas como catálogo editable | El código sí decide con ellas: sería un enum sin garantía |
| Un pipeline por programa | Un embudo comparable vale más; si un programa necesita otro, se abre con su ADR |
| El setteo como cola antes del deal (D1-B) | Mani decidió el 22-sep que vive en el deal |
