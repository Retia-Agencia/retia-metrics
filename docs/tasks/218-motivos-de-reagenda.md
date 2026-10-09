---
id: 218
etapa: O8
serves: "A-121"
depends: [217]
status: review
---

# 218 — Más motivos de reagenda, y "Otro" con texto

## Por qué existe

En la reunión faltaron motivos para el no-show o la reagenda: imprevisto sin nueva fecha, sin comunicación,
decisor ausente. Y cuando ninguno sirve, el closer necesita escribir el porqué.

## Alcance

- **Datos** (con el ok de Mani, por el molde de `lib/catalogo/` y `actorDelScript()`, ADR 0029): filas de
  `motivos` tipo `reagenda` con lo que Andre dijo que pasa (transcript del 9-oct), de más a menos frecuente:
  "Imprevisto, va a dar otra fecha" (la fecha nueva no llega de inmediato), "Sin comunicación" (no respondió
  ningún mensaje ni a la hora de la llamada), "Falta quien decide" (el jefe, la pareja), "Faltó tiempo para
  terminar la llamada", "Se cayó la llamada (luz, señal)". Antes, listar las que ya existen para no duplicar (el
  índice `motivos_tipo_nombre_idx` lo rechazaría igual).
- **"Otro"** es una fila más del catálogo, pero el código lo reconoce por una marca, no por su nombre: columna
  `motivos.pide_texto boolean default false` (migración de la sesión principal), editable en Ajustes → Motivos.
  Si el motivo elegido la tiene, el comentario es obligatorio y el servidor lo valida (zod), no solo el diálogo.
- Aplica en Anotar (217) y en cualquier flecha que pida motivo de reagenda.

## Done cuando

- [ ] Los tres motivos y "Otro" salen en el diálogo de reagenda.
- [ ] Elegir "Otro" sin comentario se rechaza en el servidor (test) y el diálogo lo dice.
- [ ] El texto queda en el comentario de la anotación y se ve en Actividades.
- [ ] Las filas tienen su `change_log`.
