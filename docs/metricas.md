# Métricas del CRM: de dónde sale cada cifra

> **El diccionario de métricas del CRM, y el único** (desde el 15-oct; antes vivía en `docs/hub.md` §5). Para
> cada métrica y cada dato: de qué tabla sale, qué cuenta y qué no, con qué fecha, en qué moneda, en qué función
> vive y cómo comprobarla contra la fuente. Si el código y este documento discrepan, **manda el código** y este
> documento se corrige en el mismo cambio. Una métrica nueva entra aquí antes de llegar a una pantalla.

## 0. Reglas que valen para todas

| Regla | Qué significa | Dónde se enforza |
|---|---|---|
| El programa es frontera | Toda cifra es de UN programa. "Todos los programas" solo suma conteos, caja en USD y gasto; nunca una tasa, una meta, un costo ni el ROAS (ADR 0043, 0048) | el tipo de la consulta (`lib/queries/agregado-programas.ts`) |
| Personas, no filas | Un lead es `(programa, correo normalizado)`; el dedup vive en un índice único (ADR 0005) | `leads_programa_email_idx` |
| Fechas de Bogotá | Un instante se vuelve día con `AT TIME ZONE 'America/Bogota'` (siempre −05:00) | `lib/queries/hechos/fechas.ts`, `lib/format.ts` |
| Lo anulado no cuenta | Llamadas, deals y abonos anulados quedan fuera de toda métrica | `vigente()` en `lib/queries/vigente.ts`, vigilado por `tests/vigencia-centralizada.test.ts` |
| Días hábiles | Lunes a viernes; los festivos cuentan como hábiles (regla de Retia) | `lib/dias-habiles.ts` |
| Moneda a la vista | Ventas y caja en USD, pauta en COP; nada se convierte en silencio | `lib/format.ts` |
| Una sola definición | Si dos pantallas muestran la misma cifra, la cifra vive en un módulo y las dos lo importan (ADR 0024) | revisión, y los tests comparativos de cada módulo |
| Toda razón con su cobertura | Una tasa, un costo o un ROAS dice sobre qué base se midió y qué falta; con medio dato la pantalla dice "parcial" o "—" (ADR 0115 N3) | el tipo de la razón (ticket 351) |
| Un nombre por concepto | El rótulo de cada métrica sale de un solo vocabulario, el de `overview.md` §11 (ADR 0115 N4) | guardián de rótulos (ticket 357) |

Las nueve reglas completas están en el ADR 0115.

### Conceptos: dónde vive cada uno (ADR 0115 N1)

Cada concepto tiene **una** función, y quien lo necesite la importa. La columna "Hoy" es lo que la auditoría del 30-oct
encontró; "Canónico" es a donde converge, y lo decide el ticket de la última columna. Mientras una fila tenga más de un
lugar en "Hoy", esas cifras pueden discrepar entre pantallas.

| Concepto | Hoy (auditoría 30-oct) | Canónico | Ticket |
|---|---|---|---|
| Venta (conteo y día) | `ventasConDiaEn`/`vendidosEn` (por evento); `ventasDeCohorte`, `alertas.ts`, `tasas-del-grupo.ts` (por estado actual) | `vendidosEn` en `lib/queries/metricas-filtros.ts`, según DA-1 | 352 |
| Vendidos de la cohorte | `ventasDeCohorte` (sin límite inferior) y `agruparVentas` de la proyección (desde el inicio de ventas) | una función, según DA-2 | 352 |
| Meta de hoy y cumplimiento | `metaDinamica`, `proyeccion.ts`, tres copias del cumplimiento lineal | `lib/dias-habiles.ts` | 352 |
| Show / ocurrió | `RESULTADOS_QUE_OCURRIERON` y 8 envolturas | `ocurrio`/`ocurrioSql` en un solo módulo | 353 |
| % de show y % de no show | por deal, por cita, de Pauta, del comparativo semanal | `showPorDeal` y `showPorCita`, y el no show como complemento nombrado | 353 |
| Cita sin resultado | cuatro predicados | `citaVencidaSinResultado` en `metricas-filtros.ts` | 353 |
| Agenda | cita creada, contando reagendas | según DA-4 | 353 |
| Día de cada hecho (anclas) | ~19 `AT TIME ZONE` sueltos; cuatro expresiones del día del envío | `lib/queries/hechos/fechas.ts` | 354 |
| Registro y lead | `filtroDeEnvios` (registros) y `leadsDelRango` (personas) con el mismo nombre en pantalla | `hechos/envio.ts` para registros; "Leads" solo para personas | 354 |
| Sin UTM | `resolverCanal`/`areaSql`, `categoriaUtmSql`, `categoriaDe` | `resolverCanal` y su gemela SQL | 354 |
| Calendario (semana, sumar días, hábiles) | `rangos.ts`, `dias-habiles.ts` y copias en `proyeccion.ts`, `vista-hoy.ts`, `metas.ts` | `lib/dias-habiles.ts` | 354 |
| Gasto convertido a USD o COP | `sumarEnCop` (semáforo) y `convertir` (ROAS, devuelve 0 en silencio) | un módulo en `lib/pauta/` | 351 |
| Embudo de Pauta por campaña y por UTM | `pauta-interina.ts` y `roas-de-pauta.ts`, con dos anclas de venta | un cargador | 355 |
| Caja recaudada | `cajaRecaudada`+`filtroCaja`, `cajaDelDiaPorOrigen`, `series-dinero.ts`, `metricas-con-filas.ts`; `hechos/abono.ts` sin llamadores | `filtroCaja` | 361 |

