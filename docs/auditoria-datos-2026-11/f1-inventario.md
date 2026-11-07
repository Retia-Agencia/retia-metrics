# Auditoría 385 · F1 · Inventario de métricas, por métrica y por superficie

> **Solo lectura.** Código de la rama `claude/youthful-mcclintock-ed5d14` en el commit `10467f24` (7-nov-2026). No se
> tocó `lib/`, `app/`, `components/` ni `tests/`, ni producción. Lo que no se pudo confirmar leyendo código dice
> **inferido**. No propone arreglos: eso es F4 a F7.
> Fuentes leídas: `docs/tasks/385-*.md`, `AGENTS.md`, `docs/metricas.md`, `docs/auditoria-metricas-2026-10-30.md`,
> ADR 0115, `docs/mcp.md`, y el código citado con `archivo:línea`.

## 0. Cómo leerlo

**Abreviaturas de rutas:** `Q/` = `lib/queries/` · `mf` = `Q/metricas-filtros.ts` · `dash` = `Q/dashboard.ts` ·
`tg` = `Q/tasas-del-grupo.ts` · `vd` = `Q/vista-dashboard.ts` · `mcf` = `Q/metricas-con-filas.ts` · `rp` = `Q/roas-de-pauta.ts`.
`M §x` = fila o sección de `docs/metricas.md`; "sin definición" = no hay fila en el diccionario.

**Filtros:** P = programa (siempre frontera), Co = cohorte, Cl = closer, Or = origen/UTM, Per = periodo.
"no" dice cuáles no admite. **Llamadores** = quien la usa fuera de `tests/` (N7).

**Columnas del inventario:** nombre visible · definición · función SQL y gemela TS · fuente (tabla, columnas, `vigente()`) ·
ancla de fecha · unidad y moneda · filtros · cobertura · llamadores. Para no repetir el mismo cuerpo en cada superficie,
las funciones se describen una vez en el **catálogo (§1)** y las filas de §2 las nombran.

**Cuatro hechos de método que condicionan todo lo demás:**

1. La capa de "nombre visible" no tiene una sola fuente. Existe `lib/vocabulario-metricas.ts` (`VOCABULARIO`, usado por Hoy, Dinero y Metas), pero la lista
   detrás de cada cifra rotula con un mapa literal propio (`app/(app)/p/[programa]/hub/lista/page.tsx:36-83`, `titulos`) y
   cada componente escribe su `titulo=` (ver §2). Por eso el mismo número cambia de nombre según la pantalla.
2. Una "venta" tiene un solo predicado (`etapaVendida()`, `mf:168`) pero **seis recorridos** para llegar a él (H-08).
3. Tres formas de cobertura conviven (H-13); solo ROAS y costo por agenda usan `RazonConCobertura` (`lib/cobertura.ts:23`).
4. `Mi día` ya no es una pantalla: `app/(app)/mi-dia/page.tsx` redirige a `/mi-espacio`; `/p/[programa]/metas` y
   `/p/[programa]/dashboard` redirigen al Hub. Se inventarían donde viven hoy.

## 1. Catálogo de funciones por concepto

| Concepto | Función SQL / gemela TS (archivo:línea) | Quién la llama fuera de `tests/` |
|---|---|---|
| **Venta (predicado)** | `etapaVendida()` `mf:168` (SQL) · `esEtapaVendida` `lib/deals/etapas.ts:29` (TS) | `mf:176,229` · `Q/estudiantes.ts:59` · `lib/deals/rellenar-comision.ts:37` · `tg:168` · `Q/embudo-etapas.ts:383` · `Q/ficha-deal.ts:732` |
| **Venta con día** | `ventasConDiaEn` `mf:225` y `vendidosEn` `mf:172` (**dos funciones casi idénticas**: solo cambia la proyección); `esMovimientoDeVenta` `mf:148`; `diaDeVenta` `mf:117` (privada) | `ventasConDiaEn`: `reporte-diario.ts:168` · `escalera.ts:167` · `ventas-de-la-cohorte.ts:32,59` · `series-dinero.ts:59` · `metas.ts:294` · `hechos/venta.ts:28` · `embudo-comercial.ts:77`. `vendidosEn`: `mf:284` (`filtroCierres`) · `dash:236` · `vista-hoy.ts:219` |
| Venta, filtro de rango | `filtroCierres` `mf:281` → `vendidosEn` | `dash:200,268,310` (`ventasDelRango`, `ventasDelRangoConValor`, `ventasPorCohorte`) · `mcf` |
| Venta por closer | `ventasPorCloser` `dash:221` (privada, usa `vendidosEn` directo, no `filtroCierres`) | `embudoPorCloser` (`dash:526`) |
| Venta de la cohorte | `ventasDeLaCohorte` `Q/ventas-de-la-cohorte.ts:26`, `ventasDelFiltro` `:53` | `dash:733,736` · `proyeccion.ts:446` · `alertas.ts:126` · `vamos-a-llegar.ts:225` · `cohorte-del-hub.ts:91` |
| Venta por escalón | `ventasDelPrograma` `escalera.ts:166` (sin rango) · `escalonDeDeal` `:115` · `cargarEscalera` `:259` | `rp:184` · `escalera.ts:233,269` |
| Cierre (ganado o perdido) | `cerradosEn` `mf:198` (Close date; **no** es venta) | `dash:451` · `kanban.ts:292` · `embudo-etapas.ts:504` |
| Valor vendido | `contratadoDeDeals` `Q/saldo.ts:60` · `valoresVendidosDeDeals` `:48` | `dash:277,325` · `rp:263` · `series-dinero.ts:81` · `vamos-a-llegar.ts` |
| Vendido, Recaudado, Por cobrar | `dineroDeVentas` `Q/dinero-de-ventas.ts:60` → `dineroDeSaldos` `:37` → `saldosDeDeals` `saldo.ts:85` | `dash:286,326` · `vd:260` · `mcf:1047` |
| Entró a caja | `cajaRecaudada` `dash:354` ← `filtroCaja` `mf:263` + `sumaDeAbonos` `saldo.ts:133` | `vd:232` · `mi-espacio-metricas.ts:75` · `vista-hoy.ts:217` · `series-dinero.ts:60,65` |
| Saldo y cartera vencida | `saldosDeDeals` `saldo.ts:85` · `carteraVencida` `Q/cartera.ts:55` | `estudiantes.ts:168` · `kanban.ts:297` · `inbox.ts:565` · MCP `cartera_vencida` |
| Comisión | `comisionDeDeal` `Q/comision.ts:14` · `comisionesPorCloser` `:31` | `vd:243,270` · `mi-espacio-metricas.ts:77` |
| Agenda creada | `fechaAnclaAgendaCreada` `mf:342`, `filtroAgendasCreadas` `mf:364`; hecho `Q/hechos/agenda.ts:84` (`agrupar`) | `vista-hoy.ts` · `origen.ts` · `proyeccion.ts` · `lib/semaforo/costo-por-agenda.ts:187` · `app/api/semaforo/envios/route.ts` |
| Cita (por fecha de la cita) | `fechaAnclaCall` `mf:31` · `filtroLlamadas` `mf:272` · `citaNoCancelada` `mf:240` · `embudoDelRango` `dash:383` | `vd:230` · `mi-espacio-metricas.ts:75` |
| Show / "ocurrió" | `llamadaOcurrio` `mf:235` (SQL) · `esShow` `tg:127` (TS) · **otras seis formas** (H-15) | ver H-15 |
| Grupo de citas, % show, % cierre, agenda→venta | `calcularTasasDelGrupo` `tg:140`, `tasasDe` `tg:104` (privada), `grupoDeCitas` `tg:289`, `gruposPorSemana` `tg:306` | `dash:419` · `proyeccion.ts` · `mcf` · `vista-metrica.ts` |
| % show por cita | `showPorCitaDelRango` `Q/tasa-show-por-cita.ts:25` | `vista-hoy.ts` · `reporte-diario.ts` |
| Cita sin resultado | `citaVencidaSinResultado` `mf:467` · `citaDebidaSinMarcar` `mf:499` · `citaDebida` `mf:490` · grupo `tg:172-175` · `rp:254-257` · `pauta-interina.ts` (resumen) | ver H-07 |
| Registro (envío completo) | `filtroDeEnvios` `Q/hechos/envio.ts:110`, `agrupar` `:122` | `vista-hoy.ts` · `reporte-diario.ts` · `proyeccion.ts` · `origen.ts` · `mcf` |
| Lead (persona) | `filtroLeads` `mf:313` + `fechaAnclaLead` `mf:309` · `leadsDelRango` `dash:791` | `vd:239` |
| Deal creado | `fechaAnclaDealCreado` `mf:333` · `filtroDealsCreados` `mf:355` · `filtroDealsDesde` `mf:415` | `embudo-comercial.ts` · `deals-contra-agendas.ts` · `mcf` |
| Deals que agendaron | `filtroDealsQueAgendaron` `mf:378` · `pctDealsQueAgendaron` `Q/deals-contra-agendas.ts:55` | `embudo-comercial.ts` · `deals-contra-agendas.ts` |
| Embudo comercial | `pasosDelEmbudoComercial` `Q/embudo-comercial.ts:48` · `cargarEmbudoComercial` `:72` | `A/p/[programa]/hub/page.tsx:582` · `mcf` |
| Embudo del formulario | `embudoDelFormulario` `Q/embudo-formulario.ts:234` · `tasasDelEmbudo` `:61` · `llegoAlCalendly` `:46` · `noAgendaronDelFormulario` `:227` | Hub page · `components/embudo-formulario.tsx` |
| Conversión por etapa | `embudoPorEtapas` `Q/embudo-etapas.ts:454`, `calcularEmbudoEtapas` `:182` | `vd:241` |
| Meta / esperado / por día hábil | `metaDeHoy` `lib/dias-habiles.ts:126` · `esperadoLineal` `:143` · `metaLineal` `:158` | `dash:758-760` · `metas.ts:181,230,246` · `vamos-a-llegar.ts:93,180` · `proyeccion.ts:318` · `alertas.ts:71` |
| Metas del mes | `leerMetasDelMes` `Q/metas.ts:316`, `armarMetasDelMes` `:144`, `leerCohortesYVentas` `:277` | `vd:240` · `series-dinero.ts` · `vamos-a-llegar.ts:220` · `alertas.ts:125` |
| Cohorte activa (cupos) | `vistaDeCohorteActiva` `dash:720` | `vd` · `metas.ts` · `alertas.ts` |
| ¿Vamos a llegar? | `leerVamosALlegar` `Q/vamos-a-llegar.ts:217`, `armarVamosALlegar` `:135` | `components/metas/vamos-a-llegar.tsx` |
| Proyección | `leerProyeccion` `Q/proyeccion.ts:395`, `calcularProyeccion` `:262`, `metaDeLeads` `:141` | `vista-hoy.ts` · `vamos-a-llegar.ts` |
| Alertas de cohorte | `alertasDelPrograma` `Q/alertas.ts:119`, `evaluarAlerta` `:96` | Hub page `:426` |
| Gasto convertido | `convertirGasto` `lib/pauta/convertir-gasto.ts:21` (+ `convertirMonto`, privada de hecho) · `coberturaDeGasto` `lib/pauta/cobertura-de-gasto.ts:18` · `tasasDelRango` `lib/trm/consultar.ts:33` | `rp:314` · `costo-por-agenda.ts:99,…` |
| ROAS | `cargarRoasDePauta` `rp:154`, `calcularRoas` `rp:141`, `razon` `lib/cobertura.ts:23` | Hub page · MCP `pauta_roas` · `mcf` · CSV de citas de pauta |
| Embudo de Pauta (interino) | `pautaInterina` `Q/pauta-interina.ts:162`, `categoriaDe` `:~114` | Hub page `:26` · `A/hub/pauta.tsx` |
| Costo por agenda | `costoPorAgenda` `lib/semaforo/costo-por-agenda.ts:311` · `…DeVentana` `:329` | `lib/semaforo/semaforo.ts` |
| Origen | `resolverCanal` `lib/atribucion/canal.ts` / `areaSql` `canal-sql.ts` · `origenDelPrograma` `Q/origen.ts:105`, `resumenDeOrigen` `:86` | Hub page · MCP `origen_del_programa` · `A/ajustes/salud/page.tsx` |
| Lista detrás de la cifra | `listaDeMetrica` `mcf:1113`, `resumenDeMetrica` `mcf:1042` | `A/hub/lista/page.tsx` · `vista-metrica.ts` · MCP |
| Series | `leerSeriesDeDinero` `Q/series-dinero.ts:128` · `serieDealsContraAgendas` `Q/deals-contra-agendas.ts:100` · `tramosDe` `lib/series-pasos.ts:99` | Hub page · `components/graficas/` |

