# 0048 — Un closer ve solo sus programas (y dentro de ellos, todo); el agregado suma solo lo sumable

**Fecha:** 2026-09-24 · **Reescrito:** 2026-09-27 (consolida el ADR retirado 0009, "todos ven todo")
· **Estado:** aceptado · **Implementación:** tickets 094 y 095

## De dónde viene

El 15-sep se decidió "todos ven todo": cualquier closer ve cierres, caja, pauta y el comparativo
entre closers de cualquier otro closer, la opción más transparente por defecto. El 24-sep Mani la
acotó: *"no todos los closers pertenecen a ambos programas; es clave definir el alcance de lo que
puede ver en métricas y operación"*. Y pidió un Dashboard que se pueda ver por programa **o** agregado,
porque Gerencia quiere el flujo de caja de Retia completa.

## Decidimos

**1. Un closer ve solo los programas donde tiene membresía ACTIVA, en operación y en métricas. Dentro
de su programa, ve todo:** los deals del equipo, la caja, la pauta y el comparativo entre closers. Fuera
de sus programas no ve nada: ni el dashboard, ni las listas, ni el selector lo ofrece.

- El **gerente** ve todos los programas; el **developer**, todo (ADR 0025).
- La pregunta *"¿qué programas ve esta sesión?"* vive en **una sola función** de `lib/auth/` y la
  usan la guarda de la ruta, las consultas y el selector. Nunca un filtro de membresía copiado en una
  consulta ni un `rol === "closer"` a mano.
- **Esconder el programa del selector no es seguridad:** la ruta y la consulta lo rechazan en el
  servidor, y se prueba forjando la petición (`AGENTS.md`).

**2. El Dashboard ofrece "todos los programas", y ahí solo suma magnitudes sumables en la misma
unidad.** La garantía vive en el **tipo**: la función del agregado no acepta una métrica de tipo tasa,
igual que el comparativo entre closers no se puede acotar (ADR 0023).

| Se suma en "todos los programas" | Va por programa, lado a lado |
|---|---|
| número de leads, deals, ventas, llamadas | % de show, % de cierre, conversión etapa a etapa |
| caja recaudada y saldo por cobrar (USD) | meta de cupos y meta dinámica (son de una cohorte) |
| gasto de pauta | CPL, CPI, CAC, ROAS |
| conteos por área y por canal | comisión (la tasa es por programa) |

La razón: un conteo o una suma de dólares significa lo mismo en los dos programas; una tasa no.
ComunicArte y Tactical tienen tickets y umbrales distintos, así que una tasa combinada se ve creíble y
no significa nada (ADR 0043). Para un closer, "todos los programas" son los suyos.

**3. Toda lista operativa es de un programa:** Leads, Deals, Calls, Students e Inbox, con selector
obligatorio (ADR 0050).

## Deuda que destapa (verificado el 24-sep)

`/programas/[slug]` deja entrar a un closer a cualquier programa activo, y `historialDePersona` no
lleva filtro de membresía. Lo cierra el ticket 094. Hoy no hay closers reales usando la app, así que no
hay exposición viva.

## Descartado

| Alternativa | Por qué no |
|---|---|
| "Todos ven todo" entre programas | Un closer de un programa no tiene por qué ver la operación del otro |
| Solo sus programas y, dentro, solo lo suyo | Rompe el comparativo, que es justo lo que el equipo quería ver |
| Alcance configurable por usuario | Más reglas sin un caso que lo pida |
| Agregado total, tasas incluidas | La tasa combinada no significa nada |
| Agregado lado a lado sin total | Deja sin respuesta el flujo de caja, que es una suma legítima |
