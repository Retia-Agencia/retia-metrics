---
id: 145
etapa: NC2
serves: "comercial.md R-6, GC-42, GC-43"
depends: [QM-5]
status: bloqueado
---

# 145 — El rol Customer Success y el onboarding en cuatro pasos

**Bloqueado por:** QM-5 (¿los cuatro pasos son fijos en el código o filas por programa? Recomendación: filas
por programa, ADR 0012).

## Objetivo

Un rol nuevo que solo ve Students y marca el onboarding paso por paso: mensaje de bienvenida por WhatsApp,
grupo de WhatsApp, correo de bienvenida y Circle. Cada paso con quién y cuándo; completo = los cuatro.

## Lo ya decidido

La pregunta del rol va en `lib/auth/roles.ts` con el molde del ADR 0052 (nunca un `rol ===` a mano) y el
developer pasa (ADR 0025). Reemplaza la marca única `onboarded_at` (099) con su traducción.
