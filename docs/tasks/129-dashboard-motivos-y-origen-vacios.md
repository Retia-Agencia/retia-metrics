---
id: 129
etapa: E6
serves: "Dashboard: bloques Motivos de pérdida y Origen del lead"
depends: []
status: done
---

# 129 — Motivos de pérdida y Origen del lead salen vacíos en el Dashboard

## Objetivo

Que los dos bloques del Dashboard muestren datos reales, o que se retiren si ya no responden una
pregunta vigente. Se destapó el 30-sep sembrando la base local con volumen (`scripts/seed-local.ts`):
con 216 deals, 15 en Cierre Perdido con motivo, los dos bloques siguen vacíos.

## Diagnóstico (ya hecho, no re-derivar)

- **Motivos de pérdida.** `llamadasPorMotivo` (`lib/queries/dashboard.ts`, ~línea 327) cuenta
  **llamadas** unidas por `calls.motivoId`. Pero perder un deal (`moverEtapa` a `cierre_perdido`,
  `lib/deals/mover-etapa.ts` ~línea 171) escribe el motivo en **`deals.motivo_id`**. La única escritura de
  `calls.motivoId` es `marcarFallida` en la flecha T29 (Atendido → Re-agenda, motivos tipo `reagenda`).
  Resultado: una pérdida con motivo nunca llega al bloque. Probablemente pasa igual en producción
  (verificar con una lectura antes de asumirlo).
- **Origen del lead.** El bloque agrupa por el catálogo viejo `origenes` (`origen_id`,
  `lib/db/schema.ts` ~1081), que nadie llena desde la ingesta nueva: todo sale "sin origen". La atribución
  vigente (canal, área, UTM; ADR 0044, 0045, 0051, 0062) ya se ve en la vista interina de Pauta.

## Decisiones abiertas (de Mani)

1. Motivos: ¿el bloque cuenta **deals perdidos por `deals.motivo_id`** (la pregunta de negocio), o
   llamadas con motivo de re-agenda, o las dos en secciones separadas?
2. Origen del lead: ¿se reemplaza por Área/Canal (`resolverCanal`) o se retira porque Pauta ya lo cubre?

## Done cuando

- Con la base local sembrada (`docker compose down -v && npm run db:local`), el Dashboard de
  ComunicArte Local en `?rango=mes` muestra motivos con conteo y el origen según lo decidido.
- Test de la consulta sobre PGlite con un deal perdido con motivo y sin llamada con motivo.

## Resolución

- Motivos cuenta deals vigentes en `cierre_perdido`, cerrados en el rango y agrupados por
  `deals.motivo_id`; el owner del deal aplica el alcance por closer.
- Origen usa los hechos vigentes del embudo agrupados por canal y área, y conserva separados
  `sin_clasificar`, `sin_utm` y `sin_envio_origen`.
