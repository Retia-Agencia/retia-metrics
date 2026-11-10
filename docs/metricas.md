# Métricas del CRM: de dónde sale cada cifra

> **El diccionario de métricas del CRM, y el único** (desde el 15-oct; antes vivía en `docs/hub.md` §5). Para
> cada métrica y cada dato: de qué tabla sale, qué cuenta y qué no, con qué fecha, en qué moneda, en qué función
> vive y cómo comprobarla contra la fuente. Sobre **qué hace hoy** una métrica, si el código y este documento
> discrepan, **manda el código** y este documento se corrige en el mismo cambio; sobre **qué debería hacer**, manda el
> ADR vigente, luego el ticket y al final el documento de reunión (ADR 0115, N8). Una métrica nueva entra aquí antes de llegar a una pantalla.

## 0. Reglas que valen para todas

| Regla | Qué significa | Dónde se enforza |
|---|---|---|
| El programa es frontera | Toda cifra es de UN programa. "Todos los programas" solo suma conteos, caja en USD y gasto; nunca una tasa, una meta, un costo ni el ROAS (ADR 0043, 0048) | el tipo de la consulta (`lib/queries/agregado-programas.ts`) |
| Personas, no filas | Un lead es `(programa, correo normalizado)`; el dedup vive en un índice único (ADR 0005) | `leads_programa_email_idx` |
| Fechas de Bogotá | Un instante se vuelve día con `AT TIME ZONE 'America/Bogota'` (siempre −05:00) | `lib/queries/hechos/fechas.ts`, `lib/format.ts` |
| Lo anulado no cuenta | Llamadas, deals, abonos y actividades anulados quedan fuera de toda métrica; una actividad anulada no cuenta como contacto ni gestión | `vigente()` en `lib/queries/vigente.ts`, vigilado por `tests/vigencia-centralizada.test.ts` |
| Días hábiles | Lunes a viernes; los festivos cuentan como hábiles (regla de Retia) | `lib/dias-habiles.ts` |
| Moneda a la vista | Ventas y caja en USD, pauta en COP; nada se convierte en silencio | `lib/format.ts` |
| Una sola definición | Si dos pantallas muestran la misma cifra, la cifra vive en un módulo y las dos lo importan (ADR 0024) | revisión, y los tests comparativos de cada módulo |
| Toda razón con su cobertura | Una tasa, un costo o un ROAS dice sobre qué base se midió y qué falta; con medio dato la pantalla dice "parcial" o "—" (ADR 0115 N3) | el tipo de la razón (ticket 351) |
| «Closer» tiene tres criterios | Llamadas, shows y agendas: **quien tomó la llamada**; ventas, vendido, recaudado, por cobrar y comisión: **el dueño del deal**; caja: **quien registró el abono**. Cada ficha lo declara (`criterioDeCloser`) y el comparativo lo dice. `embudoPorCloser` y `embudoDelRango` comparten los conteos de llamadas | `conteosDeLlamadas` en `lib/queries/dashboard.ts`; `tests/closer-una-pregunta.test.ts` |
| Una cohorte vende por vez | Las ventanas de venta de dos cohortes del mismo programa no comparten ningún día (cierre inclusive); la base lo exige con `cohorts_sin_solape_de_ventas` (ADR 0123). Una venta cae en la cohorte de su deal (`deals.cohort_id`), nunca por fecha | `EXCLUDE` en `cohorts`; `tests/cohortes-sin-solape.test.ts` |
| Periodo y cohorte son dos filtros | El **Periodo** (un atajo, un rango o **un mes concreto `AAAA-MM`**, del día 1 al último día del mes en Bogotá, ticket 400) filtra cada hecho por SU ancla de fecha (envío, agenda, cita, venta, abono); la **Cohorte** filtra por la cohorte del deal (`deals.cohort_id`) en todos los hechos; los dos se cruzan con Y. "Todas" + "Desde el inicio" es la historia del programa, y un id de otro programa se ignora. Un cruce vacío se dice ("C3 no tuvo actividad en octubre"), no se pinta en ceros (ADR 0115 N5, ticket 377) | `filtroCaja`, `filtroLlamadas`, `filtroCierres`, `filtroLeads` y hermanos en `lib/queries/metricas-filtros.ts` (UN `cohorteId` en el `Alcance`); `cohorteDelHub` en `lib/queries/cohorte-del-hub.ts`; `tests/filtros-del-hub.test.ts` |
| Un nombre por concepto | El rótulo de cada métrica sale de un solo vocabulario, el de `overview.md` §11 (ADR 0115 N4) | guardián de rótulos (ticket 357) |

Las nueve reglas completas están en el ADR 0115.

### Conceptos: dónde vive cada uno (ADR 0115 N1)

Cada concepto tiene **una** función, y quien lo necesite la importa. La columna "Hoy" es lo que la auditoría del 30-oct
encontró; "Canónico" es a donde converge, y lo decide el ticket de la última columna. Mientras una fila tenga más de un
lugar en "Hoy", esas cifras pueden discrepar entre pantallas.

| Concepto | Hoy (auditoría 30-oct) | Canónico | Ticket |
|---|---|---|---|
| Venta (conteo y día) | ✅ una sola: `etapaVendida()` (SQL) y `esEtapaVendida` (memoria) con UNA consulta con día, `ventasConDiaEn` en `lib/queries/metricas-filtros.ts` (DA-1); la consulta gemela sin día se borró y los recorridos importan esta (`idsDeVentasEn`, `ventasDelAlcance`, `ventasDelPrograma`, hechos, ficha, Students); `cerradosEn` es otro concepto (Close date) | guardián: `tests/venta-una-definicion.test.ts` | 352 ✅, 392 ✅ |
| Vendidos de la cohorte | ✅ `ventasDeLaCohorte` en `lib/queries/ventas-de-la-cohorte.ts`, sin límite inferior (DA-2); la usan Cupos, meta de hoy, Proyección y alertas | — | 352 ✅ |
| Meta de hoy y cumplimiento | ✅ `metaDeHoy` y `esperadoLineal` en `lib/dias-habiles.ts`; las importan `dashboard.ts`, `proyeccion.ts`, `metas.ts` y `alertas.ts` | — | 352 ✅ |
| Show / ocurrió | ✅ `RESULTADOS_QUE_OCURRIERON`, `ocurrio`, `ocurrioSql`, `noAsistio` y `noAsistioSql` en `lib/deals/resultados-de-llamada.ts`; las 8 envolturas se borraron | guardián N1: `tests/resultados-de-llamada.test.ts` | 353 ✅ |
| % de show y % de no show | ✅ `showPorDeal` (la cifra de Hoy, DA-3), `showPorCita` (dentro de «Cómo se calcula» y en la semana) y `noShowPorCita` / `noShowPorDeal` como complementos nombrados, en el mismo módulo; Pauta, el comparativo semanal y la escalera las importan | `tests/resultados-de-llamada.test.ts`, `tests/resultados-de-llamada-paridad.test.ts` | 353 ✅ · el % de show y el % de cierre viajan como `RazonConCobertura` (`razonShow`, `razonCierre`) en dashboard, Mi espacio, vista de todos y proyección (351, 9-nov); la proyección usa la razón aunque la cobertura sea parcial, pero lo dice en pantalla («parcial, N de M») y, si no hay valor, «—» con el motivo (decisión de Mani, 9-nov: nunca mostrar una cifra sin su cobertura) |
| Cita sin resultado | ✅ `citaVencidaSinResultado(ahora, "excluir" \| "incluir")` en `metricas-filtros.ts` (con `coalesce(fecha_agenda, fecha_llamada)`) y su gemela `citaSinResultado` en memoria; cada llamador declara si excluye negocios cerrados. Inbox y bandera del Hub: excluyen cerrados, el Inbox no sigue el periodo y la bandera sí | guardián N1 y `tests/resultados-de-llamada-paridad.test.ts` | 353 ✅ |
| Agenda | ✅ DA-4: la cita creada en el CRM, y cada reagenda es otra cita creada (`hechos/agenda.ts`); la agenda de Meta se muestra aparte con `EXPLICACION_AGENDA_CRM_VS_META` (`lib/vocabulario-metricas.ts`) | `tests/resultados-de-llamada-paridad.test.ts` | 353 ✅ |
| Día de cada hecho (anclas) | ✅ `diaEnBogota`, `anclaEnvio`, `diaDeEnvio` y `diaDeCreacionDelDeal` en un solo módulo | `lib/queries/hechos/fechas.ts` | 354 |
| Registro y lead | ✅ lead: UN ancla, `fechaAnclaLead` (primera aplicación en Bogotá, sin respaldo), que escribe la ingesta al nacer el lead (`primeraAplicacion`) y que importan la métrica y la lista (`fechaDeEntradaDelLead`); el `coalesce` suelto de la lista se borró (ADR 0121). Registros: `filtroDeEnvios` en `hechos/envio.ts`, aún con el mismo nombre en pantalla | `fechaAnclaLead` para Leads; `hechos/envio.ts` para registros | 389 ✅ (lead), 354 (registros) |
| Sin UTM | ✅ `categoriaDeUtm` y su gemela `categoriaUtmSql`; `categoriaDe` borrada | `categoriaDeUtm` y `categoriaUtmSql` | 354 |
| Calendario (semana, sumar días, hábiles) | ✅ un solo módulo; `rangos.ts` queda con los presets | `lib/dias-habiles.ts` | 354 |
| Gasto convertido a USD o COP | ✅ un solo convertidor y un hecho: `gastoConvertido` (`hechos/gasto.ts`) reusa `convertirGasto` y `coberturaDeGasto`; el ROAS lo consume en vez de leer el gasto por su cuenta | `convertirMonto`/`convertirGasto` en `lib/pauta/convertir-gasto.ts` · `gastoConvertido` en `lib/queries/hechos/gasto.ts` | 351 ✅ · 355 ✅ |
| Embudo de Pauta por campaña y por canal | ✅ un cargador y una tabla: `cargarRoasDePauta` (`roas-de-pauta.ts`) expone registro, agenda, show, no show, venta, valor vendido, gasto y ROAS por campaña › conjunto › anuncio **o** por canal (par UTM, `resolverCanal`), con UNA ancla por paso. `pauta-interina.ts` borrada | `cargarRoasDePauta` en `lib/queries/roas-de-pauta.ts` | 355 ✅ |
| Caja recaudada | `cajaRecaudada`+`filtroCaja`, `cajaDelDiaPorOrigen`, `series-dinero.ts` (ahora por día, sin meses fijos, 370), `metricas-con-filas.ts`; `hechos/abono.ts` retirado (403 F4) | `filtroCaja` | 361 |

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
- **Cita:** llamada vigente cuya cita cae en el rango y cuyo resultado no es `cancelada`. Las canceladas se cuentan
  aparte; no inflan "Citas". Esta exclusión vive en `citaNoCancelada` y la comparten la cifra y su lista.