## 1. Los hechos: lo que se cuenta

Todas las métricas son conteos o sumas sobre estos hechos. Cada hecho tiene su módulo en `lib/queries/hechos/`,
que agrupa, filtra y lista con la **misma** consulta: la lista detrás de una cifra es la misma consulta sin agrupar.

### 1.1 Envío (registro)

- **Tabla:** `submissions`, unida a `sources` (la fuente dice el programa).
- **Cuenta:** envíos **completos** (`es_parcial = false`) de las fuentes del programa.
- **Fecha:** `submissions.fecha_envio`, en Bogotá.
- **Función:** `filtroDeEnvios` en `lib/queries/hechos/envio.ts` es el único predicado de registros/envíos;
  tanto `agrupar` como `listar` y la lista de `registros` del Hub lo usan.
- **Ojo:** un envío parcial y su completo son el mismo registro (ADR 0063); el parcial solo cuenta en el embudo
  del formulario.
- **Verificar:** contar en el Typeform las respuestas completas del día (zona Bogotá) y comparar.

### 1.2 Agenda

- **Tabla:** `calls`, unida a su deal (`deals`) y al envío que abrió ese deal (`deals.submission_origen_id`).
- **Cuenta:** llamadas **vigentes** del programa. Una agenda es una cita creada, no una cita ocurrida.
- **Fecha:** `calls.created_at` en Bogotá, es decir **el día en que se agendó**, no el día de la llamada.
- **Función:** `lib/queries/hechos/agenda.ts`.
- **Ojo:**
  - Una cita de Calendly que quedó **suelta** en el Inbox (sin deal) sale con área `sin_envio_origen`: no cuenta
    como Paid hasta que un closer la asigna.
  - Una cita reagendada crea otra llamada: cuenta como otra agenda el día en que se reagendó.
- **Verificar:** en Calendly, las citas creadas ese día en el tipo de evento del programa, contra la lista de la cifra.

### 1.3 Cita, llamada y show

- **Tabla:** `calls`.
- **Fecha:** el día de la cita, `coalesce(fecha_agenda, fecha_llamada)` en Bogotá (`fechaAnclaCall`).
- **Show:** el resultado está en `show`, `compromiso_pago`, `cerrada` o `perdida` (`RESULTADOS_QUE_OCURRIERON`).
- **Función:** `lib/queries/hechos/cita.ts`, `llamadaOcurrio` en `lib/queries/metricas-filtros.ts`.

### 1.4 Venta

- **Tabla:** `deal_etapa_historial` unida a `deals`.
- **Cuenta:** deals vigentes, **sin cortesía**, que entraron a **Abonado o Completo**. Un deal es una venta
  una sola vez.
- **Fecha:** el **primer** día en que entró a una etapa vendida (Bogotá). La reversa de una venta (anular el
  abono que la vendió, ticket 200) la saca.
- **Función:** `ventasConDiaEn` en `lib/queries/metricas-filtros.ts` (la única definición) y
  `lib/queries/hechos/venta.ts`.
- **Ojo:** un deal en Cierre Perdido después de Abonado sigue siendo una venta que se perdió (ADR 0038).

### 1.5 Abono (caja recaudada)

- **Tabla:** `abonos`.
- **Cuenta:** abonos vigentes del programa, tanto del ticket como adicionales vendidos aparte.
- **Fecha:** `abonos.fecha` (la fecha del pago, no la del registro).
- **Moneda:** USD.
- **Función:** `lib/queries/hechos/abono.ts`; lo abonado y el saldo de un deal, en `lib/queries/saldo.ts`, cuentan solo abonos de ticket.
- **Ojo:** caja y ventas son métricas separadas: un abono no es una venta ni al revés (ADR 0013).

### 1.6 Gasto de pauta (días cerrados)

- **Tabla:** `gasto_pauta`, una fila por anuncio y día.
- **Origen:** la API de Meta (`insights`, `level=ad`, `time_increment=1`, campos `spend` y `conversions`),
  con el usuario de sistema `retia-insights` (solo lectura). La cuenta publicitaria dice el programa
  (`cuentas_publicitarias.program_id`): **todo el gasto de una cuenta va a un solo programa**.
- **Cuándo se escribe:** el cron `/api/cron/pauta` todos los días a las 6:00 de Bogotá
  (`vercel.json`, `0 11 * * *` UTC), reescribiendo **los últimos 7 días** (Meta corrige días pasados); un día que
  Meta corrigió a cero vuelve a cero.
