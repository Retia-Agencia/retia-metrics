# Comercial y Dinero: cableado y textos (A-167 a A-170) — traspaso, 24-oct

Rama: `claude/comercial-dinero-cableado-ac7ad9` (worktree `.claude/worktrees/comercial-dinero-cableado-ac7ad9`).
Estado: commit WIP, a medio camino. Mani pidió parar y retomar en otra sesión.

## 1. Diagnóstico (hecho, solo lectura contra producción)

**El cableado de las consultas está bien. Los ceros eran el periodo "Hoy" (sábado 24-oct).**
`app/(app)/p/[programa]/hub/page.tsx` usaba `preset ?? "hoy"`: sin periodo en la URL (p. ej. al pasar
de la pestaña Hoy, que no tiene selector), Comercial y Dinero mostraban el día de hoy.

`armarVistaDelDashboard` medido para Tactical (program_id `5cc65048-7474-4762-b9b0-b7c8ce428531`):

| Cifra | Cohorte C3 (28-sep a 24-oct) | Semana 19 a 24-oct | Hoy (sáb 24-oct) |
|---|---|---|---|
| Agendas / Shows / Cierres | 295 / 32 / 17 | 83 / 10 / 5 | 0 / 0 / 0 |
| Caja (Recaudado) | USD 18.425 | USD 4.950 | vacío |
| Ventas por cohorte | C3: 17, USD 25.350 | C3: 5, USD 7.500 | vacío |
| Closers | Andrea 235 ag, 32 shows, 16 cierres, com. USD 800,40; Maru 60 ag, 0 shows, 1 cierre | Andrea 10 shows, 5 cierres | "nadie registró actividad" |
| Descuento promedio | 0,59 % (USD 8,82, 17 ventas) | | |
| Por cobrar (cartera) | 8 deals, USD 6.925 (foto de hoy) | | |

Coincide con lo medido el 24-oct (18 abonos USD 18.425, 17 ventas USD 25.350, 10 shows y USD 4.950 en la semana).
Las 32 llamadas con show contra las 29 de la medición: el embudo ancla en `coalesce(fecha_agenda, fecha_llamada)`
por día, incluidas las de hoy; falta conciliar esas 3 (probablemente citas de hoy o reagendadas).

- **Sin dueño por antigüedad = 0 es real**: ningún deal vigente de Tactical está sin owner (consulta por etapa).
  Arreglo de texto pendiente: con todo en 0, decir "Todos los deals abiertos tienen dueño" en vez de 4 filas en cero.
- **Tiempo en etapa / Potencial-Registrado**: cuenta deals que SALIERON de la etapa en el rango. En cohorte: potencial 188,
  registrado 4 (334 deals siguen quietos en Registrado), en gestión 1. Es real; falta explicarlo en palabras.
- **No shows con `fecha_agenda` en octubre**: Agendas por semana cuenta por el día de la cita ya pasada; correcto.

Scripts de diagnóstico (solo lectura, leen `../../../.env.local`):
`/private/tmp/claude-501/-Users-mani-Desktop-mani-work-retia-repos-retia-metrics-mani--claude-worktrees-comercial-dinero-cableado-ac7ad9/69d99b65-e6c5-40ab-8303-89b2973e106a/scratchpad/diag-hub.ts`
(`npx tsx <ruta> cohorte_actual|esta_semana|hoy|sem`) y `diag-sql.ts` (SQL de lectura). Copiarlos a `scripts/`, correr y borrar.

## 2. Hecho en el commit WIP (sin probar todavía)

- **Periodo por defecto** (A-168): `EntradaDeVista.periodoPorDefecto: "cohorte"` en `lib/queries/vista-dashboard.ts`
  (cohorte actual con ventana, si no este mes). `hub/page.tsx` lo pasa solo en Comercial y Dinero, y solo si la URL no
  trae claves de periodo (`CLAVES_DE_PERIODO`). ⚠️ **Se cruza con A-164** (sesión periodo-comparacion: "por defecto, la
  cohorte en curso"). Hablar con esa sesión y dejar UNA implementación; si ellos lo resuelven en `lib/periodo.ts`, quitar el mío.
- **Deals contra agendas** (A-167): nueva métrica `deals_que_agendaron` (filtro `filtroDealsQueAgendaron` en
  `metricas-filtros.ts`, lista en `metricas-con-filas.ts`, título en `hub/lista/page.tsx`). La serie
  (`lib/queries/deals-contra-agendas.ts`) cambia `razon` por `agendaron` + `pctAgendaron`: un deal "agendó" el día en que
  existe y tiene su primera agenda vigente, agendas hasta el último día del rango (así el último punto = la lista también en
  un periodo pasado). Medido: 330 de 762 deals de la cohorte (43 %); deals = personas (762 = 762 leads).
  Componente reescrito: frase "43 % de 762 deals agendó", eje con fechas reales ("19 oct"), B cortado al mismo hábil,
  cambio en palabras (`cambioEnPalabras`, `cambioDeTasaEnPalabras` en `lib/variacion.ts`, con test).
- **Nombres de listas**: `caja` → "Recaudado", `contratado` → "Vendido", `cartera` → "Por cobrar" (solo títulos; los ids
  de métrica se quedan para no romper URLs). Descripción de la pestaña Dinero actualizada.

## 3. Pendiente, en orden

1. `tests/deals-contra-agendas.test.ts`: cambiar `razon` por `pctAgendaron` y agregar un caso con agenda anulada, agenda
   posterior al rango y otro programa (la cifra contra la lista `deals_que_agendaron`).
2. Test de `periodoPorDefecto` en `tests/vista-dashboard.test.ts` (con cohorte → ventana; sin cohorte → este mes; URL con
   `periodo=hoy` explícito → hoy).
3. Renombres en pantallas (A-170): `components/dashboard/dinero.tsx` (Contratado→Vendido, Cartera→Por cobrar, gráficas
   "Recaudo"→"Recaudado"), `components/dashboard/piezas.tsx` (`CajaConVariacion`: "Caja recaudada"→"Recaudado"),
   comparativo de `operacion.tsx` (columna "Caja"→"Recaudado"), `app/(app)/hub/secciones.tsx` y `app/(app)/hub/lista/page.tsx`
   (todos los programas), `hoy.tsx` "Caja de hoy"→"Recaudado hoy" (avisar a la sesión de proyección). `docs/metricas.md` en el
   mismo commit, incluida la métrica nueva `deals_que_agendaron`.
4. Etapas (A-169) en `operacion.tsx`: Conversión por etapa con una sola columna "% que pasó al siguiente paso" (quitar
   "% desde entrada"); Tiempo en etapa sin "Varios tramos"; Sin dueño con mensaje cuando todo es 0.
5. Embudo comercial: la columna Cambio con `cambioEnPalabras`.
6. Letra chiquita: quitar "ADR 0023" y notas técnicas de `operacion.tsx` y `dinero.tsx`; `text-xs` → `text-sm` donde quede texto
   necesario; Tinta, `cifra`, `<Badge variant>`.
7. Copiar A-167 a A-170 de `docs/anotaciones.md` del checkout principal (sin commitear allá) a la rama y marcarlas.
8. Verificación: `npm install` en el worktree (falta `echarts`: typecheck falla en `components/graficas/lienzo-grafica.tsx`
   por entorno, no por el cambio), typecheck, lint, tests del cambio, `npm run build`, recorrido en `dev:local` claro/oscuro/375 px.
9. Daily brief al cerrar.