- **Cancelada:** llamada vigente cuya cita cae en el rango y cuyo resultado es `cancelada`.
- **Fecha:** el día de la cita, `coalesce(fecha_agenda, fecha_llamada)` en Bogotá (`fechaAnclaCall`).
- **Show:** el resultado está en `show`, `compromiso_pago`, `cerrada` o `perdida` (`ocurrio`, `lib/deals/resultados-de-llamada.ts`). **No show** es solo el resultado `no_show` (`noAsistio`): la cancelada y la cita sin marcar no lo son.
- **Cita pasada sin resultado:** sigue `agendada` y su hora, `coalesce(fecha_agenda, fecha_llamada)`, ya pasó (`citaVencidaSinResultado`). Es un dato que falta, no un no show. Quien la cuenta declara si excluye los negocios ya cerrados; la escalera la muestra aparte de sus escalones (353).
- **Función:** `lib/queries/hechos/cita.ts`, `llamadaOcurrio` en `lib/queries/metricas-filtros.ts` (que llama a `ocurrioSql`).
- **Ojo:** el grupo de citas que alimenta las tasas de show y cierre no cambia: una cancelada ocurrida sigue dentro
  de ese grupo como cita no atendida. "Citas" y el grupo de tasas responden preguntas distintas.

### 1.4 Venta

- **Tabla:** `deal_etapa_historial` unida a `deals`.
- **Cuenta:** deals vigentes, **sin cortesía**, que están **hoy** en **Abonado o Completo** (DA-1, Mani, 3-nov). Un
  deal es una venta una sola vez. La etapa actual la pregunta `etapaVendida()` (SQL) o `esEtapaVendida` (memoria):
  nadie más escribe esa lista (guardián).
- **Fecha:** el **primer** día en que entró a una etapa vendida (Bogotá). La reversa de una venta (anular el
  abono que la vendió, ticket 200) la saca.
- **Función:** `ventasConDiaEn` en `lib/queries/metricas-filtros.ts` (la única consulta, 392) y
  `lib/queries/hechos/venta.ts`; la de la cohorte entera, `ventasDeLaCohorte`. Los demás recorridos la importan:
  `idsDeVentasEn` (solo los deals, para `filtroCierres`, caja del día y ventas por closer), `ventasDelAlcance` (la serie
  diaria, con las mismas condiciones que `filtroCierres`) y `ventasDelPrograma` (escalera y ROAS, sin límite de fechas).
  Las gemelas en memoria (`esEtapaVendida` en la ficha, las tasas del grupo y el embudo por etapas) usan la misma lista.
  `cerradosEn` NO es venta: es la Close date (cuenta también perdidos y un perdido recuperado deja de estar cerrado).
- **Ojo:** un deal que pasa de Abonado a Cierre Perdido **deja de ser venta y cuenta como perdido** (DA-1, Mani,
  3-nov; en la práctica solo con una devolución, 242). Así lo cuentan Mes, Cohorte, alertas, % de cierre, escalera y
  ROAS, a la vez (352). Si una venta de octubre se pierde en noviembre, octubre baja en uno.
- **Cohorte:** las ventas anteriores a `fecha_inicio_ventas` cuentan para su cohorte (DA-2, Mani, 3-nov), igual en
  Cupos y en Proyección (`ventasDeLaCohorte`, hasta hoy).

### 1.5 Abono (caja recaudada)

- **Tabla:** `abonos`.
- **Cuenta:** abonos vigentes del programa, tanto del ticket como adicionales vendidos aparte.
- **Fecha:** `abonos.fecha` (la fecha del pago, no la del registro).
- **Moneda:** USD en la app; la base acepta COP o USD (ADR 0124, `CHECK` de la migración 0126). Un abono en COP deja el saldo de su venta sin calcular, nunca lo resta contra dólares.
- **Función:** `filtroCaja` y `cajaRecaudada`; lo abonado y el saldo de un deal, en `lib/queries/saldo.ts`, cuentan solo abonos de ticket.
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
- **Moneda:** la de la cuenta (COP o USD), guardada tal cual; cualquier otra la rechaza la base (ADR 0124).
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
- **Función:** `tasasDelRango` en `lib/trm/consultar.ts` (la tasa de cada día de un rango, con sus faltantes y la etiqueta).
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
| Traza Paid | distribución N3, N2 y N1 de los envíos Paid del rango (el universo son envíos, no ventas) | `origenDelPrograma` |

## 3. Métricas

Leyenda de estado, solo dos valores: ✅ en producción y con su ticket cerrado · 🟡 definida, sin construir o con su
ticket abierto (con su número). Los colores 🟢 🟡 🔴 ⚪ de §3.3 son del semáforo, no un estado.

### 3.0 Fichas de los conceptos registrados

> Generado desde el registro tipado (`lib/metricas/registro.ts`, ADR 0120) con `npm run docs:metricas`: no se edita a mano
> y un test falla si está desactualizado. Solo trae los conceptos que ya tienen ficha; el resto sigue en las tablas de
> abajo y en `lib/metricas/pendientes.ts`. La **fórmula en prosa** de cada uno sigue escrita a mano en §3.1.