- **Fecha:** el día que reporta Meta en la zona de la cuenta (todas están en `America/Bogota`).
- **Moneda:** la de la cuenta (COP o USD), guardada tal cual.
- **Funciones:** `lib/pauta/sincronizar.ts` (lee Meta), `registrarGasto` en `lib/pauta/gasto.ts` (único escritor).
- **También:** gasto manual (`origen = manual`) con un área; solo el de área `paid` entra al costo por agenda.
- **Ojo:** un anuncio que no está en el árbol del programa (`pauta_objetos`) se omite y se cuenta en "omitidas".
- **Verificar:** en el Ads Manager de la cuenta, el gasto del día por anuncio contra `gasto_pauta`.

### 1.7 Gasto del día en curso (fotos)

- **Tabla:** `fotos_pauta`, una foto por campaña y momento.
- **Origen:** la misma API de Meta, solo el día de hoy. Se toma cuando Juanito pregunta por el semáforo o cuando
  alguien abre el Hub, como mucho una foto cada 20 minutos (`MINUTOS_ENTRE_FOTOS`).
- **Cuenta:** para un momento dado, la **última foto de cada campaña** tomada hasta ese momento.
- **Función:** `lib/pauta/dia-en-curso.ts`; la lectura, `costoDesdeFotos` en `lib/semaforo/costo-por-agenda.ts`.
- **Ojo:** el gasto de hoy no está en `gasto_pauta` hasta el cron del día siguiente.

### 1.8 TRM

- **Tabla:** `tasas_cambio`, cargada de datos.gov.co (`32sa-8pi3`, la TRM oficial).
- **Uso:** convertir a COP el gasto de una cuenta en USD con la tasa vigente **ese día**.
- **Función:** `tasaDelDia` en `lib/trm/consultar.ts`.
- **Ojo:** si falta la TRM de un día, esas filas en USD **no se suman** y la cifra lo dice con una nota
  ("Sin TRM del ...: N filas en USD no se sumaron"). Nunca se inventa una tasa.

### 1.9 Agendas según Meta

- **Origen:** el mismo `insights`, la conversión `offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled`
  (`gasto_pauta.agendas_meta`, `fotos_pauta.agendas_meta`).
- **Uso:** **control**, nunca el costo oficial (H-4 de `docs/hub.md`, ADR 0088). Sirve para ver la diferencia
  contra el CRM.
- **Por qué difieren (medido el 15-oct, ComunicArte, agendas creadas del 9 al 13-oct):**

  | Fuente | Agendas |
  |---|---|
  | Calendly (citas creadas, 49 activas y 5 canceladas) | 54 |
  | CRM, todas las áreas | 54, una por cita de Calendly |
  | CRM, Paid (por el UTM del envío que abrió el deal) | 35 |
  | CRM, no Paid | 19: 10 `direct / organic` (campaña `direct`), 9 de Instagram de las creadoras (linktree, manychat, stories) |
  | Meta (`invitee_meeting_scheduled`) | 51 |

  - El total del CRM es confiable: coincide uno a uno con Calendly.
  - Meta se atribuye 51 de las 54 citas, casi todas, incluidas las que entraron por enlaces orgánicos. El pixel
    se dispara en toda cita del sitio, y Meta la cuenta como suya si la persona vio o tocó un anuncio en su ventana
    de atribución, aunque haya entrado por el Instagram de la creadora. No se puede revisar persona por persona.
  - El CRM solo cuenta como Paid la agenda cuyo formulario llegó con un UTM de anuncio. Es el piso: no cuenta a
    quien vio un anuncio y entró después por otro enlace.
  - Ninguna de las 54 llegó sin UTM: la plantilla vieja de Meta (`facebook / cpc`) también cuenta como Paid. La
    plantilla solo decide si se sabe **qué anuncio** trajo la agenda, no si cuenta como pauta.
  - Ninguna agenda "se pierde" del CRM: lo que puede quedar mal es la **etiqueta** (orgánica cuando era de pauta).
  - **Lo que no se sabe:** de dónde sale el enlace `utm_source=direct&utm_medium=organic&utm_campaign=direct` (10
    agendas). Si está dentro del recorrido de un anuncio (una landing, un mensaje automático), esas agendas son de
    pauta y se están perdiendo; se le preguntó a Pauta (15-oct).

## 2. El origen: a qué área pertenece cada cosa

Una agenda, una cita y una venta heredan el origen del **envío que abrió su deal**. La regla es una sola, en dos
gemelas que se prueban iguales: `resolverCanal` (`lib/atribucion/canal.ts`) y `areaSql`
(`lib/atribucion/canal-sql.ts`). En orden:

| Área | Cuándo |
|---|---|
| Paid | el envío trae un id de Meta (`utm_id`, `ad_id`, `adset_id` o `campaign_id`) que existe en el árbol del programa, **o** `utm_medium` es `cpc`, `paid_social` o `paid` |
| Referidos | `utm_medium = referido` (el link de captación de un closer) |
| Orgánico | trae `utm_source` o `utm_medium`, y no es nada de lo anterior |
| Sin UTM | no trae ninguno de los dos |
| Sin envío de origen | la llamada o la venta no tiene deal o su deal no tiene envío (p. ej. una cita suelta en el Inbox) |

