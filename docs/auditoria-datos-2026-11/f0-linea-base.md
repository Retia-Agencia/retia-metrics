# F0 — Línea base de la auditoría de métricas y datos (ticket 385)

- **Fecha de la medición:** 7-nov-2026 (Bogotá), tomada entre las 13:30 y las 14:00.
- **Commit del código medido:** `10467f24` (rama `claude/competent-meninsky-6bf70f`, que parte de `main`).
- **Base:** producción (ref `hfqmiyiuyqapdsbywrag`), **solo lectura** (`SELECT` y las funciones de `lib/queries/`). Nada se escribió.
- **Privacidad:** solo conteos, ids opacos recortados y montos; ningún nombre, correo ni teléfono.

## 1. Números dorados

### Cómo se obtuvieron

Un script desechable (no se commitea) llamó, con rol `developer` y la conexión directa, a **las mismas funciones que usa la app**:

| Superficie | Función |
|---|---|
| Hub › Comercial y Dinero | `resolverContextoDeVista` + `armarVistaDelDashboard` (`lib/queries/vista-dashboard.ts`) |
| Metas y cohorte | `leerMetasDelMes` (`lib/queries/metas.ts`), mes del último día del periodo |
| Students | `studentsDelPrograma` + `totalesDeStudents` (`lib/queries/estudiantes*.ts`), foto de hoy, todas las cohortes |
| MCP `resumen_del_hub` y `consultar_metrica` | `resumenDelHubMcp.ejecutar` y `consultarMetricaMcp.ejecutar` (`lib/mcp/herramientas/metricas.ts`) con un contexto simulado de developer |

**Periodos** (hoy = 2026-11-07, `periodo=custom` con fechas explícitas para que sean reproducibles):
`mes_cerrado` = 2026-10-01 a 2026-10-31 · `mes_en_curso` = 2026-11-01 a 2026-11-07 · `custom14` = 2026-10-24 a 2026-11-06 (14 días).
**Programas activos:** 4. **Moneda:** el valor vendido, la caja y el saldo van en USD (los tickets son USD); cada monto lleva su moneda.

### Lectura rápida (lo que esta línea base ya enseña)

1. **Hub y MCP dan lo mismo en los 4 programas y los 3 periodos** (`resumen_del_hub` entero igual a la vista del Hub; `consultar_metrica` igual en cierres, agendas, shows, grupo_vendidos y leads). **Esto es paridad por construcción, no independiente:** el MCP importa las funciones del Hub. Una discrepancia solo puede aparecer contra una reconstrucción desde las tablas (F2).
2. **El hueco de captura es el mayor del embudo:** Comunicarte octubre tiene 313 agendas y 265 citas sin resultado; los porcentajes de show salen sobre el resto (ver tablas).
3. **Metas y Hub › Dinero no comparan lo mismo por diseño:** Metas cuenta ventas del mes por cohorte; el Hub, ventas del rango. Con los periodos `custom14` y `mes_en_curso` las "Metas del mes" son las del mes del último día, no las del rango (se anota en la fila).
4. El nombre "cierres" del Hub y del MCP es el conteo de ventas del rango; "grupo vendidos" es otro universo (deals con show que hoy están vendidos). Es el caso 0 del ticket (17 contra 11); la explicación se confirma en F2.

### Tablas por programa


#### AI Second Brain Jurídico (programa `second-brain-juridico`, id `9fa173fd…`)

