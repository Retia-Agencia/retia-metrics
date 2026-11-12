---
id: 412
etapa: pauta
serves: "docs/paid-media-2026-11-09.md (extracción completa, briefs de las hijas y prompt de la sesión padre) · Reunión con Paid Media (Dani Rodríguez y Michael, 7-nov) · weekly con Daniel Tovar del 3-nov (docs/weekly-2026-11-03.md) · reportes de Paid Media de 30X (diario y semanal) e imagen de KPI General/Comercial/Tráfico que pasó Mani el 9-nov · ADR 0115 N1, N3 y N5 · contrato C-1 y C-2 (docs/hub.md §8)"
depends: [355, 370, 371, 375, 377]
status: en main
---

# 412 — Pauta y Origen, una sola pestaña: el Excel de pauta sale del CRM

## Por qué

Paid Media (César y Dani Rodríguez) lleva tres Excels a mano (uno por programa) con la inversión, las agendas, las ventas,
el ROAS y el tráfico, y Michael les llena a mano la parte comercial. Dani Rodríguez lo pidió textual: *"esa data
semanal del Excel se pueda ver acá, para no estar diligenciando eso todos los días"*, con **una sección semanal y una
diaria**, filtrables por fechas. Mientras se valida, el Excel sigue; cuando cuadre, se deja.

En el Hub, **Origen** (de dónde vino cada envío) y **Pauta** (qué rindió la plata) responden la misma pregunta con el
mismo periodo, en dos pestañas. Se funden en una.

## Las fuentes y lo que se tomó de cada una

| Fuente | Lo que aporta (depurado) | Lo que se descarta y por qué |
|---|---|---|
| **Imagen KPI** (Total + Semana N) | Las 16 filas en 3 bloques: **General** (Inversión, Agendas, Costo por agenda, Ventas, Facturación, ROAS, Profit), **Comercial** (% presentación a zoom, % cierre zoom a cliente, % cierre agenda a cliente), **Tráfico** (CPM, CTR, % clicks a landing, % conversión landing, Costo por agenda, Frecuencia). Columnas: Total del periodo + una por semana | Nada. El costo por agenda sale dos veces con valores distintos (45,59 y 54,97): uno es con agendas del CRM y el otro con agendas del pixel. Aquí se muestran las dos, cada una con su nombre (decisión D-1) |
| **Semanal 30X** | Cumplimiento por cohorte de **tres cosas**: agendas, ventas de pauta y ventas totales. Cada una muestra "sobre el total" y "sobre lo que deberíamos ir a la fecha" (esperado = días transcurridos ÷ días de la cohorte). Estado: **En meta** si ≥ 100 % de lo esperado, **En seguimiento** si ≥ 65 %, **Rezagado** si no. Cifras de arriba: inversión contra KPI, agendas contra KPI, ventas contra KPI, **ROAS blend** = facturación de pauta ÷ inversión. Curvas semana a semana de la cohorte. Cada cifra semanal con su variación contra la semana anterior, en verde o rojo según si subir es bueno o malo | El texto escrito a mano (accionable, highlights, nota de datos, etiqueta "Escalable") y el link al Excel de creativos: es juicio de una persona, no se calcula. Los umbrales escritos en el código del artifact: aquí son filas de `objetivos` (abajo) |
| **Diario 30X** | El día contra el **promedio diario de los últimos 7**. Costo por agenda **sin** la inversión de campañas que no buscan agendas (reconocimiento, tráfico), que se muestra aparte con su nombre. Ritmo de la cohorte: atraso o adelanto en agendas y en dinero, **agendas por día requeridas** e **inversión requerida** para llegar (a la meta de costo por agenda y al promedio de la cohorte). Ventas de pauta contra ventas totales (% de pauta). Tabla por campaña (inversión, agendas, costo por agenda). Ranking de anuncios (inversión, agendas, CTR, ventas de la cohorte; "revisar": gastó sin agendas). Ventas con UTM de pauta que el CRM no atribuye. Rangos rápidos: último día, día anterior, 7, 14 y 28 días, esta semana, semana pasada, este mes, mes pasado, todo | Las ventas cruzadas entre programas (un anuncio de A que vendió B): el programa es frontera y ninguna cifra los cruza (AGENTS.md). El desglose por ciudad de Inmersivos: Retia no tiene ese caso. El playbook de seteo de 30X: es de Comercial, otro frente |
| **Reunión Paid Media** | Semanal + diario; filtro por fechas; % show y % cierre visibles desde pauta; el trafficker entra con lo mínimo | — |
| **Weekly Dani Tovar** | Ya cubierto: ROAS por día del envío y pendientes (355), proyectado (375), cupos y plata (370), metas mes y cohorte (371). Nuevo para esta pestaña: **qué anuncios llegan sin UTM**, como lista para la sesión con César | — |