- Los valores se comparan sin mayúsculas ni espacios de más; una macro sin expandir (`{{campaign.name}}`) cuenta
  como ausente.
- **Canal:** la primera palabra de `utm_source`, con alias (`ig` = instagram, `fb` = facebook); **cuenta**: el
  resto (`instagram rosario` = Instagram · Rosario).
- El área **no se guarda**: se calcula al leer, así que cambiar la regla reclasifica hacia atrás.

Las cifras de Hub › Origen son:

| Figura | Definición | Función |
|---|---|---|
| Registros y agendas por canal y par UTM | envíos completos y llamadas vigentes creadas en el rango, atribuidas al envío que abrió su deal; los pares se agrupan bajo su área y canal | `origenDelPrograma` |
| Sin UTM | envíos del rango cuya regla resulta `sin_utm`; siempre se muestra con conteo y porcentaje | `origenDelPrograma` |
| Macros sin expandir | envíos del rango con al menos un UTM centinela `{{…}}`; siempre se muestra con conteo y porcentaje | `origenDelPrograma` |
| Nuevo | el par se vio por primera vez entre hoy y los seis días anteriores | `origenDelPrograma` |
| Plantillas por cuenta | anuncios activos por cuenta con plantilla vieja, de Pauta, otra o sin id de anuncio | `origenDelPrograma` |
| Traza Paid | distribución N3, N2 y N1 de los envíos Paid del rango | `origenDelPrograma` |

## 3. Métricas

Leyenda de estado: ✅ en producción · 🟡 definida, sin construir (con su ticket).

### 3.1 Embudo y ventas

| Métrica | Fórmula | Unidad | ¿Se suma entre programas? | Función | Estado |
|---|---|---|---|---|---|
| Registros | envíos completos del rango (§1.1) | personas | sí | `hechos/envio.ts` | ✅ |
| Dejó datos · Llegó al Calendly | embudo del formulario (ADR 0069, ticket 126) | personas | sí | `lib/queries/embudo-formulario.ts` | ✅ |
| Agendó sobre llegó al Calendly | registros que agendaron ÷ registros que llegaron al Calendly; cada paso del embudo muestra su tasa sobre el paso anterior, nombrado ("de los que llegaron al Calendly"), y debajo la del total (Dejó datos); en la tabla por canal, solo la del paso anterior; base cero se muestra `—` (ADR 0067) | registros (`fuente`, `token`), por el día de Bogotá de su primer envío, sin filtro de closer | no: por programa, nunca en "todos" (ADR 0048) | `tasasDelEmbudo` sobre `embudoDelFormulario` | ✅ |
| No agendaron | **personas** (lead) con un registro (`fuente`, `token`) cuyo primer envío cae en el rango y que llegó al Calendly (agendó o calidad High); una fila por persona, con la fecha de su registro más antiguo. El deal que la representa es el de la persona: el abierto o, si no hay, el más reciente, desempate por id (`idsDelDealDeLaPersona`, `lib/queries/deal-de-la-persona.ts`; la misma regla cuelga el deal en la lista de registros). Sale si **hoy** ese deal tiene `calls` vigente o está en Agendado o una etapa posterior, Cierre perdido incluido (decidido por Mani, 24-oct); una cita posterior al envío la saca. Se verifica comparando `embudoDelFormulario.noAgendaron` con el total de la lista `no_agendaron`, incluyendo otro programa y un deal anulado, y agregando una cita vigente al día siguiente | personas, por programa | no | `llegoAlCalendly` y `noAgendaronDelFormulario` en `lib/queries/embudo-formulario.ts`; lista en `metricas-con-filas.ts` | ✅ |
| Agendas creadas | llamadas vigentes creadas en el rango (§1.2); la de Pauta y el costo por agenda | agendas | sí | `hechos/agenda.ts` | ✅ |
| Deals que agendaron | deals creados del rango (misma fecha que Deals creados) con al menos una llamada vigente del mismo programa creada hasta el último día del rango; la gráfica muestra el % sobre los deals creados, acumulado por día hábil | deals | sí (el % no) | `filtroDealsQueAgendaron` en `lib/queries/metricas-filtros.ts`, serie en `lib/queries/deals-contra-agendas.ts` | ✅ |
| Citas (la tarjeta "Agendas" de Comercial, "Citas de hoy" en Hoy) | llamadas vigentes cuya **cita** cae en el rango (§1.3), con cualquier resultado; no es la de arriba (medido el 23-oct, 299) | citas | sí | `embudoDelRango` (`filtroLlamadas`) | ✅ |
| Horas de agenda | hora de `calls.createdAt` en Bogotá; solo agendas de pauta y vigentes; una reagenda conserva la primera hora; el encabezado de cada programa muestra al lado las agendas de Meta del mismo día | horas | no | `armarMensajeDeHorasDeAgenda` | ✅ |
| Citas · Shows | citas del rango; las que ocurrieron (§1.3) | citas | sí | `hechos/cita.ts` | ✅ |
| % de show | deals del grupo con al menos un show ÷ deals del grupo. Una cita pasada que sigue `agendada` queda pendiente de resultado, visible aparte con su lista, y no entra al grupo ni a la tasa | % | no | `lib/queries/tasas-del-grupo.ts` | ✅ |
| % de show por cita | citas del día que ocurrieron ÷ citas del día que ya debían ocurrir al corte (§1.3); es otra pregunta que el % por deal y se muestra a su lado en Hub › Hoy, como lo contaba el reporte de Michael (Mani, 24-oct) | % | no | `showPorCitaDelRango` en `lib/queries/tasa-show-por-cita.ts` | ✅ |
| % de cierre | deals con show que hoy están vendidos ÷ deals con show; los pendientes de resultado quedan fuera del grupo y visibles aparte | % | no | ídem | ✅ |
| Agenda → venta | deals con show vendidos hoy ÷ deals del grupo (= % show × % cierre); los pendientes de resultado quedan fuera del grupo y visibles aparte | % | no | ídem | ✅ |
| Ventas | deals vendidos en el rango (§1.4) | ventas | sí | `ventasConDiaEn` | ✅ |
| Ventas por escalón | la escalera de conversión, abajo (ADR 0109): deals del periodo en siete escalones, con número, % y días hábiles medianos | deals | no: distribución por programa | `lib/queries/escalera.ts` | ✅ |
| Vendido | Σ `deals.valor_vendido_usd` de las ventas del rango (lo escribe el closer); un deal sin valor se cuenta aparte, no se inventa | USD | sí | `contratadoDeDeals` en `lib/queries/saldo.ts` | ✅ |
| Comisión | Σ valor vendido × el % congelado en el deal al entrar a Abonado o Completo; sin % del programa no se puede entrar a venta (ADR 0115 N6, ticket 356). Por closer va al dueño del deal; las ventas sin dueño salen en la fila «Sin closer» | USD | no | `comisionDeDeal` y `comisionesPorCloser` en `lib/queries/comision.ts` | ✅ |
| Recaudado | Σ abonos vigentes por su fecha (§1.5) | USD | sí | `hechos/abono.ts` | ✅ |
| Saldo de un deal | contratado − abonado; negativo es sobrepago, no deuda | USD | · | `saldosDeDeals`, `saldoLegible` | ✅ |
| Meta del mes, de la semana y de la cohorte | cupos de la cohorte repartidos por días hábiles (020, 146) | cupos | no | `lib/queries/metas.ts` | ✅ |