## 2. Inventario por superficie

### 2.1 Hub › Hoy (`armarVistaDeHoy`, `Q/vista-hoy.ts:137`; reporte `armarReporteDiario`, `Q/reporte-diario.ts:200`)

| Métrica | Nombre visible (dónde) | Def. | Función (§1) | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Ventas del día | "Cupos vendidos hoy" (`hoy/dinero.tsx:33`); semana: "Cupos vendidos" (`semana.tsx:50`); vocab `cupos_vendidos` | M §3.1 «Ventas» | `ventasDelRango` `dash:196` → `filtroCierres` → `vendidosEn` | `deal_etapa_historial`⋈`deals` (cortesia=false, `etapaVendida`, `vigente(deals)`) | día de la 1ª entrada a etapa vendida (Bogotá) | deals (cupos) | P, Co, Cl · no Or | n/a (conteo) | `embudoDelRango`←`armarVistaDelDashboard`←Hub page:368 |
| Objetivo del día | "Objetivo del día" (vocab `objetivo_del_dia`) | M §3.5 «Objetivo del día» | `metaDeHoy` `dias-habiles.ts:126` vía `vistaDeCohorteActiva` `dash:758`; `horizontesDeCupos` `vista-hoy.ts:95` | `cohorts.meta_cupos` + ventas de la cohorte | hoy | cupos | P (cohorte activa) · no Co, Cl, Or | sin ventana de ventas → no calcula | Hub Hoy |
| Leads de hoy | "Leads de hoy" (`hoy/cifras-clave.tsx:43,45`) | M §1.1 «Registros» y §3.5 D3 | `agrupar` `hechos/envio.ts:122` | `submissions`⋈`sources`, `es_parcial=false` | `fecha_envio` Bogotá | **registros** (envíos), no personas | P · no Co, Cl | `fecha_envio` nulo en parciales no entra | `vista-hoy.ts`, `reporte-diario.ts` |
| Agendas creadas hoy | "Agendas creadas hoy" | M §1.2, §3.1 «Agendas creadas» | `agrupar` `hechos/agenda.ts:84` | `calls` (+`deals`,`submissions`), `vigente(calls)` | `calls.created_at` Bogotá | llamadas | P · no Cl | cita suelta → "sin envío de origen" | `vista-hoy.ts` |
| Citas de hoy | "Citas de hoy"; en Comercial el mismo número se llama "Agendadas" | M §3.1 «Citas» | `embudoDelRango.agendas` `dash:390` (`citaNoCancelada`) | `calls` leftJoin `deals`, `vigente(calls)` | `coalesce(fecha_agenda,fecha_llamada)` Bogotá | llamadas (incluye cortesías y citas sin deal) | P,Co,Cl | no | `vd`, Mis métricas, MCP |
| Realizadas | "Realizadas (show)" | M §3.1 «Citas · Shows» | `embudoDelRango.llamadasConShow` `dash:402` (`llamadaOcurrio`) | igual | fecha de la cita | llamadas | P,Co,Cl | no | idem |
| % de show (por deal) | "% show" / vocab `asistencia` "Asistencia" | M §3.1 «% de show» | `grupoDeCitas` → `tasasDe` `tg:104` (`pctShow = conShow/deals`) | `calls`⋈`deals` (cortesia=false, `ne reagendada`) | fecha de la cita | % de **deals** con cita ocurrida | P,Co,Cl | `{cobertura,parcial,sinMarcar}` propio (H-13); `parcial` si sin marcar > 10 % (`tg:39`) | `dash:419` |
| % de show (por cita) | "% show por cita" (sin nombre distinto en vocab) | M §3.1 «% de show por cita» | `showPorCitaDelRango` `tasa-show-por-cita.ts:25` | `calls`, `citaNoCancelada` | fecha de la cita | % de **citas** | P,Co,Cl | `sinMarcar`; `null` si ninguna tiene resultado | `vista-hoy.ts`, `reporte-diario.ts` |
| Citas sin resultado | "Citas sin resultado marcado" (`hoy/comunes.tsx:102`) · "Llamadas pasadas sin resultado" (`pendientes.tsx:37`) | M §3.1 (parcial) | `citaDebidaSinMarcar` `mf:499` · `sinResultadoDelRango` `dash:331` (`citaVencidaSinResultado`) | `calls` | cita (dos formas distintas) | citas | P,Co,Cl | es una cobertura | H-07 |
| Banderas del pulso | "Shows sin Grain", "Atendidos sin Grain", "Atendidos sin valor vendido" (`pendientes.tsx:36-38`) | **sin definición** (solo mención §3.5 "no viaja en el tiempo") | `showsSinGrain` `Q/sin-grain.ts:43`, `banderasDelPulso` `Q/banderas-del-pulso.ts:76` | `calls.link_grain`, `deals.valor_vendido_usd`, etapas atendidas | foto de hoy | llamadas / deals | P,Co,Cl | no | `vd:231,237` |
| Caja del día | "Caja del día" / "Entró a caja del día" (`cifras-clave.tsx:60,62`) | M §3.1 «Entró a caja» + D4 | `cajaDelDiaPorOrigen` `vista-hoy.ts:208` (`filtroCaja` + `vendidosEn`) | `abonos`, `vigente(abonos)` | `abonos.fecha` | USD y COP sin convertir | P,Co,Cl | no | solo `armarVistaDeHoy` |
| Cómo nació la venta | "Del lead a la venta" (`reporte-diario.tsx:98,124`) | M §3.5 tabla del reporte | `comoNacioLaVenta` `reporte-diario.ts:39` | `calls` ocurridas por deal | día de la venta | ventas | P | no | `armarReporteDiario` |
| Desglose de caja | idem | M §3.5 | `desgloseDeCaja` `reporte-diario.ts:153` | `abonos`⋈`ventasConDiaEn` | abono y venta | USD/COP | P | no | idem |
| Qué pasó con cada agenda | "Citas" / "¿Cómo va cada closer?" | M §3.5 | `resultadosPorCloser` `reporte-diario.ts:96` | `calls` | cita | citas | P | no | idem |
| Leads de pauta del día | "Leads del día de pauta" | M §3.5 | `agruparEnvios` **no existe**; hoy `reduce` en `reporte-diario.ts:232` sobre `hechos/envio` | `submissions` + `resolverCanal` | envío | registros | P | no | idem |
| Total de todos los programas | solo conteos y caja | M §3.5 | `totalDeConteos` `reporte-diario.ts:265` | – | – | conteos | **solo sumables** (tipo `Conteo`) | – | `A/hub/page.tsx` |
| Necesarios para llegar | "Leads que hacen falta" (vocab) | M §3.4 | `leerProyeccion` `proyeccion.ts:395` | calc. sobre grupo y registros | día hábil | leads/día | P | muestra mínima (`MUESTRA_MINIMA_CONVERSION` = 20, `proyeccion.ts:30`) | `vista-hoy.ts` |
| Alertas | "Alertas" | **sin definición** (M tiene 3 menciones, sin fila) | `alertasDelPrograma` `alertas.ts:119` | ventas de cohorte + metas | hoy | cumplimiento | P | no | Hub page:426 |