<!-- registro:inicio (generado por `npm run docs:metricas`; no editar a mano) -->
| Concepto | Tipo | Unidad · moneda | Se ubica por | ¿Se suma entre programas? | Cobertura | Dimensiones | Vigencia | Función | Listas |
|---|---|---|---|---|---|---|---|---|---|
| Envíos (`registros`) | simple | personas | fecha del envío | sí | — | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `campana`, `fuente`, `utm_source`, `utm_medium`, `categoria` |  | `filtroDeEnvios` (`lib/queries/hechos/envio.ts`) | `registros` |
| Agendadas (`agendadas`) | simple | citas | fecha de creación de la cita | sí | — | `dia`, `semana`, `mes`, `hora`, `area`, `canal`, `cuenta`, `utm_source`, `utm_medium`, `categoria`, `tiene_envio`, `dueno`, `cohorte`, `etapa` | `calls` | `agrupar` (`lib/queries/hechos/agenda.ts`) | `agendas_creadas` |
| Citas (`citas`) | simple | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte`, `etapa`, `ocurrio` | `calls` | `embudoDelRango` (`lib/queries/dashboard.ts`) | `agendas`, `citas_debidas`, `citas_sin_marcar`, `agendas_futuras` |
| Realizadas (`shows`) | simple | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte`, `etapa` | `calls` | `ocurrioSql` (`lib/deals/resultados-de-llamada.ts`) · gemela `ocurrio` (`lib/deals/resultados-de-llamada.ts`) | `shows`, `shows_sin_grain`, `atendidos_sin_valor`, `atendidos_sin_grain` |
| No asistió (`no_asistio`) | simple | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte`, `etapa` | `calls` | `noAsistioSql` (`lib/deals/resultados-de-llamada.ts`) · gemela `noAsistio` (`lib/deals/resultados-de-llamada.ts`) | `no_shows` |
| Asistencia (`asistencia`) | razon de `shows` y `no_asistio` | % | hora de la cita (agenda, o la llamada si no tiene) | no | razón con cobertura |  | `calls`, `deals` | `grupoDeCitas` (`lib/queries/tasas-del-grupo.ts`) · gemela `showPorDeal` (`lib/deals/resultados-de-llamada.ts`) | `grupo_citas`, `grupo_pendientes`, `grupo_sin_show` |
| Cierre de ventas (`cierre_de_ventas`) | razon de `ventas` y `shows` | % | hora de la cita (agenda, o la llamada si no tiene) | no | razón con cobertura |  | `calls`, `deals` | `grupoDeCitas` (`lib/queries/tasas-del-grupo.ts`) · gemela `calcularTasasDelGrupo` (`lib/queries/tasas-del-grupo.ts`) | `grupo_shows`, `grupo_vendidos` |
| Ventas (`ventas`) | simple | cupos | día de su primera entrada a Abonado o Completo | sí | — | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte` | `deals` | `ventasConDiaEn` (`lib/queries/metricas-filtros.ts`) · gemela `esEtapaVendida` (`lib/deals/etapas.ts`) | `cierres` |
| Cupos vendidos (`cupos_vendidos`) | derivada de `ventas` | cupos | día de su primera entrada a Abonado o Completo | sí | — |  | `deals` | `ventasConDiaEn` (`lib/queries/metricas-filtros.ts`) · gemela `esEtapaVendida` (`lib/deals/etapas.ts`) | — |
| Llevamos (`llevamos`) | derivada de `ventas` | cupos | día de su primera entrada a Abonado o Completo | sí | — |  | `deals` | `ventasDeLaCohorte` (`lib/queries/ventas-de-la-cohorte.ts`) | — |
| Vendido (`vendido`) | simple | dinero · USD | día de su primera entrada a Abonado o Completo | sí | excluye y cuenta aparte | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte` | `deals`, `abonos` | `dineroDeVentas` (`lib/queries/dinero-de-ventas.ts`) · gemela `dineroDeSaldos` (`lib/queries/dinero-de-ventas.ts`) | `contratado` |
| Recaudado (`recaudado`) | simple | dinero · USD | día de su primera entrada a Abonado o Completo | sí | excluye y cuenta aparte | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte` | `deals`, `abonos` | `dineroDeVentas` (`lib/queries/dinero-de-ventas.ts`) · gemela `dineroDeSaldos` (`lib/queries/dinero-de-ventas.ts`) | — |
| Por cobrar (`por_cobrar`) | derivada de `vendido` y `recaudado` | dinero · USD | día de su primera entrada a Abonado o Completo | sí | excluye y cuenta aparte | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte` | `deals`, `abonos` | `dineroDeVentas` (`lib/queries/dinero-de-ventas.ts`) · gemela `dineroDeSaldos` (`lib/queries/dinero-de-ventas.ts`) | — |
| Entró a caja (`entro_a_caja`) | simple | dinero · USD · COP | fecha del abono | sí | — | `dia`, `semana`, `mes`, `dueno`, `cohorte`, `moneda` | `abonos` | `filtroCaja` (`lib/queries/metricas-filtros.ts`) | `caja` |
| Comisión (`comision`) | derivada de `vendido` | dinero · USD | día de su primera entrada a Abonado o Completo | no | excluye y cuenta aparte | `dia`, `semana`, `mes`, `area`, `canal`, `cuenta`, `dueno`, `cohorte` | `deals` | `comisionesPorCloser` (`lib/queries/comision.ts`) · gemela `comisionDeDeal` (`lib/queries/comision.ts`) | — |
| Leads (`leads`) | simple | personas | día de su primera aplicación (Bogotá) | sí | — | `cohorte` |  | `filtroLeads` (`lib/queries/metricas-filtros.ts`) · gemela `primeraAplicacion` (`lib/ingesta/ingerir.ts`) | `leads` |
| Sin resultado (`llamadas_sin_resultado`) | simple | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — |  | `calls`, `deals` | `citaVencidaSinResultado` (`lib/queries/metricas-filtros.ts`) · gemela `citaCuentaComoPorMarcar` (`lib/deals/resultados-de-llamada.ts`) | — |
| Sin resultado (`citas_pendientes`) | simple | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — |  | `calls`, `deals` | `citaVencidaSinResultado` (`lib/queries/metricas-filtros.ts`) · gemela `citaCuentaComoPorMarcar` (`lib/deals/resultados-de-llamada.ts`) | `sin_resultado` |
| Citas del día (`citas_del_dia`) | derivada de `citas` | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — |  | `calls` | `embudoDelRango` (`lib/queries/dashboard.ts`) | — |
| Realizadas (`citas_realizadas`) | derivada de `shows` | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — |  | `calls` | `ocurrioSql` (`lib/deals/resultados-de-llamada.ts`) · gemela `ocurrio` (`lib/deals/resultados-de-llamada.ts`) | — |
| Canceladas (`citas_canceladas`) | simple | citas | hora de la cita (agenda, o la llamada si no tiene) | sí | — |  | `calls` | `embudoDelRango` (`lib/queries/dashboard.ts`) | `canceladas` |
| % de show por cita (`show_por_cita`) | derivada de `shows` y `citas` | % | hora de la cita (agenda, o la llamada si no tiene) | no | excluye y cuenta aparte |  | `calls` | `showPorCitaDelRango` (`lib/queries/tasa-show-por-cita.ts`) · gemela `showPorCita` (`lib/deals/resultados-de-llamada.ts`) | — |
| De cita a venta (`cita_a_venta`) | derivada de `asistencia` y `cierre_de_ventas` | % | hora de la cita (agenda, o la llamada si no tiene) | no | razón con cobertura |  | `calls`, `deals` | `grupoDeCitas` (`lib/queries/tasas-del-grupo.ts`) · gemela `calcularTasasDelGrupo` (`lib/queries/tasas-del-grupo.ts`) | — |
| Agenda del día (`nacio_agenda_del_dia`) | derivada de `ventas` | cupos | día de su primera entrada a Abonado o Completo | sí | — |  | `deals`, `calls` | `comoNacioLaVenta` (`lib/queries/reporte-diario.ts`) | — |
| Seguimiento (`nacio_seguimiento`) | derivada de `ventas` | cupos | día de su primera entrada a Abonado o Completo | sí | — |  | `deals`, `calls` | `comoNacioLaVenta` (`lib/queries/reporte-diario.ts`) | — |
| Sin llamada (`nacio_sin_llamada`) | derivada de `ventas` | cupos | día de su primera entrada a Abonado o Completo | sí | — |  | `deals`, `calls` | `comoNacioLaVenta` (`lib/queries/reporte-diario.ts`) | — |
| Inversión (`inversion`) | simple | dinero · COP | día del gasto cargado (Bogotá) | sí | razón con cobertura | `dia`, `semana` |  | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
| Costo por agenda (`costo_agenda_crm`) | razon de `inversion` y `agendadas` | dinero · COP | fecha de creación de la cita | no | razón con cobertura | `dia`, `semana` | `calls` | `costoPorAgendaDelCrm` (`lib/queries/hechos/costo-agenda-crm.ts`) | — |
| Costo por agenda (según Meta) (`costo_agenda_meta`) | derivada de `inversion` | dinero · COP | día del gasto cargado (Bogotá) | no | razón con cobertura | `dia`, `semana` |  | `costoPorAgendaDeVentana` (`lib/semaforo/costo-por-agenda.ts`) | — |
| ROAS (`roas`) | razon de `vendido` y `inversion` | veces | fecha del envío | no | razón con cobertura | `dia`, `semana` | `deals` | `cargarRoasDePauta` (`lib/queries/roas-de-pauta.ts`) | — |
| Profit (`profit`) | derivada de `vendido` y `inversion` | dinero · USD | fecha del envío | no | razón con cobertura | `dia`, `semana` | `deals` | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
| CPM (`cpm`) | simple | dinero · COP | día del gasto cargado (Bogotá) | no | razón con cobertura | `dia`, `semana` |  | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
| CTR (`ctr`) | simple | % | día del gasto cargado (Bogotá) | no | razón con cobertura | `dia`, `semana` |  | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
| Llegada a la landing (`llegada_landing`) | simple | % | día del gasto cargado (Bogotá) | no | razón con cobertura | `dia`, `semana` |  | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
| Conversión de la landing (`conversion_landing`) | razon de `registros` | % | fecha del envío | no | razón con cobertura | `dia`, `semana` |  | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
| Frecuencia (`frecuencia`) | simple | veces | día del gasto cargado (Bogotá) | no | razón con cobertura | `dia` |  | `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) | — |
<!-- registro:fin -->

### 3.1 Embudo y ventas

