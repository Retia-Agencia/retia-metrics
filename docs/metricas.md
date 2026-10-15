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

## 1. Los hechos: lo que se cuenta

Todas las métricas son conteos o sumas sobre estos hechos. Cada hecho tiene su módulo en `lib/queries/hechos/`,
que agrupa, filtra y lista con la **misma** consulta: la lista detrás de una cifra es la misma consulta sin agrupar.

### 1.1 Envío (registro)

- **Tabla:** `submissions`, unida a `sources` (la fuente dice el programa).
- **Cuenta:** envíos **completos** (`es_parcial = false`) de las fuentes del programa.
- **Fecha:** `submissions.fecha_envio`, en Bogotá.
- **Función:** `lib/queries/hechos/envio.ts` (`agrupar`, `listar`).
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
- **Cuenta:** abonos vigentes del programa.
- **Fecha:** `abonos.fecha` (la fecha del pago, no la del registro).
- **Moneda:** USD.
- **Función:** `lib/queries/hechos/abono.ts`; lo abonado y el saldo de un deal, en `lib/queries/saldo.ts`.
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

## 3. Métricas

Leyenda de estado: ✅ en producción · 🟡 definida, sin construir (con su ticket).

### 3.1 Embudo y ventas

| Métrica | Fórmula | Unidad | ¿Se suma entre programas? | Función | Estado |
|---|---|---|---|---|---|
| Registros | envíos completos del rango (§1.1) | personas | sí | `hechos/envio.ts` | ✅ |
| Dejó datos · Llegó al Calendly | embudo del formulario (ADR 0069, ticket 126) | personas | sí | `lib/queries/embudo-formulario.ts` | ✅ |
| Agendas | llamadas vigentes creadas en el rango (§1.2) | agendas | sí | `hechos/agenda.ts` | ✅ |
| Citas · Shows | citas del rango; las que ocurrieron (§1.3) | citas | sí | `hechos/cita.ts` | ✅ |
| % de show | deals del grupo con al menos un show ÷ deals del grupo | % | no | `lib/queries/tasas-del-grupo.ts` | ✅ |
| % de cierre | deals con show que hoy están vendidos ÷ deals con show | % | no | ídem | ✅ |
| Agenda → venta | deals con show vendidos hoy ÷ deals del grupo (= % show × % cierre) | % | no | ídem | ✅ |
| Ventas | deals vendidos en el rango (§1.4) | ventas | sí | `ventasConDiaEn` | ✅ |
| Contratado | Σ `deals.valor_vendido_usd` de las ventas del rango (lo escribe el closer); un deal sin valor se cuenta aparte, no se inventa | USD | sí | `contratadoDeDeals` en `lib/queries/saldo.ts` | ✅ |
| Recaudado | Σ abonos vigentes por su fecha (§1.5) | USD | sí | `hechos/abono.ts` | ✅ |
| Saldo de un deal | contratado − abonado; negativo es sobrepago, no deuda | USD | · | `saldosDeDeals`, `saldoLegible` | ✅ |
| Meta del mes, de la semana y de la cohorte | cupos de la cohorte repartidos por días hábiles (020, 146) | cupos | no | `lib/queries/metas.ts` | ✅ |

**El grupo de citas** (para las tres tasas): los deals vigentes, sin cortesía, con al menos una cita **ya
ocurrida** en el rango (show, no-show, cancelada o sin resultado; la reagendada no, la representa la nueva). Se
cuenta por deal, no por llamada (ADR 0079). Por closer, cada deal va a quien tomó su último show.

### 3.2 Pauta

| Métrica | Fórmula | Unidad | ¿Se suma? | Función | Estado |
|---|---|---|---|---|---|
| Gasto | Σ gasto de las cuentas del programa (§1.6 y §1.7), convertido a COP con la TRM del día (§1.8) | COP | sí | `sumarEnCop` en `lib/semaforo/costo-por-agenda.ts` | ✅ |
| Costo por agenda | gasto ÷ agendas **del CRM** de área Paid (§3.3) | COP | no | `costoPorAgenda`, `costoPorAgendaDeVentana` | ✅ |
| Agendas según Meta | §1.9 | agendas | sí | ídem | ✅ |
| Diferencia Meta contra CRM | (según Meta − CRM) ÷ CRM, por campaña y semana cerrada | % | no | 249 | 🟡 |
| CPL | gasto de Paid ÷ registros de Paid | COP | no | 123 | 🟡 |
| Costo por venta (CAC) | gasto de Paid ÷ ventas de Paid | COP | no | 123 | 🟡 |
| ROAS | contratado de las ventas de Paid (USD) ÷ gasto en USD (cada día con su TRM) | razón | no | 123 | 🟡 |
| Nivel de la traza | el id más profundo del envío que resuelve en el árbol: anuncio (N3), conjunto o campaña (N2), solo área (N1), sin UTM (N0) | % | no | 247 | ✅ |

### 3.3 El costo por agenda, paso a paso

Es la métrica del semáforo por WhatsApp. Para un programa y un día:

1. **Gasto:**
   - Hoy: la última foto de cada campaña hasta el momento del cálculo (§1.7).
   - Un día cerrado: `gasto_pauta` de ese día (§1.6), el de Meta más el manual de área Paid.
   - Entra **todo** el gasto de **todas** las cuentas mapeadas al programa: todas sus campañas, también las de
     registro o interacción. Así lo pidió Pauta el 15-oct (HQ-4: "todas las campañas"), y cada mensaje lo
     recuerda con la nota "El gasto incluye todas las campañas del programa".
   - Lo que viene en USD se pasa a COP con la TRM del día.
