---
id: 145
etapa: NC2
serves: "comercial.md R-6, GC-42, GC-43"
depends: []
status: done
---

# 145 — El rol Customer Success y el onboarding en cuatro pasos

## Enmienda del 8-oct (reunión con Michael y Jero): primero el rol con UNA marca

Se desbloquea con un alcance más chico. **Primera entrega:** el rol Customer Success, que ve Students con la
misma información que ve hoy un closer y **solo** puede marcar onboarded sí o no (la marca `onboarded_at`
que ya existe, 063/099). Nada más: no mueve deals, no ve Leads ni Deals.

Las personas: **Dani Rincón** (Tactical) y **Juanjo** (ComunicArte). Cada uno con membresía en su programa.

Los cuatro pasos de abajo quedan para después; QM-5 sigue abierta para esa segunda parte.

**Antes bloqueado por:** QM-5 (¿los cuatro pasos son fijos en el código o filas por programa? Recomendación:
filas por programa, ADR 0012).

## Objetivo

Un rol nuevo que solo ve Students y marca el onboarding paso por paso: mensaje de bienvenida por WhatsApp,
grupo de WhatsApp, correo de bienvenida y Circle. Cada paso con quién y cuándo; completo = los cuatro.

## Lo ya decidido

La pregunta del rol va en `lib/auth/roles.ts` con el molde del ADR 0052 (nunca un `rol ===` a mano) y el
developer pasa (ADR 0025). Reemplaza la marca única `onboarded_at` (099) con su traducción.