### 2.2 Hub › Comercial (`armarVistaDelDashboard`, `vd:197`, y `cargarVistaComercial`, Hub page:554)

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Agendas | **"Agendadas"** (`operacion.tsx:217`, KPI); "Agendas" en tabla de closers (`operacion.tsx:152,72`); lista "Agendas" (`lista/page.tsx:37`) | M §3.1 «Citas (la tarjeta "Agendas")» | `embudoDelRango.agendas` | `calls` | **fecha de la cita** | citas | P,Co,Cl | no | H-02 |
| Canceladas | "Canceladas" | M §3.1 | `embudoDelRango.canceladas` `dash:391` | `calls` | cita | citas | P,Co,Cl | no | Hub |
| % show | "% show", base "N de M" | M §3.1 | `tasasDe` `tg:116` | ver 2.1 | cita | % deals | P,Co,Cl | `Kpi parcial` + cobertura textual (`operacion.tsx:209`) | `operacion.tsx:217-220` |
| **% cierre** | "% cierre", base "vendidos de conShow" | M §3.1 «% de cierre» | `tasasDe` `tg:117`, `vendido = conShow && esEtapaVendida(etapa actual)` `tg:168` | grupo de citas | cita (la venta puede ser **después**) | % de deals | P,Co,Cl | parcial; `madurando` (`tg:131`) | `operacion.tsx:219`, MCP, Mis métricas |
| Agenda → venta | "Agenda → venta" | M §3.1 | `tasasDe` `tg:118` | grupo | cita | % | P,Co,Cl | idem | `operacion.tsx:220` |
| **Ventas (cierres)** | **"Cierres"** en tabla del comparativo (`operacion.tsx:72`, `hoy/citas.tsx` vía `Comparativo`); "Ventas cerradas" en MCP; clave de lista `cierres` rotulada "Cierres" (`lista/page.tsx:43`); vocab `ventas` = "Ventas (cupos)" | M §3.1 «Ventas» | `embudoDelRango.cierres` ← `ventasDelRango` `dash:196` | ver 2.1 | **venta** | deals | P,Co,Cl | no | **H-01** |
| ¿Dónde se pierden? | "Deals creados → agendaron → tuvieron show → compraron" (`ETIQUETA_DEL_PASO`, `operacion.tsx`; lista: "Deals que compraron") | M §3.1 «Embudo comercial» | `cargarEmbudoComercial` `embudo-comercial.ts:72` | `deals`⋈`submissions`, `calls`, `ventasConDiaEn` | creación del deal; show hasta fin de rango; venta en el rango | deals | P,Co,Cl(no: `—`), Or (completo/parcial/manual) | `pctDelPaso`, `perdidos` (resta exacta) | Hub page:582 |
| Deals que agendaron | "Deals que agendaron" (dos claves con el mismo título: `deals_que_agendaron` y `embudo_comercial_agendaron`) | M §3.1 | `filtroDealsQueAgendaron` `mf:378` | `deals`+`calls` | creación del deal; cita creada ≤ fin de rango | deals | P,Co · no Cl | no | `deals-contra-agendas.ts`, embudo comercial |
| % que agendaron | "% de deals que agendaron…" | M §3.1 (2 filas) | `pctDealsQueAgendaron` `deals-contra-agendas.ts:55` | idem | idem | % | P,Co | – | `serieDealsContraAgendas` |
| Ventas por escalón | "Ventas por escalón"; grupos "Cerró en la llamada / con seguimiento / No cerró"; "Ventas sin llamada registrada" | M §3.1 «Ventas por escalón» + tabla escalera | `cargarEscalera` `escalera.ts:259`, `escalonDeDeal` `:115` | `deals`,`calls`,`abonos` | venta (1 a 4) o creación (5 a 7) | deals | P,Co,Cl · calidad | n/a | `vista-escalera.ts`, `rp`, `pauta-interina.ts` |
| Conversión por etapa ("Caminos") | "Entraron al embudo / Llegaron al paso / Siguen aquí / Se perdieron aquí" | M §3.1 «Conversión por etapa» | `embudoPorEtapas` `embudo-etapas.ts:454`; reglas de venta en memoria `:379-386` | `deal_etapa_historial` | etapa | deals, días hábiles | P,Co | mediana `null` con < 5 | `vd:241` |
| Agendas por semana | "Agendas por semana" | M §3.1 (grupo por semana) | `gruposPorSemana` `tg:306` | idem | semana (lunes–domingo) | % y conteos | P,Co | – | Hub |
| Tabla de closers | Agendas, % show, % cierre, Agenda → venta, Cómo cerró, Sin marcar, **Vendido, Recaudado, Por cobrar**, Comisión | M §3.1 (varias filas) | `embudoPorCloser` `dash:526` (re-escribe los mismos `count … filter` que `embudoDelRango`, `dash:538-541`) + `dineroDelRango` + `comisionesPorCloser` | idem | cita (calls.closer), venta (dueño del deal), abono (quien lo registró) | mixta | P,Co · closer = **3 criterios distintos** (C-16 vigente) | por closer | `vd:242` |
| Cortesías | "Cortesías" | **sin definición** | `contarCortesias` `dash:209` | `deals.cortesia=true` | primera entrada a etapa vendida | deals | P,Co,Cl | – | `vd:238` |
| Comisión | "Comisión" | M §3.1 «Comisión» | `comisionDeDeal` `comision.ts:14` | `deals.valor_vendido_usd × comision_porcentaje` | venta | USD | P,Co | `ventasSinComision` | `vd:243,270` |
| Descuento promedio | "Descuento" | **sin definición** | `descuentoDeDeal` `saldo.ts:72` (promedio en `vd:276-278`) | `deals`,`cohorts.precio_usd` | venta | USD y % | P,Co,Cl | – | `vd`, `vista-todos.ts:188` |
| Perdidos por motivo | "Perdidos por motivo" | **sin definición** | `dealsPerdidosPorMotivo` `dash:447` | `deals`,`motivos` | `cerradosEn` | deals | P,Co,Cl | – | **ninguno** (solo `dash`) |