**El grupo de citas** (para las tres tasas): los deals vigentes, sin cortesía, con al menos una cita **ya
ocurrida** en el rango (show, no-show, cancelada o sin resultado; la reagendada no, la representa la nueva). Se
cuenta por deal, no por llamada (ADR 0079). Por closer, cada deal va a quien tomó su último show.

**A quién se acredita cada cifra por closer** (356): citas, shows y no show a quien tomó la llamada; cierres y comisión al dueño del deal; caja a quien registró el abono. Lo que no tiene closer sale en la fila «Sin closer».

**La escalera de conversión** (ADR 0109, tickets 319 y 320): en qué escalón paga, o se queda, cada deal. La
decide `escalonDeDeal` (pura) y la carga `cargarEscalera`, ambas en `lib/queries/escalera.ts`; nadie más calcula
un escalón, y el escalón se calcula al leer, nunca se guarda.

| Escalón | Regla (en este orden) |
|---|---|
| 1 · Pagó en la llamada | primer abono vigente de ticket el **mismo día (Bogotá)** de la última cita atendida que no es posterior a él |
| 2 · Pagó rápido | primer abono hasta `programs.corte_pago_rapido_dias` días hábiles **después** de esa cita (sábado y domingo no cuentan; el mismo día es 0) |
| 3 · Pagó después | primer abono más tarde que el corte. **Sin corte** (nulo) los escalones 2 y 3 se juntan aquí y la tarjeta lo dice |
| 4 · Pagó sin llamada registrada | venta sin una cita atendida anterior o igual al primer abono (enmienda del ADR 0109, 28-oct): ventas migradas de las hojas o creadas a mano. Sin días medianos; si se carga la llamada, el deal sube solo. Una venta **sin abono vigente de ticket** (sin fecha de pago) cae aquí también, **aunque tenga llamadas atendidas** |
| 5 · Atendió y no compró | alguna cita atendida (`RESULTADOS_QUE_OCURRIERON`), sin venta |
| 6 · Agendó y no se presentó | alguna cita **vencida sin atender** (hora pasada, resultado no show o cancelada), ninguna atendida, sin venta. Las citas **pendientes** (futura, agendada sin resultado, reagendada) no cuentan: no han sucedido (enmienda del ADR 0109, 28-oct) |
| 7 · Dejó datos y sin cita ocurrida | ninguna cita atendida ni vencida, sin venta: incluye al deal que solo tiene citas pendientes, que sube solo cuando la cita sucede |

- **Universo de un periodo:** los deals **vendidos** en él (`ventasConDiaEn`, la misma definición de venta del Hub:
  los escalones 1 a 4 suman exactamente las ventas del periodo, comprobado por test contra la lista `cierres`) más
  los deals **creados** en él (día de Bogotá de `deals.created_at`) que **nunca** se han vendido (5 a 7). Un deal
  creado en el periodo y vendido después sale de 5-7 y entra a 1-4 en el periodo de su venta. Las cortesías y los
  deals anulados no cuentan. Se cuenta por **deal**, no por persona (un lead retomado cuenta cada intento).
