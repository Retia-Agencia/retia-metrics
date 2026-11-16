---
id: 450
etapa: entrada
serves: "ADR 0133 punto 3 · D6"
depends: [448]
status: todo
---

# 450 — El comprador se empareja con su lead, o espera en la bandeja

## Qué
Encontrar el lead del comprador dentro del programa de la fuente: correo normalizado primero, teléfono después.
Nunca cruza programas. **Si no cruza, no se crea nada** (D6): la compra alerta y queda en una bandeja de pagos sin
emparejar, donde alguien la asigna a un lead y entonces sigue su camino (455).

## Dónde mirar
`lib/ingesta/identidad.ts` (normalización de correo y teléfono, la única) · `lib/deals/crear-a-mano.ts` y la puerta
`crearDealDesdeSuelta` (ya usada en la recuperación del 15-oct, `docs/operations.md` §9) · ADR 0035.

## Cómo
1. Usar la normalización existente; no escribir otra (AGENTS.md › definición única).
2. Teléfono de Hotmart = `checkout_phone_code` + `checkout_phone`; se normaliza igual que el del formulario.
3. Dos leads posibles (correo de uno, teléfono de otro) → gana el correo y se deja nota del sistema.
4. Bandeja de pagos sin emparejar: lista por programa, con la acción de asignar a un lead del mismo programa (rol
   enforzado en el servidor y por funciones centrales de capacidad). La alerta sale por el registro único de alertas
   (`lib/alertas`, ADR 0130) salvo que la sesión encuentre un canal comercial ya existente que encaje mejor; si lo hay,
   lo propone en vez de inventar otro.
5. **Para que el correo cruce más:** probar si el checkout de Hotmart acepta el correo prellenado por la URL y, si sí,
   agregar `[correo]` al `redirectUrl` de los outcomes de LiderArte (skill `dforms-api`). Sin fuente verificada todavía.

## Done cuando
- [x] Tests: cruza por correo, cruza por teléfono, no cruza (va a la bandeja y alerta), correo de otro programa
      (no cruza), asignar desde la bandeja con un rol que no puede (403, base sin moverse).
