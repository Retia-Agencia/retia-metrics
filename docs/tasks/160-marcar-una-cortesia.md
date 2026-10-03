---
id: 160
etapa: O2
serves: "ADR 0071 punto 10 (QM-12)"
depends: [142, 143]
status: done
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

## Cierre 2-oct (Codex implementa, Claude revisa)

- **Quién marca: solo quien administra** (`esAdministrador`: gerente y developer). Lo decidido en el alcance: por el
  ADR 0074, lo que reparte el crédito de las ventas (y la comisión) es de quien administra, y regalar un cupo también es
  plata. El closer dueño no marca.
- **Marcar es una sola operación** (`marcarCortesia`, `lib/deals/cortesia.ts`): `cortesia = true` y valor vendido 0
  con rastro, y el deal pasa a Ganado Pagado Completo por la flecha del sistema (E6, E11 o E12), porque a Ganado hoy solo
  se llega con un abono. Se puede desde Contactado, Calificado, Atendido o Compromiso Verbal y sin abonos vigentes; si
  falta el área declarada el motor la rechaza y no cambia nada. Desmarcar no existe (fuera de alcance).
- **Motor:** con la marca, `valor_vendido` y `abono` se cumplen (`lib/deals/requisitos.ts`); sin ella nada cambia. La
  ficha y el Kanban leen la marca, así que una cortesía no sale en rojo.
- **Métricas, por construcción:** `vendidosEn` y `ventasConDiaEn` (la única definición de venta) dejan fuera las
  cortesías, así que cierres, tasa de cierre y comisión no las cuentan. `ventasDeCohorte` (avance hacia la meta de la
  cohorte) tampoco: es una cifra de ventas. Students sí (por etapa, `estudiantes.ts` no cambió). La cifra
  "Cortesías" vive en el dashboard del programa, al lado de los cierres, y abre su lista (`metrica=cortesias`, ADR
  0067); cifra y lista salen de `filtroCortesias`. La vista "todos los programas" no la tiene todavía.
- La etiqueta "Cortesía" de la ficha se ve donde están Editar y Anular, o sea, solo para quien puede trabajar el deal.
- Manual: se quitó "Marcar una cortesía · Mientras: avisa a gerencia".
- Tests: `tests/cortesia.test.ts` (nuevo: el camino bueno, closer 403 con la base quieta, con abono, etapa equivocada,
  rollback sin área, y cada cifra), más `deal-requisitos`, `acciones-ficha-deal`, `142-nuevas-deal-requisitos`. Codex
  corrió los 10 archivos del brief: 351 en verde. Nivel 1 de la sesión: typecheck, lint y `npm run build` en verde; sin
  correr tests en local (swap alta), los valida el checkpoint.
- **Mordido forzando la petición** (`dev:local`, 31161): se capturó el id de `marcarCortesiaAccion` desde la sesión
  del gerente sin enviarla, y se invocó a mano desde una sesión de closer: `{ ok: false, error: "Marcar una cortesía es
  de quien administra." }`, y el deal siguió en Contactado, sin marca y sin fila en `change_log`. Después el gerente la
  marcó desde la ficha: Ganado Pagado Completo, valor USD 0, descuento 100%, saldo 0, "Nada pendiente"; el dashboard
  dice "2 cierres sobre llamadas con show · 1 cortesía aparte" y la lista abre con ese deal. Consola limpia.
