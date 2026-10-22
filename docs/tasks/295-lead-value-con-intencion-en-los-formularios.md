---
id: 295
etapa: formularios
serves: "Lead Value separa a quién priorizar: baja un nivel por facilidades de pago y otro por puede esperar (ADR 0102)"
depends: []
status: in-progress
---

# 295 — Lead Value con intención en los formularios

## Por qué

ADR 0102 (Mani, 22-oct). Medición y simulación en `docs/manuales/pipeline-comercial.md` §5.

## Qué

Editar la lógica de `lead_value` en cada formulario vivo, sin tocar Lead Quality, el Calendly ni el resto de variables:

| Programa | Proveedor | Form | Estado |
|---|---|---|---|
| ComunicArte | Typeform | `nkMLdeh8` | ✅ 22-oct 9:47 a. m. |
| Comunícate con Confianza | Typeform | `E5F4chVT` | ✅ 22-oct 9:47 a. m. |
| Tactical Investor | Typeform | `GmPGBOf9` | ✅ 22-oct 9:47 a. m. · 🩸 sin `lead_value` ni `hvm_points` desde el 19-oct (0 de 82 envíos del 20 al 22-oct); se restauran copiando la lógica de Confianza (mismos ids) |
| AI Second Brain Jurídico | Form30x | `cmulcaari04c001s6m0x1ats6` | pendiente |
| Los cuatro de Dapta | Dapta (generador) | `docs/dapta/` | pendiente · sin envíos todavía |

## Cómo (propuesta del 22-oct, validada)

Un bloque igual en los tres Typeform, en la lógica de la pregunta de inversión, en lugar de las 8 reglas de `lead_value`:
`nivel_valor` (variable nueva) = 3 / 2 / 1 por `hvm_points` (≥30, 15-29, <15) → −1 si `score < 0` → −1 si "facilidades
de pago" → −1 si "puede esperar" → `lead_value` = MUY ALTO / ALTO / VALOR MEDIO / BAJO (≤0). Probado con un intérprete
de la lógica sobre las 216 combinaciones de cada form: 0 diferencias con el ADR 0102, `score` y `tag_lead_quality`
idénticos, el resto del form idéntico. Cambian de nivel 90 combinaciones en ComunicArte y 96 en Confianza; en Tactical
las 216 (vuelve a tener Lead Value). La calidad de Tactical (High/Medium al agendar) no se toca en este ticket.

## Aplicado el 22-oct (ok de Mani)

Los tres Typeform, en orden Tactical → ComunicArte → Confianza, por `PUT /forms/{id}`. Antes de cada PUT se comprobó
que el form vivo era idéntico a lo leído y se guardó el respaldo en `~/Desktop/mani/work/retia/respaldos/typeform/`
(fuera del repo). Después se volvió a leer cada uno: idéntico a la propuesta, y el intérprete dio 216 de 216 contra el
ADR 0102 con `score` y calidad sin cambios. **Hojas:** no se corren, porque las variables propias no crean columna (solo
`Score`, que no cambió) y el Apps Script enruta por las respuestas.

**Pendiente de verificar con un envío completo real por programa** (al cerrar la sesión del 22-oct solo había entrado
un parcial de ComunicArte, 9:55 a. m., ya con `variable:nivel_valor`): mirar `respuestas` (`variable:lead_value`,
`variable:nivel_valor`) y la fila 1 de cada hoja.

## Reglas

- Cada escritura pide el ok de Mani, con el cambio a la vista antes (GET, diff, PUT/PATCH).
- Typeform: el PUT reemplaza el form entero; se lee justo antes y se compara contra lo leído (lección del 29-sep en
  `docs/analytics.md` §2.4: una edición quitó las reglas de `estado`).
- Form30x: `If-Match` con el ETag, solo `scoreTagRules`, nunca el `salesFlow`.
- Antes del primer formulario: avisar a Gerencia y Pauta que la llamada calificada baja (ADR 0102, consecuencias).

## Done cuando

- Los cuatro vivos y el generador de Dapta aplican la regla; un envío de prueba por formulario sale con el nivel
  esperado (incluido el caso de Joana: capacidad alta + facilidades + muy urgente → ALTO VALOR).
- La fecha del cambio de cada programa está en esta tabla.
- A los 30 días, la tabla de `pipeline-comercial.md` §5 se repite con los leads nuevos.