| Métrica | Fórmula | Unidad | ¿Se suma entre programas? | Función | Estado |
|---|---|---|---|---|---|
| Envíos | cada formulario enviado, completo o parcial, del rango (§1.1) | envíos | sí | `filtroDeEnvios` en `hechos/envio.ts` | ✅ 397 |
| Leads | personas distintas (`leads`, entrada por formulario) del programa cuya **primera aplicación** cae en el rango, en Bogotá (`fechaAnclaLead`), la misma persona una vez. La fecha la escribe la ingesta al nacer el lead: la del envío, o cuando el CRM lo recibió si es un parcial sin fecha. **Quien solo dejó un parcial cuenta** (decisión de Mani, 8-nov, 406; test de paridad cifra = lista en `tests/ingesta-escritura.test.ts`); el alta manual no es lead de formulario y no cuenta. Con closer no hay cifra (`—`) y la cohorte la da un deal vigente en ella. La lista Leads «creado» usa el mismo ancla (alta manual: su alta) | personas | sí | `filtroLeads` en `lib/queries/metricas-filtros.ts` | ✅ 389 |
| Dejó datos · Llegó al Calendly | embudo del formulario (ADR 0069, ticket 126) | personas | sí | `lib/queries/embudo-formulario.ts` | ✅ |
| Agendó sobre llegó al Calendly | registros que agendaron ÷ registros que llegaron al Calendly; cada paso del embudo muestra su tasa sobre el paso anterior, nombrado ("de los que llegaron al Calendly"), y debajo la del total (Dejó datos); en la tabla por canal, solo la del paso anterior; base cero se muestra `—` (ADR 0067) | registros (`fuente`, `token`), por el día de Bogotá de su primer envío, sin filtro de closer | no: por programa, nunca en "todos" (ADR 0048) | `tasasDelEmbudo` sobre `embudoDelFormulario` | ✅ |
| No agendaron | **personas** (lead) con un registro (`fuente`, `token`) cuyo primer envío cae en el rango y que llegó al Calendly (agendó o calidad High); una fila por persona, con la fecha de su registro más antiguo. El deal que la representa es el de la persona: el abierto o, si no hay, el más reciente, desempate por id (`idsDelDealDeLaPersona`, `lib/queries/deal-de-la-persona.ts`; la misma regla cuelga el deal en la lista de registros). Sale si **hoy** ese deal tiene `calls` vigente o está en Agendado o una etapa posterior, Cierre perdido incluido (decidido por Mani, 24-oct); una cita posterior al envío la saca. Se verifica comparando `embudoDelFormulario.noAgendaron` con el total de la lista `no_agendaron`, incluyendo otro programa y un deal anulado, y agregando una cita vigente al día siguiente | personas, por programa | no | `llegoAlCalendly` y `noAgendaronDelFormulario` en `lib/queries/embudo-formulario.ts`; lista en `metricas-con-filas.ts` | ✅ |
| Agendadas | llamadas vigentes creadas en el rango (§1.2); la de Pauta y el denominador del costo por cita agendada del Hub (249) | citas | sí | `agrupar` en `hechos/agenda.ts` | ✅ 397 |
| Cupos con caja (ticket 370) | ventas (deals en Abonado o Completo) con **al menos un abono vigente** con fecha en el periodo, **una vez cada una**: el día de su primer abono del periodo (`min(abonos.fecha)` por deal, con el mismo `filtroCaja`). Un segundo abono del mismo deal no suma otro cupo: un cupo es un cupo (pedido de Mani, 4-nov). Por paso suma los cupos que *empezaron* a pagar en el tramo y el acumulado del último punto es el total del periodo | ventas | sí (closer = quien registró el abono; cohorte = la del deal) | `leerVentana` en `lib/queries/series-dinero.ts`; sin lista propia todavía (un punto de esta gráfica no abre lista) | ✅ |
| Ventas, Vendido y Entró a caja **por día** (ticket 370) | la serie diaria que alimenta toda gráfica de Dinero: cupos por el día de la venta (352), Vendido de esas ventas (369) y caja por día de abono y moneda. El eje X es **el periodo elegido** (con cohorte C3 y «Desde el inicio», de su primera venta a hoy, recortado a hoy); no existe ninguna ventana fija. Paso (día, semana de lunes a domingo, mes) y forma (por paso, acumulado) se calculan en `lib/series-pasos.ts`; el último punto acumulado es el total de la cifra. La comparación es la de «Comparar con», día a día desde su primer día de venta (C3 contra C2 «al mismo día de venta»), y se corta donde B se acaba | ventas / plata por moneda | sí (A y B cada uno con su cohorte) | `leerSeriesDeDinero` + `lib/series-pasos.ts` | ✅ |
| Deals que agendaron | deals creados del rango (misma fecha que Deals creados) con al menos una llamada vigente del mismo programa creada hasta el último día del rango; la gráfica muestra el % sobre los deals creados, acumulado por día hábil | deals | sí (el % no) | `filtroDealsQueAgendaron` en `lib/queries/metricas-filtros.ts`, serie en `lib/queries/deals-contra-agendas.ts` | ✅ |
| Deals creados (total) · Deals creados desde un formulario completo · Deals creados desde un parcial (tickets 372 y 381, ADR 0069) | deals vigentes del programa cuyo **día** es el del envío que los abrió, `coalesce(fecha_envio, created_at)` en Bogotá (`fechaAnclaDealCreado`). Es **completo** si el lead tiene al menos un envío no parcial del mismo programa hasta el fin del rango (`coalesce(fecha_envio, created_at)` en Bogotá), aunque el deal se haya abierto con el parcial anterior; es **parcial** si hasta ese corte solo tiene parciales. Sin `submission_origen_id` es abierto a mano y no pertenece a ninguna mitad. Con closer no hay cifra (`—`), como el total | deals | sí en las tres (la cohorte filtra por `deals.cohort_id`) | `filtroDealsDesde` / `filtroDealsDesdeQueAgendaron` en `lib/queries/metricas-filtros.ts`; listas `deals_desde_completo`, `deals_desde_parcial`; serie por mitad en `lib/queries/deals-contra-agendas.ts` | ✅ |
| % de deals que agendaron, de los que llenaron el formulario completo · de los parciales (ticket 372) | deals de **esa mitad** que agendaron ÷ deals de esa mitad, ambos con los mismos filtros (N2): jamás se divide los agendados de una mitad entre los deals de ambas, porque un parcial casi nunca agenda y la tasa bajaría sin que nada empeorara. El % de arriba del Hub y el paso «Agendadas» del embudo son el de los completos; el de parciales va al lado, rotulado. Listas `completos_que_agendaron` y `parciales_que_agendaron` | tasa por programa | no | `pctDealsQueAgendaron` sobre `serieDealsContraAgendas(..., origen)` | ✅ |
| Citas | llamadas vigentes cuya **cita** cae en el rango (§1.3), salvo las canceladas; no es Agendadas | citas | sí | `embudoDelRango` (`filtroLlamadas` + `citaNoCancelada`) | ✅ 397 |
| Citas del día | la misma cita que Citas, con el rango de un solo día (Hub › Hoy): llamadas vigentes cuya cita es de hoy, salvo las canceladas; no tiene consulta propia (403) | citas | sí | `embudoDelRango` en `lib/queries/dashboard.ts` | ✅ 403 |
| Canceladas | llamadas vigentes cuya cita cae en el rango y tienen resultado cancelada; se muestran aparte y no suman en Citas | citas canceladas | sí | `embudoDelRango`, lista `canceladas` | ✅ |
| Horas de agenda | hora de `calls.createdAt` en Bogotá; solo agendas de pauta y vigentes; cada cita creada cuenta con su hora, también la reagenda (DA-4, 353: antes decía que conservaba la primera y el código nunca lo hizo); el encabezado de cada programa muestra al lado las agendas de Meta del mismo día y el pie explica por qué pueden diferir (`EXPLICACION_AGENDA_CRM_VS_META`) | horas | no | `armarMensajeDeHorasDeAgenda` | 🟡 298 (en main, sin checkpoint) |
| Realizadas | citas del rango que ocurrieron (§1.3) | citas | sí | `ocurrioSql` y `ocurrio` en `lib/deals/resultados-de-llamada.ts` | ✅ 397 |
| No asistió | citas resueltas en las que la persona no se presentó; no incluye canceladas ni citas sin resultado | citas | sí | `noAsistioSql` y `noAsistio` en `lib/deals/resultados-de-llamada.ts` | ✅ 397 |
| Asistencia | deals del grupo con al menos una cita realizada ÷ deals con resultado marcado. Una cita pasada sin resultado queda fuera. Devuelve cobertura y marca de parcialidad cuando faltan resultados | % + cobertura | no | `grupoDeCitas` en `lib/queries/tasas-del-grupo.ts`, que divide con `showPorDeal` | ✅ 397 |
| % de show por cita | citas del día que ocurrieron ÷ citas **vivas** del día que ya debían ocurrir al corte (§1.3; las canceladas no entran: `citaDebida`, la misma para la cifra y la lista de "Citas que ya debían ocurrir"). **Cobertura (N3, 4-nov):** las que siguen `agendada` con la hora ya pasada son "sin resultado marcado" (`citaDebidaSinMarcar`, su lista es "Citas sin resultado marcado"): no son no shows, son datos que faltan; la pantalla dice "Parcial: N sin resultado marcado" y, si NINGUNA tiene resultado, muestra — y no 0,0 %. Es otra pregunta que el % por deal. **DA-3 (Mani, 7-nov):** la cifra de Hoy es el % por deal; esta va dentro de «Cómo se calcula» (el reporte de Michael la contaba por cita, 24-oct), y la semana sigue por cita con su rótulo «a la cita» | % | no | `showPorCitaDelRango` en `lib/queries/tasa-show-por-cita.ts`, que divide con `showPorCita` | ✅ |
| % de no show | **de citas resueltas** (Pauta, por canal y campaña): no shows ÷ (ocurrieron + no shows) = `noShowPorCita`; una cita sin marcar o cancelada no entra. **Por deal** (comparativo semanal): deals con cita ocurrida y sin show ÷ deals con resultado = `noShowPorDeal`, el complemento del % de show por deal. Nunca se resta 100 − show a mano | % | no | `lib/deals/resultados-de-llamada.ts` | ✅ 353 |
| Cierre de ventas | deals con cita realizada que hoy están vendidos ÷ deals con cita realizada. Conserva la cobertura y marca de parcialidad de Asistencia; una cita sin resultado nunca se inventa como No asistió | % + cobertura | no | `grupoDeCitas` y `calcularTasasDelGrupo` en `lib/queries/tasas-del-grupo.ts` | ✅ 397 |
| De cita a venta | deals con show vendidos hoy ÷ deals del grupo (= Asistencia × Cierre de ventas; antes «Cita a venta», «Cita → venta» y «Agenda → venta», D-C del 10-nov); los pendientes de resultado quedan fuera del grupo y visibles aparte | % | no | `grupoDeCitas` y `calcularTasasDelGrupo` en `lib/queries/tasas-del-grupo.ts` | ✅ 403 |
| Cita pasada sin resultado (por marcar) | citas vigentes que siguen `agendada` con su hora (`coalesce(fecha_agenda, fecha_llamada)`) ya pasada, de deals **no cerrados**. La cita suelta (sin deal) queda fuera y vive en la pestaña «Sin deal» del Inbox; **decidido por Mani el 7-nov: no cuenta como por marcar** (`CITA_SUELTA_CUENTA_COMO_POR_MARCAR = false`). Es un dato que falta, no un no show. **Captura (390):** se empuja al closer sin bloquearlo: chip «Sin resultado» en Mi espacio y, en el Inbox del equipo, el conteo por closer. Lectura del 7-nov: 46 en Confianza y 676 entre Comunicarte y Tactical | citas | sí | `citaVencidaSinResultado` en `metricas-filtros.ts`, gemela `citaCuentaComoPorMarcar` en `lib/deals/resultados-de-llamada.ts`; claves `llamadas_sin_resultado` y `citas_pendientes` | ✅ 390 |
| Cita pasada sin resultado en la escalera | deals NO vendidos con una cita `agendada` cuya hora ya pasó (`citaSinResultado` en `UbicacionEnLaEscalera`). Es una marca **aparte** del escalón: el deal sigue en «Dejó datos» o donde lo ponga la fórmula, y la tarjeta cuenta cuántos hay, con su lista (`escalon=cita_sin_resultado`), para que no se lean como falta de asistencia (C-05) | deals | sí | `escalonDeDeal`, `resumirEscalera` en `lib/queries/escalera.ts` | ✅ 353 |
| Embudo comercial | un solo universo de deals creados en el rango: **creados → agendaron → tuvieron show → compraron**. Cada paso es subconjunto del anterior; `pctDelPaso` es cantidad ÷ paso anterior (`—` si la base es cero) y `perdidos` es la resta exacta. Se puede leer completo, parcial o manual; los cuatro pasos abren su lista desde `metricas-con-filas` | deals y % | no: siempre por programa | `pasosDelEmbudoComercial` / `cargarEmbudoComercial` en `lib/queries/embudo-comercial.ts`; listas `embudo_comercial_*` | ✅ |
| Ventas | deals vendidos en el rango (§1.4) | ventas | sí | `ventasConDiaEn` | ✅ |
| Cupos vendidos (hoy) | las ventas del día, un cupo cada una; `ventasConDiaEn` con el rango de un día (392) | cupos | sí | `ventasConDiaEn` | ✅ |
| Llevamos (a hoy) | las ventas de la cohorte o del mes desde que empezó el periodo hasta hoy, sin límite inferior (DA-2); en USD, su Vendido (392) | cupos y USD | sí | `ventasDeLaCohorte` | ✅ |
| Cómo nació la venta | tres desenlaces, **Agenda del día**, **Seguimiento** y **Sin llamada**: de cada venta del día, con los días de Bogotá de las llamadas que ocurrieron en su deal: show el mismo día de la venta = **Agenda del día**; el último show de un día anterior = **Seguimiento**; ningún show hasta ese día = **Sin llamada**. Un show posterior a la venta no la explica (G-10). Cada venta cae en exactamente una; no se inventa un nacimiento a una venta sin deal | cupos | sí | `comoNacioLaVenta` en `lib/queries/reporte-diario.ts` | ✅ 403 |
| Ventas por escalón | la escalera de conversión (ADR 0109) conserva siete escalones y arriba los agrupa sin cambiar fórmulas: **Cerró en la llamada** = `pago_en_llamada`; **Cerró con seguimiento** = `pago_rapido` + `pago_despues` (su mediana se calcula sobre los deals de ambos); **No cerró** = `atendio_no_compro`; aparte, **Ventas sin llamada registrada** = `pago_sin_llamada` y **No llegaron a la llamada** = `agendo_no_se_presento` + `dejo_datos` | deals | no: distribución por programa | `GRUPOS_DE_CIERRE` y `grupoDeCierre` en `lib/queries/escalera.ts` | ✅ |
| Conversión por etapa | conserva la lectura anterior y agrega dos caminos: **setter** (En gestión → Contactado → Calificado) y **llamada** (Agendado → Atendido → Compromiso → Ganado). En cada etapa `pasaron + siguen aquí + se perdieron aquí = llegaron`. El tiempo agrega mediana de días hábiles y devuelve `null` con menos de cinco deals | deals y días hábiles | sí, por programa y cohorte | `lecturaConversion` / `lecturasPorCamino` / `calcularTiempos` en `lib/queries/embudo-etapas.ts`; listas en `lib/queries/embudo-con-filas.ts` | ✅ |
| Vendido | Σ `deals.valor_vendido_usd` de las ventas que dejan pasar los filtros del Hub (cohorte, periodo por fecha de venta, closer); lo escribe el closer. Una venta sin valor queda fuera y se cuenta aparte, no se inventa. Una venta con abonos en otra moneda SÍ cuenta en Vendido (decisión de Mani, 8-nov: el USD es el referente), pero su Recaudado y Por cobrar quedan sin calcular y se cuentan aparte (`sinSaldoCalculable`) hasta que exista la conversión a USD (pendiente). Va siempre junto a Recaudado y Por cobrar (369). **Es la única suma del valor vendido (393):** Hub, "¿Vamos a llegar?", metas, ROAS, listas y el reporte del día toman `vendido` de `dineroDeVentas`; ningún componente suma una lista. Un Student sin valor vendido no debe existir (decisión de Mani, 8-nov): la reja de `moverEtapa` lo exige y `sinValorVendido` queda como alarma que debe dar 0 | USD | sí | `dineroDeVentas` en `lib/queries/dinero-de-ventas.ts` | ✅ |
| Recaudado | Σ abonos de ticket vigentes **de esas mismas ventas, a hoy**, sin importar cuándo se abonaron (369, DH-2). Un abono adicional no entra (ADR 0113) | USD | sí | `dineroDeVentas` (sobre `saldosDeDeals`) | ✅ |
| Por cobrar | Vendido − Recaudado, venta por venta, de esas mismas ventas; un saldo negativo es un sobrepago, que se muestra aparte (`sobrepago`) y no resta deuda a otra venta. Es lo que antes era la cartera: con cohorte «Todas» y «Desde el inicio» da la cartera de hoy. Invariante probado: Vendido = Recaudado + Por cobrar − sobrepago, al centavo | USD | sí | `dineroDeVentas`, `dineroDeSaldos` | ✅ |
| Comisión | Σ valor vendido × el % congelado en el deal al entrar a Abonado o Completo; sin % del programa no se puede entrar a venta (ADR 0115 N6, ticket 356). Por closer va al dueño del deal. Una venta vigente nacida en el CRM siempre tiene dueño (la base lo exige, ADR 0122); las 3 ventas históricas migradas de la hoja (Comunicarte, closers que ya no son dueños posibles) quedan sin dueño a propósito y caen en «Sin closer» | USD | no | `comisionDeDeal` y `comisionesPorCloser` en `lib/queries/comision.ts` | ✅ |
| Entró a caja | Σ abonos vigentes con fecha en el periodo (§1.5), de cualquier venta y también los adicionales, por moneda y sin convertir. Contesta «¿cuánta plata entró esta semana?»; no se infiere de las ventas ni al revés (ADR 0013). Su lista rotula la columna «Abono» | USD · COP | sí | `filtroCaja` (`lib/queries/metricas-filtros.ts`), `cajaRecaudada` | ✅ |
| Saldo de un deal | contratado − abonado; negativo es sobrepago, no deuda | USD | · | `saldosDeDeals`, `saldoLegible` | ✅ |
| Meta del mes, de la semana y de la cohorte | cupos de la cohorte repartidos por días hábiles (020, 146) | cupos | no | `lib/queries/metas.ts` | ✅ |
| Meta en USD del mes y de la cohorte | meta de cupos × precio de la cohorte (la del mes, por cohorte y sumada; la de la cohorte, entera) (371) | USD | no | `armarMetasDelMes` (mes), `armarVamosALlegar` (cohorte) | ✅ |
| "¿Vamos a llegar?": llevamos, meta, %, faltan, esperado a hoy, por día hábil que queda y proyección, de mes y cohorte × cupos y USD | llevamos = venta (§1.4) del mes o de la cohorte, en cupos o en Vendido (`dineroDeVentas`); esperado = `esperadoLineal`; por día hábil = `metaDeHoy` (meta de apertura, 352); proyección = `leerProyeccion`, y la de USD valora los cupos que faltan al precio de la cohorte. No lee ningún filtro y la meta no se reparte por closer (ADR 0023) | cupos y USD | no | `lib/queries/vamos-a-llegar.ts` (`leerVamosALlegar`) | ✅ |
| Esperado a hoy | lo que el objetivo pedía haber vendido al cierre de hoy: el objetivo repartido por igual entre los días hábiles de la ventana, por los hábiles transcurridos; antes del inicio es 0 y pasado el cierre es el objetivo entero (352, R-09) | cupos | no | `esperadoLineal` en `lib/dias-habiles.ts` | ⏳ 403 (sin ficha: sale de un objetivo) |
| Por día hábil | lo que falta al abrir hoy, repartido entre los días hábiles que quedan contando hoy; las ventas de hoy no se descuentan (352, DA-5); pasado el cierre da el faltante entero | cupos | no | `metaDeHoy` en `lib/dias-habiles.ts` | ⏳ 403 |
| Leads que hacen falta (por día) | agendas por día que exige el objetivo, hacia atrás con las tasas medidas hoy (Cierre de ventas, Asistencia y la conversión de leads a cita), ÷ esa conversión; se calcula, no se escribe. Con una muestra menor a «Mínimo para confiar en una tasa» no se usa y da `—` con su razón (N3) | leads por día | no | `leerProyeccion` en `lib/queries/proyeccion.ts` | ⏳ 403 |
| Objetivo de la cohorte | cupos que la empresa quiere vender en toda la cohorte; lo escribe una persona en la Configuración de Hoy (`cohorts.meta_cupos`), nadie lo calcula; no se reparte entre closers (ADR 0023) | cupos | no | `leerCohortesYVentas` en `lib/queries/metas.ts` | ⏳ 403 |
| Objetivo del mes | la parte del objetivo de cada cohorte que cae en el mes, por días hábiles, sumada entre las cohortes del programa (020, 146) | cupos | no | `armarMetasDelMes` en `lib/queries/metas.ts` | ⏳ 403 |
| Objetivo de la semana | la parte del objetivo del mes que toca vender de lunes a domingo, con la compensación de lo que falte de semanas anteriores | cupos | no | `armarMetasDelMes` en `lib/queries/metas.ts` | ⏳ 403 |
| Días para medir el ritmo | ajuste de pantalla, no una cifra: cuántos días hábiles hacia atrás se miran para medir el ritmo de venta y de conversión; 5, 10 o 20 (por defecto 10); un valor fuera de esas opciones vuelve al de por defecto, nunca falla | días hábiles | no | `ventanaRitmoDeUrl` en `lib/queries/proyeccion.ts` | ⏳ 403 |
| Mínimo para confiar en una tasa | ajuste del programa (`programs.muestra_minima_conversion`, 20 por defecto): con menos personas con cita atendida o no asistida no se usa una tasa medida para proyectar | personas | no | `MUESTRA_MINIMA_CONVERSION` y `alcanzaMuestra` en `lib/queries/proyeccion.ts` | ⏳ 403 |

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
| Gasto | Σ gasto de las cuentas del programa (§1.6 y §1.7), convertido con la TRM del día (§1.8) por **un solo convertidor**: semáforo a COP, ROAS a USD. Un día sin TRM no suma y se avisa; una moneda que no es COP ni USD es error, nunca 0. Su cobertura (primer y último día con gasto en `gasto_pauta`, días sin fila) la da `coberturaDeGasto`; el día en curso sale de las fotos solo en el semáforo, en el ROAS se dice | COP o USD | sí | `convertirGasto` en `lib/pauta/convertir-gasto.ts`; `coberturaDeGasto` en `lib/pauta/cobertura-de-gasto.ts` | ✅ |
| Costo por agenda del semáforo | gasto de agenda ÷ agendas **según Meta** de esas campañas (§3.3; ADR 0088, enmienda del 16-oct). Lo ven el reporte por WhatsApp y Programa › General. **Con cobertura (ADR 0115 N3, 351):** devuelve `costoCobertura` (`RazonConCobertura`); en una ventana, los días fuera del gasto cargado van en `faltan` y el costo es `null` con el motivo ("Gasto de Meta desde el …"). El día en curso, desde las fotos, cuenta como cubierto | COP | no | `costoPorAgenda`, `costoPorAgendaDeVentana` en `lib/semaforo/costo-por-agenda.ts` | ✅ |
| Costo por agenda del Hub | gasto de campañas con propósito `agenda` (D-2; la campaña sin propósito va aparte en "Otras campañas" y no entra) ÷ agendas **del CRM** de área Paid, **la misma cifra que pinta la celda "Agendadas"** (`agendasDePauta`, con la misma cohorte; el denominador no se vuelve a contar). Sin gasto de agenda el costo es "—" con motivo (`razonDeCosto`, `lib/cobertura.ts`), nunca COP 0 (§1.2, §2; ADR 0088 punto 1). Un día sin fila de gasto entre el primero y el último cargado no cuenta como cubierto (`diaCubierto`). Con cobertura (N3). Devuelve también el gasto total y "Otras campañas" (total − agenda − lanzamiento) | COP | no | `costoPorAgendaDelCrm` en `lib/queries/hechos/costo-agenda-crm.ts` (envuelve `costoPorAgendaDeVentana`) | ✅ 412 |
| CPL de lanzamiento | semáforo: gasto de campañas de lanzamiento ÷ registros según Meta (`complete_registration`) | COP | no | `costoPorAgenda` en `lib/semaforo/costo-por-agenda.ts` | ✅ |
| Agendas según Meta | §1.9 | agendas | sí | ídem | ✅ |
| Diferencia Meta contra CRM | (según Meta − CRM) ÷ CRM, por campaña y semana cerrada | % | no | 249 | 🟡 |
| CPL | gasto de Paid ÷ registros de Paid | COP | no | 123 | 🟡 |
| Costo por venta (CAC) | gasto de Paid ÷ ventas de Paid | COP | no | 123 | 🟡 |
| ROAS | valor vendido de las ventas de Paid (USD) ÷ gasto en USD (cada día con su TRM). **UNA ancla por paso (355):** registro = el día del envío; agenda, show y no show = la cita de los envíos de esa cohorte; **venta = la cohorte de registro, el día del envío que trajo a la persona** (`fecha_envio` si existe y, en un parcial, `created_at`), aunque compre semanas después; no la fecha de venta. **Tabla semanal (D-B, ADR 0063 enmienda 10-nov):** la misma ancla: la semana es la del envío, no la de la venta; es el único ROAS de la pestaña Pauta. **Con cobertura (ADR 0115 N3, 351):** cada renglón devuelve `roas: RazonConCobertura`; base = ventas cuyo día de registro tiene gasto cargado, faltan = las que caen fuera, y con alguna fuera el ROAS es `null` (“—”) con el motivo (“Gasto de Meta desde el …”), nunca un número a medias. **Reconciliación con Comercial (355):** la tabla muestra "Ventas del periodo sin envío de pauta de origen o de registros de otro periodo" = ventas vigentes del periodo por su fecha (`ventasConDiaEn`) menos las atribuidas por cohorte; nunca se esconde. **Madurez en la cobertura (AJUSTE 3-nov, 355):** la `RazonConCobertura` del ROAS trae `agendasPendientes` = citas `agendada` con hora futura de deals ABIERTOS sin venta (`citaPorVenirDeDealAbierto`, `resultados-de-llamada.ts`; una cita futura de un deal ya vendido o cerrado no cuenta); con alguna, `estadoDeCobertura` da `parcial` y la tarjeta (`CifraDeRazon`) y `pauta_roas` del MCP dicen lo mismo («parcial: N agendas pendientes»); se muestra, no se bloquea. **Por canal el gasto y el ROAS son no disponibles** (`gastoUsd` `null`, motivo «Meta da el gasto por anuncio, no por canal»), nunca 0. El parcial se pliega en su completo por `(source_id, token)`. La atribución toma anuncio, si no conjunto, si no campaña de Meta; solo lo que no resuelve campaña queda en “Sin campaña de Meta”. El gasto convertido viene de `gastoConvertido` (`hechos/gasto.ts`) | razón | no | `diaDelEnvio` y `cargarRoasDePauta` en `lib/queries/roas-de-pauta.ts` · 123, 350, 355 | ✅ |
| Profit | Vendido de Paid menos el gasto total de Paid. Vendido sale de `valoresVendidosDeDeals` sobre las ventas de la **cohorte de registro** de Paid (misma ancla que el ROAS, D-B: semana del envío); el gasto se convierte a USD por día. Si falta TRM o valor vendido, no se calcula. Fecha: día del envío y día del gasto, Bogotá. Verificar: Vendido de la cohorte − gasto USD del mismo rango | USD | no | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` | ✅ |
| Show, cierre de ventas y de cita a venta de la tabla semanal de Pauta | **Es `grupoDeCitas` restringido a los deals con cita de área Paid** (D-A, ADR 0079 enmienda 10-nov): la misma cohorte de citas, sin reagendadas, cortesías ni anulados, con las citas sin marcar aparte como cobertura («parcial, N sin marcar») y su lista (ADR 0067). Nunca `shows ÷ citas` sueltos ni ventas de una semana sobre shows de otra. Rótulos (D-C): «% de show por cita» solo para la pregunta por cita; «Asistencia» por deal; «De cita a venta»; bloque con subtítulo «solo Paid» | % + cobertura | no | `grupoDeCitas` en `lib/queries/tasas-del-grupo.ts` · 403 F3 bis | 🟡 403 |
| Inversión de la tabla semanal | gasto de Meta de la semana en COP. Una semana sin gasto cargado (antes de la primera fila de `gasto_pauta`, o un día sin fila) muestra **«—» con «Gasto de Meta desde el …»**, igual que Profit y CPM; 0 solo cuando el gasto cargado sumó cero (D-E, ADR 0115 enmienda 10-nov; N3, N5) | COP | sí | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` · 403 F3 bis | 🟡 403 |
| Retorno de caja de la semana | vendido de las ventas con **fecha de venta** en la semana ÷ gasto de la semana. Cifra aparte, con otro nombre, para quien pregunte «¿esta semana vendimos más de lo que gastamos?»; **no es el ROAS** (D-B, ADR 0063 enmienda 10-nov). No se construye hasta que alguien la pida | razón | no | por definir | 🟡 |
| CPM | Gasto COP de las filas que tienen impresiones ÷ suma de impresiones × 1.000. Nunca promedia CPM diarios; una fila nula da cobertura parcial y todas nulas dan «—». Fecha: `gasto_pauta.fecha`, Bogotá. Verificar contra la suma de gasto e impresiones de Meta del rango | COP | no | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` | ✅ |
| CTR | Σ `gasto_pauta.clics_enlace` ÷ Σ impresiones de las mismas filas. Nunca promedia porcentajes; parcial si Meta omitió parte de las filas. Fecha: `gasto_pauta.fecha`, Bogotá. Verificar contra los totales de clics e impresiones de Meta | porcentaje | no | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` | ✅ |
| Llegada a la landing | Σ `gasto_pauta.vistas_landing` ÷ Σ clics al enlace de las mismas filas. Nunca promedia porcentajes; parcial si Meta omitió parte de las filas. Fecha: `gasto_pauta.fecha`, Bogotá. Verificar contra los totales de Meta | porcentaje | no | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` | ✅ |
| Conversión de la landing | Registros completos de Paid del CRM (`hechos/envio`) ÷ Σ `gasto_pauta.vistas_landing`. Los registros se anclan al día del envío y la vista al día de gasto; Total y semana recalculan la razón. Verificar contra registros Paid y vistas de Meta del mismo rango | porcentaje | no | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` | ✅ |
| Frecuencia | Σ impresiones ÷ alcance cuando el rango es un solo día. Para más de un día devuelve «—» porque el alcance no es aditivo; una cobertura parcial de Meta se declara. Fecha: `gasto_pauta.fecha`, Bogotá. Verificar contra impresiones y alcance diarios de Meta | razón | no | `cargarPautaSemanal` en `lib/queries/hechos/pauta-semanal.ts` | ✅ |
| Citas pendientes del rango | las citas **por venir** (`agendada`, hora posterior al corte) de deals ABIERTOS sin venta de los envíos de Paid del periodo: las mismas que ya marcan «parcial: N agendas pendientes» en el ROAS (`citaPorVenirDeDealAbierto`, 355). **No incluye** las pasadas sin marcar (esas son «Cita pasada sin resultado», §3.1). Se abre con su lista (paso `pendiente` de `pauta_meta`, la misma consulta que la cifra) y se avisa: «Faltan N citas de estos envíos (la última el …): el ROAS de hoy todavía puede subir» | citas | sí | `citasPendientesDeLaVista` en `lib/queries/proyeccion-roas.ts` · 375 | ✅ |
| ROAS proyectado | (Vendido a hoy + Σ por cita pendiente de **prob. de show × prob. de cierre × precio de la cohorte del deal**) ÷ gasto en USD. Las probabilidades son **por closer dueño de la cita**, de las últimas `SEMANAS_DE_MUESTRA` (3) semanas (`grupoDeCitas`): show = personas con show ÷ personas con cita, cierre = vendidas ÷ con show. Un closer con menos de `programs.muestra_minima_conversion` personas con cita usa la tasa del programa y la pantalla lo dice; si el programa tampoco llega, **«—» con motivo**. Con gasto no completo (la cobertura del ROAS a hoy es `null`), o una cita de una persona sin cohorte, también «—» con su motivo (N3). USD, un programa (nunca cruza). **Se guarda y se confirma:** un cron diario (`/api/cron/proyeccion-roas`, 30 min después del de pauta) guarda UNA fila por programa y día (`proyecciones_roas`, periodo = mes en curso de Bogotá hasta ese día) y **nunca reescribe lo proyectado**; cuando la última cita pendiente tiene resultado (`reagendada` espera), recalcula el MISMO rango y guarda el ROAS real: «Proyectado el 6-nov: 2,4× · Real: 2,1×» | razón | no | `calcularProyeccionDeRoas`, `proyectarRoas`, `guardarProyeccionDelDia`, `confirmarProyecciones` y `proyeccionesConfirmadas` en `lib/queries/proyeccion-roas.ts` · 375 | ✅ |
| Nivel de la traza | **por envío, no por venta**: el id más profundo del envío que resuelve en el árbol: anuncio (N3), conjunto o campaña (N2), solo área (N1), sin UTM (N0). La distribución es sobre los envíos Paid del rango (§2, Traza Paid). Una traza por venta no existe | % | no | `emparejar` en `lib/atribucion/emparejar.ts`, `origenDelPrograma` · 247 | ✅ |

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
   creadas ese día, hasta el momento del cálculo, de área **Paid** (§2), para detectar diferencias. El costo por agenda
   del Hub, sin construir (249), usará como denominador las agendas del CRM (ADR 0088 punto 1 y enmienda del 16-oct).
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
- **Funciones:** `semaforoDelPrograma` en `lib/semaforo/semaforo.ts`; el texto, `armarMensajeDeLaHora` en
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
| Leads requeridos por día | agendas requeridas ÷ (agendas ÷ registros) de la misma ventana, ambos del programa entero (`calcularProyeccion`, C-18) | leads/día | ✅ 253 |
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
  reporte: "Agendas reales" eran las citas vivas que caían ese día). Las canceladas aparecen aparte.