## Lo que ya existe y se reusa (no se reescribe, N1)

| Fila | Definición vigente (`docs/metricas.md`) | Dónde vive |
|---|---|---|
| Inversión | Gasto convertido con la TRM del día; el ROAS en USD | `hechos/gasto.ts` (`gastoConvertido`) |
| Agendas | Citas creadas en el CRM (DA-4); las de Meta, aparte | `hechos/agenda.ts`; `agendas_meta` en `gasto_pauta` |
| Costo por agenda (CRM) | Gasto Paid ÷ agendas del CRM de área Paid (🟡 249: hoy no se muestra) | se construye aquí |
| Costo por agenda (Meta) | Gasto de agenda ÷ agendas según Meta (el del semáforo) | `lib/semaforo/costo-por-agenda.ts` |
| Ventas, Facturación | Deals de Paid en Abonado o Completo, y su Vendido en USD | módulo de venta (352) |
| ROAS | Vendido de Paid ÷ gasto en USD, una ancla por paso | 355 |
| % presentación a zoom | **% de show** (`showPorCita`) | `lib/deals/resultados-de-llamada.ts` |
| % cierre zoom a cliente | **Cierre de ventas** | ídem |
| % cierre agenda a cliente | **Agenda → venta** (= % show × % cierre) | ídem |
| Esperado a la fecha, faltantes por día | `calcularProyeccion` / "¿Vamos a llegar?" | 371 |
| Umbrales del semáforo | filas de `objetivos` (`meta` verde, `aceptable` amarillo) | ADR 0063, 122 |

**Vocabulario (N4 y N5):** en pantalla se usan los nombres del CRM y, al lado y una sola vez en el "Cómo se calcula", el
nombre del Excel ("% presentación a zoom = % de show"), para que Paid Media reconozca sus filas sin un segundo vocabulario.

## Lo que falta en la base

1. **Tráfico de Meta por anuncio y día.** `gasto_pauta` guarda gasto, agendas y registros según Meta, pero no
   impresiones, alcance, clics al enlace ni vistas de la landing. Sin eso no hay CPM, CTR, % clicks a landing,
   % conversión landing ni frecuencia. **Migración** (la aplica la sesión principal): columnas enteras nulas
   `impresiones`, `alcance`, `clics_enlace`, `vistas_landing` en `gasto_pauta`, y el sync de pauta las escribe
   (`impressions`, `reach`, `inline_link_clicks`, `landing_page_view` de los insights). Fórmulas, todas sumando
   numeradores y denominadores, nunca promediando porcentajes:
   CPM = gasto ÷ impresiones × 1000 · CTR = clics ÷ impresiones · % clicks a landing = vistas de landing ÷ clics ·
   % conversión landing = registros del CRM de Paid ÷ vistas de landing · frecuencia = impresiones ÷ alcance (el alcance
   de varios días no se suma: se pide a Meta por el rango, o la frecuencia se muestra por día; ver D-5).
   Lo anterior a la migración queda nulo y la celda dice "—" con cobertura (N3), nunca 0.
2. **Metas de la cohorte que no hay.** `objetivos` tiene cupos, agendas por día, costos, ROAS y conversión. Faltan
   **agendas de la cohorte** (total) e **inversión de la cohorte** (presupuesto). Se agregan al enum
   `metrica_objetivo` en la misma migración; los valores se cargan como filas, por el molde.

