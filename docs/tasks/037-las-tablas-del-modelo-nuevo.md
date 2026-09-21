---
id: 037
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-2 · ADR 0035, 0036, 0037, 0041"
depends: [036]
status: done
---

# 037 — Las seis tablas del modelo nuevo

> Parte de la etapa 1: **una rama, una migracion** (`0020`). No se fusiona suelto.

## Objetivo

Crear en el esquema las seis tablas que el modelo HubSpot necesita y que hoy no existen. Solo
esquema y tipos: quien las llena es la etapa 3, y quien mueve las etapas es la etapa 2.

## Alcance

```
lead_contactos       (lead_id, tipo correo|telefono, valor, submission_id, es_principal,
                      confirmado)                      unico (program_id, tipo, valor)   ADR 0035
submissions          (lead_id, source_id, token, es_parcial, fecha_envio, estado_hoja,
                      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
                      posicion_en_hoja, respuestas jsonb)                                ADR 0036
deals                (lead_id, program_id, cohort_id, owner_user_id?, etapa, producto_id?,
                      motivo_id?, submission_origen_id?, onboarded_at?, creado_por,
                      anulado_por?, anulado_en?, anulado_motivo?)                        ADR 0037
                      unico parcial (lead_id, program_id) WHERE etapa NOT IN (completo, perdido)
deal_etapa_historial (deal_id, de, a, user_id?, motivo_id?, fecha)                       ADR 0037
deal_actividades     (deal_id, tipo contacto|nota, canal, user_id, fecha, nota)          ADR 0037
cuotas_pactadas      (deal_id, numero, monto, fecha_pactada, abono_id?)                  ADR 0041
```

- **Dentro:** las tablas, sus indices y sus FKs. `restrict` donde borrar perderia historia (mismo
  criterio del ADR 0026), `set null` solo donde la referencia es opcional de verdad.
- **Dentro:** el `pgEnum` de las diez etapas **lo crea el ticket 043** (etapa 2); aqui la columna
  `deals.etapa` lo usa. Si por orden de trabajo hace falta antes, se adelanta el enum y se anota.
- **Fuera:** llenar nada, mover etapas, leer nada.

## Lo que no se puede olvidar

- 🎯 **`deal_etapa_historial` se crea AHORA aunque la pantalla no exista.** El dato es el
  **instante** del cambio y no se puede reconstruir despues: sin el no hay conversion etapa a etapa
  ni tiempo en etapa, para siempre (ADR 0037, ADR 0042).
- El unico parcial de `deals` es lo que garantiza **un deal abierto por lead y programa**. Es la
  garantia en la base y no en el codigo (ADR 0005), mismo molde que
  `cohorts_una_activa_por_programa_idx`.
- `submissions.respuestas` **no repite** las columnas promovidas (ADR 0036, opcion A').
- `cuotas_pactadas` nace vacia y **el deal no lleva `num_cuotas`**: es `count()` (ADR 0041).

## Done cuando

- [ ] Las seis tablas existen en `lib/db/schema.ts` con sus indices, y `npm run typecheck` pasa.
- [ ] Hay un test que **muerde el unico parcial de `deals`**: dos deals abiertos del mismo lead y
      programa chocan; uno abierto y uno `perdido` conviven.
- [ ] Hay un test que muerde el unico de `lead_contactos` sobre `(program_id, tipo, valor)`.
- [ ] Ninguna de las seis se puede escribir sin pasar por su funcion (lo exige el ticket 041).

## Kiro

Las tablas y sus tests, con revision. El diseno de los indices, no.
