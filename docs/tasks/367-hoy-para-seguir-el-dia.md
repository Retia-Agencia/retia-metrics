---
id: 367
etapa: hub
serves: "ADR 0086 punto 3 (Hub › Hoy), ADR 0115 N1, N3 y N5; Mani, 3-nov"
depends: []
status: todo
---

# 367 — Hoy sirve para seguir el día: citas vivas, canceladas aparte y la agenda por hora

## Por qué

El 3-nov Dani preguntó en el grupo de ventas "¿cómo vamos hoy de calls por programa?" y nadie pudo leerlo de Hub › Hoy
sin hacer cuentas. Medido ese día en Tactical: **"Citas de hoy" decía 9 y una estaba cancelada en Calendly**; el CRM
lo sabía (`calls.resultado = 'cancelada'`) y la contaba igual, porque la definición de `docs/metricas.md` §1.3 era
"cualquier resultado". La pantalla además estaba ordenada por cómo se calcula cada cifra, no por la pregunta del día,
con párrafos de nota bajo cada tarjeta.

Decisión de Mani (3-nov): **una cita cancelada no es una cita de hoy.** Se muestra aparte. Y lo que importa son las
agendas creadas **hoy** (desde la medianoche de Bogotá), no las de las últimas 24 h.

## Alcance

### 1. La métrica "Citas" excluye las canceladas (enmienda de §1.3)

- "Citas" (la tarjeta "Citas de hoy" de Hoy y "Agendas" de Comercial, `embudoDelRango.agendas`) cuenta las llamadas
  vigentes con cita en el rango **salvo `resultado = 'cancelada'`**. La lista detrás de la cifra
  (`metricas-con-filas.ts`, caso `agendas`, y su universo en `metricas-filtros.ts`) aplica el mismo predicado: la cifra
  y la lista siguen dando lo mismo (N1, N2).
- Nueva cifra **"Canceladas"**: las llamadas vigentes con cita en el rango y `resultado = 'cancelada'`, con su lista.
- **No cambia** el grupo de citas de las tasas (`grupoDeCitas`, ADR 0079): ahí la cancelada sigue contando como cita
  ocurrida no atendida. Son dos preguntas distintas; se dice en el diccionario.
- En el mismo commit (N8): fila de `docs/metricas.md` (§1.3 y la tabla de Hoy), vocabulario de `docs/overview.md` §11.

### 2. Hub › Hoy reordenado por la pregunta del día (`components/dashboard/hoy.tsx`)

De arriba abajo:

1. **¿Cómo vamos hoy?** Una fila en el orden del día: Leads de hoy → Agendas creadas hoy → Citas de hoy (vivas) →
   Show → Ventas. Bajo "Citas de hoy", el desglose por estado en una línea de chips (`<Badge variant>`): por venir, sin
   resultado (ya pasó la hora), show, no show, reagendadas, y **canceladas aparte** (no suman al total). Cada número
   abre su lista. Espacio reservado para "confirmadas" cuando exista el 343, sin mostrar un cero inventado (N3: hasta
   entonces no aparece).
2. **La agenda de hoy**: las citas del día ordenadas por hora, con closer y estado; la que ya pasó sin resultado,
   en tono de peligro. Las canceladas al final, atenuadas. Sale de la misma consulta que la lista de "Citas de hoy"
   más las canceladas (sin consulta nueva para la misma pregunta).
3. **Mañana**: citas de mañana (vivas), con su lista. Mismo predicado que el punto 1 con el rango de mañana.
4. **Lo que pide atención**: banderas y alertas; las que están en cero se agrupan en una línea "sin pendientes", las
   demás arriba.
5. **Cupos, proyección, caja y metas** debajo, compactos (siguen igual por dentro).
6. **Se quita "Lo que viene"** (ADR 0077: una tarjeta sin datos).

Las notas largas bajo cada tarjeta pasan a una línea corta; la explicación de cómo se cuenta va en el `title`/tooltip
o en la lista. Texto visible sin `utm_*`, ADR ni ids (N5). Todo con Tinta (`docs/structure.md` §9): ningún color,
sombra ni radio a mano, cifras en `cifra`, formato por `lib/format.ts`. Funciona en celular (una columna).

## Fuera de alcance

- Confirmadas (343) y cancelar a quien no confirmó (366).
- Cambiar el grupo de citas de las tasas de show y cierre.

## Done cuando

- [x] Test: una llamada cancelada con cita hoy no suma a "Citas" ni a su lista, sí a "Canceladas"; cifra = todas las
      páginas de su lista en las dos; una anulada no cuenta en ninguna; otro programa no cruza.
- [x] Test: el grupo de citas de las tasas no cambió (la cancelada sigue en el grupo).
- [x] Test: el desglose por estado suma el total de citas vivas.
- [x] `metricas.md` y `overview.md` §11 dicen lo mismo que el código.
- [ ] Typecheck, lint y tests focalizados del cambio limpios; `npm run build` queda sin ejecutar por instrucción del encargo.
- [ ] Recorrido en `dev:local`, escritorio y celular: cada número abre su lista y la consola queda limpia.