| Cifra | mes_cerrado (2026-10-01 a 2026-10-31) | mes_en_curso (2026-11-01 a 2026-11-07) | custom14 (2026-10-24 a 2026-11-06) |
|---|---|---|---|
| Hub › Comercial: agendas | 3 | 0 | 0 |
|   canceladas | 0 | 0 | 0 |
|   citas sin resultado | 0 | 0 | 0 |
|   shows (llamadas con show) | 0 | 0 | 0 |
|   % show (por periodo) | — | — | — |
|   cierres (ventas en el rango) | 0 | 0 | 0 |
|   % cierre / agenda a venta | — / — | — / — | — / — |
|   grupo: deals · con show · vendidos | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
|   grupo: cobertura · parcial | — · entera | — · entera | — · entera |
|   grupo: % show · % cierre | — · — | — · — | — · — |
|   leads (personas) | 106 | 194 | 278 |
| Hub › Dinero: ventas | 0 | 0 | 0 |
|   vendido (USD) | 0 USD | 0 USD | 0 USD |
|   recaudado de esas ventas (USD) | 0 USD | 0 USD | 0 USD |
|   por cobrar (USD) | 0 USD | 0 USD | 0 USD |
|   caja del periodo (por moneda) | 0 (sin caja) | 0 (sin caja) | 0 (sin caja) |
|   comisión total (USD) · ventas sin comisión | 0 USD · 0 | 0 USD · 0 | 0 USD · 0 |
| Metas del mes (mes del fin del periodo): vendidos / meta cupos · meta USD | 2026-10: 0 / 20 · 35.000 USD | 2026-11: 0 / 20 · 35.000 USD | 2026-11: 0 / 20 · 35.000 USD |
|   esperado · deuda · cumplimiento | 20 · 20 · 0,0 % | 10 · 10 · 0,0 % | 10 · 10 · 0,0 % |
|   contratado del mes (USD) | 0 USD | 0 USD | 0 USD |
| MCP resumen_del_hub: ventas cerradas · vendido | 0 · USD 0,00 | 0 · USD 0,00 | 0 · USD 0,00 |
|   caja · agendas/shows | USD 0,00 · 3 · shows: 0 | USD 0,00 · 0 · shows: 0 | USD 0,00 · 0 · shows: 0 |
|   show · cierre (texto) | — · cobertura — | — · cobertura — | — · cobertura — | — · cobertura — | — · cobertura — | — · cobertura — |
| MCP consultar_metrica: cierres · agendas · shows | 0 · 3 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
|   grupo_vendidos · sin_resultado · leads · registros | 0 · 0 · 106 · 52 | 0 · 0 · 194 · 131 | 0 · 0 · 278 · 168 |
|   caja (cantidad · montos) | 0 · 0 (sin caja) | 0 · 0 (sin caja) | 0 · 0 (sin caja) |
| Paridad Hub = MCP (resumen entero) | igual | igual | igual |
| Paridad Hub = consultar_metrica (cierres, agendas, shows, grupo_vendidos, leads) | igual | igual | igual |

Students (foto de hoy, todas las cohortes, sin filtro): 0 estudiantes; por moneda []; sin valor vendido 0.

#### Comunicarte (programa `comunicarte`, id `fb076a4d…`)

