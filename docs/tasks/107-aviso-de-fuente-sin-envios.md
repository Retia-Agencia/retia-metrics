---
id: 107
etapa: E3
serves: "ADR 0055, por decidir 2 (cerrado por Mani el 27-sep) · reemplaza al 055 para las fuentes webhook"
depends: [106]
status: done
---

# 107 — Una fuente que dejó de recibir se ve en la app

## Objetivo

Que alguien se entere de que un formulario dejó de mandar leads (secreto rotado en un lado y no en el
otro, webhook borrado en Typeform) antes de que se note en las ventas.

## Alcance

- La fuente muestra **"último envío hace X"**, calculado desde `submissions`, no guardado (ADR 0024).
- Pasado un umbral sin envíos, la fuente se marca en la app. **El umbral es configurable por fuente**
  (ADR 0012): no tiene el mismo ritmo un programa con pauta prendida que uno sin ella. Los valores por
  defecto los decidió Mani el 28-sep (abajo).
- También cuentan los sobres crudos (106) sin reprocesar: una fuente que recibe pero no procesa está
  igual de rota.
- **Fuera:** el canal (correo, WhatsApp). Es de la etapa 6.

## Done cuando

- [x] Una fuente sin envíos por encima de su umbral aparece marcada; una con envíos recientes, no.
- [x] Una fuente con sobres crudos pendientes aparece marcada.
- [x] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí, con revisión.

---

## Decisión de Mani, 2026-09-28: los umbrales

- **48 horas sin envíos:** la fuente se marca "sin respuestas".
- **5 días sin envíos:** la fuente se marca "muerta". Se marca, no se apaga (ADR 0055).
- **Si llega un envío después de la primera marca y antes de los 5 días:** la marca se quita y hay un
  aviso de que la fuente volvió.
- Configurables por fuente (ADR 0012); 48 h y 5 días son los valores por defecto.
- **Canal: solo dentro de la app por ahora** (Mani, 28-sep). Queda anotado para después: revisar si
  las alertas se mandan también por correo, de forma estandarizada y simple (`docs/plan.md` §7).

---

## Hecho, 2026-09-28 (sesión 40)

- **Migración 0035** (sesión principal): `sources.umbral_sin_respuesta_horas` (48) y
  `sources.umbral_muerta_horas` (120), en horas los dos, y el CHECK `sources_umbrales_en_orden` (muerta >
  sin respuestas > 0). Aditiva: las filas vivas toman los defectos.
- **`lib/queries/salud-fuentes.ts`**: `saludDeFuente` (pura) y `saludDeFuentes` (la base). Todo se
  calcula desde `submissions.created_at` (cuándo llegó al CRM) y `sobres_crudos`; nada se guarda. Cinco
  estados: `al_dia`, `volvio`, `sin_respuestas`, `muerta`, `sin_envios`. Solo las fuentes activas.
- **"Volvió" sin estado guardado:** es que el hueco entre los dos últimos envíos superó el umbral de sin
  respuestas; se ve mientras el último sea reciente y se va solo con el siguiente envío.
- **Una fuente activa que nunca recibió** sale como `sin_envios` y se marca: no hay fecha de activación
  contra la cual medir, y es justo el caso del secreto sin pegar del 28-sep.
- **Umbrales opcionales en la entrada:** al crear, si no vienen, los pone la base; al editar se conserva el
  valor actual. Con un `.default()` en zod, una edición que no los mandara los resetearía en silencio.
- **Pantalla:** `/ajustes/fuentes` pinta la marca por fuente (tono `exito`/`info`/`alerta`/`peligro`) y
  los envíos sin procesar; el formulario de la fuente edita los dos umbrales. El 110 reusa el módulo.
- Tests: `tests/salud-fuentes.test.ts` y el bloque "umbrales de silencio" de `tests/fuentes.test.ts`.
- **Migración 0035 aplicada en producción** (ok de Mani, 28-sep): las cinco fuentes quedaron en 48/120.
  Pantalla vista con datos reales: "recibiendo · último hace 36 min" y el formulario con los dos umbrales.
  No se guardó ninguna edición desde el navegador (escribiría en producción).