- **Fecha de la cita:** `coalesce(fecha_agenda, fecha_llamada)` en Bogotá, la misma de `fechaAnclaCall`. Atendida =
  resultado en show, compromiso de pago, cerrada o perdida; las citas anuladas no cuentan.
- **Primer abono:** `min(abonos.fecha)` de los abonos **vigentes de concepto ticket**; un abono adicional (ADR 0113)
  no es el pago del programa.
- **Todos los programas:** una tarjeta por programa, lado a lado, sin total ni % combinado (ADR 0048): `escaleraPorPrograma`
  devuelve filas por programa y el % es una `Tasa` que las sumas de `agregado-programas.ts` no aceptan.
- **Días medianos:** mediana de los días hábiles de la cita al primer abono, solo en los escalones 2 y 3.
- **Porcentaje:** sobre todos los deals del universo filtrado; base cero se muestra `—`. Es una distribución por
  programa: **nunca se suma entre programas** (ADR 0048).
- **Calor:** presentación, continuo: la intensidad es el porcentaje de la celda sobre su propia fila; sin color «Sin closer». No cambia ninguna cifra.
- **Dimensiones** (lista blanca): closer (el dueño del deal), calidad (`submissions.lead_quality` del envío que abrió
  el deal, tal como llegó; sin dato, «Sin calidad») y cohorte. El comparativo por closer no se acota (ADR 0023).
- **Lista:** `hub/lista?metrica=escalera&escalon=…&calidad=…&closer=…`, del mismo cálculo que la cifra. La fecha de
  la fila es la de la venta (1 a 4) o la de creación del deal (5 a 7).
- **Corte:** `programs.corte_pago_rapido_dias`, editable en Programa › por quien administra (rastro en
  `change_log`, campo `cortePagoRapidoDias`). Nulo no se inventa.
- **Verificar:** la suma de los escalones 1 a 4 contra Ventas del mismo periodo; abrir la lista de una celda y
  contar sus filas contra la cifra (`tests/escalera.test.ts`).

### 3.2 Pauta

| Métrica | Fórmula | Unidad | ¿Se suma? | Función | Estado |
|---|---|---|---|---|---|
| Gasto | Σ gasto de las cuentas del programa (§1.6 y §1.7), convertido a COP con la TRM del día (§1.8) | COP | sí | `sumarEnCop` en `lib/semaforo/costo-por-agenda.ts` | ✅ |
| Costo por agenda | semáforo: gasto ÷ agendas según Meta; Hub: gasto ÷ agendas **del CRM** de área Paid (§3.3) | COP | no | `costoPorAgenda`, `costoPorAgendaDeVentana` | ✅ |
| CPL de lanzamiento | semáforo: gasto de campañas de lanzamiento ÷ registros según Meta (`complete_registration`) | COP | no | `costoPorAgenda` en `lib/semaforo/costo-por-agenda.ts` | ✅ |
| Agendas según Meta | §1.9 | agendas | sí | ídem | ✅ |
| Diferencia Meta contra CRM | (según Meta − CRM) ÷ CRM, por campaña y semana cerrada | % | no | 249 | 🟡 |
| CPL | gasto de Paid ÷ registros de Paid | COP | no | 123 | 🟡 |
| Costo por venta (CAC) | gasto de Paid ÷ ventas de Paid | COP | no | 123 | 🟡 |
| ROAS | contratado de las ventas de Paid (USD) ÷ gasto en USD (cada día con su TRM). **Las ventas se anclan al día del envío que abrió el deal**: `fecha_envio` si existe y, en un parcial, `created_at`; no a la fecha de venta. El parcial se pliega en su completo por `(source_id, token)`. La atribución toma anuncio, si no conjunto, si no campaña de Meta; solo lo que no resuelve campaña queda en “Sin campaña de Meta” | razón | no | `diaDelEnvio` y `cargarRoasDePauta` en `lib/queries/roas-de-pauta.ts` · 123, 350 | 🟢 |
| Nivel de la traza | el id más profundo del envío que resuelve en el árbol: anuncio (N3), conjunto o campaña (N2), solo área (N1), sin UTM (N0) | % | no | 247 | ✅ |

El gasto sigue naciendo en anuncio y se acumula hacia conjunto y campaña. Si un registro solo resuelve conjunto o
campaña, cuenta en esos niveles y aparece como “Anuncio sin identificar”; nunca se reparte entre anuncios.

### 3.3 El costo por agenda, paso a paso

Es la métrica del semáforo por WhatsApp. Para un programa y un día:

1. **Gasto:**
   - Hoy: la última foto de cada campaña hasta el momento del cálculo (§1.7).
   - Un día cerrado: `gasto_pauta` de ese día (§1.6), el de Meta más el manual de área Paid.
   - Entra el gasto de campañas clasificadas como **agenda** y el de las campañas todavía sin clasificar. El gasto
     manual de área Paid, que no tiene campaña, también cuenta como agenda. Las campañas de **lanzamiento** se
     muestran aparte y no entran al costo; agenda + lanzamiento forman el gasto total del programa (314, 26-oct).
   - Lo que viene en USD se pasa a COP con la TRM del día.