### 2.3 Hub › Dinero

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Vendido | "Vendido" (vocab `vendido`); tipo interno `contratadoUsd` | M §3.1 «Vendido» | `dineroDeVentas` → `saldosDeDeals`; `contratadoDelRango` `dash:272` (otra suma sobre las mismas ventas) | `deals.valor_vendido_usd` | venta | USD | P,Co,Cl | `sinSaldoCalculable` (ventas sin valor) | `vd:233,260` (se calcula **dos veces** el mismo conjunto: `contratadoDelRango` y `dineroDeVentas`) |
| Recaudado | "Recaudado" | M §3.1 «Recaudado» | `dineroDeSaldos` `dinero-de-ventas.ts:37` | `abonos` ticket vigentes de esas ventas, a hoy | no depende de la fecha de abono | USD | idem | idem | idem |
| Por cobrar | "Por cobrar" | M §3.1 «Por cobrar» | idem; `sobrepago` aparte | | | USD | idem | | idem |
| Entró a caja | "Entró a caja" | M §3.1 | `cajaRecaudada` `dash:354` | `abonos` | `abonos.fecha` | USD/COP sin convertir | P,Co,Cl | no | `vd:232` |
| Ventas por cohorte | "Ventas por cohorte" | **sin definición propia** | `ventasPorCohorte` `dash:299` | `deals`⋈`cohorts` | venta | ventas + USD | P,Co | – | `vd:235`, `A/hub/secciones.tsx:142`, `components/dashboard/dinero.tsx:65` |
| Comisión y descuento por programa | "Comisión y descuento por programa" (`secciones.tsx:171`) | M §3.1 | ver arriba | | | USD, % | P (lado a lado) | | Hub de todos |
| Cupos con caja | "Cupos con al menos un abono" | M §3.1 «Cupos con caja» | `leerVentana` `series-dinero.ts:51` (`min(abonos.fecha)` por deal) | `abonos` | primer abono del periodo | ventas | P,Co,Cl | – | gráfica de Dinero |
| Ventas, Vendido y Entró a caja por día | serie diaria | M §3.1 | `leerSeriesDeDinero` `series-dinero.ts:128`; **re-filtra** las ventas con `porClaveDeDeal`/`porCohorteDeDeal` (`:71-76`) en vez de `filtroCierres` | idem | venta / abono | ventas, USD | P,Co,Cl | `sinValorVendido` | Hub page:356 |

### 2.4 Hub › Pauta

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Gasto | "Gasto" / `gastoUsd` | M §3.2 «Gasto» | `convertirGasto` `convertir-gasto.ts:21` ← `rp:314`, `costo-por-agenda.ts` | `gasto_pauta`, `tasas_cambio` | día que reporta Meta | COP o USD, **conversión con TRM del día** | P (cuentas) | `coberturaDeGasto`; `diasSinTrm` | `rp`, semáforo |
| ROAS | "ROAS" (sin unidad, U-04) | M §3.2 «ROAS» | `cargarRoasDePauta` `rp:154`, `calcularRoas` `:141` | `submissions`,`deals`,`calls`,`gasto_pauta` | **día del envío** (`diaDelEnvio` `rp:98`, `coalesce(fecha_envio, created_at)`) | razón (USD/USD) | P · jerarquía de pauta | `RazonConCobertura`: `null` si alguna venta cae fuera del gasto (`rp:141-151`) | Hub page, MCP `pauta_roas`, `mcf`, CSV |
| Registros / Agendas / Shows / No shows / Ventas (por campaña, conjunto, anuncio) | "Registros", "Agendas", "Shows", "Ventas" (`RenglonRoas`, `rp:54`) | M §3.2 (ROAS) | `sumarEnvio` `rp:121` | `submissions`→`deals`→`calls` | día del envío; **agendas = todas las citas del deal, sin ancla de fecha de cita**; **ventas = vendido en cualquier fecha** (`ventasDelPrograma` sin rango, `rp:184`) | citas / deals | P | no | H-02, H-18 |
| Embudo de Pauta (interino) | "Pauta y origen (interina)" | M §3.2 (no tiene fila propia) | `pautaInterina` `pauta-interina.ts:162` | `submissions`,`calls`,`ventasConDiaEn` | registros por envío, agendas por creación, **ventas por fecha de venta** | personas, citas, deals | P · Or (source, medium, campaign) | no | Hub page:26, `A/hub/pauta.tsx` |
| Costo por agenda (semáforo) | "Costo por agenda" (Programa › General, WhatsApp) | M §3.2/§3.3 | `costoPorAgenda`/`…DeVentana` | gasto de Meta ÷ **agendas según Meta** | día / ventana | COP | P | `RazonConCobertura` (`costo-por-agenda.ts:223`) | `semaforo.ts` |
| CPL, CAC, Diferencia Meta contra CRM, Costo por agenda del Hub | – | M §3.2 las marca 🟡 | **no existen** (tickets 123, 249) | – | – | – | – | – | – |

### 2.5 Hub › Origen

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Registros y agendas por canal y par UTM | tabla "Origen" (`components/dashboard/origen.tsx`, `tabla-de-origen.tsx`); lleva `utm_*`, "macro", "ADR" en cadenas (10 coincidencias, U-01 vigente) | M §2 | `origenDelPrograma` `origen.ts:105` | `submissions`,`calls`,`hechos/agenda` | envío / creación de la cita | registros, agendas | P | "Sin UTM" siempre visible | Hub, MCP `origen_del_programa`, `A/ajustes/salud` |
| Sin UTM · Macros sin expandir · Nuevo · Plantillas · Traza Paid | idem | M §2 tabla | `origenDelPrograma`, `emparejar` | idem | idem | % de registros | P | – | idem |
| Embudo del formulario | "Dejó datos / Llegó al Calendly / Agendó" (`components/embudo-formulario.tsx`) | M §3.1 | `embudoDelFormulario` `embudo-formulario.ts:234`; ancla `diaDeEnvio` `:97` | `submissions` (con parciales sin `fecha_envio`: C-04) | `fecha_envio` | personas/registros | P · no Cl | no | Hub page |
| Embudo por pregunta | "Embudo por pregunta" | **sin definición** | `embudoPorPregunta` `embudo-por-pregunta.ts:39` (Typeform Insights, caché 5 min) | API de Typeform | – | respuestas | P | – | Hub page |
| No agendaron | "No agendaron" | M §3.1 | `noAgendaronDelFormulario` `embudo-formulario.ts:227` | `leads`,`submissions` | primer envío | personas | P | – | Hub page, Inbox (`inbox/page.tsx:121`) |

### 2.6 Hub de todos los programas (`armarVistaDeTodos`, `Q/vista-todos.ts:161`)

| Métrica | Nombre visible | Def. | Función | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|
| Ventas, Agendas, Shows, Caja, Gasto | idem por programa, lado a lado | M §0 (regla de programa) | `armarVistaDelDashboard` por programa + `sumarConteos`/`sumarDinero` `agregado-programas.ts:29,40` | solo **Conteo** y **Dinero** suman (tipo `Tasa` no compila) | – | `A/hub/page.tsx`, `secciones.tsx` |
| Escalera por programa | tarjeta por programa | M §3.1 | `escaleraPorPrograma` `escalera-todos.ts:19` | sin total | – | Hub de todos |
| Tablas rearmadas a mano | "No depende del periodo A ni se compara con B", "Deuda cupos" (U-09 vigente) | – | `A/hub/secciones.tsx` | – | – | – |

