---
id: 160
etapa: O2
serves: "ADR 0071 punto 10 (QM-12)"
depends: [142, 143]
status: todo
---

# 160 — Marcar una cortesía en el deal

## Por qué existe

El ADR 0071 (punto 10) decidió que la cortesía es un deal con 100% de descuento y una marca. La columna ya existe
(`deals.cortesia`, migración 0058), pero **nadie la escribe ni la lee**: no hay cómo marcarla en la ficha, el motor
no acepta valor vendido 0 con ella, y un deal de cortesía sale en rojo en valor y abono (handoff, 2-oct).

## Alcance

1. En la ficha del deal, quien administra marca "Cortesía" (con rastro). Decidir en el ticket si el closer dueño
   también puede, con la regla del ADR 0074 (lo propio del closer).
2. `lib/deals/requisitos.ts`: con la marca, valor vendido 0 y sin abono son válidos para entrar a Ganado Pagado
   Completo; sin la marca, nada cambia.
3. Las métricas: cuenta como Student, **no** en ventas, ni en tasa de cierre, ni en comisión; se ve aparte en el
   dashboard (cifra "cortesías" con su lista, ADR 0067).

## Done cuando

- Un deal marcado como cortesía entra a ganado sin abono y no sale en rojo.
- Ventas, tasa de cierre y comisión no lo cuentan; Students sí. Test por cada cifra.
- La marca se prueba forjando la acción desde una sesión sin permiso: 403 y la base quieta.
