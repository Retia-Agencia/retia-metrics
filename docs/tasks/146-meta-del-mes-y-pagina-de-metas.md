---
id: 146
etapa: NC2
serves: "comercial.md R-8, GC-44, GC-45, §5"
depends: [136]
status: done
sesion: M3 (ola O5, 4-oct)
---

# 146 — La meta del mes y la página de Metas

> **4-oct (Mani): desbloqueado.** QM-6: la meta del mes se reparte **pareja por día hábil** (la misma regla de
> la meta lineal, 020). QM-7: una venta cuenta a la meta de **la cohorte del deal**, no a la de la ventana abierta
> en la fecha; la cohorte se elige al registrar el primer abono (por defecto, la activa).

~~**Bloqueado por:**~~ QM-6 (la meta del mes repartida pareja por día hábil; Dani contó por semanas) y QM-7 (a qué
meta cuenta una venta de la C1 hecha en la ventana de la C2, y si la cohorte del primer abono se elige).

## Objetivo

La meta del mes derivada de la de la cohorte (§5), y una página de Metas con avance, deuda y las dos
compensaciones (en la semana y en lo que queda de la cohorte), siempre en número y %. La meta en cash usa el
ticket base de la cohorte (ADR 0065). Absorbe el 124 o lo deja como un corte más (se decide al desbloquear).

## Alcance (M3, 4-oct)

Decisiones de la sesión M3, cada una con su razón. Las que cambian una cifra van marcadas con 🔶 para que Mani
las confirme al revisar.

1. **Meta del mes de una cohorte** = `meta_cupos × hábiles de su ventana dentro del mes ÷ hábiles de la ventana`
   (QM-6, pareja por hábil; es `metaLineal` del 020 por los hábiles del mes, sin otra cuenta). La del programa es
   la suma de las cohortes cuya ventana toca el mes, del estado que sean. Sin redondear (lo hace `lib/format.ts`).
   Una cohorte sin `fecha_inicio_ventas` no tiene ventana: no aporta meta y la página lo dice (ADR 0022).
2. **Avance del mes** = ventas con fecha de venta en el mes (la MISMA definición del dashboard: `vendidosEn`,
   primera entrada a venta, sin cortesías, vigentes), **agrupadas por la cohorte del deal** (QM-7). Una venta de
   la C1 hecha en la ventana de la C2 suma a la fila de la C1 (cuya meta del mes puede ser 0) y al total. Un deal
   vendido sin cohorte va a una fila "sin cohorte" que suma al total y lo dice.
3. ✅ **(Mani, 4-oct: confirmado, como el dashboard)** **Esperado a hoy y deuda.** Esperado = `metaLineal × hábiles de la ventana dentro del mes hasta hoy,
   inclusive`; deuda = `max(esperado − vendidos, 0)`, en número y % del esperado. Es la convención del 020 y del
   dashboard (`vistaDeCohorteActiva`: hoy cuenta como transcurrido para el esperado y como restante para la
   compensación). Con ella el ejemplo de Dani del miércoles da 2,33 por día en la semana, no 3,5: Dani contó
   "al cierre del miércoles". Se usa la del 020 para que la página y el dashboard no den dos números distintos
   para la misma pregunta (AGENTS.md: una pregunta, un módulo).
4. **Compensación en la semana** (nueva): semana de lunes a domingo que contiene hoy; meta de la semana = suma por
   cohorte de `metaLineal × hábiles de su ventana en la semana`; ventas de la semana igual que el punto 2;
   por día = `metaDinamica({ meta: meta semana, vendidos semana, diasHabilesRestantes: hábiles de hoy al fin de
   la semana })`. Solo se muestra si el mes elegido es el actual.
5. **Compensación en lo que queda de la cohorte** = la meta dinámica que ya existe (020): se importa
   `vistaDeCohorteActiva` de `dashboard.ts`, sin editarlo, para que sea la misma cifra del dashboard.
6. **Cash.** Meta en cash de una cohorte = su meta del mes × `cohorts.precio_usd` (ticket base, ADR 0065), en USD.
   Avance en cash = **contratado** (suma del valor vendido de esas ventas), que vive en `lib/queries/saldo.ts`
   (ADR 0065 punto 6) como función nueva; las ventas sin valor vendido se cuentan aparte y se dicen. Siempre
   con la moneda al lado.
7. **El mes** sale de la URL (`?mes=AAAA-MM`, zod; inválido = mes actual de Bogotá, `hoyEnBogota()`).
8. **Toda cifra abre su lista (ADR 0067):** las ventas del mes y de la semana abren `/dashboard/lista` con
   `metrica=cierres` y el rango (`urlDeLista`), que cuenta la misma venta. 🔶 Las ventas **por cohorte** no
   tienen lista con filtro de cohorte todavía: se muestran sin enlace y queda como deuda nombrada aquí (la lista
   es de M1/137, no de esta sesión).
