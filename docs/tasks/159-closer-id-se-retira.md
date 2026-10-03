---
id: 159
etapa: después del corte
serves: "ADR 0030, ADR 0011; pregunta de Mani del 2-oct"
depends: [078]
status: todo
---

# 159 — `closer_id` se retira: quién cobró y quién vendió son FK a `users`

## Por qué existe

Mani preguntó el 2-oct si `closer_id` es solo para las hojas. **Hoy no**: es texto copiado (ADR 0030) y el CRM
todavía decide con él en vivo:

- `lib/deals/abonos.ts` sella cada abono con el `closer_id` de la cuenta (`abonos.closer_id`, texto). `abonos`
  **no tiene FK a `users`**, así que es la única marca de quién cobró.
- La caja por closer del dashboard filtra por ese texto (`delCloser` en `lib/queries/metricas-filtros.ts`) y la
  comisión agrupa por `claveDeCloser(users.closerId)` (`lib/queries/comision.ts`).
- Crear un deal a mano con alta del lead lo exige (`lib/deals/crear-a-mano.ts`, ADR 0011): un closer sin
  `closer_id` no puede.
- La migración de las hojas (078) lo usa para reconocer al closer escrito a mano en la hoja (`lib/deals/historico.ts`).

Las llamadas ya tienen la FK (`calls.closer_user_id`, 057) y los deals su dueño (`owner_user_id`). El texto quedó
como herencia del MVP y de las hojas.

**Mientras tanto:** todo closer nuevo se da de alta con `closer_id` (su nombre, una vez). Sin él, sus abonos
salen sin closer y su caja no aparece en el comparativo.

## Objetivo

Después de migrar las hojas, quién registró un abono y a quién cuenta una venta son FK a `users`; `closer_id` deja
de decidir nada y se retira.

## Alcance

1. `abonos.registrado_por_user_id` (FK), relleno desde `closer_id` con `mismoCloser` y sin adivinar: lo que no
   case se lista, no se asigna.
2. Caja por closer, comisión y "crear a mano" leen la FK. `delCloser`, `claveDeCloser` e `igualCloser` quedan solo
   donde se lea historia de las hojas, o desaparecen.
3. `users.closer_id` y su índice salen en una migración aparte, cuando nada lo lea (el guardián de
   `tests/closer-identidad.test.ts` cambia de propósito o se retira).

## Done cuando

- Ninguna lectura que decide (caja, comisión, permisos, crear a mano) usa `closer_id`.
- Un closer dado de alta sin `closer_id` registra abonos y aparece en caja y comisión.
- Las cifras de caja y comisión por closer antes y después del cambio cuadran contra producción.
