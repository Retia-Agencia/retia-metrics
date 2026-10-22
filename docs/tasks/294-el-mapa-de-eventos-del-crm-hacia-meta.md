---
id: 294
etapa: pauta
serves: "Meta ve cada paso de la operación comercial que el CRM conoce, no solo la venta, para medir y optimizar la pauta por calidad (Mani, 22-oct)"
depends: [281]
status: idea
---

# 294 — El mapa de eventos del CRM hacia Meta

## Por qué

Mani (22-oct): si se puede mandar Atendido, mapear toda la operación comercial a Meta y tener el CRM y Meta en sync.
La API de Conversiones acepta cualquier evento estándar o personalizado, con el mismo `user_data`, `event_id` y `fbc` del
281. La bandeja `eventos_meta` ya sirve: un evento nuevo es un valor del enum y un disparo en `moverEtapa`.

## Mapa propuesto (a decidir con Pauta; sin fuente verificada de qué optimiza cada campaña)

| Paso del CRM | Evento de Meta | Quién lo manda hoy | Propuesta |
|---|---|---|---|
| Envío del formulario | `Lead` / `TypeformSubmit` | Pixel e integración nativa de Typeform | No duplicar |
| Calificado (High) | personalizado `LeadCalificado` | nadie | Candidato fuerte: más volumen que la venta y filtra calidad |
| Agendado | `Schedule` | Pixel de Calendly (`invitee_meeting_scheduled`) | No duplicar (283) |
| Atendido | personalizado `Atendido` | nadie | Potencial (283) |
| No show / Cierre Perdido | personalizado | nadie | Solo para medir, no para optimizar |
| Abonado o Completo | `Purchase` con valor | CRM (281) | Hecho |
| Completo (pago total) | personalizado `PagoCompleto` | nadie | Opcional: separa caja de venta |

## Reglas

- Una sola vez por deal y evento (índice de `eventos_meta`), `action_source: system_generated`, 7 días de ventana.
- Nada se manda si otro canal ya lo manda, salvo deduplicación por `event_id`.
- Meta aprende con ~50 eventos por semana por conjunto: los eventos con volumen (Calificado, Atendido) sirven para
  optimizar; los raros (Purchase, Perdido) para medir.

## Abierto

Qué eventos quiere Pauta y para qué campañas; si conviene "Conversion Leads" (optimización por etapas del CRM) de Meta.