2. **Agendas:** el semáforo usa las agendas que reporta Meta (pixel). Muestra al lado las agendas del CRM (§1.2)
   creadas ese día, hasta el momento del cálculo, de área **Paid** (§2), para detectar diferencias. El Hub conserva
   como denominador las agendas del CRM (ADR 0088, enmienda del 16-oct).
3. **Costo del semáforo = gasto de agenda ÷ agendas según Meta de esas campañas.** Con gasto y 0 agendas de Meta queda rojo; si Meta no
   reporta el dato, queda sin dato.
4. **Umbral:** el objetivo "Costo por agenda" (área Total) de la **cohorte activa** del programa, que se carga en
   Programa › Ventas › Objetivos de la cohorte: `meta` y `aceptable` en COP. Lo pueden editar quien administra y
   el paid trafficker (266).
5. **Color** (`lib/semaforo/color.ts`): durante el día, al cierre y para la racha de días cerrados se compara
   siempre contra el objetivo de la cohorte activa: ≤ meta 🟢; ≤ aceptable 🟡; más 🔴. Sin agendas de Meta pero
   con gasto 🔴; sin gasto ⚪; sin dato de agendas de Meta ⚪ (ADR 0088 y 0089, enmiendas del 16-oct).
6. **Racha de días cerrados** (`racha`, 17-oct, Mani): el color del último día cerrado (ayer) y cuántos días
   cerrados seguidos tienen ESE mismo color (🟢, 🟡 o 🔴), contra el umbral **de hoy** (no el que había esos días),
   hasta 20. Se corta en el primer día de otro color o ⚪, y hoy no cuenta. Antes solo contaba el rojo, y un día
   verde con "1 día seguido en rojo" se leía como si hoy estuviera en rojo.
- **Funciones:** `semaforoDelPrograma` en `lib/semaforo/semaforo.ts`; el texto, `armarMensaje` en
  `lib/reporte-whatsapp/mensaje.ts`.
- **Verificar un día cerrado:**
  1. Gasto: en el Ads Manager, el gasto del día de cada cuenta del programa (las USD × TRM del día).
  2. Agendas: la lista de la cifra en Hub › Pauta (cada agenda con su envío de origen y su `utm_medium`).
  3. Dividir y comparar con el mensaje del cierre.

### 3.4 Planeación

| Métrica | Fórmula | Unidad | Estado |
|---|---|---|---|
| Ritmo | ventas por día hábil de los últimos 5, 10 o 20 días hábiles (`?ritmo=`, 10 por defecto), recortados al inicio de ventas de la cohorte (`calcularProyeccion`) | ventas/día | ✅ 253 |
| Proyección | vendidos + ritmo × días hábiles que quedan de la cohorte (`calcularProyeccion`) | cupos | ✅ 253 |
| Ventas requeridas por día | faltan ÷ días hábiles que quedan (`calcularProyeccion`) | cupos/día | ✅ 253 |
| Shows requeridos por día | ventas requeridas ÷ % de cierre (`calcularProyeccion`); el % de cierre exige al menos 20 shows y una venta | shows/día | ✅ 253 |
| Agendas requeridas por día | shows requeridos ÷ % de show (`calcularProyeccion`). Las dos tasas salen de un solo grupo, en orden de la cohorte anterior o la cohorte en curso; el % de show exige 20 personas con cita con resultado. Los pendientes quedan fuera y se nombran en la razón. Con objetivo declarado agenda → venta, este manda sobre las agendas y los shows salen de agendas × % de show medido | agendas/día | ✅ 253 |
| Leads requeridos por día | agendas requeridas ÷ (agendas ÷ registros) de la misma ventana (`calcularProyeccion`) | leads/día | ✅ 253 |
| Origen del cierre | por venta: agenda del día, seguimiento o sin llamada | ventas | 🟡 254 |
| Cierre del ciclo | rojos con una acción registrada ÷ rojos, y horas hasta la acción | % | 🟡 261 |

**Propuestas sin decidir (HQ-7 de `docs/hub.md`):** CAC en COP y en USD; los tres grupos del origen del cierre
salen del deal sin pedirle un clic al closer.

### 3.5 Hub › Hoy: el reporte diario (ticket 299)

Hoy se arma con `armarVistaDeHoy` (`lib/queries/vista-hoy.ts`) para un día de Bogotá: hoy por defecto, o cualquier
día pasado **como se veía al cierre de ese día** (ventas de la cohorte, del mes y de la semana hasta ese día; el
instante de corte es las 23:59:59.999 −05:00). Con el día de hoy da lo mismo que Comercial y Dinero con el periodo
"hoy": nada se recalcula aparte.

**Decisiones de Mani (23-oct):**

- **D1, agendas.** Dos tarjetas rotuladas: "Agendas creadas hoy" (§1.2, la de Pauta) y "Citas de hoy" (§1.3, la del
  reporte: "Agendas reales" eran las citas que caían ese día).
