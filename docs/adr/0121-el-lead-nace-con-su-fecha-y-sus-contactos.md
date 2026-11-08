# 0121: El lead nace con su fecha y sus contactos; un solo ancla de fecha

- **Estado:** aceptado · 7-nov-2026 (ticket 389, hijo del 385; auditoría F3-01). Código construido; el relleno (M1) y el
  `CHECK` (M2) los aplica la sesión principal con ok de Mani, M1 antes que M2.
- **Concreta:** ADR 0115 N1 (un concepto, un módulo) y N6 (lo que una métrica necesita se exige al escribir, no se parcha al
  leer). **Enmienda el 0035** (el alta manual también escribe sus contactos).

## Contexto

El 7-nov, 784 de 3.742 leads (21 %) tenían `fecha_primera_aplicacion` nula: el parcial de Typeform no trae `fecha_envio` y el
resumen del lead solo miraba envíos fechados. `fechaAnclaLead()` (la métrica "Leads") no tenía respaldo y la lista Leads sí
(`coalesce(..., created_at)`): dos anclas para el mismo concepto, y 784 personas contadas por una pantalla y no por la otra.
Además, los 18 leads de alta manual no tenían fila de correo en `lead_contactos` (16 tampoco de teléfono).

## Decisión

1. **La ingesta escribe la fecha al nacer el lead.** `fecha_primera_aplicacion` es la más antigua de
   `coalesce(fecha_envio, created_at)` de sus envíos (`primeraAplicacion` en `lib/ingesta/ingerir.ts`). `created_at` del envío
   es cuándo lo recibió el CRM y no cambia en un reintento (el upsert no lo toca). `fecha_ultima_aplicacion` sigue solo con
   envíos fechados: no se inventa.
2. **UN ancla de fecha del lead.** `fechaAnclaLead` (`lib/queries/metricas-filtros.ts`) es el día de Bogotá de la primera
   aplicación, sin respaldo. La lista Leads la importa a través de `fechaDeEntradaDelLead`, que decide por TIPO de entrada
   (formulario: la primera aplicación; alta manual: su alta), nunca por "el dato faltó".
3. **El alta manual escribe su correo y su teléfono** como `lead_contactos`, por el módulo de la ingesta
   (`insertarContactosDeAlta` en `lib/ingesta/contactos-de-alta.ts`). No pasa por `ingerirEntradas` porque no hay envío ni fuente: pasar
   por ahí fabricaría una aplicación al formulario que no existió (ADR 0005, 0021).
4. **La calificación del resumen es determinista.** Entre envíos que la fecha no separa, desempatan la posición en la hoja,
   luego cuándo los recibió el CRM y al final el token (`porPosicion`). Antes, con `posicion_en_hoja` nula en todo envío de
   webhook, decidía el orden en que Postgres devolvía las filas.
5. **La base lo exige (M2).** `CHECK (entrada <> 'formulario' OR fecha_primera_aplicacion IS NOT NULL)`, creado `NOT VALID` y
   validado después del relleno M1 (solo `UPDATE`, solo donde es nula).

## Consecuencias

- La métrica "Leads" cuenta hoy 784 personas más en el periodo en que entraron; el relleno hace que coincida con la lista.
- Un lead de formulario sin fecha deja de poder existir: la ingesta falla antes de escribirlo sin ella (no puede, el envío
  siempre trae `created_at`) y la base lo rechaza.
