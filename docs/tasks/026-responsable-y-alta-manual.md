---
id: 026
fase: F1
serves: "ADR 0021; spec §7 (lead que no pasó por el formulario)"
depends: [015]
status: done
---

# 026 — Responsable de la persona y alta manual

## Objetivo
Toda persona puede tener un closer responsable asignado en el CRM, y un closer puede crear una
persona que llegó sin formulario (WhatsApp, masivos), quedando como su responsable.

## Alcance
- Dentro: columnas en `people`: responsable (`closerId` en texto, ADR 0011, nullable) y entrada
  (`formulario` | `crm`, default `formulario`). Migración generada, **sin aplicar** hasta el ok
  de Mani.
- Dentro: `asignarResponsable(personaId, closerId)` con estas reglas: un closer solo se asigna a
  sí mismo una persona sin responsable; un gerente asigna o cambia cualquiera, solo a closers
  activos que venden en ese programa (`miembros_programa`, 015). Cada cambio va a `change_log`.
- Dentro: `crearPersonaManual({ programa, correo, nombre?, telefono? })`, solo closer: correo
  obligatorio y normalizado, entrada `crm`, el closer queda como responsable. Si el correo ya
  existe en ese programa, no duplica: devuelve la persona existente (ADR 0005).
- Dentro: el sync nunca lee ni escribe el responsable. Cuando encuentra una persona con entrada
  `crm`, completa sus datos del formulario y la pasa a entrada `formulario`.
- Dentro: validación zod en el borde; un id que no es uuid da 400, no 500.
- Fuera: la UI (buscar, "tomar", "crear persona") va en 003; la vista "por asignar" y la
  separación por entrada en el dashboard van en 004/005; reparto automático (descartado en ADR 0021).

## Done cuando
- [x] Un closer toma una persona sin responsable; intentar tomar una ajena falla con 403.
- [x] Un gerente reasigna una persona a otro closer del programa; a un closer inactivo o de otro
      programa falla con 400.
- [x] Un closer crea una persona manual y queda como responsable; repetir el correo no duplica.
- [x] Un sync sobre una persona con responsable lo conserva (test en `plan-sync`).
- [x] Un sync sobre una persona manual la pasa a entrada `formulario` sin perder el responsable.
- [x] Toda asignación y alta queda en `change_log` con `userId`.

## Notas
El gerente no crea personas manuales: registrar trabajo de venta es del closer (ADR 0003).
