---
id: 062
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-6 · insumo §2.7 y §7, ADR 0024"
depends: [060]
status: en curso
---

# 062 — La comision se calcula, nunca se guarda

## Objetivo

`comision = tasa_del_programa × precio_lista del producto`, visible en el dashboard por closer.

🩸 Las tasas reales de hoy: **80 sobre 697** en ComunicArte y **100 sobre 1.500** en Tactical.

## Alcance

- **Dentro:** `programs.tasa_comision` como **instancia** editable desde la app (ADR 0012), con su
  fila de `change_log`.
- **Dentro:** el calculo **en un solo modulo**, importado por la pantalla y por cualquier otra
  consulta que lo necesite. Si dos lugares responden la misma pregunta, la respuesta vive en un
  modulo (invariante 1, ADR 0024).
- **Dentro:** la moneda al lado del numero, siempre.
- **Fuera:** guardar la comision en el deal. Es derivada: guardarla la deja discrepar el dia que
  la tasa cambie, y ademas obligaria a decidir si un cambio de tasa es retroactivo (no lo es: el
  calculo usa la tasa vigente, y si el negocio quiere congelarla, eso es otro ADR).
- **Fuera:** pagos de comision, liquidaciones, nomina.

## Done cuando

- [ ] La comision sale del mismo modulo en todas partes.
- [ ] Cambiar la tasa de un programa cambia la cifra sin migracion y deja rastro.
- [ ] La cifra nunca aparece sin su moneda.

## Kiro

Si.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- La comisión no se le muestra al paid trafficker (ADR 0052 enmendado).

---

## ✅ Decisión y construcción (29-sep, Alejo)

**La comisión es un monto FIJO por venta, en USD, por programa** (no un porcentaje del precio): USD 80 por venta en
ComunicArte y USD 100 en Tactical, como pagaba la hoja. El precio de lista puede cambiar (ComunicArte pasó a 797) sin
que cambie lo que gana el closer. Enmendados `overview.md` §11 y el ADR 0037.

- **Migración `0044_comision-por-venta`** (rama `062-comision`, **SIN aplicar**; era la 0043, renumerada porque la 0043 de `main` es la del 115 de Mani, que va antes): `programs.comision_por_venta_usd`
  numeric(10,2) nullable, con CHECK `>= 0`. SQL leído: solo agrega. **La aplica Mani ANTES de mergear**, o el código
  que lee la columna llega a Vercel antes que ella.
- Editable en **Ajustes → Programas** (campo "Comisión por venta (USD)"): pasa por el molde, así que cambiarla deja
  su fila en `change_log`. Vacío = nulo, y la pantalla dice "sin comisión cargada", nunca un cero.
- **El cálculo vive en `lib/queries/comision.ts`** (`comisionUsd`, `comisionPorVentaDe`). El comparativo entre
  closers del Dashboard (`lib/queries/vista-dashboard.ts`, `components/dashboard-programa.tsx`) lleva la columna
  **Comisión**, con los MISMOS cierres de la fila: la columna y la cifra no pueden discrepar.
- Tests: `tests/comision.test.ts`.

**Pendiente:** cargar los montos (80 y 100) en producción desde Ajustes, después de aplicar la migración. Ocultar la
comisión al paid trafficker va con el 102 (el rol todavía no existe).

🩸 **Hallazgo para Mani (064):** `ventasPorCloser` y `ventasDelRango` cuentan un deal en CADA rango donde entró a
Abonado **o** a Completo. Un deal que pasa a Abonado en septiembre y a Completo en octubre es cierre en los dos
meses: la venta se cuenta dos veces entre períodos, y con la comisión se pagaría dos veces. Lo correcto sería
contar la PRIMERA entrada a Abonado o Completo. No se tocó aquí: es del 064.
- La 0044 empieza con `SET lock_timeout = '5s';` (regla del 29-sep en `AGENTS.md`: `programs` es tabla caliente).
  Antes de aplicarla, mirar `pg_stat_activity` por transacciones largas.

**Aplicado (29-sep, Alejo, con el ok de Mani):** `0044` aplicada en producción con `npm run db:migrate` (ref
`hfqmiyiuyqapdsbywrag`, conexión directa 5432; `pg_stat_activity` sin transacciones largas antes). Verificado: 45
migraciones, la columna `numeric(10,2)` nullable y el CHECK. Merge a `main` en `7bae817`. **Falta:** cargar los
montos en Ajustes → Programas (USD 80 ComunicArte, USD 100 Tactical); hoy los dos están en nulo.