2. **Agendas:** las agendas del CRM (§1.2) creadas ese día, hasta el momento del cálculo, de área **Paid** (§2).
3. **Costo = gasto ÷ agendas.** Con 0 agendas no hay costo ("sin dato").
4. **Umbral:** el objetivo "Costo por agenda" (área Total) de la **cohorte activa** del programa, que se carga en
   Programa › Ventas › Objetivos de la cohorte: `meta` y `aceptable` en COP. Lo pueden editar quien administra y
   el paid trafficker (266).
5. **Color** (`lib/semaforo/color.ts`):
   - **Al cierre del día** y para "días seguidos en rojo": contra el umbral. ≤ meta 🟢; ≤ aceptable 🟡; más 🔴.
     Sin agendas pero con gasto 🔴. Sin gasto ni agendas ⚪ ("No hay gasto de pauta hoy").
   - **Durante el día** (los mensajes de cada hora): contra **el día hábil anterior a la misma hora**, no
     contra la meta. La razón (ADR 0089): las agendas llegan con retraso respecto del gasto, así que a media
     mañana casi cualquier día "se ve caro" contra la meta de cierre; comparar contra ayer a la misma hora mide
     si hoy va mejor o peor que un día comparable.
     - 🟢 si hoy cuesta ≤ lo que costaba ayer a esta hora.
     - 🟡 si cuesta más, pero sin pasar de ayer × (aceptable ÷ meta).
     - 🔴 si pasa de eso. Hoy hay agendas y ayer no 🟢; hoy no y ayer sí 🔴; ninguno de los dos ⚪.
   - Sin umbral cargado, cualquier costo por encima del de ayer es 🔴 (no hay franja amarilla).
   - **Ejemplo** (meta 80.000, aceptable 100.000; la franja amarilla es 100.000 ÷ 80.000 = 1,25 veces la referencia):
     - Martes a las 11 h: 360.000 de gasto y 3 agendas = **120.000** por agenda.
     - Miércoles a las 11 h: 330.000 y 3 agendas = **110.000**. Contra el martes (110.000 ≤ 120.000) es 🟢:
       va mejor que un día comparable, aunque contra la meta de cierre sería 🔴.
     - Si el miércoles llevara 390.000 y 3 agendas = 130.000: el tope es 120.000 × 1,25 = 150.000, así que 🟡.
     - Con 600.000 y 3 agendas = 200.000: 🔴.
     - Al cierre (20 h), el mismo miércoles se juzga contra la meta: si cerró en 85.000 por agenda, 🟡.
6. **Días seguidos en rojo:** cuántos días hábiles anteriores cerraron en 🔴 contra el umbral **de hoy** (no el
   que había esos días), hasta 20.
- **Funciones:** `semaforoDelPrograma` en `lib/semaforo/semaforo.ts`; el texto, `armarMensaje` en
  `lib/reporte-whatsapp/mensaje.ts`.
- **Verificar un día cerrado:**
  1. Gasto: en el Ads Manager, el gasto del día de cada cuenta del programa (las USD × TRM del día).
  2. Agendas: la lista de la cifra en Hub › Pauta (cada agenda con su envío de origen y su `utm_medium`).
  3. Dividir y comparar con el mensaje del cierre.

### 3.4 Planeación

| Métrica | Fórmula | Unidad | Estado |
|---|---|---|---|
| Ritmo | ventas por día hábil en la ventana de ritmo (PQ3 abierta: cuál ventana) | ventas/día | 🟡 253 |
| Proyección | vendidos + ritmo × días hábiles que quedan de la cohorte | cupos | 🟡 253 |
| Ventas requeridas por día | faltan ÷ días hábiles que quedan (la meta dinámica, 020) | cupos/día | 🟡 253 |
| Agendas requeridas por día | ventas requeridas ÷ conversión agenda → venta (PQ3) | agendas/día | 🟡 253 |
| Leads requeridos por día | agendas requeridas ÷ (agendas ÷ registros) de la misma ventana | leads/día | 🟡 253 |
| Origen del cierre | por venta: agenda del día, seguimiento o sin llamada | ventas | 🟡 254 |
| Cierre del ciclo | rojos con una acción registrada ÷ rojos, y horas hasta la acción | % | 🟡 261 |

**Propuestas sin decidir (HQ-7 de `docs/hub.md`):** CAC en COP y en USD; los tres grupos del origen del cierre
salen del deal sin pedirle un clic al closer.

## 4. Cuentas de Meta por programa (producción, 15-oct)

Lo que hoy suma el gasto de cada programa (`cuentas_publicitarias`, todas en `America/Bogota`):

| Programa | Cuentas | Moneda |
|---|---|---|
| ComunicArte | Cuenta Publicitaria Milena Morales · Rosario Gomez ADS | COP |
| ComunicArte | Milena \| Retia · Rosario \| Retia | USD |
| Comunícate con Confianza | 567726836094755 | COP |
| Tactical Investor | Tactical Assets SAS | COP |

`[CP] - Milena - [Nas & Be]` (USD) es visible para el usuario de sistema pero **no está mapeada** a ningún
programa. Pauta nombró además las cuentas de **Juan Pablo** y **Francisco**, que el usuario de sistema **no ve**
(no tiene acceso en el Business Manager): su gasto hoy no entra a ninguna cifra.