- **D2, % de show.** Por deal (ADR 0079), dicho en la tarjeta: "X de Y deals con cita ocurrida · N reagendadas (no
  cuentan)". Las citas pasadas que siguen `agendada` se muestran como pendientes con su lista y no entran a la
  tasa hasta registrar el resultado. ~~No hay una segunda fórmula por cita.~~ **Enmendada el 24-oct (Mani, 299):** al
  lado del % por deal, Hub › Hoy muestra el % de show por cita (§3.1, `showPorCitaDelRango`), que es otra pregunta.
- **DA-3 (Mani, 7-nov), cierra D2 y 299:** el «%» de show de Hoy es **por deal**, con la cita en «Cómo se calcula». **DA-4 (Mani, 7-nov):** la agenda es la cita creada en el CRM (la reagenda cuenta como otra); la de Meta se muestra aparte y la pantalla explica que pueden diferir.
- **D3, leads.** Registros del día (§1.1, envíos completos, igual a Typeform) sin meta hasta el 253: excepción
  temporal al ADR 0086 punto 3, que el 253 cierra. Una persona que aplica dos veces son dos registros.
- **D4, caja.** Por moneda, partida en ventas de hoy y ventas anteriores; los nombres están en la lista de la cifra.
- **Objetivo del día** (antes "Meta del día"). Lo que faltaba **al abrir hoy** (meta menos lo vendido hasta ayer) ÷ días hábiles de venta que
  quedan contando hoy (`metaDeHoy`). **No descuenta las ventas de hoy** (DA-5, Mani, 3-nov, que reemplaza la regla
  anterior): si las descontara, vender 4 contra una meta de 2 daba un cumplimiento de 333 %. El último día hábil
  da el faltante entero, y es la misma cifra que "ventas requeridas por día" de la Proyección. La meta de hoy de
  la semana (`porDia`) usa el mismo borde. La proyección a futuro (ritmo y reparto semanal) sigue contando desde mañana.

