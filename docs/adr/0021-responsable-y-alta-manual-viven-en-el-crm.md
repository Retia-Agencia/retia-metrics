# 0021 — El responsable de una persona y el alta manual viven en el CRM, no en Sheets

**Fecha:** 2026-09-16 · **Estado:** aceptado (Mani, en `/grill-with-docs`; pedido de Michael)

Michael pidio el 16-sep que toda persona tenga un closer responsable y que el closer la cree o se
la asigne "en la plataforma, como en Kapso". Leido al pie de la letra, eso choca con ADR 0004
(Sheets es la fuente de verdad de los leads). Revisamos las hojas en vivo: los formularios de los
dos programas no tienen ninguna columna de closer ni de responsable. El dato no existe hoy en
ningun lado.

**Decidimos que ADR 0004 cubre lo que el formulario captura, y nada mas.** El responsable y las
personas creadas a mano son del CRM, igual que las llamadas y ventas desde ADR 0008:

- **El responsable es un campo de la persona que solo escribe la app.** El sync nunca lo lee ni
  lo pisa, y la app no lo escribe de vuelta a la hoja. Se guarda como el mismo `closerId` en
  texto de ADR 0011, no como relacion a `users`.
- **Asignar:** un closer se asigna personas sin responsable; solo un gerente cambia a una persona
  que ya tiene responsable. Cada cambio va a `change_log`.
- **"Sin responsable" es un estado valido.** El sync sigue trayendo personas sin responsable y no
  hay reparto automatico ni backfill. "Siempre tiene responsable" es una meta operativa que la app
  hace visible (cuantas faltan), no una restriccion de la base.
- **Alta manual:** el closer crea una persona que no paso por el formulario (WhatsApp, masivos)
  con correo obligatorio y queda como su responsable. Se marca que entro por el CRM. Si despues
  aplica por el formulario, el sync la encuentra por correo (ADR 0005), completa sus datos y pasa
  a contar como del formulario; ante conflicto en un campo del formulario, gana la hoja.
- **Metricas:** las personas manuales cuentan en el embudo, pero se pueden separar por su entrada.
  El CPL usa solo las del formulario, porque la pauta solo paga esas.

Se descartaron dos alternativas. Escribir el responsable tambien en la hoja cumplia la letra de
ADR 0004, pero exigia escritura a Sheets y dejaba una columna editable a mano: dos verdades. Una
columna que el equipo llena en la hoja contradecia el pedido de Michael de asignarlo en la app.
