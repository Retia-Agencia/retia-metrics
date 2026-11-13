---
id: 414
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §5 opción B y §6 · pedido de Dani Rodríguez (7-nov): sección diaria · docs/diseno-cifra-y-pauta.md §4.3"
depends: [412, 419]
status: en curso
---

# 414 — Tabla de Pauta por día

## Alcance

- Paso `dia` en `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) y en la tabla; interruptor Por semana | Por día en
  la URL (`lib/series-pasos.ts`); el título cambia ("¿Qué día rindió mejor?") y el chip dice "Cambio contra el día anterior".
- La última columna "en curso"; Comercial "Parcial" en ella. CSV por día.
- Columnas razonables con desplazamiento horizontal y la primera columna pegada.
- **Fila propia "Agendas según Meta"** en Tráfico (hoy va dentro del costo según Meta).
- Si Mani ya decidió D-A, D-B y D-E (403 F1), sus arreglos en este mismo archivo van **antes** (I-1, I-2, I-8), cada uno con su
  test en rojo primero.

**Bloqueo para cuadrar con el Excel (no para construir):** DM-8 (Q-2 y Q-3).

**Migración:** Ninguna.

## Done cuando

- [x] Test de paridad: la suma de los días de una semana = la semana (conteos y dinero; tasas sobre sus partes).
  *(12-nov: `tests/pauta-semanal.test.ts` › «414»: inversión, agendadas, agendas de Meta, ventas y vendido suman la semana;
  CPM, CTR y llegada suman sus partes; el costo de la semana es el gasto de los días entre sus agendas, porque un día con 0
  agendas no tiene costo.)*
- [ ] Por día con "en curso", "Parcial" y CSV; igual al boceto. *(Hecho: «en curso», «Parcial» en Comercial de la columna
  que contiene hoy, CSV `pauta-diaria-…csv` y textos de la celda en día. **Falta** compararlo lado a lado con el boceto.)*
- [x] Agendas según Meta como fila. *(Rótulo canónico «Agendas de Meta», justo antes de su costo; mismo número que el
  denominador del costo según Meta.)*

## Avance

**12-nov (carril P).** `cargarPautaSemanal` recibe `paso: "semana" | "dia"` y devuelve `columnas` y `celdas.porColumna`
(antes `semanas` y `porSemana`; renombrado en los llamadores y tests). Por día, una columna por día del periodo **hasta hoy**
(un día futuro no tiene nada que medir); las lecturas por columna (gasto, costos, dinero, ROAS) van de a 4 para no llenar el
pooler con ~31 columnas. El grupo de citas por día sale de `gruposPorTramo` (`lib/queries/tasas-del-grupo.ts`; `gruposPorSemana`
lo usa). La columna que contiene hoy marca Parcial las tres tasas de Comercial (también el Total si el periodo llega a hoy).
Interruptor **Por semana | Por día** en `?tabla=dia` (`pasoDeTablaDePauta`), el título cambia («¿Qué semana / día rindió
mejor?»), la leyenda de la línea pequeña va encima de la tabla, la columna Métrica queda pegada al desplazar y el botón dice
«Descargar CSV». `agendas_meta` apunta al concepto `costo_agenda_meta` en `lib/metricas/pendientes.ts` (es su denominador, no
concepto aparte; **archivo del carril D, una línea**).
**Verificado:** typecheck, eslint, 14 archivos de tests del área (245), `npm run build`, recorrido en `dev:local` como gerente
(oscuro escritorio, claro 375 px sin scroll de página, CSV 200, vista semanal intacta, consola limpia).
**Falta:** el chip «Cambio contra el día anterior» como interruptor (hoy la comparación va siempre y la leyenda lo dice);
comparar con el boceto; `test:humo`; el cuadre con el Excel (DM-8).