**Cada fila del reporte (15-sep y 9-sep) contra Hoy:**

| Fila del reporte | En Hoy | Función | Fecha | Universo |
|---|---|---|---|---|
| Semana día X de 5 · mes día X de N hábiles · corte día X de N | Línea de contexto | `contextoDelDia` | el día | lunes a viernes; la cohorte, de su ventana de ventas |
| Cupos del día: objetivo, llevamos, avance | Cupos › Hoy | `horizontesDeCupos` (meta: `vistaDeCohorteActiva`) | venta (§1.4) | meta dinámica de la cohorte activa; real = ventas del día |
| Leads del día: objetivo, real, cumplimiento | Leads de hoy contra Objetivo de leads | `leadsDelRango` sobre `filtroLeads` | primera aplicación | personas distintas del programa cuya primera aplicación cae ese día |
| Agendas reales | Citas de hoy + Canceladas aparte | `embudoDelRango.agendas`, `canceladas` | cita (§1.3) | llamadas vigentes con cita ese día; Citas excluye canceladas |
| (no estaba) | Agendas creadas hoy | `agrupar` de `hechos/agenda.ts` | creación (§1.2) | llamadas vigentes creadas ese día |
| Llamadas realizadas | Realizadas (show) | `embudoDelRango.llamadasConShow` | cita | citas del día con resultado que ocurrió |
| Show | % de show por deal | `grupoDeCitas` | cita | deals con cita ya ocurrida y resultado; la reagendada y la pendiente de resultado no cuentan |
| Ventas · % de cierre | Ventas de hoy · % de cierre | `ventasDelRango`, `grupoDeCitas` | venta | ADR 0079 |
| Tabla por closer | Hoy por closer | `embudoPorCloser` | cita / venta | cada deal en quien tomó su último show |
| Caja del día y de dónde viene | Caja de hoy | `cajaDelDiaPorOrigen` | abono (§1.5) | abonos vigentes por moneda |
| Semana: meta, meta a la fecha, real | Cupos › Semana | `leerMetasDelMes` (compensación semanal, 146) | venta | ventas de la semana hasta el día |
| El corte: meta, vendidos, faltan, cumplimiento lineal | Cupos › Cohorte | `vistaDeCohorteActiva` | venta | ventas de la cohorte hasta el día |
| El mes: leads, cupos, cumplimiento lineal | Cupos › Mes y metas del mes | `leerMetasDelMes` | venta | ventas del mes hasta el día; los leads del mes, 253 |

