---
id: 187
etapa: O6
serves: "ADR 0079; 148 (Lo que sigue, punto 3); overview.md §7"
depends: [148]
status: en curso
---

# 187 — Las tasas del embudo sobre el mismo grupo de personas

## Por qué existe

El % de cierre dividía ventas por fecha de venta entre shows por fecha de llamada: dos grupos distintos, y podía
pasar de 100%. Por closer mezclaba al dueño del deal con quien tomó la llamada. Mani decidió (4-oct, ADR 0079) que
toda tasa sea real: el mismo grupo arriba y abajo.

## Alcance

1. **Un módulo** en `lib/queries/` con la cohorte de citas del rango (ADR 0079 puntos 1 y 2) y la cadena: % de show,
   % de cierre, agenda → venta, por programa y por closer (punto 4). Pura la cuenta, aparte la lectura, como el 065.
2. **Lo usan todos:** el Pulso y la Operación comercial del dashboard, el comparativo entre closers, Mi espacio ›
   Métricas (`lib/queries/mi-espacio-metricas.ts`) y la lista de cada tasa (`metricas-con-filas.ts`): la lista abre
   exactamente los deals del grupo (ADR 0067).
3. **"Aún madurando"** cuando el rango termina hace menos de 30 días (punto 5), en una línea junto a la tasa.
4. Las cantidades (ventas, caja, contratado) no cambian.
5. `analytics.md` §6 y `structure.md` §9 dicen la definición si la nombran.

## Done cuando

- Un test con PGlite: un deal con show la semana pasada y venta hoy entra al grupo de la semana pasada, no al de
  esta; ninguna tasa pasa de 100%; % de show × % de cierre = agenda → venta; un no-show re-agendado con show cuenta
  una vez; anulados, cortesías, citas futuras y otro programa no cuentan.
- Por closer: un deal cuyo show tomó Ana y cuyo dueño es Beto cuenta en el % de cierre de Ana.
- El dashboard, el comparativo y Mi espacio dan el mismo número para el mismo closer y rango.
- Cada tasa abre su lista y la lista tiene tantas filas como dice la cifra.
- Typecheck, lint, tests del ticket, `npm run build`; recorrido en `dev:local` como gerente y closer, 375 px.

## Decidido al construir (5-oct, Alejo + Claude)

1. **Qué cita mete a un deal en el grupo:** toda cita del rango cuya hora ya pasó, salvo la **reagendada** (la
   representa su cita nueva). Entran el show, el no-show, la cancelada y la que sigue sin resultado (cuenta como
   no-show hasta que se registre: la lista "Llamadas pasadas sin resultado" es la que lo arregla).
2. **A qué closer va cada deal:** al de su último show del rango o, sin show, al de su última cita. Cada deal cuenta
   en UN closer, y la suma de los grupos de los closers es el grupo del programa.
3. **Agenda → venta = deals con show vendidos hoy ÷ grupo**, para que % show × % cierre = agenda → venta también por
   closer. Un vendido sin show en el rango no entra a la cadena; sí a las ventas del periodo.
4. **El embudo comercial de Operación** sigue mostrando cantidades del periodo (agendas, shows, cierres por fecha);
   el "% del paso" sale del grupo, y debajo una línea con el grupo (con cita, con show, vendidos), cada número con su
   lista (`grupo_citas`, `grupo_shows`, `grupo_vendidos`), agenda → venta y "Aún madurando".

## Nota de cierre (5-oct, Alejo + Claude)

- `lib/queries/tasas-del-grupo.ts`: cuenta pura (`calcularTasasDelGrupo`) y lectura (`leerCitasDelGrupo`, con la
  clave del closer resuelta como en el comparativo). `embudoDelRango` y `embudoPorCloser` toman de ahí `pctShow`,
  `pctCierre`, `agendaAVenta`, `grupo` y `madurando`; las cantidades no cambiaron. Lo heredan el dashboard, el
  comparativo, "todos los programas" y Mi espacio (su tasa abre `grupo_vendidos` y avisa "Aún madurando").
- Tests: `tests/tasas-del-grupo.test.ts` (los casos del "Done cuando"); `dashboard.test.ts` y `vista-todos.test.ts`
  tenían llamadas sin deal con la definición vieja: ahora cada cita cuelga de un deal, con los mismos números.
- Nivel 1: typecheck y lint limpios; tests de métricas, guardianes y páginas en verde. `npm run build` compila; su
  chequeo de tipos local cae solo por `.next/dev/types` viejo (rutas borradas), no por este cambio: lo valida el CI.
- **Falta:** el recorrido en `dev:local` como gerente y closer a 375 px, y el checkpoint.
- **Revisión de Codex (solo lectura):** sin hallazgos en la identidad del closer (grupo y comparativo usan el mismo
  join), en la igualdad dashboard = comparativo = Mi espacio, en la frontera de programa, anulados, cortesías,
  citas futuras y fechas nulas. Tres hallazgos que quedan fuera, como lo que sigue:
  1. Las tasas de cada fila del comparativo no abren su lista: es el alcance del **188**.
  2. El % de show por canal (`embudoPorCanal`, `origen-por-canal.tsx`) sigue dividiendo llamadas; pasarlo al grupo
     pide la atribución por canal de cada deal (hechos del embudo). Va con el 188 o un ticket propio.
  3. `desglosesDelResumen` junta el desglose por closer por el NOMBRE y no por la clave: dos cuentas sin `closer_id`
     con el mismo nombre se funden (el subtotal cuadra). Ya existía; afecta a todas las listas.