### 2.7 Metas y cohorte (`/p/[programa]/metas` redirige al Hub; la lógica vive en `components/metas/` y `Q/metas.ts`)

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Vendidos de la cohorte | "Llevamos", "Cupos vendidos" | M §0 «Vendidos de la cohorte» | `ventasDeLaCohorte` `ventas-de-la-cohorte.ts:26` | `ventasConDiaEn` sin límite inferior | venta | cupos | P,Co (activa) | – | 5 llamadores (§1) |
| Meta del mes / semana / cohorte | "Objetivo del mes / de la semana / de la cohorte" | M §3.1 | `armarMetasDelMes` `metas.ts:144` | `cohorts.meta_cupos`, ventana de ventas | día hábil | cupos | P · no Cl (ADR 0023) | `mesSinVentana` | `vd:240`, `series-dinero.ts`, `vamos-a-llegar.ts` |
| Meta en USD | idem | M §3.1 | `armarMetasDelMes`, `armarVamosALlegar` `vamos-a-llegar.ts:135` | meta × `precio_usd` | – | USD | P | – | idem |
| Esperado a hoy, por día hábil, cumplimiento | "Esperado a hoy", "Por día hábil" | M §3.5 (Objetivo del día) | `esperadoLineal`, `metaDeHoy`, `metaLineal` | – | día hábil | cupos | P | – | 5 módulos (§1) |
| Ritmo, Proyección, Ventas/Shows/Agendas/Leads requeridos | idem vocab | M §3.4 | `calcularProyeccion` `proyeccion.ts:262` | grupo + registros + `hechos/venta` | día hábil | por día | P | muestra mínima (programa o 20) | `leerProyeccion` |
| Próxima cohorte | tablero "Próxima cohorte" | **sin definición** | `dealsDeProximaCohorte` `proxima-cohorte.ts:27` (la **fecha de espera sale de parsear el texto** de notas: `'Esperando corte: %'`, `:~64-72`) | `deals.pendiente`, `deal_actividades.nota` | nota del sistema | deals | P | – | `A/p/[programa]/proxima-cohorte/page.tsx` |
| Alertas de cohorte | "Alertas" | sin definición | `alertasDelPrograma` | – | – | – | P | – | Hub Hoy |

### 2.8 Students y cartera

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Students | "Students" | **sin definición** | `studentsDelPrograma` `estudiantes.ts:151`, `estudiantesDe` `:36` (usa `etapaVendida`) | `deals` en etapa vendida | hoy | personas/deals | P,Co · no Cl | – | `students/page.tsx:78`, MCP `cartera_vencida` |
| Recaudado / Por cobrar de Students | "Recaudado", "Por cobrar" (totales por moneda) | M §3.1 «Por cobrar» dice que la cartera "ya no existe aparte" | `totalesDeStudents` `estudiantes-totales.ts:20` (suma `abonado` aunque falte valor vendido; `porCobrar` solo saldos > 0) | `saldosDeDeals` | a hoy | por moneda (USD/COP) | P,Co | `sinValorVendido` | `students/page.tsx:79` |
| Cartera vencida | "Cartera vencida" (badge en `tarjeta-deal.tsx:169`, Inbox `pago_vencido`) | **M la declara inexistente** (`metricas.md:422`) | `carteraVencida` `cartera.ts:55` (solo etapa **Abonado**, saldo > 0, fecha límite o inicio de clases) | `deals`,`cohorts`,`saldosDeDeals` | `fecha_limite_pago` o inicio de clases | USD/COP | P,Co | `sinFechaDeReferencia` | `estudiantes.ts:168`, `kanban.ts:297`, `inbox.ts:565`, MCP `cartera_vencida`, `lib/mi-espacio/notificaciones.ts` |

### 2.9 Mi día (hoy Mi espacio) y Bandeja

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Mis métricas: Agendas, Shows, No shows, Cierres, % cierre, Caja, Comisión | "Agendas", "Shows", "No shows", "Cierres", "% cierre", "Caja"; al sumar programas, tasas lado a lado | M §3.1 | `armarVistaDeMisMetricas` `mi-espacio-metricas.ts:94`; `cifrasDelPeriodo` `:66` (`no_shows` por `resumenDeMetrica`, **no** por `embudoDelRango`) | igual que Comercial | cita / venta / abono | mixta; Cl = persona logueada | P,Cl · no Or | `pendientesDeResultado`, `madurando` | Mi espacio |
| Bandeja: llamadas de hoy sin resultado, sueltas, perdidos en Calendly, sin dueño, pago vencido | secciones del Inbox | **sin definición** | `inboxDelPrograma` `inbox.ts:258`, `perdidosEnCalendly` `:181`, `seccionesSinDueno` `inbox-sin-dueno.ts:127` (sin resultado: `citaVencidaSinResultado`, `inbox.ts:314`) | `calls`,`deals` | cita | filas | P,Cl | – | `bandejaParaActor` `operacion.ts:58`, MCP `bandeja` |

### 2.10 Deals (tablero y ficha)

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Totales por columna | "Potencial", "Confirmado" (`kanban.ts:116,117,480,481`) | **sin definición** | `tableroKanban` `kanban.ts:279`: `potencialUsd = saldo.precio ?? precio_usd de la cohorte`; `confirmadoUsd = saldo.abonado` | `deals`,`saldosDeDeals`,`cohorts` | hoy | USD | P,Cl,… | – | `deals/page.tsx`, MCP `tablero_de_deals` |
| "Vendido" en la ficha | `vendido` (booleano) | – | `fichaDeDeal` `ficha-deal.ts:732`: `abonosVigentes > 0 \|\| esEtapaVendida(etapa)` | – | – | bool | – | – | ficha del deal |
| Valor vendido, Descuento, Saldo | "Valor vendido" (`ficha-cabecera.tsx:80`) | M §3.1 | `saldosDeDeals`, `descuentoDeDeal` | `deals`,`abonos` | – | USD o moneda del abono | – | alerta si moneda distinta (`ficha-pago.tsx:128`) | ficha |

### 2.11 Leads (lista y ficha)

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Leads (lista) | "Leads" (`leads/page.tsx:220`) | **sin definición** (≠ M "Leads" de Comercial) | `leadsDelPrograma` `leads.ts:131` (sin filtro `entrada='formulario'`; creación = `coalesce(fecha_primera_aplicacion, created_at)`, actividad = `fecha_ultima_aplicacion`) | `leads` | creación o último envío | personas | P · calidad, abandono, duplicado, deal | – | `leads/page.tsx`, MCP `buscar_leads` |
| Posibles duplicados | "Posibles duplicados" | sin definición | `posiblesDuplicadosDelPrograma` `leads.ts:405` | `lead_contactos` | – | personas | P | – | `leads/page.tsx:227` |
| Calidad (High/Mid/Low) | "Calidad"; ficha del deal "Lead quality" (`ficha-perfil.tsx:14`) y "Lead value" (`:15`) | sin definición | `lower(trim(leads.lead_quality))` en `leads.ts:~137`; la escalera usa `submissions.lead_quality` del envío de origen | – | – | texto | – | "Sin calidad" | G-10 vigente |
| Ficha del lead: llamadas por deal, abonos | – | – | `fichaDeLead` `ficha-lead.ts:258`, `abonosDelLead` `abonos-del-lead.ts` ("ningún total sale de aquí") | – | – | – | P | – | `leads/[id]/page.tsx` |

### 2.12 Dashboard por programa y la lista detrás de cada cifra

`/p/[programa]/dashboard` y `/dashboard` redirigen al Hub; `dashboard/lista` sigue existiendo (K-12, G-14). La lista detrás de cada
cifra es `listaDeMetrica` `mcf:1113`, con 44 claves en `METRICAS_DE_LISTA` (`Q/filtros-de-lista.ts:8-17`) y la garantía de
exhaustividad de tipo en ambos sentidos. Rótulos del mapa literal `titulos` (`hub/lista/page.tsx:36-83`):

