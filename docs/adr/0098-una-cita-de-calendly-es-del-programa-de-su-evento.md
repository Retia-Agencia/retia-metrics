# 0098: Una cita de Calendly es del programa de su evento, y la org compartida se declara

- **Estado:** aceptado, 19-oct-2026 (Mani). Se construye en el 289.
- **Enmienda:** ADR 0049 (toda cita que llega al webhook de un programa era de ese programa).
- **Confirma:** ADR 0058 (el sobre se guarda siempre), ADR 0096 (round robin en setteo, evento personal en el resto),
  ADR 0043 (el programa es frontera), ADR 0005 (la garantía vive en un índice).

## Contexto

El webhook de Calendly de un programa se suscribe a TODA su organización. En Retia cada programa tiene su propia org,
así que toda cita que llega es del programa. EstadoX no: AI Second Brain Jurídico comparte la org con Líderes Públicos
e IA para Abogados. Medido el 19-oct en producción (solo lectura): las 24 llamadas vigentes del programa son sueltas y
**todas** son de otros eventos (19 del `52d5a5c0…`, 5 de IA para Abogados `953f7b35…`), y cuentan como agendas.

También medido: el round robin del programa (`/d/dv7d-pg2-692/postulacion-second-brain-juridico-estadox`) no sale en
`GET /event_types?organization=…`, pero sí en `GET /event_types?user=…` de sus miembros (lo que ya hace
`eventoParaAgendar`, 280), con la URI `9ef431be…`, la misma que trae `payload.scheduled_event.event_type` del webhook.
Ningún programa tiene `calendly_url` configurado y no había pantalla para hacerlo.

## Decisión

1. **Los eventos de un programa** = su round robin (`programs.calendly_event_type`) ∪ el evento personal de cada
   membresía activa (`miembros_programa.calendly_event_type`, 280).
2. **El filtro se declara, no se deduce.** `programs.calendly_org_compartida` (falso por defecto) dice si la org la
   comparten otros programas. Falso (Retia): toda cita de la org cuenta, como hoy. Verdadero (EstadoX): un
   `invitee.created` cuyo `event_type` no está en el conjunto se guarda en el sobre, la entrega queda con motivo
   `evento_de_otro_programa` y no se escribe llamada. Se descartó encender el filtro al configurar el round robin:
   en una org de un solo programa descartaría en silencio citas de otros eventos del propio programa (p. ej. un
   closer que usa un evento personal distinto del asociado).
3. **Lo que el CRM ya conoce va antes del filtro.** Una cita cuya huella (`calendly:<uuid>`) ya existe, o una reagenda
   cuyo `old_invitee` es una llamada del programa, se procesa como hoy aunque su evento no esté en el conjunto.
4. **Un event type es de un solo programa.** Índice único parcial sobre cada columna, y los dos escritores validan
   contra la otra tabla en la misma transacción (un round robin no puede ser el evento personal de nadie, y al revés).
5. **El round robin se configura en Integraciones › Calendly** con su URL de agenda, junto con la marca de org
   compartida. Al guardar se resuelve a su URI por la API con el token del programa; si no se encuentra exactamente
   uno, falla con el error visible y no se guarda nada. `eventoParaAgendar` usa la URI guardada y deja de resolverla
   en cada reserva.
6. **Webhook Health avisa** cuando un programa tiene la org compartida y le falta el round robin: en ese estado solo
   pasan los eventos personales.

## Consecuencias

- Configurar un programa en una org compartida exige marcarla y cargar su round robin; olvidarlo deja pasar todo (falso)
  o casi nada (verdadero sin round robin), y por eso el aviso.
- Una cita de otro programa no se borra ni se inventa: queda en `sobres_crudos` y en `entregas_webhook`, visible.
- Las 24 sueltas ajenas de Second Brain Jurídico se anulan aparte (no se borran), con el molde de anulación.
