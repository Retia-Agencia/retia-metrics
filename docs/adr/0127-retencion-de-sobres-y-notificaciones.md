# 0127 — Retención de sobres crudos, entregas y notificaciones

- **Estado:** aceptada · 9-nov-2026 (Mani aprobó en chat los plazos: 180 días para sobres procesados, 90 para notificaciones, cron nuevo)
- **Relacionadas:** ADR 0058 (el webhook no pierde nada), ADR 0093 (lectura de Form30x), ADR 0115 N7, ticket 402, auditoría 385 F3-19

## Contexto

Medido el 9-nov-2026 en producción (solo SELECT, ref `hfqmiyiuyqapdsbywrag`):

| Tabla | Filas | Tamaño | Rango |
|---|---|---|---|
| `sobres_crudos` | 8.613 | 24 MB | 1-oct a 9-nov (39 días) |
| `entregas_webhook` | 8.453 | n/d | 1-oct a 9-nov |
| `notificaciones_calendly` | 1.153 | 920 kB | 7-oct a 9-nov |

- `sobres_crudos`: 8.346 procesados (99,5 % de ellos de 0 a 30 días en 6.552 de `formulario`), 9 con error pendiente, 3 con error ya reprocesado. **Nada purga esta tabla.** La purga de 90 días que existe (`purgarRechazosVencidos`) es de `entregas_webhook`, solo los rechazos sin sobre (401/404). Las 8.453 entregas con sobre quedan para siempre, y su FK `sobre_id` es `RESTRICT`: **no se puede borrar un sobre sin tocar antes su entrega.**
- Crecimiento: ~0,6 MB/día de sobres, unos 220 MB al año. No es cifra falsa: es crecimiento.
- Cuánto atrás sirve un sobre: los 4 reprocesos registrados (`reprocesado_en`) se hicieron como máximo 2 h después de recibido (mediana 40 min). Todo el contenido de un sobre ya vive en `submissions.respuestas` (ADR 0058 punto 2). El crudo es la red de seguridad para cuando la ingesta falla, y para rehacer una regla cambiada.
- `leer-form30x.ts` (`yaTieneSobre`) busca un sobre `form30x_api` para no duplicar el de una respuesta con error, pero solo sobre respuestas de las últimas **48 h** (`limite`). Un sobre más viejo que eso no lo consulta nadie.
- `notificaciones_calendly`: 1.150 de 1.153 sin leer; 270 de ellas tienen más de 30 días. Una "cita nueva" de hace tres meses ya no le dice nada a nadie.

## Decisión

Plazos (con su razón):

1. **Sobre procesado con firma válida (`error` nulo, cualquier origen): 180 días.** Sobra frente a los 2 h máximos medidos y cubre rehacer una regla de mapeo de un semestre. El dato ya está en `submissions`. Pasado el plazo se borra junto con su `entrega_webhook` (una transacción, la entrega primero por la FK).
2. **Sobre con error pendiente (`error` no nulo y `reprocesado_en` nulo): nunca se purga.** Es un envío con firma buena que no entró; perderlo viola ADR 0058. Solo sale al reprocesarse.
3. **Sobre con error ya reprocesado: 180 días desde `reprocesado_en`** (no desde `recibido_en`), por la misma razón que el 1.
4. **Entregas rechazadas sin sobre (401/404): 90 días**, como hoy (sin cambio).
5. **Notificaciones de Calendly: 90 días desde `created_at`, leídas o no.** Una notificación sin leer a los 90 días es ruido; la cita y la llamada viven en `calls`. Las 3 leídas no cambian la regla.
6. **Nunca se purga:** `submissions`, `leads`, `calls`, `change_log` ni nada derivado del sobre. Esta ADR solo retira el crudo y su rastro de entrega.

**Quién la aplica:** un cron diario a las 7:00 UTC, `/api/cron/retencion` (`lib/retencion/retencion.ts`; mismo molde que `/api/cron/mcp-retencion`, `CRON_SECRET`), con una función por tabla en su dominio. Por lotes de 500, idempotente, que cuenta lo borrado por clase y nunca toca una fila dentro de su plazo ni un sobre con error pendiente. Sin migración.

## Consecuencias

- El primer sobre llega a 180 días el 30-mar-2027: hasta entonces el job no borra nada (se prueba con fechas inyectadas).
- Tabla estable en ~110 MB de sobres con el ritmo de hoy.
- Si el plazo de 180 días se acorta, `yaTieneSobre` (ventana de 48 h) sigue funcionando; el piso real es mayor a 48 h.