| Clave | Rótulo en la lista | Rótulo del vocabulario (`VOCABULARIO`) | ¿Coinciden? |
|---|---|---|---|
| `cierres` | Cierres | `ventas` = "Ventas (cupos)" | no |
| `contratado` | Vendido | `vendido` = "Valor vendido" | no |
| `agendas` | Agendas | `citas` = "Citas vigentes" / `agendadas` = "Citas agendadas en el periodo" | no |
| `agendas_creadas` | Agendas creadas | `agendadas` | no |
| `leads` | Leads | `leads` | sí (pero la lista usa `filtroLeads`, ver H-04) |
| `registros` | Registros | `registros` | sí |
| `shows` | Shows | `shows` = "Citas a las que asistieron" | casi |
| `no_shows` | No show | `no_asistio` = "No asistió" | no |
| `sin_resultado` | Llamadas pasadas sin resultado | `llamadas_sin_resultado` | no |
| `citas_sin_marcar` | Citas sin resultado marcado | `citas_pendientes` = "Citas sin resultado" | no |
| `grupo_pendientes` | Citas pasadas sin resultado | idem | no |
| `deals_creados` / `embudo_comercial_creados` | "Deals creados" (los dos) | – | dos claves, un rótulo |
| `deals_que_agendaron` / `embudo_comercial_agendaron` | "Deals que agendaron" (los dos) | – | dos claves, un rótulo |

Cada fila trae su subtotal desde `subtotal` `mcf:1005`; la suma de dinero de la lista (`mcf:369,374`: `sumaDeAbonos`,
`sum(deals.valor_vendido_usd)`) es **otra** agregación distinta de `dineroDeVentas` (`mcf:1047` llama a las dos en la misma lista).

### 2.13 Reporte de WhatsApp y semáforo (ADR 0089)

| Métrica | Nombre visible | Def. | Función | Fuente | Ancla | Unidad | Filtros | Cobertura | Llamadores |
|---|---|---|---|---|---|---|---|---|---|
| Costo por agenda | "Gasto de agenda … · agendas Meta … · CRM …" (`mensaje.ts:111`), "c/u", "ag" | M §3.3 | `semaforoDelPrograma` `semaforo.ts:216` → `costoPorAgenda` | gasto Meta (o foto del día) ÷ agendas Meta | día, hora | COP | P | `costoCobertura`; "sin agendas" | `app/api/semaforo/envios/route.ts:119`, `vista-previa.ts` |
| Agendas CRM junto a Meta | "CRM N" | M §3.3 punto 2 | `contarAgendas` `costo-por-agenda.ts:183` ← `hechos/agenda.agrupar` (área Paid) | `calls` | creación | agendas | P | – | idem |
| CPL de lanzamiento | "reg · c/u" | M §3.2 | `costoPorAgenda` (lanzamiento) | `complete_registration` | día | COP | P | – | idem |
| Color | "En meta / Atención / En peligro" (UI) contra verde/amarillo/rojo (mensaje) | M §3.3 punto 5 | `colorDelCosto` `color.ts:23` | – | – | – | – | – | `semaforo.ts` |
| Horas de agenda | "Horas de agenda" | M §3.1 (🟡 298, pero en producción: `route.ts:220`) | `armarMensajeDeHorasDeAgenda` `horas-de-agenda.ts:55` | `calls.created_at` | hora de creación Bogotá | horas | P | – | route:220 |
| Campos de contrato | `esquemaRespuestaSemaforo` `contrato.ts:112` (`.strict()`) | – | – | – | – | – | – | – | route |

Lo que el WhatsApp imprime con términos de backend: `fbclid`, "envíos pagos", `ag`, `reg`, `c/u` (`mensaje.ts:123-155,254`, U-21 vigente).

### 2.14 Exportables CSV

| Exportable | Columnas con números | Función | Observación |
|---|---|---|---|
| `deals/descargar.csv` | "Valor" | `dealsParaCsv` `deals-para-csv.ts:14` | **"Valor" es `leads.lead_value`** (`:30`), no el valor vendido |
| `hub/pauta-citas.csv` | fecha, resultado, campaña, conjunto, anuncio | `csvDeCitasPauta` `lib/pauta/csv-citas.ts:12` sobre `VistaRoasDePauta` | usa las citas del ROAS (sin ancla de fecha de cita) |
| `calls/grain.csv` | "Resultado" | `csvDeGrain` `lib/llamadas/csv-grain.ts:34` (+ `sin-grain.ts`) | – |

### 2.15 Gráficas y series

| Serie | Nombre visible | Función | Observación |
|---|---|---|---|
| Ventas, Vendido y Entró a caja por día | Dinero | `leerSeriesDeDinero` `series-dinero.ts:128` | re-implementa el filtro de ventas (H-08) |
| Cupos con caja | "Cupos con al menos un abono" | `leerVentana` `:51` | – |
| Deals contra agendas | "Deals y agendas" | `serieDealsContraAgendas` `deals-contra-agendas.ts:100` | `acumularPorHabil` `:65` |
| Paso, unidad y forma | `?g_<clave>=…` | `lib/series-pasos.ts` (`tramosDe` `:99`) | guardián `graficas-guardian.test.ts` |

### 2.16 Las once tools del MCP (`lib/mcp/herramientas/`)

Todas comparten el mismo patrón: devuelven `estructurado` con el objeto interno y un texto que **escribe cada una a mano**.

| Tool | Cifra y nombre que imprime | Función | Observación |
|---|---|---|---|
| `programas_visibles` | – | `programas.ts:7` | – |
| `resumen_del_hub` | "Ventas cerradas" (= `embudo.cierres`), "Vendido", "Caja", "Agendas" (= citas, `embudo.agendas`) y "shows" (= **llamadas**) en la misma línea (`metricas.ts:52`); "Show", "Cierre", "Agenda a venta" (= **deals**, `:53-55`) | `armarVistaDelDashboard`, `proyectarDashboardSegunRol` `vista-metrica.ts:515` | devuelve la vista interna entera (`vista`): `dinero.ventas`, `embudo.cierres`, `contratadoUsd` |
| `consultar_metrica` | imprime la **clave** (`${entrada.metrica}: N`, `metricas.ts:132`): `cierres`, `contratado`, `grupo_vendidos` | `vistaDeLista`, `desglosesDelResumen` `mcf:1170` | enum `METRICAS_DE_LISTA` completo (44 claves) |
| `buscar_leads` | filas | `leadsDelPrograma` | – |
| `ficha_de_lead`, `ficha_de_deal` | fichas | `fichaDeLeadParaActor`, `fichaDeDealVisible` | – |
| `tablero_de_deals` | "Potencial/Confirmado" | `tableroKanban` | sin paginar |
| `bandeja` | secciones | `bandejaParaActor` | – |
| `cartera_vencida` | saldo por fila | `carteraVencida` + `studentsDelPrograma` | sin paginar |
| `pauta_roas` | "Vendido", "gasto", "Registros", "agendas", "shows", "ventas" (`decisiones.ts:126-127`) | `cargarRoasDePauta` | "ventas" y "agendas" con el ancla del envío (H-02, H-18) |
| `origen_del_programa` | canales | `origenDelPrograma`, `resumenDeOrigen` | `contenidoNoReconocido` expone jerga |

### 2.17 Superficies que no estaban en la lista cerrada (agregadas)

| Superficie | Cifras | Función | Definición |
|---|---|---|---|
| Programa › Ventas / ficha del programa | Comisión del closer, objetivos de la cohorte | `fichaDelPrograma` `ficha-programa.ts:140`; `textoComisionPrograma` `operacion.tsx:60` | M §3.1 «Comisión» |
| Nerd Stats y Ajustes › Salud | conteos por programa/origen, salud de fuentes ("sin calidad") | `conteosPorPrograma` `nerd-stats.ts:36`, `saludDeFuentes` | sin definición |
| Meta CAPI | resumen | `resumenMetaCapi` `lib/meta-capi/resumen.ts:14` | sin definición |
| Media | piezas por estado | `lib/media/lista-de-piezas.ts` | sin definición |

## 3. Hallazgos

Clases: **A** = dos conceptos con el mismo nombre · **B** = mismo concepto con dos nombres · **C** = duplicado de implementación ·
**D** = métrica sin definición · **E** = función del diccionario sin llamador (o inexistente) · **F** = contradicción documental.

### Dos conceptos con el mismo nombre (A)

