---
id: 062
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-6 · insumo §2.7 y §7, ADR 0024"
depends: [060]
status: todo
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