## Alcance: la pestaña "Pauta", de arriba a abajo

`?seccion=origen` redirige a `?seccion=pauta` con el resto de la URL. La pestaña Origen desaparece de la lista.

1. **Cifras del periodo** (fila de tarjetas): Inversión · Agendas · Costo por agenda · Ventas · Facturación · ROAS ·
   Profit (= Facturación − Inversión, en USD). Cada una abre su lista (contrato "toda cifra abre su lista").
   ROAS con el aviso de pendientes del 355.
2. **Cumplimiento de la cohorte** (no lo tocan los filtros de fecha, sí el de cohorte): agendas, ventas de pauta y
   ventas totales; por cada una: llevamos / meta, % sobre el total, % sobre lo esperado a la fecha, estado
   (En meta / En seguimiento / Rezagado), atraso o adelanto, agendas por día requeridas e inversión requerida a la meta
   de costo por agenda y al promedio de la cohorte. Si la cohorte no tiene la meta: "sin meta" y un enlace a cargarla.
3. **La tabla semanal** (el Excel): filas = las 16 de la imagen en sus tres bloques; columnas = Total del periodo +
   una por semana (lunes a domingo, Bogotá). Cada celda con su color por `objetivos` si la métrica tiene umbral, y la
   variación contra la semana anterior. Una fila sin dato de la fuente dice "—".
4. **Gráfica por día** (contrato del 370): inversión contra agendas, y las demás series de la tabla elegibles; paso
   día/semana, acumulado o no, en cupos o en plata cuando aplique. Es la "sección diaria".
5. **La tabla del 355** con "Ver por: Canal | Campaña | Anuncio". La vista Canal absorbe las tarjetas de Origen
   (cada canal se abre en sus UTM, 311). La vista Anuncio ordena por inversión y marca "gastó sin agendas".
6. **La traza**: registros sin UTM y **anuncios con gasto cuyos envíos llegan sin id** (la alarma del 290, ahora
   listada por anuncio), para la sesión con César.
7. **ROAS proyectado** (375), igual que hoy.
8. **Embudo del formulario** y por pregunta, al final, igual que hoy en Origen.

**Filtros:** los del Hub (periodo, comparar, cohorte), con los rangos rápidos del diario que no estén ya en el selector.
Rol: lo ven gerente, developer y paid trafficker (`manejaPauta`); el closer no (ADR 0082).

## Decisiones (aprobadas por Mani el 9-nov; D-6 espera que Paid Media confirme los valores)

| # | Pregunta | Propuesta | Por qué |
|---|---|---|---|
| D-1 | ¿Costo por agenda con agendas del CRM o del pixel? | Las dos, en filas distintas: **del CRM** en General, **según Meta** en Tráfico | Es lo que hace la imagen sin decirlo; el CRM es la fuente de verdad, y Meta es lo que el trafficker optimiza |
| D-2 | ¿La inversión de campañas que no buscan agendas cuenta en el costo por agenda? | No: el costo por agenda usa solo el **gasto de agenda** (campañas con `pauta_objetos.proposito = agenda`, el mismo predicado del semáforo, `metricas.md` §3.3); lanzamiento va a su CPL y el resto (sin propósito, reconocimiento, tráfico) se muestra aparte como "Otras campañas: $X" con sus nombres. El ROAS y el Profit usan el gasto total | Es la regla del diario; sin ella el costo por agenda sube por campañas de reconocimiento |
| D-3 | ¿La semana? | Lunes a domingo, Bogotá | Es la de los dos reportes |
| D-4 | ¿Moneda? | Inversión y costos en la moneda del gasto (COP); Facturación, ROAS y Profit en USD con la TRM del día, como el ROAS de hoy | Nunca convertir en silencio (AGENTS.md) |
| D-5 | ¿Frecuencia de un rango? | Pedir a Meta el alcance del rango cuando se sincroniza la semana; mientras no exista, frecuencia solo por día | El alcance no se suma |
| D-6 | ¿Umbrales? | Filas de `objetivos`; se cargan los de 30X como punto de partida (ROAS ≥ 10 verde, ≥ 5 amarillo; costo por agenda ≤ 20 USD / ≤ 30; CTR ≥ 2 % / ≥ 1 %; conversión landing ≥ 2 % / ≥ 1 %; frecuencia ≤ 3 / ≤ 3,5) solo si Paid Media los confirma para Retia | C-1: nada escrito para el estado de hoy |
| D-7 | ¿Estado de cumplimiento? | En meta ≥ 100 % de lo esperado, En seguimiento ≥ 65 %, Rezagado < 65 %. Los cortes son tipo (código), no dato, porque el código decide con ellos | Es la regla del semanal |