- **H-01 · Caso 0: "Ventas" frente a "% de cierre".** `embudoDelRango` devuelve en el mismo objeto `cierres` (ventas con día en el
  rango: `ventasDelRango` `dash:196,417`) y `pctCierre` (`tg:117`). Difieren en: (a) ancla, la venta cae por su fecha de venta y el
  grupo por la **fecha de la cita**; (b) universo, `cierres` incluye ventas sin cita ni show (escalón 4 de la escalera) mientras el
  grupo exige cita ocurrida y excluye cortesías (`tg:252`, `leerCitasDelGrupo`); (c) `vendidos` del grupo mira la **etapa actual**
  (`tg:168`), sin importar cuándo se vendió; por eso hay marca `madurando`. Ambas se rotulan "Cierre(s)" (`operacion.tsx:72,219`),
  "Ventas cerradas" y "Cierre" en el MCP (`metricas.ts:49,54`), `cierres` y `pctCierre` en Mi espacio
  (`mi-espacio-metricas.ts:84-85`). El texto de vocabulario `cierre_de_ventas` dice "De las citas realizadas, cuántas terminaron en venta",
  que es el grupo por deal, no por cita. **Confirmación con datos queda para F2.**
- **H-02 · "Agendas" tiene cuatro universos.** (1) citas no canceladas por fecha de cita (`dash:390`, rótulo "Agendadas"
  `operacion.tsx:217`, "Agendas" lista `lista/page.tsx:37`, MCP "Agendas"); (2) llamadas **creadas** en el rango
  (`mf:342,364`, "Agendas creadas", y es lo que el `VOCABULARIO.agendadas` llama "Agendadas"); (3) ROAS: todas las citas del deal del
  envío del rango, sin fecha de cita (`rp:123,245-253`); (4) Origen y Pauta interina: creadas atribuidas al envío (`hechos/agenda`).
  Un MCP o un CSV puede mostrar dos de ellos con el mismo nombre en el mismo periodo.
- **H-03 · "Show" tiene al menos siete cuentas.** `estadosDeCitas.show` solo cuenta `resultado='show'` (`dash:394`) mientras
  `llamadasConShow` cuenta los cuatro resultados (`dash:402`); `conShow` por deal (`tg:105`); `showPorCita.realizadas`
  (`tasa-show-por-cita.ts:33`); `pauta-interina.shows`; `rp:124`; `hechos/cita.ts:60,74`. En `resumen_del_hub` la línea
  "shows: N" (llamadas) va pegada a "Show: X %" (deals) (`metricas.ts:52-53`).
- **H-04 · "Leads".** Tres universos: personas por `filtroLeads` (`mf:313`: `entrada='formulario'`, ancla
  `fecha_primera_aplicacion`); registros (envíos completos) rotulados "Leads de hoy" en Hoy (`cifras-clave.tsx:43`) y "Leads" en la
  semana (`semana.tsx:58`); y la lista Leads (`leads.ts:131`: sin filtro de `entrada`, ancla `coalesce(primera, created_at)`).
  El vocabulario ya separa `registros` de `leads`; las pantallas no.
- **H-05 · "Recaudado" y "Por cobrar".** En el Hub salen de `dineroDeVentas` (ventas elegidas, **excluye** las que no tienen valor
  vendido, `dinero-de-ventas.ts:41-44`); en Students, `totalesDeStudents` suma `abonado` también de filas sin valor vendido
  (`estudiantes-totales.ts:26-28`); "Confirmado" del tablero es `abonado` (`kanban.ts:481`); "Entró a caja" es otra métrica (por fecha de
  abono). Mismo rótulo, distinto tratamiento de la venta sin valor.
- **H-06 · Dinero con cinco nombres.** Vendido (Hub), `contratado` (clave de lista, `contratadoUsd` en tipos y en la salida del MCP
  aunque `JERGA_PROHIBIDA_EN_EL_HUB` lo prohíbe), "Potencial" (tablero), "ticket perdido" (`embudo-etapas.ts:241`, usa precio de la
  cohorte, no valor vendido), "Valor" (CSV de deals = `lead_value`).
- **H-07 · "Cita sin resultado" tiene cinco predicados y cuatro nombres.** `citaVencidaSinResultado` (`mf:467`: solo `fecha_agenda`,
  excluye deals cerrados, exige join con `deals`, deja fuera las citas sueltas por el `NOT IN`: **inferido**); `citaDebidaSinMarcar`
  (`mf:499`: `coalesce`, no excluye cerrados); grupo `pendientes` (`tg:172-175`: deals cuyas citas son todas `agendada`); ROAS
  `citasSinMarcar` (`rp:254-257`); Pauta interina `citasSinMarcar`. Rótulos: "Llamadas pasadas sin resultado", "Citas sin resultado
  marcado", "Citas pasadas sin resultado", "Sin marcar", "Sin resultado". `tasasDe` guarda el mismo número dos veces
  (`pendientes` y `sinMarcar`, `tg:112-113`).
- **H-08 · "Venta": un predicado, seis recorridos.** `vendidosEn` y `ventasConDiaEn` son la misma consulta con distinta proyección
  (`mf:172-180` y `225-233`); `series-dinero.ts:71-76` vuelve a filtrar por programa, closer y cohorte en vez de `filtroCierres`;
  `ficha-deal.ts:732` define "vendido" como abono **o** etapa; `ventasDelPrograma` (`escalera.ts:166`) no tiene rango; `cerradosEn`
  (`mf:198`) cuenta ganados y perdidos con otra regla de reapertura; `tg:168` y `embudo-etapas.ts:379-386` reimplementan en memoria.
- **H-09 · "Cierre".** Ventas (`cierres`), Close date (`cerradosEn`), "Cierre" del kanban (`deals/page.tsx:32`), "Cierre de ventas"
  (título de configuración, `configuracion-hoy.tsx:145`), "Cómo cerró", "Motivo del cierre".

### Mismo concepto con dos o más nombres (B)

- **H-10 · Show/ocurrió/atendido/realizada/asistió:** "Show", "Realizadas (show)", "Llamadas atendidas", "Asistencia", "No-show" y
  "No show" y "No asistió" conviven (`operacion.tsx:54-55,106-107`, `acciones-de-llamada.tsx:154,231`, `VOCABULARIO`).
- **H-11 · Dinero cobrado:** "Recaudado", "Caja", "Entró a caja", "Caja del día", "Confirmado", "Abono" (`rotuloDeImporte`).
- **H-12 · Closer** significa quien tomó la llamada, el dueño del deal o quien registró el abono (`filtroLlamadas`, `filtroCierres`,
  `filtroCaja`); sigue siendo una sola palabra en la tabla de closers (`operacion.tsx:152`).

### Duplicados de implementación (C)

- **H-13 · Tres formas de cobertura (N3).** `RazonConCobertura` (`lib/cobertura.ts:23`) solo la usan ROAS (`rp:145`) y costo por agenda
  (`costo-por-agenda.ts:223`); % de show y de cierre usan `{cobertura, parcial, sinMarcar, pendientes}` (`tg:75-88`); % de show por cita
  tiene `{sinMarcar, porcentaje}`; Proyección tiene su propia muestra mínima (`proyeccion.ts:30,57`).
- **H-14 · Ancla de fecha.** 16 ocurrencias de `AT TIME ZONE 'America/Bogota'` en 8 archivos fuera de `hechos/fechas.ts`
  (`mf` 7, `mcf` 2, `leads.ts` 2, `embudo-formulario.ts:97`, `bitacora.ts:98`, `pauta-interina.ts:109`, `rp:103`, `hechos/agenda.ts:110`).
  El día del envío tiene cuatro expresiones: `fechaAnclaEnvio` (`mf:347`, solo `fecha_envio`), `diaDeEnvio`
  (`embudo-formulario.ts:97`, solo `fecha_envio`), `diaDelEnvioSql` (`rp:102`, `coalesce` con `created_at`) y `diaEnBogota`
  (`pauta-interina.ts:109`). La diferencia es justo C-04: el parcial de Typeform llega sin `fecha_envio`.
