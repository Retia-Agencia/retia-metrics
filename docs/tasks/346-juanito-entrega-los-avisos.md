---
id: 346
etapa: avisos
serves: "ADR 0114 (el lado de Juanito)"
depends: [340, 343]
status: todo
---

# 346 — Juanito entrega los avisos y reenvía las confirmaciones

Toca el repo de Juanito (`30X/repos/Juanito`): cada cambio en el VPS lo aprueba Mani.

## Alcance

- Cron cada 5 min en horario hábil: `POST /api/avisos/pendientes`, entregar por su cola anti-ban (correo → número con
  su directorio y su opt-in; el grupo, por su id) y confirmar con `POST /api/avisos/entregados`.
- Después de interpretar la respuesta de confirmación (18.CN), reenviarla a `POST /api/avisos/confirmaciones`; si el
  CRM no responde, reintentar (es idempotente).
- **Desde el 3-nov (PUSH-1): el playbook de confirmación de 30X (§18.CU, `CALENDLY_PLAYBOOK`) en las conexiones de
  Retia**, en vez de la pregunta del Push 2. Hoy está amarrado a HubSpot y hay que soltarlo para Retia: el link de
  registro de cada toque va al deal del CRM, no a "Log WhatsApp message"; el texto es por programa ("del equipo de
  <programa>", nunca 30X ni HubSpot) y lleva solo el material del programa al que llegó el lead; la respuesta al
  corte se reenvía al 343 y no se guarda como fuente propia. Con el modo del 366 en aprobar, Juanito le pregunta al
  closer "¿cancelo a estas N?" y le reenvía el sí al CRM; con el sí, le arma al closer el "liberé el espacio" con el
  link para reagendar. Juanito nunca le escribe al lead.
- **Apagar el Push 5 (link al Sheet) para Retia** cuando 341 esté vivo.
- Alinear el directorio: todo closer activo de Retia en el CRM resuelve a un número. Medido el 3-nov contra
  producción: Dana, Juanjo, Nicolás y Maru (ComunicArte) coinciden; Andrea (`registro@ttrading.co`,
  `info@eventoscomunicarte.com`) y Maru en Tactical (`equipo@ttrading.co`) atienden por buzón de la empresa, que se
  queda así, y a su identidad solo le falta el correo del CRM; **Jerónimo (`jeronimosnbr@gmail.com`, ComunicArte y
  Tactical) no está en `src/calendly/closers.js`**, así que hoy no le llegaría ningún push.

## Done cuando

- Un aviso de prueba de cada tipo llega a su destino y queda como entregado en el CRM.
- Una respuesta "1 3" en un programa de Retia aparece como confirmación en la ficha del deal.