| Cifra | mes_cerrado (2026-10-01 a 2026-10-31) | mes_en_curso (2026-11-01 a 2026-11-07) | custom14 (2026-10-24 a 2026-11-06) |
|---|---|---|---|
| Hub › Comercial: agendas | 313 | 47 | 110 |
|   canceladas | 17 | 3 | 7 |
|   citas sin resultado | 265 | 44 | 103 |
|   shows (llamadas con show) | 37 | 3 | 7 |
|   % show (por periodo) | 60,7 % | 50,0 % | 50,0 % |
|   cierres (ventas en el rango) | 28 | 5 | 11 |
|   % cierre / agenda a venta | 45,9 % / 27,9 % | 33,3 % / 16,7 % | 71,4 % / 35,7 % |
|   grupo: deals · con show · vendidos | 61 · 37 · 17 | 6 · 3 · 1 | 14 · 7 · 5 |
|   grupo: cobertura · parcial | 19,3 % · parcial | 12,0 % · parcial | 12,1 % · parcial |
|   grupo: % show · % cierre | 60,7 % · 45,9 % | 50,0 % · 33,3 % | 50,0 % · 71,4 % |
|   leads (personas) | 927 | 182 | 392 |
| Hub › Dinero: ventas | 28 | 5 | 11 |
|   vendido (USD) | 22.136 USD | 3.985 USD | 8.767 USD |
|   recaudado de esas ventas (USD) | 17.626 USD | 3.588 USD | 6.824 USD |
|   por cobrar (USD) | 4.510 USD | 397 USD | 1.943 USD |
|   caja del periodo (por moneda) | 16.832 USD | 4.781 USD | 7.620 USD |
|   comisión total (USD) · ventas sin comisión | 2.222,49 USD · 0 | 400,1 USD · 0 | 880,22 USD · 0 |
| Metas del mes (mes del fin del periodo): vendidos / meta cupos · meta USD | 2026-10: 28 / 31.42857142857143 · 25.048,57 USD | 2026-11: 5 / 14.285714285714286 · 11.385,71 USD | 2026-11: 5 / 14.285714285714286 · 11.385,71 USD |
|   esperado · deuda · cumplimiento | 31.42857142857143 · 3.4285714285714306 · 89,1 % | 7.142857142857143 · 2.1428571428571432 · 70,0 % | 7.142857142857143 · 2.1428571428571432 · 70,0 % |
|   contratado del mes (USD) | 22.136 USD | 3.985 USD | 3.985 USD |
| MCP resumen_del_hub: ventas cerradas · vendido | 28 · USD 22.136,00 | 5 · USD 3.985,00 | 11 · USD 8.767,00 |
|   caja · agendas/shows | USD 16.832,00 · 313 · shows: 37 | USD 4.781,00 · 47 · shows: 3 | USD 7.620,00 · 110 · shows: 7 |
|   show · cierre (texto) | 60,7% · cobertura 19,3% (parcial) | 45,9% · cobertura 19,3% (parcial) | 50,0% · cobertura 12,0% (parcial) | 33,3% · cobertura 12,0% (parcial) | 50,0% · cobertura 12,1% (parcial) | 71,4% · cobertura 12,1% (parcial) |
| MCP consultar_metrica: cierres · agendas · shows | 28 · 313 · 37 | 5 · 47 · 3 | 11 · 110 · 7 |
|   grupo_vendidos · sin_resultado · leads · registros | 17 · 265 · 927 · 985 | 1 · 44 · 182 · 201 | 5 · 103 · 392 · 430 |
|   caja (cantidad · montos) | 29 · 16.832 USD | 8 · 4.781 USD | 13 · 7.620 USD |
| Paridad Hub = MCP (resumen entero) | igual | igual | igual |
| Paridad Hub = consultar_metrica (cierres, agendas, shows, grupo_vendidos, leads) | igual | igual | igual |

Students (foto de hoy, todas las cohortes, sin filtro): 40 estudiantes; por moneda [{"moneda":"USD","recaudado":25505,"porCobrar":6098}]; sin valor vendido 0.

#### Comunícate con Confianza (programa `comunicate-confianza`, id `9153d04d…`)

