# 30X: el ciclo de vida del cliente y su manual de gestión comercial (leídos el 2-oct-2026)

Transcripción de dos documentos internos de 30X que Mani compartió el 2-oct. Los originales están en el repo
desde el 3-oct: [`30x/manual-gestion-comercial-30x.pdf`](./30x/manual-gestion-comercial-30x.pdf) (junio 2026,
12 páginas) y [`30x/ciclo-de-vida-30x.pdf`](./30x/ciclo-de-vida-30x.pdf) (un diagrama). Sirven de norte para las once etapas
(ADR 0071); la operación de 30X hoy tiene más cosas (ver `hubspot-30x-workflow.md`, leído por API el 1-oct).

## El principio

*El comercial llena propiedades; el sistema mueve los deals.* Nadie arrastra tarjetas. Un solo proceso
para todos los programas y todos los vendedores; lo que cambia por programa son los criterios de
calificación, no el flujo.

## Las once etapas y lo que mueve cada una (del diagrama)

El manual de junio tiene nueve activas más Cierre perdido (sin Registrado); el diagrama, más nuevo, suma
Registrado: once en total.

| Etapa | Entra | Lo que llena el comercial | Sale |
|---|---|---|---|
| Potencial | formulario **incompleto** con `lead_quality_crm` < 7 | nada | el comercial registra **cualquier actividad** → En gestión (workflow) |
| Registrado | formulario **completo** con `lead_quality_crm` < 7 | nada | igual que Potencial |
| En gestión | primera actividad | `resultado_del_intento_de_contacto` | logrado → Contactado (workflow) · no logrado → protocolo de **3 intentos** en días hábiles: si logra, Contactado; si se agotan, Cierre perdido ("No contestó") |
| Contactado | contacto logrado | `resultado_del_contacto` (¿califica? ¿tiene recursos?) | califica → Calificado (workflow) · no califica → Cierre perdido |
| Calificado | `lead_quality_crm` ≥ 7 al llegar, **o** califica desde Contactado | `resultado_de_la_calificacion` | agendó por el Typeform o por Calendly → Agendado · en negociación → Compromiso Verbal · reserva realizada → Ganado Pago Parcial (fija fecha de pago) · interesado → se queda en Calificado con próximo contacto · descartado → Cierre perdido. Si el puntaje es alto y no agenda solo: cadencia automática por WhatsApp (1 h, 24 h, 48 h) y después seguimiento manual |
| Agendado | reunión con fecha | `estado_de_agenda` (fecha y nombre) | Terminada → Atendido (workflow) · Reprogramada → tareas para re-agendar, vuelve a Agendado · No asistió o Cancelada → dos reintentos (24 h y 48 h); de ahí reprogramar (vuelve a Agendado), intento de contacto (protocolo de 3 intentos) o descartar (Cierre perdido). Recordatorios automáticos 24 h, 1 h y 15 min |
| Atendido | la reunión terminó | modal obligatorio de `origen_del_deal`; `resultado_de_reunion_completada` | Comprometido → Compromiso Verbal (workflow) · Reservado → Ganado Pago Parcial (fija fecha de pago) · Interesado → se queda en Atendido con próximo contacto (tareas a T+2 y T+5) · No interesado → Cierre perdido |
| Compromiso Verbal | comprometido o en negociación | `estado_de_negociacion` | Reservado → Ganado Pago Parcial · Revisando propuesta → tareas a T+3 y T+6, se queda · Descartado → Cierre perdido |
| Ganado Pago Parcial | reserva (primer pago) | fecha de pago | saldo en cero → Ganado Pago Total (workflow) |
| Ganado Pago Total | pagó todo | · | final |
| Cierre perdido | desde cualquier rama, **motivo obligatorio** | motivo | nutrición automática (comunidad, webinars) |

## Reglas del manual que no son etapas

- **Prioridad:** matriz HVM (tier A+ a C) × Lead Quality → Prioritario (mismo día), Alto valor (24 h),
  Potencial (48 h), Nurturing (automatizado). Máximo 15 deals por bloque de una hora: primero por etiqueta,
  después de atrás hacia adelante en el pipeline (cerrar lo más maduro), y la antigüedad desempata.
- **Flag DESATENDIDO:** más de 2 días sin contacto, sin próximo paso y con contacto previo. Es alerta visual;
  no mueve el deal.
- **WhatsApp** por Treble, registrado como actividad del deal, y esa actividad dispara los workflows.
- **Por definir en 30X:** el setter, bot o humano. Tentativo: el bot escribe el avance y la cadencia; el
  comercial conserva el resultado de la reunión, la negociación y el descarte.
