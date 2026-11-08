# 0122: Una venta vigente tiene dueño; la identidad del closer de un abono es su cuenta

- **Estado:** borrador · 8-nov-2026 (ticket 391 fase A, hijo del 385; auditoría F3-05 y F3-07). La corrección de datos y la
  migración M3 las aplica la sesión principal con ok de Mani, en ese orden.
- **Concreta:** ADR 0115 N6 (lo que una métrica necesita se exige al escribir, no se parcha al leer). **Enmienda el 0030**
  (el texto `closer_id` de un abono es historia; la identidad es la FK) y **el 0037** (un deal puede nacer sin dueño, pero no
  puede ser una venta vigente sin él).

## Contexto

El 8-nov, en producción, 3 ventas vigentes (`ganado_completo`, deals migrados de Comunicarte C3) no tenían `owner_user_id` y
3 abonos de esas mismas ventas traían un `closer_id` de texto (`Juanjo`, `Alejo`) que ninguna cuenta resuelve y sin
`registrado_por_user_id`. Efecto: la comisión de esas ventas no se puede atribuir (cae en «Sin closer») y el comparativo
muestra closers fantasma. No es un error de cálculo: es un dato que no se exigió al escribir (N6). En cada caso hay dos
cuentas que casan con el texto (dos Alejos, dos Juanjos, con roles distintos), así que la corrección no es inequívoca.

## Decisión

1. **Una venta vigente tiene dueño.** `CHECK deals_venta_con_dueno`:
   `anulado_en IS NOT NULL OR etapa NOT IN ('ganado_parcial','ganado_completo') OR owner_user_id IS NOT NULL`.
   Una venta anulada sin dueño sigue permitida (ADR 0038: el registro no existió). Los deals abiertos sin dueño
   (Unclaimed, ADR 0037) no cambian.
2. **La identidad del closer de un abono es `registrado_por_user_id`.** `claveCloserSql` ya le da prioridad sobre el texto; el
   `closer_id` queda como historia y no se reescribe. Corregir un huérfano es escribir la FK.
3. **Los 6 registros se corrigen por `editarConRastro`**, con una fila de `change_log` por campo, nunca por `UPDATE` a mano
   (script desechable `scripts/corregir-closer-huerfanos-391.ts`, ensayo por defecto, `--decision <id>=<userId>` para lo
   ambiguo). El destino lo decide Mani cuando hay más de una cuenta posible.
4. **Migración M3 después de la corrección**: `ADD CONSTRAINT ... NOT VALID` con `SET lock_timeout = '5s'`, y `VALIDATE`
   después. Con las 3 ventas sin corregir, el `VALIDATE` falla.

## Consecuencias

- Toda ruta que lleve un deal a Abonado o Completo tiene que dejarlo con dueño. Rutas a revisar antes de aplicar M3: la
  migración de la hoja (`lib/deals/mover-etapa.ts`, alta con `ownerUserId` nulo cuando el nombre de la hoja no es un usuario
  del CRM) y todo movimiento del sistema a venta de un deal Unclaimed (el movimiento de una persona ya lo reclama, E1).
- Los tests que siembran una venta sin dueño dejan de poder hacerlo (hay ~80 archivos de test que nombran `ganado_`; los que
  inserten sin `ownerUserId` se arreglan con dueño explícito).
- La fila «Sin closer» de la comisión deja de recibir ventas vigentes (`docs/metricas.md` §Comisión, `overview.md` §11 Dueño).