## Reparto (sesión padre y sesiones hijas)

> Resumen. **Manda `docs/paid-media-2026-11-09.md` §8 a §10**: contratos de props entre hijas, briefs completos y el prompt de la padre.

La sesión padre (la principal) escribe este ticket, aplica la migración, revisa cada entrega, integra y hace el recorrido.
Las hijas implementan (Codex) en worktree propio, sin migraciones. **Un archivo caliente, un dueño:**
`app/(app)/p/[programa]/hub/page.tsx` es solo de la hija A.

| Hija | Qué | Archivos | Depende de |
|---|---|---|---|
| **A · Fusión** | redirect de `origen`, pestañas, composición de la sección en el orden del alcance, con huecos para B, C y E | `app/(app)/p/[programa]/hub/page.tsx`, `app/(app)/hub/page.tsx`, lista de pestañas | — |
| **B · Tabla semanal** | consulta por semana sobre los hechos (C-2), General y Comercial; Tráfico con "—" hasta D. Componente de la tabla y su lista | `lib/queries/hechos/pauta-semanal.ts`, `components/pauta/tabla-semanal.tsx`, fila en `docs/metricas.md` | — |
| **C · Cumplimiento** | las tres barras, estado, atraso, requeridos; sobre `calcularProyeccion` | `lib/metas/cumplimiento-de-cohorte.ts` (reusa `lib/queries/vamos-a-llegar.ts`), `components/pauta/cumplimiento.tsx` | migración (enum) para agendas e inversión de cohorte |
| **D · Tráfico de Meta** | el sync escribe impresiones, alcance, clics y vistas de landing; B enciende Tráfico | `lib/` del sync de pauta (263) y su test | migración (columnas) |
| **E · Traza por anuncio y costo por agenda del CRM** | lista de anuncios sin id (290) y la fila 249 | `lib/queries/` de la traza, `components/pauta/traza.tsx` | — |

**Para mañana (demo):** A + B (General y Comercial) + C con la meta de cupos y USD que ya existe. D y E entran detrás.
Orden de la padre: migración primero (enum y columnas en una), luego lanza A, B, C y E en paralelo, y D cuando la
migración esté en `main`.

## Done cuando

