# 0024 — Todo dinero derivado tiene UNA definicion, y vive en un solo modulo

**Fecha:** 2026-09-17 · **Estado:** aceptado (Mani, al cerrar el ticket 006)

Al cerrar el 006 se reporto que `historialDePersona` "compone `ventasDePersona` en vez de repetir
el SQL del saldo". Mani lo leyo y respondio la regla general: **no podemos dejar que el saldo se
desincronice; hay que priorizar el bajo acoplamiento y la centralizacion cuando se pueda, para
poder rastrear el funcionamiento con claridad.**

Al revisarlo con eso en mente aparecio que la composicion del 006 habia evitado una TERCERA copia,
pero que ya existian **dos**, con el SQL identico palabra por palabra:

- `lib/queries/ventas.ts` → `saldoDeVenta`, que alimenta la reja que **bloquea un sobrepago** al
  registrar un abono (ticket 019).
- `lib/queries/personas.ts` → `ventasDePersona`, que alimenta **lo que el closer ve en pantalla**
  en `/mi-dia` y en el historial (tickets 003 y 006).

No es duplicacion estetica. Son los dos lados de la misma cifra: uno decide si el dinero entra,
el otro le dice a una persona cuanto falta. Si una cambia y la otra no —excluir un abono devuelto,
tratar otra moneda, redondear distinto— la pantalla muestra un saldo, la reja aplica otro, y la
diferencia no se descubre hasta que el dinero no cuadra. Nada en el codigo lo habria impedido.

## Decidimos

**1. Lo abonado y el saldo se definen una sola vez, en `lib/queries/saldo.ts`.** Las dos consultas
importan las mismas expresiones (`ABONADO`, `SALDO`) y la misma derivacion (`estaPagadaCompleta`).
Ninguna consulta nueva vuelve a escribir `sum(abonos.monto)` a mano: si necesita dinero derivado,
importa de ahi o extiende ese modulo.

**2. La regla general: si dos lugares tienen que dar la MISMA cifra, la cifra vive en un modulo y
los dos la importan.** Vale para el dinero derivado y para cualquier numero que el negocio lea
desde mas de una pantalla. La alternativa —copiar y confiar en que nadie toque una sola— ya se
habia intentado sin querer aqui y en el ADR 0023 (donde se descarto un `dashboard-por-closer.ts`
que habria duplicado el anclaje de fecha en Bogota y el agrupado por moneda). Es el mismo error
dos veces; esta es la regla que lo nombra.

**3. La duplicacion se prueba, no se promete.** `tests/saldo-centralizado.test.ts` hace leer la
misma venta por los dos caminos y exige que coincidan, con abonos parciales, sin abonos, sin
precio de contrato y con sobrepago. Un test que compara las dos salidas es lo unico que sobrevive
a que alguien "arregle" una sola: un comentario que pida no separarlas no falla nunca.

**4. El dinero sigue sin pasar por un `float`.** Las expresiones centralizadas mantienen la suma y
la resta en SQL sobre `numeric`, devueltas como texto (ADR 0013). Centralizar no aflojo eso; lo
dejo en un solo sitio donde se puede verificar de una mirada.

## Consecuencias

- Cambiar la regla del saldo es cambiar un archivo, y los tests de los dos caminos dicen al
  instante si algo quedo fuera de sincronia.
- `saldoDeVenta` y `ventasDePersona` siguen existiendo por separado: resuelven preguntas distintas
  (una venta puntual contra todas las de una persona). Lo que se unifico es la DEFINICION de la
  cifra, no las consultas.
- Sin migracion: no cambio ninguna columna ni ningun resultado. Es un refactor con la misma salida
  observable, y los 392 tests lo confirman.
- Queda pendiente el mismo ejercicio sobre las metricas del dashboard (`lib/queries/dashboard.ts`):
  hoy no estan duplicadas, pero nadie lo ha verificado explicitamente contra esta regla.