| Cifra | mes_cerrado (2026-10-01 a 2026-10-31) | mes_en_curso (2026-11-01 a 2026-11-07) | custom14 (2026-10-24 a 2026-11-06) |
|---|---|---|---|
| Hub › Comercial: agendas | 108 | 31 | 73 |
|   canceladas | 7 | 6 | 7 |
|   citas sin resultado | 34 | 11 | 21 |
|   shows (llamadas con show) | 29 | 9 | 22 |
|   % show (por periodo) | 45,3 % | 40,9 % | 47,8 % |
|   cierres (ventas en el rango) | 3 | 4 | 5 |
|   % cierre / agenda a venta | 20,7 % / 9,4 % | 11,1 % / 4,5 % | 22,7 % / 10,9 % |
|   grupo: deals · con show · vendidos | 64 · 29 · 6 | 22 · 9 · 1 | 46 · 22 · 5 |
|   grupo: cobertura · parcial | 64,0 % · parcial | 66,7 % · parcial | 65,7 % · parcial |
|   grupo: % show · % cierre | 45,3 % · 20,7 % | 40,9 % · 11,1 % | 47,8 % · 22,7 % |
|   leads (personas) | 428 | 119 | 232 |
| Hub › Dinero: ventas | 3 | 4 | 5 |
|   vendido (USD) | 2.347 USD | 3.067 USD | 3.814 USD |
|   recaudado de esas ventas (USD) | 1.947 USD | 1.999 USD | 2.746 USD |
|   por cobrar (USD) | 400 USD | 1.068 USD | 1.068 USD |
|   caja del periodo (por moneda) | 3.014 USD | 932 USD | 3.146 USD |
|   comisión total (USD) · ventas sin comisión | 187,76 USD · 0 | 245,36 USD · 0 | 305,12 USD · 0 |
| Metas del mes (mes del fin del periodo): vendidos / meta cupos · meta USD | 2026-10: 3 / 28.571428571428573 · 22.857,14 USD | 2026-11: 4 / 43.42857142857143 · 34.742,86 USD | 2026-11: 4 / 43.42857142857143 · 34.742,86 USD |
|   esperado · deuda · cumplimiento | 28.571428571428573 · 25.571428571428573 · 10,5 % | 7.142857142857143 · 3.1428571428571432 · 56,0 % | 7.142857142857143 · 3.1428571428571432 · 56,0 % |
|   contratado del mes (USD) | 2.347 USD | 3.067 USD | 3.067 USD |
| MCP resumen_del_hub: ventas cerradas · vendido | 3 · USD 2.347,00 | 4 · USD 3.067,00 | 5 · USD 3.814,00 |
|   caja · agendas/shows | USD 3.014,00 · 108 · shows: 29 | USD 932,00 · 31 · shows: 9 | USD 3.146,00 · 73 · shows: 22 |
|   show · cierre (texto) | 45,3% · cobertura 64,0% (parcial) | 20,7% · cobertura 64,0% (parcial) | 40,9% · cobertura 66,7% (parcial) | 11,1% · cobertura 66,7% (parcial) | 47,8% · cobertura 65,7% (parcial) | 22,7% · cobertura 65,7% (parcial) |
| MCP consultar_metrica: cierres · agendas · shows | 3 · 108 · 29 | 4 · 31 · 9 | 5 · 73 · 22 |
|   grupo_vendidos · sin_resultado · leads · registros | 6 · 34 · 428 · 442 | 1 · 11 · 119 · 125 | 5 · 21 · 232 · 246 |
|   caja (cantidad · montos) | 5 · 3.014 USD | 3 · 932 USD | 6 · 3.146 USD |
| Paridad Hub = MCP (resumen entero) | igual | igual | igual |
| Paridad Hub = consultar_metrica (cierres, agendas, shows, grupo_vendidos, leads) | igual | igual | igual |

Students (foto de hoy, todas las cohortes, sin filtro): 7 estudiantes; por moneda [{"moneda":"USD","recaudado":3946,"porCobrar":1468}]; sin valor vendido 0.

#### Tactical Investor (programa `tactical-investor`, id `5cc65048…`)

| Cifra | mes_cerrado (2026-10-01 a 2026-10-31) | mes_en_curso (2026-11-01 a 2026-11-07) | custom14 (2026-10-24 a 2026-11-06) |
|---|---|---|---|
| Hub › Comercial: agendas | 360 | 57 | 148 |
|   canceladas | 22 | 2 | 5 |
|   citas sin resultado | 303 | 54 | 143 |
|   shows (llamadas con show) | 33 | 0 | 1 |
|   % show (por periodo) | 44,6 % | 0,0 % | 16,7 % |
|   cierres (ventas en el rango) | 17 | 2 | 1 |
|   % cierre / agenda a venta | 33,3 % / 14,9 % | — / 0,0 % | 100,0 % / 16,7 % |
|   grupo: deals · con show · vendidos | 74 · 33 · 11 | 2 · 0 · 0 | 6 · 1 · 1 |
|   grupo: cobertura · parcial | 20,3 % · parcial | 3,6 % · parcial | 4,2 % · parcial |
|   grupo: % show · % cierre | 44,6 % · 33,3 % | 0,0 % · — | 16,7 % · 100,0 % |
|   leads (personas) | 764 | 137 | 324 |
| Hub › Dinero: ventas | 17 | 2 | 1 |
|   vendido (USD) | 25.350 USD | 3.000 USD | 1.500 USD |
|   recaudado de esas ventas (USD) | 18.175 USD | 1.250 USD | 750 USD |
|   por cobrar (USD) | 7.175 USD | 1.750 USD | 750 USD |
|   caja del periodo (por moneda) | 18.675 USD | 1.250 USD | 750 USD |
|   comisión total (USD) · ventas sin comisión | 1.690,85 USD · 0 | 200,1 USD · 0 | 100,05 USD · 0 |
| Metas del mes (mes del fin del periodo): vendidos / meta cupos · meta USD | 2026-10: 17 / 34.375 · 51.562,5 USD | 2026-11: 2 / 10.9375 · 16.406,25 USD | 2026-11: 2 / 10.9375 · 16.406,25 USD |
|   esperado · deuda · cumplimiento | 34.375 · 17.375 · 49,5 % | 7.8125 · 5.8125 · 25,6 % | 7.8125 · 5.8125 · 25,6 % |
|   contratado del mes (USD) | 25.350 USD | 3.000 USD | 3.000 USD |
| MCP resumen_del_hub: ventas cerradas · vendido | 17 · USD 25.350,00 | 2 · USD 3.000,00 | 1 · USD 1.500,00 |
|   caja · agendas/shows | USD 18.675,00 · 360 · shows: 33 | USD 1.250,00 · 57 · shows: 0 | USD 750,00 · 148 · shows: 1 |
|   show · cierre (texto) | 44,6% · cobertura 20,3% (parcial) | 33,3% · cobertura 20,3% (parcial) | 0,0% · cobertura 3,6% (parcial) | — · cobertura 3,6% (parcial) | 16,7% · cobertura 4,2% (parcial) | 100,0% · cobertura 4,2% (parcial) |
| MCP consultar_metrica: cierres · agendas · shows | 17 · 360 · 33 | 2 · 57 · 0 | 1 · 148 · 1 |
|   grupo_vendidos · sin_resultado · leads · registros | 11 · 303 · 764 · 809 | 0 · 54 · 137 · 154 | 1 · 143 · 324 · 359 |
|   caja (cantidad · montos) | 18 · 18.675 USD | 2 · 1.250 USD | 1 · 750 USD |
| Paridad Hub = MCP (resumen entero) | igual | igual | igual |
| Paridad Hub = consultar_metrica (cierres, agendas, shows, grupo_vendidos, leads) | igual | igual | igual |