- **D2, % de show.** Por deal (ADR 0079), dicho en la tarjeta: "X de Y deals con cita ocurrida · N reagendadas (no
  cuentan)". Las citas pasadas que siguen `agendada` se muestran como pendientes con su lista y no entran a la
  tasa hasta registrar el resultado. No hay una segunda fórmula por cita.
- **D3, leads.** Registros del día (§1.1, envíos completos, igual a Typeform) sin meta hasta el 253: excepción
  temporal al ADR 0086 punto 3, que el 253 cierra. Una persona que aplica dos veces son dos registros.
- **D4, caja.** Por moneda, partida en ventas de hoy y ventas anteriores; los nombres están en la lista de la cifra.
- **Meta del día.** Cupos que faltan de la cohorte ÷ días hábiles de venta que quedan, contando hoy, y **descuenta
  las ventas de hoy**: toda cifra es dinámica según el CRM (regla de Mani). Por eso, a diferencia del reporte, la
  meta del día baja cuando se vende.

**Cada fila del reporte (15-sep y 9-sep) contra Hoy:**

| Fila del reporte | En Hoy | Función | Fecha | Universo |
|---|---|---|---|---|
| Semana día X de 5 · mes día X de N hábiles · corte día X de N | Línea de contexto | `contextoDelDia` | el día | lunes a viernes; la cohorte, de su ventana de ventas |
| Cupos del día: meta, real, cumplimiento | Cupos › Hoy | `horizontesDeCupos` (meta: `vistaDeCohorteActiva`) | venta (§1.4) | meta dinámica de la cohorte activa; real = ventas del día |
| Leads del día: meta, real, cumplimiento | Leads de hoy, sin meta | `agrupar` de `hechos/envio.ts` | envío (§1.1) | registros completos del programa |
| Agendas reales | Citas de hoy | `embudoDelRango.agendas` | cita (§1.3) | llamadas vigentes con cita ese día, cualquier resultado |
| (no estaba) | Agendas creadas hoy | `agrupar` de `hechos/agenda.ts` | creación (§1.2) | llamadas vigentes creadas ese día |
| Llamadas realizadas | Realizadas (show) | `embudoDelRango.llamadasConShow` | cita | citas del día con resultado que ocurrió |
| Show | % de show por deal | `grupoDeCitas` | cita | deals con cita ya ocurrida y resultado; la reagendada y la pendiente de resultado no cuentan |
| Ventas · % de cierre | Ventas de hoy · % de cierre | `ventasDelRango`, `grupoDeCitas` | venta | ADR 0079 |
| Tabla por closer | Hoy por closer | `embudoPorCloser` | cita / venta | cada deal en quien tomó su último show |
| Caja del día y de dónde viene | Caja de hoy | `cajaDelDiaPorOrigen` | abono (§1.5) | abonos vigentes por moneda |
| Semana: meta, meta a la fecha, real | Cupos › Semana | `leerMetasDelMes` (compensación semanal, 146) | venta | ventas de la semana hasta el día |
| El corte: meta, vendidos, faltan, cumplimiento lineal | Cupos › Cohorte | `vistaDeCohorteActiva` | venta | ventas de la cohorte hasta el día |
| El mes: leads, cupos, cumplimiento lineal | Cupos › Mes y metas del mes | `leerMetasDelMes` | venta | ventas del mes hasta el día; los leads del mes, 253 |
| Meta para llegar a la meta desde mañana; leads por día hábil | Lo que viene | · | · | 🟡 253 |
| Cómo nació cada cupo (agenda del día, follow-up) | Lo que viene | · | · | 🟡 254 |
| Planes de acción | Lo que viene | · | · | 🟡 257 |
| Masivos, cola y respuestas de Kapso | fuera | · | · | H-9: no viven en el CRM |
| El texto por closer ("9 agendas: 1 cierre, 2 no-show...") | la lista de cada cifra | · | · | fuera del 299 |

**Lo que no viaja en el tiempo:** las banderas (llamadas pasadas sin resultado, atendidos sin valor, sin Grain) y la
cartera son una foto de ahora; qué cohorte está activa también se lee de ahora.

## 4. Cuentas de Meta por programa (producción, 15-oct)

Lo que hoy suma el gasto de cada programa (`cuentas_publicitarias`, todas en `America/Bogota`):

| Programa | Cuentas | Moneda |
|---|---|---|
| ComunicArte | Cuenta Publicitaria Milena Morales · Rosario Gomez ADS | COP |
| ComunicArte | Milena \| Retia · Rosario \| Retia | USD |
| Comunícate con Confianza | 567726836094755 | COP |
| Tactical Investor | Tactical Assets SAS | COP |

`[CP] - Milena - [Nas & Be]` (USD) es visible para el usuario de sistema pero está restringida y **no entra**
(Mani, 15-oct). Las cuentas que nombró Pauta son todas las de la tabla: la de Juan Pablo Vieira es Tactical Assets
SAS (Tactical) y la de Francisco es 567726836094755 (Power Talk, Comunícate con Confianza).
