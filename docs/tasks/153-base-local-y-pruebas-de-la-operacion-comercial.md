---
id: 153
etapa: NC2
serves: "Hito B: probar a mano la operación comercial completa antes de migrar y de meter closers"
depends: [142, 151, 128, 118]
status: en curso
---

# 153 — La base local para operar como closer, y la lista de pruebas de la operación comercial

**Origen:** Mani, 2-oct: antes de la migración quiere operar él mismo TODO el flujo de 30X como closer en local y
verificar que todo está en orden y se ve.

## Objetivo

1. `scripts/seed-local.ts` deja deals en **las 11 etapas** (incluidas Potencial, En gestión y Calificado), leads con
   2 envíos (parcial y completo), una cita suelta de Calendly, un deal con saldo pendiente, un student por
   onboardear y cuentas locales de closer (con membresía en un solo programa), gerente y developer.
2. `docs/pruebas-operacion-comercial.md`: una lista de pruebas numeradas, cada una con **qué hacer, dónde (ruta) y
   qué debe verse**, y una casilla para marcar. Cubre: entrada de un envío y su reenvío (151); tomar un lead (En
   gestión); contacto logrado (Contactado) e intento fallido; calificar; agendar; atendido con y sin Grain; no show y
   re-agenda; compromiso verbal; abono parcial y completo; el camino solo por WhatsApp sin llamada (E2 → E6; el abono
   antes del contacto logrado se rechaza); perder y recuperar; anular; onboarding a Students; Inbox, sin dueño y "se
   perdió en el Calendly"; alertas de la ficha (128); Urgencias; crear un deal a mano; y que un closer no ve otro
   programa (404).
3. La lista sale del motor (`lib/deals/etapas.ts`, `lib/deals/requisitos.ts`) y de `docs/manual-gestion-comercial.md`,
   no de memoria. Lo que falle al recorrerla va a `docs/anotaciones.md` con su id `A-NN`.

## Done cuando

- [x] `npm run db:local` + `npm run dev:local` levantan con todas las etapas pobladas.
- [ ] La lista está escrita y recorrida una vez por la sesión (sin errores en consola), y Mani la recorre como closer.
- [ ] No toca producción.
