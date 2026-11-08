# 0122: Una venta vigente tiene dueño; la identidad del closer de un abono es su cuenta

- **Estado:** aceptado · 8-nov-2026 (ticket 391 fase A, hijo del 385; auditoría F3-05 y F3-07). La migración M3 la aplica la sesión
  principal con ok de Mani. Los 3 casos históricos no se corrigen (decisión de Mani, 8-nov).
- **Concreta:** ADR 0115 N6 (lo que una métrica necesita se exige al escribir, no se parcha al leer). **Enmienda el 0030**
  (el texto `closer_id` de un abono es historia; la identidad es la FK) y **el 0037** (un deal puede nacer sin dueño, pero no
  puede ser una venta vigente sin él).

## Contexto

El 8-nov, en producción, 3 ventas vigentes (`ganado_completo`, deals migrados de Comunicarte C3) no tenían `owner_user_id` y
3 abonos de esas mismas ventas traían un `closer_id` de texto (`Juanjo`, `Alejo`) que ninguna cuenta resuelve y sin
`registrado_por_user_id`. Efecto: la comisión de esas ventas no se puede atribuir (cae en «Sin closer») y el comparativo
muestra closers fantasma. No es un error de cálculo: es un dato que no se exigió al escribir (N6). Los textos eran de
closers históricos de Comunicarte (Juanjo Gaitan, hoy customer success, y Alejo Carvajal, que solo es miembro de Comunícate
con Confianza): ninguno puede ser dueño hoy en ese programa (`duenosPosibles` exige membresía activa y `trabajaLeads`), y
dárselo cruzaría la frontera de programa. Mani decidió dejarlos sin dueño: son historia y lo importante es de ahora en adelante.

## Decisión

1. **Una venta vigente tiene dueño, salvo el deal histórico migrado.** `CHECK deals_venta_con_dueno`:
   `anulado_en IS NOT NULL OR etapa NOT IN ('ganado_parcial','ganado_completo') OR owner_user_id IS NOT NULL OR huella_migracion IS NOT NULL`.
   Una venta anulada sin dueño sigue permitida (ADR 0038). La excepción es nombrada: solo la migración de la hoja escribe
   `huella_migracion`, y las 3 ventas históricas sin dueño la llevan. Toda venta que nazca en el CRM exige dueño.
2. **La identidad del closer de un abono es `registrado_por_user_id`.** `claveCloserSql` le da prioridad sobre el texto; el
   `closer_id` queda como historia y no se reescribe. Los 3 abonos históricos con `Juanjo`/`Alejo` siguen sin FK: cómo se
   muestran en el comparativo (una fila «Histórico sin cuenta», no un closer inventado) lo resuelve el 404 (fase B).
3. **No se escribe ningún dato en producción en esta fase.** El script `scripts/corregir-closer-huerfanos-391.ts` se borra:
   su único uso era elegir un destino y la decisión fue no elegirlo.
4. **Migración M3**: `ADD CONSTRAINT ... NOT VALID` con `SET lock_timeout = '5s'` y `VALIDATE` después. Con la excepción, las
   3 ventas actuales cumplen el CHECK sin tocarlas.

## Consecuencias

- Toda ruta que lleve un deal a Abonado o Completo tiene que dejarlo con dueño. La migración de la hoja queda cubierta
  por la excepción (`huella_migracion`). A revisar: todo movimiento del sistema a venta de un deal Unclaimed (el movimiento de una persona ya lo reclama, E1).
- Los tests que siembran una venta sin dueño dejan de poder hacerlo (hay ~80 archivos de test que nombran `ganado_`; los que
  inserten sin `ownerUserId` se arreglan con dueño explícito).
- La fila «Sin closer» de la comisión deja de recibir ventas vigentes (`docs/metricas.md` §Comisión, `overview.md` §11 Dueño).