Students (foto de hoy, todas las cohortes, sin filtro): 20 estudiantes; por moneda [{"moneda":"USD","recaudado":20425,"porCobrar":9425}]; sin valor vendido 0.

## 2. Reclasificación de los tickets 351 a 362 (los arreglos de la auditoría del 30-oct)

Evidencia leída el 7-nov contra los archivos, el tracker (`docs/tasks/README.md`), `git log` y el código del commit `10467f24`. "Casillas" = marcadas / abiertas en el "Done cuando".

| Id | Tracker | `status:` del archivo | Casillas | Commits que lo tocan | Veredicto |
|---|---|---|---|---|---|
| 351 | `[ ]` todo | `todo` | 4 / 2 | `24af04d1` (auditoría), `23abe2bb` (mitad de pauta), `213c2279` (backfill del gasto), `016106ec` (recorrido), `8e9278d0` (ola 1) | **Parcial.** Hecho: ROAS y costo por agenda con cobertura, un convertidor de gasto (`tests/roas-de-pauta.test.ts`, `gasto-paridad.test.ts`, `convertir-gasto.test.ts`), backfill del 1 al 7-oct. Falta: el % de show como razón parcial (`lib/cobertura.ts` existe y se prueba solo, pero `tasas-del-grupo.ts` no lo devuelve) y que ninguna tarjeta reciba un `number` suelto (`costo` sigue `number \| null`; `RazonConCobertura` la usan 4 archivos y `CifraDeRazon` solo la celda de ROAS). Las dos casillas abiertas dependen de 353. |
| 352 | `[x]` done | `done` | 6 / 0 | `3f7bbdc0`, `525e782f`, `c15c259b`, `5361e160` | **Hecho.** `tests/venta-una-definicion.test.ts` (6 casos); `ventasConDiaEn` tiene llamadores en 10 archivos de `lib/app/components/scripts`. Coherente. |
| 353 | `[ ]` todo | `todo` | 0 / 5 | `24af04d1`, `23abe2bb` | **Vigente, apenas rozado.** No existen `showPorDeal` ni `ocurrioSql` (el diccionario los cita: 0 ocurrencias en código). Lo único movido es la asistencia por cita (`lib/queries/tasa-show-por-cita.ts`, `tests/show-por-cita.test.ts`, de los tickets 378 y 379), sin la regla DA-3/DA-4 ni guardianes. Espera DA-3 (Mani) y DA-4 (Pauta). Bloquea las dos casillas abiertas del 351. |
| 354 | `[ ]` todo | `todo` | 0 / 5 | `24af04d1` | **Vigente sin empezar.** No hay módulo de anclas de fecha ni guardián; `lib/queries/embudo-formulario.ts` conserva su propio `diaDeEnvio`, y no hay función única de "registro / lead / sin UTM" fuera del emparejador. |
| 355 | `[ ]` todo | `todo` | 0 / 4 | `24af04d1` | **Vigente sin empezar.** `lib/queries/pauta-interina.ts`, `components/pauta-interina.tsx` y `categoriaDe` siguen vivos (4 archivos de `lib/app/components` los importan, entre ellos `metricas-con-filas.ts`). Depende de 351 a 354. |
| 356 | `[ ]` todo | `todo` | 4 / 0 | `76b2b5db` (reja y backfill), `597fa7a2` (backfill aplicado), `8e9278d0` | **HECHO, se cierra aquí.** Verificado hoy con un `SELECT`: ventas vigentes (`ganado_parcial`/`ganado_completo`, `anulado_en` nulo) con `comision_porcentaje` nulo = **0**; el Hub muestra 0 ventas sin comisión en los 4 programas y 3 periodos; `tests/mover-etapa.test.ts` ("no vende si el programa no tiene porcentaje de comisión") y `tests/rellenar-comision.test.ts`. Faltaba solo cambiar `status:` y la fila del tracker. |
| 357 | `[x]` reemplazado | `reemplazado` | 0 / 4 | `d833c6e5` | **Obsoleto, reemplazado por el 374** (hecho, 3-nov). Su guardián vive hoy en `tests/hub-vocabulario-guardian.test.ts`. Coherente; las 4 casillas abiertas no cuentan (N9 solo exige casillas a los `done`). |
| 358 | `[ ]` todo | `todo` | 0 / 4 | `24af04d1`, `d833c6e5` | **Vigente, alcance reducido.** La parte del Hub la hizo el 374. En código ya casi no hay formato local (único `toLocaleDateString` fuera de `lib/format.ts`: `components/calendly/selector-de-hora.tsx:82`), pero `lib/format.ts` no tiene el formateador de razón con la regla del vacío (`razon`/`—`/`Sin datos`) ni guardián de formato. Espera DA-7 (Gerencia). Fase 2. |
| 359 | `[ ]` todo | `todo` | 0 / 4 | `24af04d1`, `d833c6e5` | **Vigente, alcance reducido.** Hub lo cubrió el 374 y Comercial el 372. Quedan Mi espacio y el resto de pantallas; el guardián de jerga existente (`hub-vocabulario-guardian`) solo recorre las carpetas del Hub. Espera DA-6 (Mani). Fase 2. |
| 360 | `[ ]` todo | `todo` | 0 / 4 | `24af04d1`, `d833c6e5`, `2c7c1810` | **Vigente sin empezar** para las cinco listas operativas (los filtros del Hub pasaron al 377, que sigue `todo`). Siguen tres componentes de fecha (`components/selector-periodo.tsx`, `components/filtro-fecha-lista.tsx`, `components/filtros/filtro-fecha.tsx`) y `components/filtro-dashboard.tsx` con nombre viejo. |
| 361 | `[ ]` todo | `todo` | 0 / 5 | `24af04d1`, `c9c5ec85`, `0224efd2` | **Parcial.** Hecho: `/ajustes/canales` ya redirige a Hub › Origen (`app/(app)/ajustes/canales/page.tsx`). Falta: el guardián del diccionario (no existe ningún test que lea `docs/metricas.md`; el sondeo de la Parte 3 encuentra 4 nombres citados que no existen y 1 función sin llamador), el retiro de `estados_llegada` (3 comentarios en `lib/ingesta/`) y de la tabla `canales` con su catálogo (`lib/catalogo/canales.ts`, `from(canales)`), y `pauta-interina` (355). |
| 362 | `[ ]` todo | `todo` | 4 / 0 | `1ae0543d`, `c9c5ec85`, `8e9278d0` | **HECHO, se cierra aquí.** `tests/tracker-coherente.test.ts` existe, está mordido en los dos sentidos (casos que fallan con una fila desfasada) y recorre el tracker entero; el grep de "agendas del CRM" solo deja ADR 0088, `metricas.md` §Semáforo y `hub.md` (todos describen el costo por agenda del **Hub**, que sí usa las agendas del CRM, o historia). Faltaba cambiar `status:` y la fila del tracker. |