**Hoy como el reporte diario (373, plantilla v5 del 15-sep; `lib/queries/reporte-diario.ts`).** Hoy se ordena con los
números de sección de la plantilla (1 El día, 3 La semana, 4 y 5 El corte y el mes; la 2, masivos, y la 6, planes de
acción, no se dibujan: fase 2) y se descarga en PDF con la hoja de impresión del navegador. `?fecha=` elige el día de
Bogotá (hoy por defecto; una fecha futura o mal escrita se rechaza y se muestra hoy). Cada sección dice su fuente al
pie. No agrega ninguna cifra a la tabla de arriba, salvo estas:

| Cifra | Cuenta | Función |
|---|---|---|
| Cómo nació la venta | por cada venta del día: **agenda del día** si el deal tuvo una llamada que ocurrió (show, compromiso de pago, cerrada o perdida) el mismo día de Bogotá de la venta; **seguimiento** si su último show fue un día anterior; **sin llamada** si ninguno hasta ese día. Un show posterior a la venta no la explica | `comoNacioLaVenta` |
| Desglose de la caja del día | cada abono vigente de la caja con su venta de origen: venta nueva del día, saldo de una venta anterior (con el día y el closer de esa venta: no suma un cupo nuevo) o abono adicional (1:1). Las partes suman la misma caja de Dinero | `desgloseDeCaja` |
| Qué pasó con cada agenda | las citas del día por closer y resultado: cierre, show sin cierre, compromiso de pago, no-show, reagendada, perdida (con su motivo) y pendiente; las canceladas aparte | `resultadosPorCloser` |
| Envíos del día de pauta | envíos del día en el área Paid (`resolverCanal`); la ficha Objetivo de leads usa Leads del día (personas) | `agruparEnvios` por área; `leadsDelRango` para la ficha |
| Día y semana: meta de leads y show | la **meta de leads** es siempre `cohorts.meta_leads_dia`, decidida por `metaDeLeads`; en la semana se multiplica por los hábiles. No se sustituye por el requerido calculado | `metaDeLeads`, `armarReporteDiario` |
| Total de todos los programas | solo conteos y caja por moneda; el tipo no tiene un campo de tasa (ADR 0048) | `totalDeConteos` |
| Necesarios para llegar; leads por día hábil | lo requerido para cumplir la meta de cupos: ventas por día ÷ conversión agenda→venta declarada, o ÷ cierre ÷ show, y luego ÷ agenda por lead. Muestra origen, cohorte, muestra, maduración y pendientes; no es una meta declarada | `leerProyeccion` | día hábil | 253, aclarado en 378 |
| Cómo nació cada cupo (agenda del día, follow-up) | fuera de Hoy hasta tener una métrica | · | · | 🟡 254 |
| Planes de acción | fuera de Hoy hasta tener datos | · | · | 🟡 257 |
| Masivos, cola y respuestas de Kapso | fuera | · | · | H-9: no viven en el CRM |
| El texto por closer ("9 agendas: 1 cierre, 2 no-show...") | la lista de cada cifra | · | · | fuera del 299 |

**Lo que no viaja en el tiempo:** las banderas (llamadas pasadas sin resultado, atendidos sin valor, sin Grain)
son una foto de ahora (la **cartera vencida** también, §3.6: existe aparte de Por cobrar, que no mira fechas y sigue los filtros); qué cohorte está activa también se lee de ahora.

### 3.6 Métricas operativas fuera del Hub (398, H-28)

> Cifras que las pantallas de Programa, Mi espacio y el MCP ya muestran y que el diccionario no definía. Cada fila se
> comprobó contra el código el 7-nov. **El rótulo visible lo fija el glosario del ticket 397**: aquí va el nombre que hoy
> usa el código. «Retiro» marca lo que otro ticket decide quitar o unir.