- [x] `?seccion=origen` lleva a Pauta con la misma URL; no queda ningún enlace a la pestaña vieja.
- [ ] La tabla semanal cuadra contra el Excel de Paid Media de una semana cerrada (Mani elige cuál), fila por fila, o
      la diferencia está explicada en "Cómo se calcula".
      **Abierta, con el primer cruce hecho (12-nov, hija H4).** Fuente: los reportes diarios de Paid Media que pasó Mani
      (`Reporte_Diario_Llamadas_Tactical.xlsx` y `Reporte_Diario_Llamada_Comunicarte.xlsx`, pestaña "Cohorte Oct - Nov",
      con una tabla semanal armada con fórmulas: filas 40-50 y 45-61). Contra producción por el MCP del CRM (solo lectura),
      **no** contra la tabla semanal en pantalla, que falta abrir.
      Cómo calcula el Excel: inversión y "Agendas en Meta" a mano desde Meta; costo por agenda = inversión ÷ agendas de
      Meta; "Agendas del día", "Llamadas realizadas" y "Ventas" a mano; % conversión = ventas ÷ llamadas; CAC = inversión
      ÷ ventas; **Ingresos = ventas × ticket fijo en COP** (Tactical 4.776.000, ComunicArte 2.537.648); ROAS = ingresos ÷
      inversión. Todo en COP; ComunicArte separa las cuentas de Milena y Rosario y corta la semana de viernes a jueves.

      | Tactical, 12-18 oct | Excel | CRM | Lectura |
      |---|---|---|---|
      | Inversión | COP 6.136.870 | USD 1.928,62 | Cuadra: TRM implícita ≈ 3.182, la misma del ticket (4.776.000 ÷ 1.500 ≈ 3.184) |
      | Agendas | 82 (Meta) | 78 agendadas de Paid · 88 citas | Fuentes distintas (D-1); falta la fila "según Meta" de la tabla |
      | Llamadas | 16 | 12 shows (cobertura 29 %) | Captura del resultado de la cita (390) |
      | Ventas | 3 | 3 en el Hub · 2 en el ROAS de Paid | El Excel cuenta todas las ventas cerradas en la semana |
      | ROAS | 2,33 | 1,56 | USD 4.500 de las 3 ventas ÷ USD 1.928,62 = 2,33: misma cifra si se toman todas las ventas; el CRM usa solo Paid |

      ComunicArte, 26-sep a 30-oct, por las semanas del Excel: la inversión cuadra (10-16 oct: COP 5.907.439 contra
      USD 1.864,21, TRM ≈ 3.169), pero **las ventas no**: Excel 5 · 10 · 9 · 7 · 10 = 41, CRM 4 · 8 · 5 · 7 · 4 = 28 (lista
      de cierres del Hub). Solo la semana 17-23 oct coincide. Eso no es de definición: o el Excel cuenta algo que el CRM no
      registra como venta (¿abonos, otra cuenta?), o hay ventas sin registrar en el CRM. Se pregunta a Paid Media.
      **Falta para cerrar:** (1) la respuesta sobre las 13 ventas de ComunicArte; (2) abrir la tabla semanal de Pauta en
      producción con 12-18 oct y comparar sus 16 filas; (3) agregar a "Cómo se calcula" (`components/dashboard/info-de-pauta.tsx`,
      "Equivalencias con el Excel") que el ROAS y los ingresos del Excel usan todas las ventas × ticket fijo en COP y el
      CRM solo las de Paid × su valor vendido en USD.
- [x] Cada fila de la tabla tiene su fila en `docs/metricas.md` y su función en un módulo de concepto; ninguna fórmula
      repetida (guardián N1).
- [x] Cumplimiento muestra En meta / En seguimiento / Rezagado y "sin meta" cuando falta.
- [x] Tráfico muestra "—" con cobertura antes de la migración y cifras después (el sync de D ya escribe las columnas; las cifras llegan con los días sincronizados desde hoy).
- [x] Recorrido como gerente y como paid trafficker, escritorio y 375 px, `npm run build`, CI verde. (10-nov, hija F: build limpio, recorrido en `dev:local` claro/oscuro, 375 px sin scroll horizontal de página —la tabla semanal desplaza dentro de su contenedor—, consola limpia, closer 404; CI verde de la punta `9b34054c`, tag `cp-20261109-2`)
      Repetido el 12-nov (hija H4, `9309e590`, gerente): Pauta sin desborde a 375 px (`scrollWidth` = 375) ni a 763 px,
      consola limpia en claro y oscuro, los tres interruptores de la gráfica diaria en la URL. Tres observaciones para el
      carril P, ninguna bloquea esta casilla: (1) a 375 px la columna de nombres de la tabla semanal ocupa ~260 px y el
      Total queda fuera de vista hasta desplazar; (2) Cumplimiento dice "Vamos 14,9 atrás" en cupos, y el boceto y Dinero
      los muestran sin decimales ("Vas 15 atrás"); (3) la tabla semanal marca "solo Paid" (D-C del 403), pero la leyenda de
      la gráfica diaria dice solo "Vendido" (USD 3.586,50 de Paid) mientras Dinero, con los mismos filtros, dice "Vendido"
      USD 8.687,30 de todas las áreas: vale revisar si la leyenda debe llevar el "solo Paid".
