---
id: 289
etapa: llamadas
serves: "Una cita de otro programa de la misma org de Calendly no crea llamada ni cuenta como agenda (Second Brain Jurídico, EstadoX, 19-oct)"
depends: [280, 278]
status: done
---

# 289 — El webhook de Calendly filtra por tipo de evento

Decisión: **ADR 0098**. Léelo antes de empezar; no se re-litiga.

## Qué se construye

1. **Migración 0098** (ya generada por la sesión principal): `programs.calendly_event_type`,
   `programs.calendly_org_compartida`, índices únicos parciales en `programs` y `miembros_programa`, y el motivo
   `evento_de_otro_programa` en `motivo_entrega`.
2. **Lector del evento** en `lib/calendly/evento-webhook.ts`: `invitee.created` trae `eventType`
   (`payload.scheduled_event.event_type`, nulo si falta).
3. **Pertenencia** (`lib/calendly/`): una función pura que dice si un `eventType` es del programa dado el conjunto
   (round robin ∪ personales activos) y la marca de org compartida, y una lectura del conjunto. En
   `aplicarEventoDeCalendly`, para `agendada`: huella existente o `old_invitee` conocido → como hoy; si no, org
   compartida y evento fuera del conjunto → nuevo efecto `{ tipo: "otro_programa", eventType }`, sin escribir.
   La ruta registra la entrega con `evento_de_otro_programa`.
4. **Round robin en Integraciones › Calendly:** URL de agenda (`programs.calendly_url`) y marca de org compartida. Al
   guardar se resuelve la URI (la búsqueda por miembros de `eventoParaAgendar`, extraída a una función) y se guarda en
   `programs.calendly_event_type` con `change_log`; ni uno o más de uno → 422 visible y nada se guarda. Valida que la
   URI no sea el evento personal de ninguna membresía. `eventoParaAgendar` lee la URI guardada.
5. **Evento personal:** `asignarEventoDeMembresia` rechaza (422) una URI que ya es el round robin de un programa; el
   índice ataja dos membresías con el mismo evento (409 con mensaje). Texto del selector: "Un evento por programa".
6. **Webhook Health:** aviso cuando la org es compartida y falta el round robin.

## Done cuando

- Tests: en org compartida, un `invitee.created` de otro evento no crea llamada y la entrega dice
  `evento_de_otro_programa`; uno del round robin y uno del evento personal de un miembro sí la crean; uno de otro
  evento con huella existente se adopta. En org no compartida todo pasa como hoy. Resolver el round robin: cero, uno
  y dos resultados. Choques entre tablas en los dos sentidos.
- Typecheck, lint, build y tests del cambio limpios; checkpoint verde.
- Migración aplicada en producción con ok de Mani; Second Brain Jurídico marcado como org compartida con su round
  robin; las 24 sueltas ajenas anuladas con rastro (ok de Mani).

## Estado (19-oct, noche)

- Código en `main` (`6367b5f`); typecheck, lint y build en verde; tests del cambio al CI (swap sin aire en local).
- Migración 0098 aplicada en producción (ok de Mani).
- Second Brain Jurídico: round robin `…/postulacion-second-brain-juridico-estadox` resuelto a
  `event_types/9ef431be-4023-4dac-bd12-4c0ae64c2f09` por `guardarRoundRobin`, org compartida, con `change_log`.
- Anuladas con rastro **25** sueltas ajenas (24 medidas + 1 que entró antes del deploy), motivo "Cita de otro programa
  de la organización de Calendly de EstadoX (ADR 0098)". Quedan 0 llamadas vigentes en el programa.
- Sin cubrir por test: la entrega `evento_de_otro_programa` por la ruta real (está cubierto el efecto). Se verifica
  con la próxima cita ajena en Webhook Health.
- Pendiente de Mani: evento personal de Andrea y Maru (ComunicArte y Tactical) y la cuenta de Jerónimo.
