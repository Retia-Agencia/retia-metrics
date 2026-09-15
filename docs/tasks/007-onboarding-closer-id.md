---
id: 007
serves: "spec §7 supuestos — onboarding de closers; precondición de ADR 0011"
status: todo
---

# 007 — Cargar closerId en las cuentas de los closers activos

## Objetivo
Andrea, Maru y Jero (y cualquier closer activo hoy) tienen su cuenta en `users` con `closerId`
cargado, para que ADR 0011 funcione desde el primer registro.

## Alcance
- Dentro: confirmar o crear la cuenta de cada closer activo en `users`, con `closerId` igual al
  texto exacto que usan en la BBDD de Sheets.
- Fuera: no crea un flujo de auto-registro. `users` se administra por `npm run usuarios`, como hoy.

## Done cuando
- [ ] Cada closer activo (mínimo Andrea, Maru, Jero) tiene fila en `users` con `rol="closer"` y
      `closerId` no nulo.
- [ ] `registrarLlamada` (ticket 002) probado contra una cuenta real de closer.

## Notas
Bloquea el uso real del MVP, aunque no bloquea el desarrollo de los tickets 001-006 (se puede
probar con datos de prueba mientras tanto).