| Métrica (nombre en el código) | Qué cuenta | Unidad | ¿Se suma? | Función | Estado |
|---|---|---|---|---|---|
| Cartera vencida | deals vigentes en **Abonado** con saldo > 0 cuya fecha límite de pago ya pasó (estrictamente anterior a hoy, Bogotá). Fecha efectiva = `fecha_limite_pago` del deal; sin ella, el inicio de clases de su cohorte o de la activa; sin ninguna, se cuenta aparte en `sinFechaDeReferencia`. El saldo sale de `saldosDeDeals`. **No es Por cobrar** (§3.1): Por cobrar suma el saldo de las ventas del periodo sin mirar fechas; la cartera vencida es una lista con fecha, foto de hoy (ADR 0053) | deals y USD/COP | no: por programa | `carteraVencida` en `lib/queries/cartera.ts:55` (la usan Students, Kanban, Inbox, notificaciones y la tool `cartera_vencida` del MCP) | ✅ |
| Students (lista) | deals en etapa vendida (`etapaVendida()`, la misma de una venta) con su saldo, acuerdo de pago, si están vencidos y su onboarding; filtros por cohorte, closer, búsqueda y onboarding | estudiantes | no | `estudiantesDe` en `lib/queries/estudiantes.ts:36`, `studentsDelPrograma` | ✅ |
| Students (totales) | sobre las **mismas filas ya filtradas**: Σ abonado y Σ saldo > 0 por moneda, y cuántos no tienen valor vendido; no consulta ni recalcula saldos | USD · COP por moneda | no | `totalesDeStudents` en `lib/queries/estudiantes-totales.ts:20` | ✅ |
| Cortesías | deals del programa marcados `cortesia` que entran al rango; **no son ventas** ni entran al grupo de citas ni a las banderas (llevan valor 0) | deals | sí | `contarCortesias` (`lib/queries/dashboard.ts:211`) sobre `filtroCortesias` (`metricas-filtros.ts:301`) | ✅ |
| Descuento promedio | por venta, ticket de la cohorte − valor vendido (en USD y en %), y su promedio simple en el rango; una venta sin ticket o sin valor no entra | USD y % | no (el % nunca) | `descuentoDeDeal` en `lib/queries/saldo.ts:72`; promedio en `lib/queries/vista-dashboard.ts:299` | ✅ |
| Perdidos por motivo | deals que **hoy** están en Cierre Perdido, cerrados en el rango, agrupados por el motivo (catálogo `motivos`); anulados fuera (ADR 0038). Un deal sin motivo no aparece | deals | sí por motivo; no entre programas con catálogos distintos | `embudoPorEtapas` (campo `motivosDePerdida`) en `lib/queries/embudo-etapas.ts` (la consulta aparte del Dashboard se retiró en el 361) | vigente |
| Ventas por cohorte | las ventas del rango (§1.4) agrupadas por la cohorte del deal, con su contratado y las tres cifras del dinero (369); incluye las de cohortes que aún no inician clases y las «sin cohorte» | ventas y USD | sí | `ventasPorCohorte` en `lib/queries/dashboard.ts:300` | ✅ |
| Banderas del pulso: atendido sin valor | sobre los deals **atendidos** (Atendido, Compromiso verbal, Ganado parcial o Completo; sin cortesías), los que están en una etapa que exige el valor vendido y lo tienen en 0 o nulo; % sobre los atendidos. **Foto de hoy**: el periodo no la acota | deals y % | sí (el % no) | `sinValorVendido`, `filtroAtendidos`, `banderasDelPulso` en `lib/queries/banderas-del-pulso.ts:29,47,76`; su lista, `metricas-con-filas.ts` | ✅ |
| Banderas del pulso: atendido sin Grain | los mismos atendidos con al menos una llamada vigente atendida sin enlace de grabación (ADR 0066); foto de hoy | deals y % | sí (el % no) | `conLlamadaSinGrain` (`banderas-del-pulso.ts:55`) y `esAtendidaSinGrain` (`lib/queries/sin-grain.ts:31`) | ✅ |
| Banderas del pulso: Cierre perdido con pagos registrados (405) | deals **no anulados en Cierre perdido** del programa que conservan al menos un **abono vigente** (un abono anulado no cuenta). Es una **inconsistencia de datos** (plata cobrada sobre una venta perdida), no un caso de negocio; hoy son 0 y la bandera existe para que, si aparece uno, se vea. Foto de hoy, sin porcentaje (no hay denominador natural). Con 0 se muestra el 0, no un vacío | deals | sí (el conteo) | `filtroPerdidosConPagos`, `conAbonoVigente` y `banderasDelPulso` en `lib/queries/banderas-del-pulso.ts`; su lista, `perdidos_con_pagos` en `metricas-con-filas.ts` | ✅ |
| Alertas de cohorte (por persistencia) | por umbral activo del programa, la **racha** de días hábiles cerrados seguidos con cumplimiento (vendido hasta ese día ÷ esperado lineal) por debajo del `aceptable`; se dispara cuando la racha llega a `diasSeguidos`. Hoy no cuenta, un día sin esperado corta la racha, se calcula al leer (ticket 147) | racha y días | no | `alertasDelPrograma` y `evaluarAlerta` en `lib/queries/alertas.ts:119,96` | ✅ |
| Embudo por pregunta | por pregunta de cada formulario de Typeform, cuántas personas llegaron y se salieron, **leído en vivo** de la API de Insights con el token de la fuente y con caché de 5 minutos; no guarda nada y no pasa por la base (ticket 126 B) | personas | no | `embudoPorPregunta` en `lib/queries/embudo-por-pregunta.ts:38` | ✅ |
| Próxima cohorte (cola) | deals que esperan cohorte: «sin asignar» o «asignada» a una próxima, con desde cuándo esperan. La fecha de espera se deriva hoy del texto `Esperando corte: …` de `deal_actividades.nota` (frágil, F3 de la auditoría) | deals | no | `dealsDeProximaCohorte` en `lib/queries/proxima-cohorte.ts:27` | ✅ · retiro de la derivación por texto pendiente (F3) |
| Potencial y Confirmado del tablero | por columna del Kanban: **Potencial** = Σ del precio de sus tarjetas (el del saldo del deal o, sin él, el de la cohorte; `kanban.ts:480`); **Confirmado** = Σ lo abonado, solo en las etapas donde se abona (en el resto, `null`) | USD | no | `confirmadoDeColumna` y `potencialUsd` en `lib/queries/kanban.ts:116-141` | ✅ |
| Inbox: llamadas sin resultado, sueltas, sin closer, perdidos en Calendly y «lo mío que necesita atención» | cinco listas **de ahora**, no siguen el periodo: citas pasadas sin resultado (`citaVencidaSinResultado`, excluye negocios cerrados), citas de Calendly sin deal, citas cuyo anfitrión no tiene cuenta, registros High parciales sin dueño tras `MINUTOS_PERDIDO_EN_CALENDLY` (5) y deals con motivo (`MotivoAtencion`: reagenda sin fecha, compromiso vencido, pago vencido, abono sin comprobante, reenvío sin atender, link sin cita, próximo contacto vencido, estancado) | filas | no | `inboxDelPrograma` (`lib/queries/inbox.ts:258`), `llamadasSueltasDelPrograma` (`:390`), `llamadasSinCloserDelPrograma` (`:336`), `perdidosEnCalendly` (`:181`) | ✅ |
| Bandeja | los pendientes del día de quien la pide, según su rol, para el MCP y Mi espacio | filas | no | `bandejaParaActor` en `lib/queries/operacion.ts:58` | ✅ |
| Leads (lista del programa) | personas `(programa, correo)` con filtros por calidad, closer, fuente y duplicado; **no es «Leads» del Hub** (que cuenta personas nuevas del rango, §1.1/N1): es el universo completo del programa | personas | no | `lib/queries/leads.ts` (`CALIDADES_DE_LEAD` `:55`) | ✅ · nombre visible: lo fija el 397 |
| Calidad del lead | el `lead_quality` que mandó el formulario, **tal como llegó** (High, Mid, Low o «sin calidad»); filtro de Leads y dimensión de la escalera. **Es texto copiado de la fuente**: el único valor que el código lee es `High`, y solo en la frontera de abajo | texto | no | `esCalidadAlta` en `lib/ingesta/etapa-de-entrada.ts:52`; filtro en `lib/queries/leads.ts:137`; escalera `escalera.ts:298` | ✅ |
| Posibles duplicados | contactos cuyo correo entró por teléfono y nadie confirmó (ADR 0035), con el teléfono en común; el closer ve solo los de sus deals abiertos | contactos | no | `PosibleDuplicado` y `DUPLICADOS_POR_PAGINA` en `lib/queries/leads.ts:376-392`; el aviso entre programas, `otrosProgramasDelCorreo` (`lib/queries/otros-programas-del-correo.ts:35`), **no entra en ninguna métrica** | ✅ |
| Reagendadas | citas del rango con resultado `reagendada`; se muestran aparte (no cuentan en el grupo de tasas: la representa la nueva) | citas | sí | `reagendadas` en `embudoDelRango` (`lib/queries/dashboard.ts:123-126,405`) | ✅ |
| Origen del cierre (cómo nació la venta) | por venta del día: agenda del día, seguimiento o sin llamada (§3.5). La versión de §3.4 por periodo sigue 🟡 254 | ventas | sí | `comoNacioLaVenta` (`lib/queries/reporte-diario.ts`) | ✅ en Hoy · 🟡 254 para el periodo |
| Meta CAPI (salud del envío de eventos) | de los **últimos 7 días**, eventos del programa por estado (`enviado`, `fallido`, `vencido`, `omitido`) y cuántos enviados llevaron `fbc`; es monitoreo de la integración, no una métrica de negocio | eventos | no | `resumenMetaCapi` en `lib/meta-capi/resumen.ts:14` | ✅ |
| Nerd Stats | conteos de control del developer: personas, llamadas, ventas y abonos por programa y por origen, últimos cambios, usuarios activos por rol y salud de las fuentes. No es una métrica de negocio y no se cita como cifra | conteos | no | `conteosPorPrograma` y `fuentesConSalud` en `lib/queries/nerd-stats.ts:36,198` | ✅ |

**Constantes de método** (cada una con su override si lo tiene): `UMBRAL_SIN_MARCAR = 0.1` y `DIAS_PARA_MADURAR = 30` en
`lib/queries/tasas-del-grupo.ts` (el segundo con `diasParaMadurarDe` por programa), `MUESTRA_MINIMA_CONVERSION = 20` en
`lib/queries/proyeccion.ts` (con override por programa).

**Frontera de `lead_quality`.** `lead_quality` es **texto del formulario** y se guarda como llegó (ADR 0004). El código decide
con un solo valor, `High` (sin mayúsculas ni espacios): `esCalidadAlta` (`lib/ingesta/etapa-de-entrada.ts:52`) manda un envío
completo a Calificado y a un parcial a Potencial; `perdidosEnCalendly` (`lib/queries/inbox.ts:213`) reescribe el mismo
`lower(trim(…)) = 'high'` en SQL; `llegoAlCalendly` (§3.1) lo cuenta; y el adaptador de Dapta lo **escribe**
(`adaptador-dapta.ts:110-124`: `High` o `Low`). Es una constante de frontera, no un enum: un formulario que cambie la etiqueta
manda a todos a Registrado sin error, y por eso existe la alarma «sin calidad» de `salud-fuentes.ts`. Las dos lecturas de `High`
(TypeScript y SQL) tienen que cambiar juntas.

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