- **H-15 · "Ocurrió" tiene siete envolturas** sobre `RESULTADOS_QUE_OCURRIERON` (`mover-etapa.ts:974`): `llamadaOcurrio` (`mf:235`), `esShow`
  (`tg:127`), `ocurrio` privada en `rp:95` y en `pauta-interina.ts:118`, SQL crudo en `hechos/cita.ts:21` y `escalera.ts:201`,
  `sin-grain.ts:38`, `reporte-diario.ts:51`, `mcf:622,975` y `mover-etapa.ts:951,1003`. El diccionario ya nombra los destinos
  (`showPorDeal`, `showPorCita`, `ocurrioSql`) y no existen (ticket 353 sin empezar).
- **H-16 · No show.** `filtroNoShows` (`mf:457`), `estadosDeCitas.noShow` (`dash:395`), `resumenDeMetrica("no_shows")` en Mis métricas
  (`mi-espacio-metricas.ts:78,114`: la misma cifra del embudo calculada por la lista), `noShows` del ROAS y de Pauta interina; el
  complemento `grupo_sin_show` no es ninguno de ellos. `VOCABULARIO.no_asistio` se define como "ocurridas sin llamada atendida".
- **H-17 · "Sin UTM".** Tres definiciones (`canal.ts`, `canal-sql.ts`, `categoriaDe` `pauta-interina.ts:~114`) y dos en Pauta:
  persistente respecto de la auditoría del 30-oct (C-14); no se releyeron las dos primeras en esta fase (**inferido** de la tabla
  "Conceptos" de `metricas.md:43`).
- **H-18 · Pauta con dos cargadores y dos anclas en la misma pestaña.** `pautaInterina` (ventas por fecha de venta) y
  `cargarRoasDePauta` (por día del envío) se importan en `hub/page.tsx:26,41`; la lista de ROAS toma `ventasDelPrograma` sin rango, por
  eso "ventas" del ROAS no es "Ventas" del Hub aunque coincida el nombre.
- **H-19 · `embudoPorCloser` repite inline los cinco `count … filter`** de `embudoDelRango` (`dash:538-541` frente a `390-402`).
- **H-20 · Sumas y promedios en componentes y vistas:** `components/dashboard/hoy/dinero.tsx:30` suma Vendido/Recaudado/Por cobrar de una
  lista de ventas (recalcula `dineroDeSaldos`); `A/hub/secciones.tsx:73`; `tabla-de-origen.tsx:41`; `vd:276` promedios de descuento.
- **H-21 · Dinero calculado dos veces con el mismo conjunto:** `vd:233` (`contratadoDelRango`), `vd:234,260` (`ventasDelRangoConValor` +
  `dineroDeVentas`) y `mcf:369,374` (suma de la lista, aparte de `mcf:1047`) recorren las mismas ventas por separado.
- **H-22 · Calendario:** copias de `sumarDias` y `lunesDe` en `proyeccion.ts:216,221` (existen en `rangos.ts:32,37`); `ultimoDiaDelMes` en
  `vamos-a-llegar.ts:99` y `vista-hoy.ts:48`.
- **H-23 · Formato:** helpers locales de porcentaje/tasa (`embudo-formulario.tsx:27`, `embudo-por-pregunta.tsx:14`,
  `tabla-de-origen.tsx:27`, `piezas.tsx:11`, `operacion.tsx:149`) además de `pct` (`format.ts:42`).
- **H-24 · Rótulos fuera del vocabulario.** `VOCABULARIO` sí lo usan Hoy, Dinero, Metas, el reporte diario y las gráficas de Dinero
  (`nombreCorto(...)` en `hoy/*.tsx`, `dinero-de-ventas.tsx`, `vamos-a-llegar.tsx`); **no** lo usan Comercial (`operacion.tsx`), el mapa
  `titulos` de la lista (`lista/page.tsx:36-83`, salvo 2 claves), Pauta, Origen, Mis métricas, el WhatsApp ni el MCP. Hay 350 literales
  `titulo=`/`etiqueta=`/`label=` con mayúscula inicial en `app/` y `components/` (no todos son de métricas).

### Métricas sin definición en el diccionario (D)

**H-28.** Cortesías, Descuento promedio, Perdidos por motivo, Banderas del pulso (Atendidos sin valor / sin Grain, solo mencionadas en una
nota), Alertas de cohorte, Ventas por cohorte, Embudo por pregunta, Cartera vencida (el diccionario dice que no existe),
Students y sus totales, Próxima cohorte, Potencial y Confirmado del tablero, Inbox (cada sección), Leads de la lista (≠ Leads del
Hub), Posibles duplicados, Calidad del lead, Meta CAPI, Nerd Stats, Origen del cierre (🟡 254, pero `comoNacioLaVenta` existe
para Hoy), Agendas futuras, Reagendadas, Bandeja.

### Funciones del diccionario sin llamador, inexistentes o desactualizadas (E)

**H-29.** Detalle:

- **Inexistentes:** `showPorDeal`, `showPorCita`, `ocurrioSql` (M §0, ticket 353), `agruparEnvios` (M §3.5), `armarMensaje`
  (M §3.3; la real es `armarMensajeDeLaHora` `mensaje.ts:226`).
- **Sin llamador fuera de `tests/`:** `tasaDelDia` `lib/trm/consultar.ts:14` (M §1.8 la cita como la función; la real en uso es
  `tasasDelRango` `:33`); todo `Q/hechos/abono.ts` (cero importadores; M §1.5 lo cita como la función de Entró a caja, que en realidad
  calcula `cajaRecaudada` `dash:354`); `Q/hechos-embudo.ts` (solo su tipo lo importa `dash`); `embudoPorCanal` `dash:666` y
  `dealsPerdidosPorMotivo` `dash:447` (solo dentro de `dash`); `periodoAnterior` `serie.ts:26`; `colorDeCupos` `lib/objetivos/semaforo.ts`;
  `components/proxima-fase.tsx`, `perfil-propio.tsx`, `canales-admin.tsx`. (`convertirMonto` solo lo usa `convertirGasto`: es interna,
  no un duplicado.)
- **Citada como borrada y vigente:** `sumarEnCop` aparece tachada en M §0 pero sigue en `costo-por-agenda.ts:61` (hoy llama a `convertirGasto`).
- **Filas del diccionario sin función:** Costo por agenda del Hub, Diferencia Meta contra CRM (249), CPL, CAC (123), Origen del cierre
  (254), Cierre del ciclo (261). Horas de agenda sigue 🟡 298 aunque ya está en `route.ts:220`.

### Contradicciones documentales (F)

- **H-25 · Cartera.** `metricas.md:422` dice "la cartera ya no existe aparte: es Por cobrar"; el código mantiene `carteraVencida`
  (solo Abonado, con fecha límite) en Students, tablero, Bandeja, notificaciones y una tool del MCP, y "Por cobrar" no mira fechas.
- **H-26 · `pauta-interina.ts:23-26`** declara que sus definiciones "son las de `docs/analytics.md` §6 y viven SOLO aquí", y
  `AGENTS.md` ya declaró esas fórmulas historia (N8).
- **H-27 · `vocabulario-metricas.ts`** dice "Alineado con `docs/overview.md` §11"; el rótulo "Agendadas" (creadas) no coincide con
  lo que pinta la tarjeta de Comercial que lo usa para citas por fecha de cita.

### Constantes y datos derivados de texto

- `UMBRAL_SIN_MARCAR = 0.1` y `DIAS_PARA_MADURAR = 30` siguen como constantes (`tg:38-39`; el segundo tiene override por programa,
  `diasParaMadurarDe` `tg:42`); `MUESTRA_MINIMA_CONVERSION = 20` con override (`proyeccion.ts:406`).
- `proxima-cohorte.ts` deriva la fecha de espera de `deal_actividades.nota LIKE 'Esperando corte: %'` (frágil, F3).

## 4. Cobertura del inventario y lo que queda para F2

- Cubiertas las 11 superficies de la lista cerrada y cuatro más (§2.17). Las 11 tools del MCP están en §2.16.
- **No se leyeron** línea por línea: `Q/kanban.ts` (756), `Q/inbox.ts` (763), `Q/ficha-deal.ts` (884), `canal.ts`/`canal-sql.ts`, ni los tests
  guardianes (`venta-una-definicion`, `hub-vocabulario-guardian`, etc.): de ellos se usó lo que dicen sus comentarios y su existencia.
- Lo marcado **inferido** debe reproducirse con un `SELECT` en F2: H-01 (cifras de 17 contra 11 / 33), el efecto de `NOT IN` en
  H-07, y las diferencias de universo de H-02, H-04 y H-05.