9. **Quién la ve:** igual que el dashboard, `paginaConRol("gerente", "closer")` + `programaVisiblePorSlug`
   (frontera de programa y alcance del ADR 0048; el developer pasa por `esAccesoTotal`). Un programa ajeno: 404.
   No hay meta por closer (ADR 0023).
10. **Entrada en el menú:** la pestaña de programa "Metas" vive en `lib/nav.ts` (`TABS_DE_PROGRAMA` y los items),
    no en `app-sidebar.tsx`, que solo pone el icono. Nadie más de la O5 toca `lib/nav.ts`.
11. **El 124 no se absorbe:** el reparto por área es de Pauta, que queda después de v1 (R-9). Entrará como un
    corte más de esta página.
12. **El 148 (Pulso) lo puede montar:** el módulo exporta una función pura de armado y una de lectura, con tipos,
    para que el Pulso importe la misma cifra. Sin migración.

## Done cuando

- [x] `lib/queries/metas.ts`: la cuenta pura (cohortes + ventas + hoy → meta del mes, esperado, deuda,
      compensaciones) separada de la lectura de la base, con tests puros: el ejemplo de §5 (ventana del 31-ago al
      9-oct, 30 hábiles, 60 cupos) da 2 / 44 / 14 cupos para agosto, septiembre y octubre y USD 88.000 en
      septiembre a USD 2.000; dos cohortes en el mismo mes suman; un mes fuera de toda ventana da meta 0 y lo dice;
      hoy en sábado; 0 hábiles restantes no divide por cero.
- [x] Test con PGlite (`tests/metas.test.ts`): una venta de la C1 en la ventana de la C2 cuenta a la C1; un deal
      anulado, una cortesía y una venta de otro programa no cuentan; un deal con Abonado en septiembre y Completo
      en octubre cuenta una vez, en septiembre; las ventas del mes son las mismas que la lista `cierres` del mismo
      rango; contratado = suma del valor vendido.
- [x] `/p/[programa]/metas` con Tinta (`structure.md` §9): meta del mes en cupos y USD, avance, deuda y las dos
      compensaciones, todo en número y %, tabla por cohorte; cifras de la lista con enlace.
- [x] La guarda mordida: un closer sin membresía en el programa recibe 404 (`tests/metas-pagina.test.ts`).
- [x] Typecheck, lint, tests del ticket, `npm run build`; recorrido en `dev:local` como gerente y como closer, en
      escritorio y 375 px, con la consola limpia.

## Nota de cierre (M3, 4-oct)

Implementó Codex (dos pasadas) y revisó M3. Queda en `review` hasta el checkpoint verde que lo incluya.

- **Archivos:** `lib/queries/metas.ts` (nuevo: `armarMetasDelMes` pura, `leerMetasDelMes`, `nombreDelMes`,
  `moverMes`), `lib/queries/saldo.ts` (solo `contratadoDeDeals` nueva, ADR 0065 punto 6),
  `app/(app)/p/[programa]/metas/page.tsx`, `components/metas/metas-del-mes.tsx`, `lib/nav.ts` (pestaña
  `metas` tras Dashboard), `components/app-sidebar.tsx` (solo el icono), `tests/metas.test.ts`,
  `tests/metas-pagina.test.ts`. No toca `dashboard.ts` ni `vista-dashboard.ts`: solo importa.
- **Verificado:** typecheck, lint, `npm run build`; tests `metas`, `metas-pagina`, `vigencia-centralizada`,
  `paginas`, `roles` y `ficha-programa` (160 en verde). Suite completa: la corre el CI.
- **Recorrido en `dev:local`** (escritorio y 375 px, consola sin errores): gerente y closer ven la misma página;
  la venta del mes (2) abre la lista `cierres` con 2 filas; la compensación de la cohorte (0,70) es la misma
  meta dinámica del dashboard; el cambio de mes y el menú móvil abren. **Frontera mordida forjando la
  petición:** `mani.closer` (solo ComunicArte) recibe 404 en `/p/tactical-local/metas` y 200 en ComunicArte.
- **Para el 148 (M1):** el Pulso puede importar `leerMetasDelMes` y el tipo `MetasDelMes`, y el Dinero el
  `contratadoDeDeals` de `saldo.ts`, en vez de recontar.
- **Deuda nombrada:** las ventas por cohorte no abren lista (la lista no filtra por cohorte todavía); los 🔶 del
  alcance (convención de hoy, punto 3) esperan el ok de Mani. En fin de semana la tarjeta de la semana dice lo
  que quedó sin vender en vez de un ritmo por día.
