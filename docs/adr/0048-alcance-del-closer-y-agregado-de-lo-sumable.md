# 0048 — Un closer ve solo sus programas, y el agregado de programas suma solo lo sumable

**Fecha:** 2026-09-24 · **Estado:** aceptado (Mani, preparación de la reunión con Comercial) ·
**Implementación:** tickets 094 y 095 · **Enmienda:** ADR 0009 ("todos ven todo"), ADR 0043 punto 4
(el programa es frontera) · **Origen:** `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §3.1 y §5

## El problema

Dos pedidos de Mani chocan con dos reglas vigentes:

1. **"No todos los closers pertenecen a ambos programas; es clave definir el alcance de lo que puede
   ver en métricas y operación."** El ADR 0009 dice lo contrario: *"cualquier closer puede ver
   cierres, caja recaudada y comparativo de cualquier otro closer y programa"*. Hoy
   `/programas/[slug]` deja entrar a cualquier closer a cualquier programa activo. Las membresías
   (`miembros_programa`) existen, pero solo acotan qué catálogos puede editar un closer
   (`exigirAccesoAlPrograma`, ADR 0016), no qué ve.
2. **Un Dashboard que se pueda ver por programa "o el agregado"**, porque Gerencia pidió flujo de caja
   y rendimiento de Retia completa. El ADR 0043 punto 4 dice: *"de nada sirve combinar métricas de
   programas"* y pide que una vista que cruce programas sea imposible de construir.

## Decidimos

**1. Un closer ve solo los programas donde tiene membresía ACTIVA, en operación y en métricas.**
Dentro de su programa sigue rigiendo "todos ven todo" (ADR 0009): ve los deals del equipo, la caja,
la pauta y el comparativo entre closers. Fuera de su programa no ve nada: ni el dashboard, ni las
listas, ni el selector de programa lo ofrece.

- El **gerente** ve todos los programas. El **developer** ve todo (ADR 0025).
- La pregunta *"¿qué programas ve esta sesión?"* vive en **una sola función** de `lib/auth/`, igual
  que `esAccesoTotal`, `esAdministrador` y `trabajaLeads`, y la usan la guarda de la ruta, las
  consultas y el selector. Nunca un `rol === "closer"` a mano ni un filtro de membresía copiado en
  cada consulta.
- **Esconder el programa del selector no es seguridad:** la ruta y la consulta lo rechazan en el
  servidor, y se prueba forjando la petición (AGENTS.md, "cómo se muerde una server action").

**2. El Dashboard puede mostrar "todos los programas", pero ahí solo suma magnitudes sumables en la
misma unidad.**

| Se suma en "todos los programas" | No se suma: va por programa, lado a lado |
|---|---|
| número de leads, de deals, de ventas, de llamadas | tasas: % de show, % de cierre, conversión etapa a etapa |
| caja recaudada (USD) y saldo por cobrar (USD) | meta de cupos y meta dinámica (son de una cohorte) |
| gasto de pauta | CPL, CPI, CAC, ROAS |
| conteos por área y por canal | comisión (la tasa es por programa) |

- La razón: un conteo o una suma de dólares significa lo mismo en los dos programas; una tasa no.
  ComunicArte y Tactical tienen tickets distintos (USD 697 o 797 contra 1.500) y umbrales distintos,
  así que **una tasa de cierre combinada se ve creíble y no significa nada**, que es exactamente lo
  que el ADR 0043 quería impedir.
- Para un closer, "todos los programas" son **los suyos**.
- La garantía vive en el **tipo** de la consulta, como el comparativo del ADR 0023: la función que
  arma el agregado **no acepta** una métrica de tipo tasa. No se confía en la revisión.

**3. Toda lista operativa es de un programa.** Leads, Deals, Calls, Students e Inbox muestran un
programa a la vez, con selector obligatorio. Solo el Dashboard tiene la opción "todos los programas".
Esto no cambia nada del ADR 0043: es su punto 4 aplicado a las pantallas.

## Consecuencias

- El ADR 0009 queda **enmendado**, no reemplazado: su política sigue viva **dentro** del programa.
- El ADR 0043 punto 4 queda **enmendado**: la frontera se conserva para identidad, listas y tasas; se
  abre solo para sumas en la misma unidad.
- `docs/spec.md` §1 pilar 2 y §5 criterio 2 dicen "cualquier closer"; pasan a "cualquier closer del
  programa".
- **Deuda que esto destapa en el código de hoy** (verificado el 24-sep): el buscador de `/personas`
  ya se limita a los programas con membresía activa (`buscarPersonas`, `lib/queries/personas.ts`),
  pero `/programas/[slug]` deja entrar a un closer a cualquier programa activo, y `historialDePersona`
  no lleva filtro de membresía a propósito, porque se entraba desde ese dashboard. Lo cierra el ticket
  094, con una sola función de alcance que usen los tres. Hoy no hay closers reales usando la app, así
  que no hay exposición viva.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener "todos ven todo" entre programas | Mani lo descartó: un closer de un programa no tiene por qué ver la operación del otro |
| Solo sus programas y, dentro, solo lo suyo | Rompe el comparativo del ADR 0023, que es justamente lo que el equipo quería ver |
| Alcance configurable por usuario | Más reglas que mantener y probar, sin un caso que lo pida hoy |
| Agregado total, tasas incluidas | Revierte el ADR 0043 con el argumento que el mismo ADR ya refutó |
| Agregado lado a lado sin total | Deja sin respuesta la pregunta de flujo de caja de Gerencia, que es una suma legítima |
