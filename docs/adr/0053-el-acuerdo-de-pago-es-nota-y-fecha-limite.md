# 0053 — El acuerdo de pago es una nota y una fecha límite, no cuotas

**Fecha:** 2026-09-24 · **Estado:** aceptado (Mani, tras la reunión con los closers) ·
**Implementación:** etapa 4 del plan v2, ticket 061 · **Enmienda:** ADR 0041 (las cuotas pactadas
salen de v1) · **Toca:** ADR 0013, ADR 0024, ADR 0037 (la "fecha prometida" de Compromiso Verbal)

## El problema

El ADR 0041 decidió guardar lo prometido como filas de `cuotas_pactadas` (número, monto, fecha),
para que la cartera vencida pudiera decir *"le falta la cuota 2, vencía el 5 de octubre"*. Esa
decisión se tomó leyendo las hojas, sin preguntarles a los closers cómo pactan.

En la reunión del 24-sep lo contaron
([transcript](../insumos/fleeting/2026-09-24-reunion-closers-crm.md)):

- **No hay cuotas fijas.** El acuerdo se conversa con cada persona: *"paga el otro 30% en tal fecha y
  el 20% restante en tal otra"*.
- **Hay una regla general:** pagar todo **antes del inicio del programa**; como caso extremo, **a la
  mitad del programa**.
- **Lo que pidieron:** una nota del acuerdo y una fecha límite en el deal.

Pedirle al closer que traduzca una conversación a filas de cuotas es pedirle trabajo que su proceso
no tiene, justo en el momento que ellos mismos nombraron como su dolor número uno (registrar después
de la llamada). Un campo que nadie llena no queda vacío sin más: la cartera vencida calculada sobre
cuotas sin llenar dice "al día" de alguien que no pagó, y **no lanza ningún error**.

## Decidimos

**1. Dos columnas en el deal:** `acuerdo_pago` (texto libre, opcional) y `fecha_limite_pago` (fecha,
Bogotá).

**2. La fecha límite se prellena y se edita.** Por defecto, `cohorts.fecha_inicio_clases` de la
cohorte del deal (o de la cohorte activa del programa si el deal todavía no tiene). El closer la mueve
si pactó otra cosa. Prellenar no es asumir: es el caso común de la regla que dijeron, y queda a la
vista para corregirla.

**3. Cartera vencida = saldo > 0 con `fecha_limite_pago` pasada.** El saldo sigue saliendo de
`lib/queries/saldo.ts` (ADR 0024); la cartera no suma abonos por su cuenta.

**4. La "fecha prometida" de Compromiso Verbal (T12, T25) es `fecha_limite_pago`.** El ADR 0037 y la
tabla del ticket 043 la colgaban de la primera cuota pactada; ya no existe esa fila en v1.

**5. `cuotas_pactadas` sale de v1.** La tabla ya existe (migración 0020) y **se queda quieta**: no se
borra, no se escribe y ninguna pantalla la muestra. Vuelve cuando alguien pida cobrar cuota por cuota.

## Consecuencias

- Una migración (la genera y aplica la sesión principal) con las dos columnas.
- La tab Students (ticket 099) y la ficha del deal (074) muestran la nota y la fecha límite.
- El Inbox (071) muestra "fecha límite vencida con saldo" en vez de "cuota vencida".
- **Lo que se pierde, dicho:** la cartera no sabe cuánto debía entrar en cada fecha intermedia, solo
  que a la fecha límite no estaba todo. Las fechas intermedias viven en la nota, legibles para el
  closer y no para una consulta. Si Gerencia pide cobrar por cuota, se vuelve al ADR 0041, que sigue
  siendo la forma correcta de hacerlo.
- El guardián del rastro (ADR 0042) cubre las dos columnas nuevas sin cambios: viven en `deals`.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener `cuotas_pactadas` como dice el ADR 0041 | Pide una estructura que el proceso no tiene; sin llenar, la cartera miente |
| Solo la nota, sin fecha límite | Ninguna consulta puede leer un texto: no habría cartera vencida |
| `num_cuotas` + fecha | Ya descartado en el ADR 0041: divide el saldo en cuotas iguales que no existen |
| Fecha límite fija calculada (inicio de clases), sin columna | La regla tiene excepciones (hasta la mitad del programa); un derivado no se puede editar |
