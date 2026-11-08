---
id: 389
etapa: hub
serves: "Auditoría 385 F3-01 · ADR 0115 N6 · ADR 0121"
depends: [388]
status: en main
---

# 389 — Lead bien escrito al nacer

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El parcial de Typeform no trae `fecha_envio` y el lead no la hereda. `fechaAnclaLead()` no tiene fallback y `lib/queries/leads.ts:138` sí (`coalesce(..., created_at)`): dos anclas para el mismo concepto. Es la regla N6 (lo que una métrica necesita se exige al escribir, no se parcha al leer).

## Alcance

**Cubre:** F3-01 (784 leads, 21 %; 16 con venta vigente), los 18 leads de alta manual sin contacto de correo y 16 sin fila de teléfono (F3 §2.1, última fila), y las 14 calificaciones del resumen que difieren de la reconstrucción de F3 (a verificar si el desempate de `ingerir.ts` es el correcto antes de llamarlo defecto).

**Archivos calientes** (donde chocan dos sesiones): `lib/ingesta/ingerir.ts`, `lib/queries/metricas-filtros.ts` (`fechaAnclaLead`), `lib/queries/leads.ts`, alta manual en `lib/leads/` (a verificar la ruta).

**Migración:** M1 (relleno de `leads.fecha_primera_aplicacion` donde es nula, 784 filas, solo `UPDATE`, con conteo antes y después) y M2 (`CHECK` con `ADD CONSTRAINT ... NOT VALID` y luego `VALIDATE`, después de M1). ADR 0121. Escribe producción: ok de Mani.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] La ingesta escribe `fecha_primera_aplicacion` desde el envío o desde `created_at` del sobre, con test del parcial sin `fecha_envio`.
- [x] Un solo ancla de fecha del lead, importada por la métrica y por la lista Leads; grep limpio del `coalesce` suelto.
- [ ] El alta manual escribe su contacto de correo y teléfono por `ingerirEntradas`; 0 leads sin contacto. **Pendiente:** el código ya escribe el contacto de las altas nuevas (`lib/ingesta/contactos-de-alta.ts`, no por `ingerirEntradas`, ADR 0121 punto 3), pero las 18 altas manuales existentes siguen sin correo y 16 sin teléfono: falta su relleno (escribe producción, pide ok).
- [x] Test de paridad de `calificacion` del resumen contra sus envíos, con el caso de desempate.
- [x] Relleno aplicado (784 filas, solo donde es nula), conteo antes y después, y `CHECK` validado. Aplicado el 8-nov con el ok de Mani: M1 (0118) rellenó 791 leads (no 784: 7 llegaron con el código viejo), 791 filas en `change_log`, 0 de formulario sin fecha; M2 (0119) validada. Los 18 de alta manual (`entrada = crm`) quedan sin fecha a propósito.
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [x] Registro: ficha de `leads` (ancla única; el nombre visible lo fija el 397) en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.