**Resumen:** hechos y cerrados con esta sesión: **356 y 362** (más el 352, que ya estaba); parciales: **351, 361**; vigentes sin empezar: **353 (rozado), 354, 355, 358, 359, 360**; obsoleto: **357** (por el 374). Cadena de bloqueo real: 353 (espera DA-3/DA-4) → 351 (2 casillas) → 355; 354 es independiente y se puede abrir ya.

**Hallazgo de N9 que sigue abierto:** el tracker mantiene 11 excepciones nombradas en `tests/tracker-coherente.test.ts` (`EXCEPCIONES`) y una lista congelada de 80 tickets cerrados antes de la N9 sin casillas. No se tocan aquí.

## 3. Verificación del ADR 0115 (N1 a N9): ¿existe el guardián y muerde?

"Muerde" = el test falla si alguien reintroduce lo que prohíbe (se leyó su contenido, no solo su nombre). Un "guardián" que solo comprueba una salida fija no muerde el patrón.

| Regla | Guardián que el ADR promete | Qué existe hoy | ¿Muerde? | Falta |
|---|---|---|---|---|
| **N1** un concepto, un módulo | Un guardián por concepto, molde `vigencia-centralizada` (352, 353, 354) | `vigencia-centralizada.test.ts` (recorre `lib/`, `app/`, `components/`, `scripts/` cadena por cadena, mordido: 6 referencias a morder), `venta-una-definicion.test.ts` (venta, 6 casos), `saldo-centralizado.test.ts` (dinero), `show-por-cita.test.ts` (solo una vista de Hoy), `closer-identidad.test.ts` | **Sí** para vigencia, venta y saldo. **No** para show/no show/cita sin resultado (el test de show-por-cita prueba un escenario, no impide una segunda fórmula). | **Sin guardián:** show, no show y cita sin resultado (353, ni `showPorDeal` ni `ocurrioSql` existen); ancla de fecha, registro, lead y "sin UTM" (354); gasto convertido (solo hay paridad, no un guardián que caza una conversión suelta); calendario hábil. |
| **N2** paridad probada | Tests de paridad por concepto (352, 353, 354) | `gasto-paridad.test.ts` (1 caso), `atribucion-canal-sql.test.ts` (gemela SQL/TS del área, ejecutadas), `preguntas-disponibles-paridad.test.ts`, `sin-resultado-compartido.test.ts` (1 caso), `venta-una-definicion.test.ts` | **Parcial.** Existen y son de caso concreto. | Sin paridad probada para show (DA-4 reagenda), anclas de fecha de envío (parcial sin fecha), "sin UTM" SQL/TS, ni "Deals creados" Hub contra escalera. |
| **N3** toda razón con cobertura | El tipo: la tarjeta no compila con un `number` suelto (351) | `lib/cobertura.ts` (`RazonConCobertura`, `razon()`), `tests/cobertura.test.ts` (2 casos), `CifraDeRazon` | **Parcial.** El tipo solo se exige en la celda de ROAS; `costo` por agenda y el % de show siguen `number \| null`. Ningún test impide una tarjeta nueva con un número suelto. | Aplicarlo a show, cierre, costo por agenda, tarjetas de Hoy y Comercial y al contrato de WhatsApp (351/353). |
| **N4** un nombre por concepto | Guardián de rótulos sobre `app/`, `components/` y `lib/reporte-whatsapp/` (357→374) | `hub-vocabulario-guardian.test.ts` + `lib/vocabulario-metricas.ts` (mordido en 2 sentidos) | **Sí, pero solo en las carpetas del Hub** (`CARPETAS` = selector, variación, pauta, `app/(app)/hub`, `hub` del programa, `components/dashboard`, `metas`, `hub`). | **No cubre** `lib/reporte-whatsapp/`, listas operativas, Mi espacio, Deals, Leads, ni el MCP (el MCP devuelve `embudo.cierres` y `dinero.ventas` tal cual: hallazgo del ticket 385). |
| **N5** pantalla para quien la usa | Guardián de cadenas en JSX y de helpers de formato locales (358, 359) | El mismo `hub-vocabulario-guardian` (jerga, solo Hub). Formato: `tests/format.test.ts` prueba `lib/format.ts` pero **ningún test caza un formateador local**. | **Parcial.** Jerga solo en el Hub. Formato: **no muerde** (hoy hay un `toLocaleDateString` suelto, `selector-de-hora.tsx:82`, y nada lo detecta). | Guardián de formato local y de jerga fuera del Hub; `razon` y la regla del vacío en `lib/format.ts` (358/359). |
| **N6** se exige al escribir | Tests de la reja en `moverEtapa` (356) y del aviso (341) | `tests/mover-etapa.test.ts` ("no vende si el programa no tiene porcentaje de comisión", línea 707), `tests/rellenar-comision.test.ts` | **Sí** para la comisión (y el conteo en producción es 0). El aviso 341 de llamada sin resultado: no hay un test con ese nombre; la cobertura de citas sin resultado sigue baja (Comunicarte octubre: 265 de 313). | Verificar en F2/F6 que el aviso exista y se pruebe; la alarma de envío pago sin `utm_id` (290) vive en otro módulo de salud y no se auditó aquí. |
| **N7** reemplazar es borrar | Guardián del diccionario: cada función citada en `metricas.md` existe y tiene un llamador fuera de `tests/` (361) | **No existe.** Ningún test lee `docs/metricas.md`. | **No** (no hay guardián). Sondeo manual del 7-nov sobre 100 identificadores con mayúscula citados en el diccionario: **4 funciones citadas que no existen con ese nombre** (`ocurrioSql` y `showPorDeal`, por construir en el 353; `showPorCita`, que en el código es `showPorCitaDelRango`; `armarMensaje`, que es `armarMensajeDeLaHora`); `agruparEnvios` es un alias de import de `agrupar` (`lib/queries/hechos/envio.ts`) y `cortePagoRapidoDias` y `pctDelPaso` son campos, no funciones. **1 función sin llamador fuera de su archivo y de tests:** `tasaDelDia` (`lib/trm/consultar.ts:14`, una sola ocurrencia en código). | El guardián entero (361). Es la regla sin dientes: el sondeo de hoy prueba que el diccionario ya se desfasó. |
| **N8** jerarquía y enmiendas arriba | Revisión, con la lista en el "Done cuando" de todo ticket de métricas (362) | Es **revisión manual** por diseño; la lista N8 está como casilla en 351 a 362 | **No aplica test.** Se cumple al cerrar cada ticket; hallazgo: `metricas.md` cita `showPorDeal`/`ocurrioSql` que no existen (documenta lo planeado como si fuera hecho). | Marcar en el diccionario qué filas son "por construir" (🟡) para que no se confundan con vigentes. |
| **N9** terminado con evidencia | `tests/tracker-coherente.test.ts` (362) | Existe, 9 casos, mordido en los dos sentidos; recorre todas las filas del tracker. | **Sí**, con deuda nombrada: 11 excepciones de estado y 80 tickets viejos sin casillas (lista congelada que solo puede achicarse). | Achicar las excepciones; con esta sesión 356 y 362 quedan coherentes. |

**Guardianes que no existen o no muerden (la lista que pidió Mani):**
1. **N7 completo**: no hay guardián del diccionario.
2. **N1** para show / no show / cita sin resultado, anclas de fecha, registro, lead, "sin UTM", gasto convertido y calendario.
3. **N2** para show (reagenda), anclas de envío y "sin UTM" SQL/TS.
4. **N3** como tipo obligatorio: solo ROAS lo cumple.
5. **N4/N5** fuera de las carpetas del Hub (WhatsApp, listas, Mi espacio, MCP) y el guardián de **formato local**.
6. **N6**: el aviso de llamada sin resultado (341) no tiene test identificable.

## 4. Cómo repetir esta medición

El script no se guardó en el repo a propósito (N7: no dejar cargadores sueltos). Para repetirla: llamar con `tsx` y la conexión directa a las seis funciones de la tabla de la sección 1, con los mismos periodos y `hoy`. Comparar con estas tablas **antes** de cambiar cualquier fórmula (ticket 385 F6, punto 2: una enmienda actualiza los números dorados en el mismo commit).
