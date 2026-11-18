---
id: 419
etapa: hub
serves: "docs/diseno-cifra-y-pauta.md §1, §2, §10 (norte aprobado por Mani el 10-nov: el boceto docs/bocetos/una-forma-de-metrica.html, tal cual) · DM-1, DM-2, DM-9 · anotaciones A-186 a A-190 · structure.md §9 contrato de entendimiento · ADR 0067 · ADR 0115 N3 y N5"
depends: []
status: en curso  # desde el 10-nov: Alejandro, carril P
---

# 419 — La Cifra: una forma de métrica y su explicación, en todo el Hub

## Por qué

Mani aprobó el 10-nov una sola forma de mostrar una métrica: la tarjeta lleva solo lo necesario y **toda cifra se explica al
abrirla** (qué mide, fórmula en bloque con variables, qué es cada número y etiqueta, filtros, evidencia), sin una sola referencia
técnica, porque la leen Gerencia y Pauta. Hoy cada bloque resuelve la cifra, el vacío, la variación y "Cómo se calcula" a su
manera, con texto libre y con dos vocabularios de estado.

## Alcance

1. **Contrato `CifraDeMetrica`** (`docs/diseno-cifra-y-pauta.md` §10), armado en el servidor. Un solo módulo en `lib/` (no en
   `components/`) lo construye a partir de la ficha del concepto y de la consulta.
2. **Ficha con la explicación.** Campos nuevos en `FichaDeMetrica` (`lib/metricas/registro.ts`): `que` (una frase de negocio),
   `formula` (forma: razón, suma, conteo, resta o producto, con sus términos en palabras y `por1000`), `variables` (nombre y
   explicación) y `aliasExcel?`. **Un solo commit toca `registro.ts` y solo agrega los campos** (archivo caliente del 403: avisar
   a esa sesión). El texto de cada concepto está en el diseño §2.1; los de Pauta se llenan aquí, el resto lo completa el 403 F4.
3. **La pieza.** Evolucionar `components/cifra-con-lista.tsx`, `components/como-se-calcula.tsx` (hoy diálogo con texto libre),
   `components/variacion.tsx` y `components/hub/barra-de-avance.tsx`; no crear una segunda versión. Tres tamaños: tarjeta, barra,
   celda (§1.2). Barra con lleno, rayado de atraso y marca rotulada "a hoy N" (§1.1).
4. **La explicación** en un panel lateral (pantalla completa en celular) con las cinco secciones del §2, en ese orden, incluida la
   fórmula como fracción apilada y "Con los números de esta cifra".
5. **Los ocho casos raros** del §1.3, cada uno con su frase.
6. **DM-1:** el semáforo pasa a En meta / En seguimiento / Rezagado (cambia el rótulo, no el cálculo; WhatsApp no cambia).
7. **Guardián** (test): ningún texto de una explicación lleva rutas, `lib/`, `§`, "ADR", "ticket", ids `M\d`, `D-`, `I-`,
   `utm_`, "macro", "periodo A/B". Mordido en los dos sentidos.
8. **structure.md §9:** el contrato de la Cifra y la regla DM-9 escritos con la pieza (ya anotados el 10-nov; ajustar a lo construido).

**Archivos calientes:** `lib/metricas/registro.ts` (del 403), `components/cifra-con-lista.tsx` (14 llamadores),
`components/semaforo/semaforo-del-programa.tsx`.

**Migración:** Ninguna.

## Fuera

Reacomodar Pauta (420), las filas nuevas (414 a 416), los rótulos que dependen de D-C y las fórmulas de D-A/D-B/D-E (403).

## Done cuando

- [x] `CifraDeMetrica` armada en el servidor; la pantalla no calcula nada.
- [x] Ficha con `que`, `formula`, `variables`, `aliasExcel?`; todas las cifras de Pauta con su texto (§2.1). *(17-nov: las 52 fichas de E-1, con `tests/registro-de-metricas.test.ts:118-121`; verificado en verde.)*
- [ ] Tarjeta, barra y celda iguales al boceto en claro, oscuro y 375 px (comparar lado a lado con `docs/bocetos/una-forma-de-metrica.html`).
- [x] Panel con las cinco secciones; foco, Escape y vuelta del foco; la lista completa sabe volver.
- [x] Los ocho casos raros, cada uno con test de su frase.
- [x] Semáforo con el vocabulario único.
- [x] Guardián de texto técnico en verde y mordido.
- [ ] `quick_review` de Rams, `npm run build`, `test:humo` y la pantalla abierta con la consola limpia.

**Casillas de la enmienda del 13-nov** (el detalle de cada una está en "Enmienda del 13-nov", abajo; sin ellas el 419 no es `done`):

- [x] **E-0** Decisiones DC-1 a DC-4 respondidas por Mani y escritas aquí, antes de tocar código. *(13-nov: las cuatro, en "Respondidas por Mani".)*
- [x] **E-1** El texto de toda explicación vive en la ficha (`lib/metricas/registro.ts`); `lib/metricas/explicaciones-de-pauta.ts` borrado; las 52 fichas con `que`, `formula` y `variables`, y un test que falla si una ficha registrada no los tiene.
- [ ] **E-2** Constructores puros de `CifraDeMetrica` para Comercial, Dinero, Hoy y "¿Vamos a llegar?", cada uno con su test (los ocho casos raros que apliquen y la paridad cifra = lista).
- [ ] **E-3** Comercial, Dinero, Hoy y "¿Vamos a llegar?" pintan solo `<Cifra>`; comparados lado a lado con el boceto en claro, oscuro y 375 px; el PDF de Hoy sigue saliendo bien.
- [ ] **E-4** `/hub` (todos los programas): Hoy, Comercial y Dinero con la misma pieza, sin una sola tasa combinada entre programas.
- [ ] **E-5** Mi espacio › Métricas con la misma pieza.
- [ ] **E-6** El botón Info retirado de las cinco pestañas y de `/hub` (DC-1), sin perder ninguna frase. Borrados sin llamadores: `CifraConLista`, `ResumenDeCifra`, `CifraDeRazon`, `ComoSeCalcula` (el diálogo), las props viejas de `BarraDeAvance`, `Variacion` y las piezas `Tarjeta`/`Ficha`/`Dato`/`Fila` que queden sin uso (N7).
- [ ] **E-7** Guardián `tests/una-forma-de-cifra-guardian.test.ts`, mordido en los dos sentidos.
- [ ] **E-8** `structure.md` §9 (puntos 5, 8 y 10), `diseno-cifra-y-pauta.md` y el ADR 0067 reescritos en el mismo commit que cierra cada fase (N8). Tracker y `status:` iguales (N9).

## Enmienda del 13-nov: la Cifra en TODO el Hub (decisión de Mani)

> **Decidido por Mani el 13-nov:** Hoy, Comercial y Dinero pasan a la Cifra **antes** de seguir abriendo Pauta. Origen:
> `docs/reportes/revision-hub-metricas-mcp-2026-11-13.md`, hallazgo H-1. Esta enmienda no abre un ticket nuevo: completa el
> alcance que el título del 419 ya prometía ("en todo el Hub") y que su "Done cuando" original dejó solo en Pauta.

### Por qué hace falta (medido en el código el 13-nov)

1. **La pieza nueva solo se usa en Pauta y el semáforo.** `CifraDeMetrica` se arma en cuatro módulos: `lib/pauta/cifras-de-origen.ts`,
   `lib/pauta/cifras-de-proyeccion.ts`, `lib/pauta/cifra-de-celda-semanal.ts` y `lib/semaforo/cifras-del-semaforo.ts`. Hoy,
   Comercial, Dinero, "¿Vamos a llegar?", `/hub` y Mi espacio siguen con la forma vieja.
2. **Nadie era dueño del resto.** El alcance 2 de este ticket dice "el resto lo completa el 403 F4". El 403 F4 llenó la ficha
   **estructurada** (unidad, ancla, función) y cerró el trinquete en 0, pero no escribió ningún texto de explicación:
   `grep -c "que:" lib/metricas/registro.ts` da 0 sobre 52 fichas.
3. **El puente quedó huérfano.** `lib/metricas/explicaciones-de-pauta.ts` dice en su cabecera "PUENTE, no casa (…) este archivo se
   borra" y esperaba a que el 403 registrara los conceptos de Pauta. El 403 los registró el 10-nov (`CONCEPTO_DE_PAUTA_SEMANAL` en
   `lib/metricas/pendientes.ts`). El traspaso está desbloqueado y nadie lo hizo.

### Inventario: qué pinta cada archivo hoy (conteo de usos por `grep`, 13-nov)

| Archivo | Pestaña | `<CifraConLista` | `<CifraDeRazon` | Otras piezas viejas | Cifras que muestra |
|---|---|---|---|---|---|
| `components/dashboard/operacion.tsx` | Comercial | 1 | 3 | `Tarjeta`, `Tabla` | Citas, Asistencia, Ventas, Cierre de ventas, Entró a caja; por closer: Citas, Asistencia, Cierre, Cita a venta, Vendido, Recaudado, Por cobrar; Grupo de citas, Citas sin marcar, Deals abiertos, Deals sin dueño, Ventas sin llamada registrada |
| `components/dashboard/escalera.tsx` | Comercial | 1 | 0 | ya usa `<Cifra` 3 veces (mezcla) | Los escalones y "Cita pasada sin resultado" |
| `components/dashboard/dinero.tsx` | Dinero | 0 | 0 | `Tarjeta` | Vendido, Recaudado, Por cobrar |
| `components/dashboard/dinero-de-ventas.tsx` | Dinero y Hoy | 1 | 0 | `Variacion` | Vendido, Recaudado, Por cobrar (por clave) |
| `components/dashboard/graficas-de-dinero.tsx` | Dinero | 0 | 0 | punto de gráfica por `ResumenDeCifra` | Vendido, Entró a caja, Cupos con caja |
| `components/dashboard/piezas.tsx` | Compartido | 1 | 0 | `Tarjeta`, `Caja`, `CajaConVariacion`, `Variacion` | Entró a caja, por moneda |
| `components/dashboard/hoy/cifras-clave.tsx` | Hoy | 4 | 1 | `Ficha`, `BarraDeAvance` (forma vieja `llevamos`/`objetivo`), `EnlaceAInfo` | Cupos vendidos, Leads de hoy, Entró a caja hoy, Asistencia; Objetivo del día, Objetivo de leads, Leads que hacen falta |
| `components/dashboard/hoy/embudo.tsx` | Hoy | 1 | 1 | — | Envíos, Citas del día, Realizadas, Cupos vendidos, Cierre de ventas |
| `components/dashboard/hoy/citas.tsx` | Hoy | 1 | 0 | — | Citas del día, Realizadas, Canceladas, Sin resultado, "¿Cómo va cada closer?" |
| `components/dashboard/hoy/dinero.tsx` | Hoy | 1 | 0 | — | Cupos vendidos hoy, Vendido, Recaudado, Por cobrar |
| `components/dashboard/hoy/semana.tsx` | Hoy | 0 | 0 | `Fila`, `Variacion` | Llevamos, Cupos vendidos, Leads, Asistencia de la semana |
| `components/dashboard/hoy/pendientes.tsx` | Hoy | 1 | 0 | — | Citas de mañana |
| `components/dashboard/hoy/comunes.tsx` | Hoy | 1 | 0 | define `Ficha`, `Lado`, `CuentaDeAsistencia`, `cumplimiento` | (piezas) |
| `components/metas/vamos-a-llegar.tsx` | Las cinco pestañas | 0 | 0 | `Dato`, `Fila`, `Variacion` | Mes y cohorte × cupos y USD: Vendido, Faltan, Esperado a hoy, Por día hábil, Proyección |
| `app/(app)/hub/secciones.tsx` | `/hub` (todos) | 3 | 4 | `Tarjeta`, `Variacion` | Entró a caja por moneda, Hoy por programa (Ventas, Citas, Realizadas, Asistencia, Cierre), Vendido/Recaudado/Por cobrar, Comisión y descuento, Tasas por programa |
| `components/mi-espacio/tab-metricas.tsx` | Mi espacio | 5 | 1 | `Tarjeta`, `ComoSeCalcula` (diálogo), `Variacion` | Con show y vendidos hoy, Citas pasadas sin resultado, Entró a caja, Ventas que generan comisión, Citas, Realizadas, No asistió, Ventas |
| `components/graficas/barras.tsx` | Compartido | 1 | 0 | — | Pasos del embudo, segmentos, filas |
| `components/graficas/resumen-de-punto.tsx` | Gráficas | 0 | 0 | `ResumenDeCifra` | El punto de una gráfica de Dinero y Comercial |
| `components/pauta-roas.tsx` | Pauta (`/hub`) | 0 | 1 | ya usa `<Cifra` 4 veces | ROAS por campaña (lo cierra el 422) |

Totales: `CifraConLista` 40 referencias en 14 archivos, `CifraDeRazon` en 7, `ComoSeCalcula` solo en Mi espacio.
**Antes de empezar, repetir el conteo** (el inventario envejece): `grep -rc "<CifraConLista\|<CifraDeRazon" app components | grep -v ":0"`.

Las 43 claves del Hub, con su función, su fila del diccionario y su lista, están en `docs/audit-hub-2026-11-10.md` §4.1. Hoy las
52 claves registradas son (`lib/metricas/registro.ts`): `registros`, `agendadas`, `citas`, `shows`, `no_asistio`, `asistencia`,
`cierre_de_ventas`, `ventas`, `cupos_vendidos`, `llevamos`, `vendido`, `recaudado`, `por_cobrar`, `entro_a_caja`, `comision`,
`leads`, `llamadas_sin_resultado`, `citas_pendientes`, `citas_del_dia`, `citas_realizadas`, `citas_canceladas`, `show_por_cita`,
`cita_a_venta`, `nacio_agenda_del_dia`, `nacio_seguimiento`, `nacio_sin_llamada`, `meta`, `objetivo_cohorte`, `objetivo_de_leads`,
`dias_del_ritmo`, `citas_minimas`, `objetivo_mes`, `objetivo_semana`, `esperado_a_hoy`, `faltan`, `por_dia_habil`,
`objetivo_del_dia`, `proyeccion`, `leads_que_hacen_falta`, `deals_desde_completo`, `deals_desde_parcial`, `cupos_con_caja`,
`inversion`, `costo_agenda_crm`, `costo_agenda_meta`, `roas`, `profit`, `cpm`, `ctr`, `llegada_landing`, `conversion_landing`,
`frecuencia`.

### Decisiones que van antes del código (E-0). Ninguna se asume.

| # | Pregunta | Recomendación y por qué |
|---|---|---|
| **DC-1** | El botón **Info** de cada pestaña (`components/hub/info-de-pagina.tsx`, 381, con `?info=<sección>` y los "?" de `EnlaceAInfo`) explica hoy las cifras por sección. Con la explicación por cifra habría dos lugares que explican lo mismo. ¿Se queda, se retira o cambia? | **Se queda como índice de la página, pero deja de tener texto propio de métricas:** cada sección lista sus cifras y pinta `que` y `formula` desde la ficha. Así hay un solo texto (N1) y no se pierde el enlace compartible. Retirarlo del todo es más simple, pero lo pidió Mani el 4-nov y lo usa el PDF de Hoy |
| **DC-2** | El **universo** ("de pauta" / "todas las áreas") hoy es un campo de `ExplicacionDeConcepto`, o sea del concepto. Pero un concepto se muestra en los dos universos: el puente tiene `agendas` y `agendas_total`, `ventas` y `ventas_total`, `vendido_pauta` y `vendido_total` con el mismo concepto detrás. ¿Dónde vive? | **En la cifra, no en la ficha:** `universo` pasa a `EntradaDeCifra` (el diseño §10 ya lo pone en `CifraDeMetrica`). La ficha guarda el texto general del concepto. Lo que una vista de Pauta necesite decir distinto ("cuenta en la semana del registro", "solo campañas de agenda") va como **variante nombrada** de esa ficha, no como otra ficha. Un concepto, una ficha |
| **DC-3** | Hoy el primer clic de una cifra abre un **resumen con desgloses** (por closer, por etapa, por antigüedad: `ResumenDeCifra`, ADR 0067 punto 5). La explicación nueva muestra 5 filas y el botón "Ver las N". ¿Se pierden los desgloses? | **No se pierden: pasan a la cabecera de la lista completa** (`/p/[programa]/hub/lista`). Medido el 13-nov: esa página **no** pinta hoy ningún desglose (`grep` de `desglose`, `porCloser` y `Resumen` en `lista/page.tsx` da cero), así que pintarlos ahí es trabajo de E-3, con la misma consulta que hoy alimenta `ResumenDeCifra` (`lib/queries/vista-metrica.ts`). Enmienda al ADR 0067 punto 5 en el mismo commit (N8). Para quien no cumple `veEquipoComercial` nada cambia: no ve listas |
| **DC-4** | ¿Qué universo dice una cifra de **Mi espacio** (las del closer)? "todas las áreas" es cierto pero no dice que son solo suyas | **Un tercer valor de universo, "tuyas"**, con la explicación "Solo tus deals y tus llamadas". Es un valor nuevo de un tipo cerrado (`UniversoDeCifra`), decisión de vocabulario: se escribe en `overview.md` §11 |

#### Respondidas por Mani (13-nov). Mandan sobre la columna "Recomendación" de la tabla.

- **DC-1 · El botón Info se va.** Textual: "se debería ir para evitar redundancia; ya cada tarjeta de cifra abre el popup
  estandarizado para ver el cálculo y los registros". **No es la recomendación de la tabla** (que lo dejaba como índice): se retira
  entero. Qué implica, medido el 13-nov:
  - Se borran `components/hub/info-de-pagina.tsx` (`InfoDePagina`, `EnlaceAInfo`, `abrirInfo`, el parámetro `?info=`),
    `components/hub/piezas-de-info.tsx`, `components/dashboard/info-de-comercial.tsx`, `components/dashboard/info-de-pauta.tsx` y
    `components/dashboard/hoy/info-de-hoy.tsx`, y sus usos en `app/(app)/hub/page.tsx` y `app/(app)/p/[programa]/hub/page.tsx`.
  - Hay 16 usos de `EnlaceAInfo` o `abrirInfo` fuera de ese archivo, en `components/dashboard/operacion.tsx`, `escalera.tsx`,
    `configuracion-hoy.tsx`, `hoy/cifras-clave.tsx`, `hoy/comunes.tsx`, `components/deals-contra-agendas.tsx` y
    `components/deals/ficha/ficha-cierre.tsx`. **Los dos últimos no son del Hub:** mirar qué enlazan antes de quitarlos.
  - **Nada se pierde al borrar:** antes de quitar una sección del Info, cada frase suya tiene que estar en la ficha de una cifra
    (`que`, `formula`, `variables`) o, si explica un ajuste (días del ritmo, mínimo para confiar en una tasa, objetivo de leads), en
    la ficha de ese parámetro, que se abre desde donde se configura (`components/dashboard/configuracion-hoy.tsx`). El commit que
    borra una sección lista en su descripción a dónde fue cada frase. Lo que no explique ninguna cifra ni ningún ajuste se anota
    aquí y lo decide Mani; no se tira en silencio.
  - **El PDF de Hoy** (373) no puede depender del Info: verificar el PDF antes y después.
  - Va **por pestaña, en el mismo commit de E-3** que migra esa pestaña (cuando sus cifras ya abren su explicación, su Info sobra),
    no al final: así nunca hay una pestaña sin explicación ni una con dos.
  - N8 en ese commit: `docs/structure.md` §9 (el contrato de entendimiento habla de "Cómo se calcula" y del Info), el ticket 381
    ("el Info único", que esta decisión revierte) con una nota de enmienda, y `docs/hub.md` si lo nombra.
- **DC-2 · El universo vive en la cifra.** Textual: "en la cifra; que sea consistente con el UI que tenemos propuesto, nada feo.
  Tiene que ser entendible y poco saturado". Regla de pantalla que sale de ahí: el universo se pinta **exactamente como en el
  boceto** (gris, junto al rótulo: "Agendadas · de pauta"), sin píldora, sin borde y sin una línea propia. Si en una pestaña todas
  las cifras son del mismo universo, igual se pinta en cada una (DM-6: siempre visible), pero no se repite en un subtítulo ni en un
  encabezado además. Ante la duda entre mostrar un dato más o dejar la tarjeta limpia, gana la tarjeta limpia: el dato va en la
  explicación.
- **DC-3 · Los desgloses pasan a la cabecera de la lista completa.** Sí, con la recomendación. Enmienda al ADR 0067 punto 5 en el
  commit que lo construye.
- **DC-4 · Mi espacio usa un tercer universo, "tuyas".** Sí, con la recomendación. Texto de la explicación: "Solo tus deals y tus
  llamadas". Entra a `UniversoDeCifra` y a `docs/overview.md` §11 en el mismo commit.

### Fases, en orden. Cada fase deja `main` desplegable.

**E-1 · El texto a la ficha, y el puente se borra** (archivo caliente: `lib/metricas/registro.ts`; una sola sesión a la vez)

1. `FichaDeMetrica` gana lo que hoy solo tiene `ExplicacionDeConcepto` y es del concepto: `admiteObjetivo?` y `unidadesDePartes?`.
   `rotulo` NO entra: sale del vocabulario (`nombreCorto`, N4). `universo` NO entra (DC-2).
2. `UnidadDeCifra` (`conteo`, `decimal`, `cop`, `usd`, `porcentaje`, `veces`) y `UnidadDeMetrica` de la ficha (`cupos`, `personas`,
   `citas`, `deals`, `dinero`, `porcentaje`, `veces`, `dias`) son dos enums para lo mismo. Una función `unidadDeCifra(ficha, moneda?)`
   en `lib/metricas/cifra.ts` deriva la primera de la segunda; nadie escribe la unidad dos veces. Falta decidir cómo se escribe
   `dias` (hoy no existe en `UnidadDeCifra`): agregar el caso a `formatearValor`.
3. Pasar los 35 textos del puente a su ficha. El mapa de clave del puente a concepto:
   - **Con concepto registrado** (por `CONCEPTO_DE_PAUTA_SEMANAL`): `inversion`→`inversion`, `agendas`/`agendas_total`/`agendas_origen`→`agendadas`,
     `ventas`/`ventas_total`/`ventas_origen`→`ventas`, `facturacion`/`vendido_pauta`/`vendido_total`→`vendido`, `show`→`asistencia`,
     `cierre_ventas`→`cierre_de_ventas`, `agenda_venta`→`cita_a_venta`, `costo_agenda_crm`/`costo_agenda_origen`→`costo_agenda_crm`,
     `agendas_meta`/`costo_agenda_meta`→`costo_agenda_meta`, `inversion_origen`→`inversion`, `roas`, `profit`, `cpm`, `ctr`,
     `llegada_landing`, `conversion_landing`, `frecuencia` a su clave igual.
   - **Sin concepto registrado todavía** (hay que crear clave en `lib/vocabulario-metricas.ts`, ficha, y fila en `docs/metricas.md`
     si no la tiene, todo en el mismo commit, N8): `presupuesto`, `cac` (lo crea el 415: coordinar, no duplicar), `agendas_dia`,
     `agendas_req`, `inversion_req`, `roas_proy`, `envios_sin_id`, `registros_sin_utm`, `ventas_sin_anuncio`, `embudo`.
     Antes de crear una clave, buscar si el concepto ya existe con otro nombre (`por_dia_habil`, `proyeccion`, `leads_que_hacen_falta`
     son del mismo tipo de cuenta para ventas y leads): si es el mismo concepto, se reutiliza; si es otro, se dice por qué.
4. Escribir `que`, `formula` y `variables` de las claves del Hub que no vienen del puente. **El texto es de negocio y lo aprueba
   Mani**: la sesión redacta una tabla como la de `docs/diseno-cifra-y-pauta.md` §2.1 (clave, rótulo, qué mide, fórmula, variables),
   la agrega a ese documento como §2.2, Mani la lee y dice sí, y solo entonces entra al código. Fuente de cada texto: la fila del
   concepto en `docs/metricas.md`, traducida a palabras de Gerencia. Las fichas de tipo `parametro` (objetivos, `dias_del_ritmo`,
   `citas_minimas`) llevan `que` y, como fórmula, "lo escribe [quién] en [dónde]".
5. `explicacionDePauta(clave)` se reemplaza por una función que arma la `ExplicacionDeConcepto` desde la ficha más la variante
   (DC-2). Borrar `lib/metricas/explicaciones-de-pauta.ts` y mover sus tipos a `lib/metricas/cifra.ts`.
5b. **(13-nov, noche) Mani aprobó §2.2** con sus respuestas (diseño §2.2, "Respondidas por Mani"): una clave por concepto
   (Realizadas y Sin resultado se unifican), toda cifra visible queda registrada, y §2.1 se reescribe en palabras por persona
   (Asistencia = Realizadas ÷ Citas del grupo; De cita a venta = Ventas ÷ Agendadas del grupo) sin mover ningún número.
6. Test nuevo en `tests/registro-de-metricas.test.ts`: toda ficha registrada tiene `que`, `formula` y `variables` (trinquete en 0
   desde el primer día: no nace con excepciones). `tests/explicacion-sin-jerga.test.ts` pasa a recorrer el registro entero.
7. **Costura con el MCP y WhatsApp:** con el texto en la ficha, `capacidades` del MCP y el mensaje del semáforo pueden leerlo. No se
   hace aquí; se anota en el 411 (F5) y en el 358.

**E-2 · Constructores puros por pestaña** (molde: `lib/pauta/cifras-de-proyeccion.ts`, 89 líneas)

- Módulos nuevos, puros (sin `lib/db`), en `lib/hub/`: `cifras-de-comercial.ts`, `cifras-de-dinero.ts`, `cifras-de-hoy.ts`,
  `cifras-del-norte.ts`. Reciben lo que la página ya consulta (`VistaDelDashboard`, `DetallesDelDashboard`, `ReporteDiario`, los datos
  de `VamosALlegar`) y devuelven `CifraDeMetrica`. **No consultan ni recalculan** (N1): si un constructor necesita un número que
  la consulta no trae (las `partes` de una razón), se agrega a la consulta, no se deduce en el constructor.
- Lo que hoy decide `CifraDeRazon` (`components/cifra-de-razon.tsx`) se traduce así, una sola vez, en un ayudante
  `entradaDesdeRazon(razon: RazonConCobertura)` junto a `armarCifra`:
  `estadoDeCobertura === "no_calculable"` → `valor: null` + `motivo`; `"parcial"` → `parcial: "…"` con base y faltan en palabras
  ("12 de 30 citas ya tienen resultado") y, si hay `agendasPendientes`, su frase; completa → nada. El umbral sigue siendo
  `UMBRAL_COBERTURA_POR_DEFECTO` de `lib/cobertura.ts`.
- `lista` de cada cifra: `href` sale del `DetalleDeCifra` que ya existe (viene de `urlDeLista`, que exige `origen`); `total` de
  `resumen.subtotal.cantidad`; las 5 filas con `leerEvidencia` (`lib/metas/cumplimiento-de-cohorte.ts`), que ya lee cualquier lista
  con un rango. Si esa función queda como dependencia de todo el Hub, mudarla a `lib/queries/` (no es de metas).
  **Una cifra sin lista probada no lleva evidencia** (regla del 419 original): primero el test cifra = lista, después la evidencia.
- **Dinero en varias monedas:** "Entró a caja" es **una Cifra por moneda**, nunca una suma (regla dura de AGENTS.md). El constructor
  devuelve un arreglo; si no hay abonos, una sola Cifra en USD con 0.
- **Comparación:** `Variacion` (vieja) → `comparacion: { referencia, valor }` de la entrada; `referencia` en palabras ("el periodo
  anterior", "C5 al mismo día"), nunca "periodo B" (N5).
- **Estado:** solo con fuente. "¿Vamos a llegar?" y Cupos vendidos de Hoy usan `fuente: "esperado"`; las tasas no llevan estado
  salvo que tengan objetivo cargado. Sin fuente, sin badge.
- **`filtros` ("Calculada con"):** Programa, Cohorte, Periodo, Closer (si hay), y en Hoy "Día: 13 nov". El norte muestra solo
  Programa (no sigue filtros: `docs/hub.md` §1).
- Tests por módulo (puros, sin base): cada caso raro del §1.3 que aplique; que ningún texto lleve ".." ni jerga; y, con base, la
  paridad cifra = lista sembrando una anulada, otro programa y un parcial.

**E-3 · Las pantallas, una pestaña por commit**

Orden recomendado: **Comercial → Dinero → Hoy → "¿Vamos a llegar?"**. Comercial primero porque `operacion.tsx` concentra las
razones y es la que más se parece a Pauta; Hoy casi al final porque es el reporte que se descarga en PDF (373) y es donde más se
puede romper algo que Gerencia ya usa.

- En cada archivo de la tabla: reemplazar la pieza vieja por `<Cifra cifra={…}>` (tamaño `tarjeta` o `celda`). La página del
  servidor (`app/(app)/p/[programa]/hub/page.tsx`) llama al constructor y pasa las cifras **como props**; el componente cliente no
  importa nada de `lib/` que cargue `lib/db` (regla de AGENTS.md: `Module not found: 'fs'` solo aparece en el build).
- **PDF de Hoy:** la Cifra es un botón con panel; en `print:` debe verse como texto plano, con la barra y sin "Cómo se calcula →".
  Verificar descargando el PDF (`components/dashboard/descargar-reporte.tsx`) antes y después, y comparar página por página.
- **Gráficas de Dinero y Comercial:** el punto abre hoy `ResumenDeCifra` (`components/graficas/resumen-de-punto.tsx`). Pasa a
  `components/graficas/grafica-con-explicacion.tsx`, que ya existe para Pauta (420): clic en un punto abre la explicación de esa
  cifra en ese día.
- **Tablas por closer** (Comercial): cada celda es `<Cifra tamano="celda">`. Solo para quien cumple `veEquipoComercial`; el paid
  trafficker sigue sin verlas (`sinListas`). La proyección por rol se decide en el servidor, no en el constructor.
- Por cada pestaña: `npm run build`, abrir con `npm run dev:local`, **clic en cada cifra** con la consola abierta, comparar lado a
  lado con `docs/bocetos/una-forma-de-metrica.html` en claro, oscuro y 375 px, y `npm run test:humo`. Recorrer con gerente y con
  paid trafficker.
- **El Info de esa pestaña se borra en este mismo commit** (DC-1, arriba), con la lista de a dónde fue cada frase. `ContextoDeCifra`
  (la línea de contexto bajo el título) se queda: no explica una cifra, dice qué se está mirando.

**E-4 · `/hub` de todos los programas** (`app/(app)/hub/secciones.tsx`)

Misma pieza, **una Cifra por programa, lado a lado**. La función del agregado no compila con una tasa (ADR 0048): no se toca ese
tipo. Lo sumable (conteos, caja por moneda) puede llevar una Cifra de total; tasas, metas, comisión, CPL y ROAS nunca. La parte de
Pauta de `/hub` es del **422**: coordinar para no tocar los mismos archivos a la vez (`components/pauta-roas.tsx`).

**E-5 · Mi espacio › Métricas** (`components/mi-espacio/tab-metricas.tsx`)

Último llamador de `ComoSeCalcula`. Usa el universo de DC-4. El closer no entra al Hub (ADR 0082): esto no le abre nada nuevo, solo
cambia la forma de lo que ya ve.

**E-6 · Borrar lo reemplazado** (N7: reemplazar es borrar)

Cuando `grep` dé cero llamadores: `CifraConLista` y `ResumenDeCifra` (`components/cifra-con-lista.tsx`; el archivo se queda solo con
`Cifra`), `components/cifra-de-razon.tsx`, el diálogo `ComoSeCalcula` (`components/como-se-calcula.tsx` se queda con
`ExplicacionDeCifra`, `BadgeDeEstado`, `PUNTO`), la forma vieja de `BarraDeAvance` (`llevamos`/`objetivo`), `Variacion` si quedó sin
uso (`CambioDeCifra` se queda), `components/graficas/resumen-de-punto.tsx`, y de `components/dashboard/piezas.tsx` y
`hoy/comunes.tsx` lo que quede huérfano (`Tarjeta`, `Ficha`, `Dato`, `Fila`, `Caja`, `tasa`). `components/dato-o-vacio.tsx`: mirar
quién lo llama antes de decidir. Nada se borra "porque parece muerto": se borra con el `grep` en la descripción del commit.

**E-7 · El guardián** (`tests/una-forma-de-cifra-guardian.test.ts`)

Recorre `app/` y `components/` y falla si: (a) alguien importa un nombre borrado en E-6; (b) un archivo de `components/dashboard/`,
`components/metas/`, `components/pauta/`, `components/semaforo/`, `app/(app)/hub/` o `app/(app)/p/[programa]/hub/` llama `pct(`,
`monto(`, `usd(` o `cop(` de `lib/format.ts` para pintar una métrica fuera de la Cifra. La (b) nace con una lista de excepciones
nombradas y fechadas (ejes de gráficas, CSV, encabezados) que solo se achica, como `tests/tracker-coherente.test.ts`. Mordido en
los dos sentidos: una fuente sintética con la pieza vieja falla; la pieza nueva no.

### Riesgos conocidos (leer antes de empezar)

- **El build, no los tests, caza el import equivocado.** Un componente cliente que importe un valor de un módulo con `lib/db`
  revienta solo en `npm run build`. Correrlo en cada commit de E-3 a E-5.
- **Un servidor no importa valores de un archivo `"use client"`** (`tests/frontera-cliente-guardian.test.ts`): constantes
  compartidas en `lib/`.
- **Base UI es estricto:** el panel (`components/ui/sheet.tsx`) y cualquier menú fallan en tiempo de ejecución, no al compilar.
  Cargar la pantalla no la prueba: hay que abrir cada cifra.
- **Rendimiento:** la evidencia (5 filas por cifra) es una consulta por cifra. Hoy tiene más de 20 cifras. Medir el tiempo de la
  página antes y después; si sube, leer las filas por lote o solo al abrir (decisión a registrar aquí, no a improvisar).
- **`hub/page.tsx` es archivo caliente** (754 líneas, lo tocan 420, 414, 416 y 422): un solo dueño por commit, `git pull --rebase`
  antes de empujar, y avisar al otro carril.
- **No cambiar ninguna cifra.** Esta enmienda cambia la forma, no el cálculo. Si un número cambia al migrar, es un hallazgo: se
  detiene, se anota aquí y se decide con Mani. Verificación: antes de E-3, guardar los valores de cada pestaña en la base local
  (captura o CSV) y compararlos después.

### Quién y en qué orden (propuesto; lo confirma Mani en `docs/plan-reparto.md` §4)

E-0 Mani. E-1 carril D (Mani con Codex): es su archivo. E-2 a E-7 carril P (compañero), una pestaña por commit. E-1 y E-2 pueden
ir en paralelo si E-2 arranca con los conceptos que ya tienen texto en el puente; E-3 de una pestaña espera a que sus fichas
tengan texto aprobado.

## Lo que falta contra el boceto (18-nov, sesión de UI; medido con `grep` sobre `main` c0cea03c)

Hecho en `main` (Alejo, 13 a 17-nov): el contrato, las 52 fichas, la pieza, y la Cifra en el Hub **de un programa** para Comercial,
Dinero, Hoy y el norte. Lo que queda, pantalla por pantalla:

| Pantalla | Falta |
|---|---|
| **Hoy** (programa) | Cifras clave, embudo, citas, dinero y pendientes siguen importando `CifraConLista`/`CifraDeRazon` en su rama vieja (`hoy/cifras-clave.tsx` 4+1, `embudo.tsx`, `citas.tsx`, `dinero.tsx`, `pendientes.tsx`, `comunes.tsx`); `hoy/semana.tsx` sigue con `Fila` y `Variacion`; el botón Info de Hoy sigue montado (`p/[programa]/hub/page.tsx:323`, DC-1). PDF de Hoy sin verificar antes/después. |
| **Comercial** (programa) | Hecha. Queda la rama vieja en `operacion.tsx` (3 `CifraDeRazon`, 1 `CifraConLista`), `escalera.tsx` y `EnlaceAInfo` en `deals-contra-agendas.tsx` (E-6). |
| **Dinero** (programa) | Cifras hechas. Las gráficas abren `ResumenDeCifra` (`graficas/resumen-de-punto.tsx`) y no la explicación; `dinero-de-ventas.tsx` conserva `CifraConLista` y `Variacion`. |
| **Pauta** (programa) | Cifras hechas (420). Queda `pauta-roas.tsx` con `CifraDeRazon` y el Info de Pauta montado (`page.tsx:240`, DC-1). |
| **Hub de todos** (`/hub`) | E-4 entero: `secciones.tsx` con 3 `CifraConLista`, 4 `CifraDeRazon`, `Tarjeta`, `Variacion`; `vamos-a-llegar.tsx` (vista vieja); Info montado (`hub/page.tsx`). |
| **Mi espacio** | E-5 entero: `tab-metricas.tsx` (8 `CifraConLista`, `CifraDeRazon`, `ComoSeCalcula`, 5 `Variacion`, 6 `Tarjeta`); universo «tuyas» (DC-4). |
| **Transversal** | E-6 (borrar lo huérfano), E-7 (guardián `una-forma-de-cifra-guardian`), E-8 (`structure.md` §9, ADR 0067), comparación visual con el boceto en claro, oscuro y 375 px, Rams, `build`, `test:humo`. |

## Avance

- **18-nov · E-5 Mi espacio › Métricas: hecho.** `lib/hub/cifras-de-mi-espacio.ts` (puro) arma, por programa, Citas, Realizadas,
  No asistió, Ventas, Cierre de ventas, las citas sin resultado (solo si hay), Entró a caja (una por moneda) y Comisión; y, en
  «Todos», los totales sumables (la comisión y las tasas no se suman). Universo nuevo «tuyas» en `UniversoDeCifra` (DC-4) y en
  `overview.md` §11; texto en `lib/hub/explicaciones-de-mi-espacio.ts`. `tab-metricas.tsx` ya no usa `CifraConLista`,
  `CifraDeRazon`, `ComoSeCalcula`, `Variacion` ni `Tarjeta`. Test: `tests/cifras-de-mi-espacio.test.ts`. **Frases del
  diálogo «Cómo se calcula» retirado, a dónde fueron:** «las llamadas que tomaste» y «los deals de los que eres dueño hoy» →
  universo «tuyas» («Solo tus deals y tus llamadas») más `que`/`variables` de cada ficha; «los abonos que registraste» (Entró a
  caja) NO está en la ficha (la ficha dice abonos del periodo): pendiente de decisión de Mani; el criterio del % de cierre («cada
  deal cuenta contigo si tomaste su último show o, sin show, su última cita») tampoco está en `cierre_de_ventas`: pendiente.
  **Pendiente del texto de Mani (no se inventó copia):** Realizadas sin Grain, Llamadas pasadas sin resultado y las banderas
  Atendidos sin valor vendido, Atendidos sin Grain y Cierre perdido con pagos (siguen con la tarjeta vieja en `/hub`).
  **E-6 parcial:** borrado el diálogo `ComoSeCalcula` (`grep -rn ComoSeCalcula app components lib tests` = 0 fuera de su archivo);
  el archivo conserva `BadgeDeEstado`, `PUNTO` y `ExplicacionDeCifra`. Siguen vivos `CifraConLista`, `CifraDeRazon`,
  `ResumenDeCifra`, `Variacion` y `resumen-de-punto` por la rama vieja de Comercial y Hoy de `/hub` y las gráficas de Dinero.

- **18-nov · E-4 `/hub` (Hoy, Comercial, Dinero): hecho; Pauta es del 422.** `lib/hub/cifras-de-todos.ts` (puro) arma los totales
  sumables (Leads, Citas, Realizadas y Ventas, una Cifra cada uno con la nota «Suma de programas») y la tasa de cada programa
  (Asistencia y Cierre de ventas, con el nombre del programa en «Calculada con», nunca combinadas); Vendido, Recaudado, Por
  cobrar y Entró a caja (una por moneda) salen de `cifrasDeDinero`, sin cambiar su módulo. Texto en
  `lib/hub/explicaciones-de-todos.ts` (universo «todas las áreas»). `secciones.tsx` ya no importa `CifraDeRazon` ni
  `TarjetaVendido`. Ninguna cifra cambia. Test: `tests/cifras-de-todos.test.ts`. **Queda con la forma vieja en `/hub`:**
  Realizadas sin Grain, Llamadas pasadas sin resultado y las tres banderas (Atendidos sin valor, sin Grain, Cierre perdido con
  pagos) porque no tienen ficha en el registro (escribirla necesita el texto aprobado por Mani); las columnas de Comisión y
  Descuento de la tabla de Dinero; «Hoy por programa» conserva su Ventas/objetivo en texto; `vamos-a-llegar.tsx` (vista vieja del
  norte) y el Info de `/hub`. Sin cambio de consultas (el guardián por página sigue igual).

- **17-nov · Carril D: hallazgo 20 resuelto.** Las fichas `agendadas`, `cierre_de_ventas`, `ventas` y `vendido` decían «de pauta»
  aunque Hoy, Comercial, Dinero y el norte cuentan todas las áreas. `explicacionDe` (`lib/metricas/explicacion.ts`) toma ahora una
  frase neutra por concepto cuando la variante es `universo: "todas"`; Pauta conserva su ficha y una variante explícita manda.
  Sin tocar `registro.ts` ni los archivos de `lib/hub/` ni de componentes. Test nuevo `tests/explicacion-por-universo.test.ts`;
  en `tests/explicaciones-de-comercial.test.ts` se quitaron tres igualdades contra la ficha (ya las cubre `explicacionDe` en
  la línea anterior). No cambia ninguna cantidad.
- **16-nov · E-3 ¿Vamos a llegar?** Integrado solo el norte del Hub de un programa.
  - **Revisión de Claude (corrige lo de abajo donde choca):** la paridad SÍ corrió y está en verde
    (`tests/norte-evidencia.test.ts`: cierres del mes y de la cohorte = Llevamos de cupos), así que la evidencia quedó
    **conectada**: `cifrasDelNorte` recibe `listas` (puro) y `VamosALlegar` lee las cinco filas con
    `leerEvidenciaDeVentas` solo cuando `conListas`; la misma lista va en Llevamos y en Vendido (USD), como en el
    cumplimiento de Pauta. Decidido por Alejandro: **la frase de avance se retira** del norte del programa (repetía la
    barra con el dato redondeado: «3 de 9, vas 2 atrás» junto a «de 8,8 · vamos 1,6 atrás»; su enlace a la lista ahora
    sale de la Cifra) y **en cupos Esperado a hoy y Faltan se escriben con su decimal**, como la barra (antes 5 y 6, ahora
    4,6 y 5,8: la misma cantidad, otra forma). `fraseDeAvance` sigue viva para `/hub` hasta E-4. Rendimiento: el norte
    va en todas las pestañas y ahora hace dos lecturas más (una por horizonte) para quien abre listas; sin medir.
    Verificado en `dev:local` como gerente: panel de Llevamos con sus secciones, consola limpia, 375 px sin scroll
    horizontal; `npm run build` en verde.
  - `VamosALlegar` sigue leyendo únicamente programa y hoy; ahora resuelve las seis fichas con
    `explicacionesDelNorte()` (`universo: "todas"`), arma `cifrasDelNorte` y pasa sus resultados a
    `VamosALlegarProgramaVista`. La página no requiere cambios: conserva su componente, ubicación en todas
    las pestañas y reutilización dentro del reporte de Hoy. La vista vieja `VamosALlegarVista` sigue intacta
    para `/hub` de todos los programas hasta E-4 (comentario junto a su exportación).
  - **Mapa de lo anterior:** cada `Fila` pasa a una fila de mes/cohorte con dos columnas, Cupos y Vendido (USD).
    `BarraDeLaCelda` y Llevamos pasan a la Cifra principal con meta, barra, atraso y marca «a hoy» en ambas
    columnas. Los `Dato` de Faltan, Esperado a hoy y Por día hábil pasan a Cifras de tamaño celda; Proyección
    también, únicamente en cohorte. Los encabezados conservan mes, código y fecha de cierre. Título, subtítulo,
    `data-testid`, Configurar, Sin cohorte activa y razón de no proyectar siguen presentes. `fraseDeAvance`
    y su enlace a cierres conservan los mismos argumentos y rangos. El badge suelto de ventas sin valor pasa
    al `parcial` de la Cifra USD; `mostrarCobertura` mantiene visible su motivo una vez por horizonte.
    No había Info del norte para retirar. El reporte reutiliza los estilos de impresión existentes de Cifra.
  - **Evidencia NO conectada:** se escribió primero `tests/norte-evidencia.test.ts`, con PGlite explícito y
    cliente real bloqueado, para comparar cierres del mes (`{mes.clave}-01` a hoy) y de la cohorte
    (`desdeLista` a hoy + cohorteId) contra cupos llevados. Siembra venta anulada, otro programa, venta futura,
    venta anterior a la apertura y venta sin valor vendido. El lanzador falla antes de iniciar Vitest con
    `spawnSync ps EPERM` (`scripts/test.mjs:98`). No hay resultado de paridad: no se afirma que cuadre ni que
    difiera. Por la regla «una cifra sin lista probada no lleva evidencia», no se agrega todavía `listas`
    al constructor ni se leen cinco filas. El enlace histórico de la frase se conserva. Sin lecturas nuevas,
    no hacen falta cambios de mocks en `tests/paginas.test.ts`.
  - **Hallazgos:** como anticipaba el 19, el tono por umbrales pasa a la escala contra esperado de la Cifra:
    pueden cambiar etiquetas y colores, no cantidades. La barra USD ahora es visible. El constructor E-2
    conserva su formato decimal para Por día hábil y sus motivos de vacío; no se reescriben cuentas ni redondeos.
    La ficha compartida de Vendido todavía dice «valor vendido de cada venta de pauta» en su fórmula aunque
    aquí el universo es todas las áreas; las fichas de ritmo hablan de ventas/cohorte también al usarlas en
    USD/mes. Se deja a carril D la revisión de estos textos, sin variantes locales ni cambios de registro.
  - **No tocado:** consultas (incluida `vamos-a-llegar.ts`), constructor E-2, `lib/metricas/*`, vocabulario,
    esquema, migraciones, ADRs, handoff, `/hub`, ni las demás pestañas. No se leyeron `.env*` ni se accedió a
    bases o servicios reales. No se cambió `status:` ni ninguna casilla de Done cuando.
  - **Verificado:** `npm run typecheck` pasa. `npm run lint` pasa con cero errores y las siete advertencias
    ajenas ya existentes. `git diff --check` limpio. Nuevos tests de fichas y render estático cubren las seis
    explicaciones sin jerga, barras/celdas, enlaces originales, acceso sin listas y vacío sin meta/cohorte.
    **Pendiente:** ejecutar esos tests y la paridad; la corrida por `npm test --` de norte-evidencia,
    explicaciones-del-norte, cifras-del-norte, vamos-a-llegar, paginas y frontera-cliente-guardian se bloqueó
    por el mismo `ps EPERM`; no se saltó el lanzador y no se declaran verdes. Tampoco se verificaron build,
    clics con gerente/paid trafficker, comparación visual claro/oscuro/375 px, PDF de Hoy página por página,
    humo ni rendimiento. No se arrancó Next (carga archivos de entorno) ni se preparó una base local con
    migraciones bajo las restricciones de esta tarea. E-3 sigue pendiente de esa verificación.

- **16-nov · E-3 Comercial: integrado en el Hub de un programa; pendiente de verificación de ejecución.**
  - La página prepara `cifrasClaveDeComercial`, `cifrasDeCloser` y los cinco constructores de recorridos existentes,
    con detalles YA proyectados. `DashboardPrograma` solo pasa props; `Operacion`, `Escalera` y barras aceptan cifras
    opcionales y conservan la rama vieja sin ellas. `Comparativo` de Hoy no se cambió. No se tocaron queries,
    registro, vocabulario, fórmulas, `/hub` de todos, Hoy, Dinero, Pauta ni el guardián 447.
    Cifras clave son tarjetas; aviso, embudo (cantidad, %, perdidos), escalera, siete escalones, calidad, tiempos,
    caminos, semanas, closers y auditoría abren la explicación. «Cómo vendió» conserva su barra y recibe los grupos
    por closer. Los segmentos conservan alto, ancho, color y texto; el cero del embudo también abre explicación.
    `Cifra` añade `children` opcional para preservar el disparador de barras y formatos heredados de celdas.
  - **Mapa de claves:** `lib/hub/explicaciones-de-comercial.ts` resuelve una vez `citas`, `asistencia`,
    `cierre_de_ventas`, `cita_a_venta`, `vendido`, `recaudado`, `por_cobrar` contra su propia ficha;
    `citas_sin_marcar → citas_pendientes`. Todas con `universo: "todas"`. Recorridos vienen de
    `explicacionesDeRecorridos()`: escalones/grupos → variables de `ventas_por_escalon`;
    porcentaje → variante de esa ficha; días escalera → `dias_cita_a_pago`; cita sin resultado →
    `escalera_sin_resultado`; pasos, conversión y perdidos → `embudo_comercial`;
    pasaron/siguen/perdidos → `conversion_por_etapa`; días etapa → `tiempo_en_etapa`;
    semanas → `shows` / `no_asistio` / `citas_pendientes` / variante futura de `citas`;
    abiertos/sin dueño → sus fichas; motivos → `perdidos_por_motivo` y `ticket_perdido`;
    ventas sin llamada → grupo de `ventas_por_escalon`. Ninguna ficha nueva o texto de definición inventado.
  - **Evidencia conectada:** cuatro lecturas en paralelo de `listaDeMetrica`, página 1 y corte a cinco filas,
    SOLO con `veEquipo`: `agendas`, `grupo_citas`, `grupo_shows`, `grupo_pendientes`. Mismo programa,
    periodo, cohorte y closer que las cifras clave. Filas con nombre y fecha. El grupo no expone `conShow` /
    `vendido` en sus filas: la nota ya no promete la columna de quién suma arriba. Son las personas de abajo
    de la fórmula, y la lista completa permite revisar el deal. Por closer solo botón, nunca cinco filas.
    `cierres` conecta los botones del dinero por closer; NO se lee para vista previa porque ninguna cifra
    global de este bloque la consume. Recorridos solo botón de los detalles existentes: escalera, semanas,
    abiertos y sin dueño; Caminos reutiliza la lista del siguiente paso / siguen / perdidos de la rama vieja,
    y conecta los días a `embudo.tiempo` (la etapa en el programa, Ganado → ganado_parcial).
    El último «Pasaron» no tenía lista y sigue sin ella. Porcentajes, días de la escalera y motivos no traían lista y no
    se inventó una. Perdidos del embudo conserva el enlace anterior, rotulado explícitamente como **lista
    completa del paso anterior**, incluidos quienes avanzaron; no es una lista exclusiva de pérdidas.
    Paid trafficker no lee evidencia ni recibe enlaces de los detalles proyectados; no se construyen cifras
    de closers ni de abiertos por owner para él.
  - **DC-1 — decisión de la revisión, para confirmar con Mani:** aplicado el addendum del brief.
    Comercial de un programa ya no monta `InfoDePagina`, ni con `?info=`; Pauta conserva su condición y su Info.
    `DealsContraAgendas` recibe `sinInfo` solo desde el programa: ambas ramas sustituyen los dos «?» por el
    texto gris conservado. Sin prop queda igual. `hrefInfo` de la ficha del deal apunta ahora a
    `hub?seccion=comercial#como-cierra`; `Escalera` añade esa ancla y `scroll-mt-4` solo con cifras.
    `ficha-cierre.tsx` no se tocó. Se retiró `info-de-comercial.tsx` tras comprobar cero llamadores:
    `/hub/page.tsx` solo solicita Info de Hoy o secciones vacías, no importaba Comercial.
  - **Inventario frase por frase de `info-de-comercial.tsx` antes de retirarlo:**

    | Frase del Info | Destino comprobado / conservación visible |
    |---|---|
    | Citas creadas dentro del periodo | `citas.que/variables` cuenta por día de cita, no creación: no equivale. Se conserva literal bajo Cifras clave para decisión de Mani; discrepancia preexistente. |
    | Citas realizadas entre citas ya marcadas | `asistencia.que/formula/variables` (Realizadas, Citas del grupo, Sin marcar). |
    | Ventas entre citas marcadas con show | `cierre_de_ventas.formula/variables` (asistieron y compraron / asistieron). |
    | Ventas entre todas las citas marcadas | `cita_a_venta.formula/variables`, grupo de citas con sin marcar fuera. |
    | Más de 10 % sin marcar vuelve parcial la tasa | Las variables avisan parcial, pero no dan 10 %: literal visible bajo Cifras clave. |
    | Esas citas nunca cuentan como no-show | `citas_pendientes.variables` y `no_asistio.variables`; además se conserva junto al umbral. |
    | Deals creados → Agendaron → Tuvieron show → Compraron | `embudo_comercial.que/variables`, y títulos de las cuatro barras conservados. |
    | Los deals creados en el periodo | `embudo_comercial.que/variables.Deal creado`. |
    | Cada porcentaje divide una barra por la anterior | Variante `conversion_del_paso.que/formula` de `embudo_comercial`. |
    | Compraron solo cuenta ventas con show antes del pago | La ficha dice show y Abonado/Completo, no «antes del pago»: frase completa visible bajo el título del embudo. |
    | Las demás van en su línea aparte | Visible con la frase anterior; la línea y ficha `ventas_sin_llamada` permanecen. |
    | Si el periodo terminó hace poco (los días de madurez del programa), aún pueden llegar ventas | No está en la ficha: visible en el embudo. |
    | Completo significa que la persona terminó el formulario, aunque haya empezado con un parcial | No está en la ficha del embudo: visible en el embudo. |
    | Cerró en la llamada: el primer pago cae el mismo día (Bogotá) que la llamada con show | El segmento abre `cerro_en_la_llamada`, variable «Agrupa Pagó en la llamada». La base `ventas_por_escalon.variables.Pagó en la llamada` define primer abono y día de cita atendida, pero la variante no la incluye ni explicita Bogotá: definición completa visible y etiquetada bajo Escalera. |
    | Cerró con seguimiento: el primer pago llega días hábiles después de esa llamada | El segmento abre `cerro_con_seguimiento`, variable «Agrupa Pagó rápido y Pagó después». La base explica ambos escalones, la variante no los desarrolla: definición completa visible y etiquetada bajo Escalera. |
    | No cerró: tuvo show y no hay venta | El segmento abre `no_cerro`, variable «Agrupa Atendió y no compró». La base desarrolla esa variable, la variante no: definición completa visible y etiquetada bajo Escalera. |
    | Nadie lo etiqueta: se calcula con la llamada marcada y el primer abono | Las variables de escalones cubren llamada/abono, no «Nadie lo etiqueta»: frase completa visible bajo Escalera. |
    | Una cita sin marcar no entra | No queda completa en las tres variantes: visible bajo Escalera. |
    | Las ventas sin llamada registrada van aparte | Ficha/variante `ventas_sin_llamada` y línea aparte conservadas; frase también visible bajo Escalera. |
    | Cada deal lo dice en su ficha | No es definición de métrica: visible bajo Escalera. |
    | Compara cuándo nacen los deals y cuándo se crean sus agendas | No es cifra: visible bajo Deals y agendas, en sus dos ramas. |
    | Los controles cambian el paso y la forma de la misma serie | No es cifra: visible en el mismo texto gris de Deals y agendas. |
    | Camino del setter: deals que pasaron por En gestión, Contactado o Calificado | `conversion_por_etapa.variables.Camino del setter`, con nombres de sus etapas. |
    | Camino de la llamada: deals que llegaron a Agendado | `conversion_por_etapa.variables.Camino de la llamada`, comienza en Agendado. |
    | Siguen aquí: abiertos, aunque hayan vuelto a una etapa anterior | La ficha nombra «siguen aquí» pero no la vuelta: visible bajo Caminos. |
    | Se perdieron aquí: hoy en Cierre Perdido | La ficha no explicita esa etapa: visible bajo Caminos. |
    | El tiempo es la mediana de días hábiles en la etapa | `tiempo_en_etapa.formula/variables.Mediana`. |
    | Con menos de cinco deals sale “—” | `tiempo_en_etapa.variables.Mediana`. |
    | Las citas se agrupan por su semana y resultado: show, no-show, sin marcar o futura | Las cuatro fichas explican resultados, no la agrupación: frase completa visible bajo Citas por semana. |
    | Las mismas cifras de arriba, por closer, en el periodo elegido | Es contexto de tabla: visible bajo Closers. |
    | Sin casos sale “—” | Visible bajo Closers, con el disparador heredado preservado. |

  - **Hallazgos de formato y texto (sin esconder diferencias):** las citas de closer en cero pasaban de «—»
    a «0» con el constructor directo; se conserva «—» como contenido del disparador (el valor explicado es 0).
    Sin ventas el dinero sigue «—»; con ventas y cero recaudado sigue «USD 0,00». Porcentajes conservan un decimal.
    Los días con fracción se mantienen en pantalla: Escalera `2,5`, Caminos `2,5 días hábiles`; el constructor
    de unidad `dias` escribe **«3 días»** en explicación/aria para ese mismo 2,5 (hallazgo pendiente de Mani,
    no se cambió ficha, formato central ni contrato). La ficha de `cierre_de_ventas.que` aún dice «de pauta»
    aunque el universo pasado es todas; se conserva el texto real y se reporta, no se inventa una variante.
    La conservación literal de «Citas creadas» y de «show antes del pago» requiere decisión de Mani frente
    a las fichas actuales. No se verificó paridad contra datos de producción.
  - **Retirado / búsquedas:** `rg -n 'info-de-comercial|seccionesDeInfoDeComercial|info=escalera' app components`
    devuelve cero resultados. `EnlaceAInfo` queda condicional a la rama vieja en Operacion/Escalera y a
    `!sinInfo` en DealsContraAgendas. Info de Pauta y Hoy conservados. `ESCALONES` se importa del catálogo
    puro `lib/escalones`, no del reexport de queries. Nuevos imports de constructores en componentes son
    solo tipos; las explicaciones se resuelven en servidor. Revisión independiente en otra sesión realizada.
  - **Verificación:** `npm run typecheck` terminó con salida 0; `npm run lint` terminó con salida 0, sin errores
    y siete advertencias ajenas en `hub/lista/page.tsx`, `lib/mcp/recurso-protegido.ts` y
    `lib/queries/filtros-de-lista.ts`. `git diff --check` sin errores.
    Test puro nuevo `tests/explicaciones-de-comercial.test.ts`: ocho fichas reales (`que`, `formula`,
    `variables`), cifras clave con parcial, formato heredado del cero y variables de grupos.
    `tests/paginas.test.ts` solo amplía los mocks de escalera y caminos, sin alterar afirmaciones.
    `npm test -- tests/explicaciones-de-comercial.test.ts tests/paginas.test.ts tests/frontera-cliente-guardian.test.ts`
    **no ejecutó tests**: el lanzador falló con `spawnSync ps EPERM` en `scripts/test.mjs:98`.
    Pendientes para quien revisa: esos tests, build y recorrido interactivo de programa y rama vieja, claro,
    oscuro y 375 px frente al boceto; clic en tarjetas, segmentos, tablas, listas y ancla de ficha.
    No se arrancó dev ni build, no se abrió la app ni conectó a base, no se leyó `.env*`, no se instalaron
    paquetes, no hubo git add, commit ni push. `.claude/launch.json` ajeno intacto.

  - **16-nov, sesión externa (revisión, Claude).** Pasaron fuera del sandbox: `explicaciones-de-comercial`,
    `cifras-de-comercial`, `cifras-de-recorridos`, `cifras-de-hoy`, `explicaciones-de-hoy`, `paginas`,
    `frontera-cliente-guardian`, `vigencia-centralizada`, `volver-de-listas`, `enlace-guardian`, `explicacion-sin-jerga`,
    `show-y-sin-resultado-guardian` y `tracker-coherente`; typecheck y lint limpios (7 advertencias ajenas); `npm run build` pasa.
    **Línea base:** con `dev:local` y el gerente, la pestaña del commit anterior (copia de trabajo aparte) contra la nueva en
    ComunicArte Local, C1, desde el inicio: todos los valores iguales (cifras clave 8 / 85,7 % / 16,7 % / 14,3 %, embudo
    22 → 8 → 6 → 1 con sus porcentajes y perdidos, escalera, caminos, citas por semana, las cuatro filas de closers,
    abiertos, sin dueño y siete escalones). Las 115 cifras de la pantalla abren su panel con fórmula y «Calculada con»;
    consola sin errores; 375 px sin desborde horizontal; claro y oscuro. Paid trafficker: 75 cifras, ninguna con lista, sin
    tabla de closers ni abiertos por owner. `/hub` de todos y Hoy siguen con su forma y sin errores.
    **Arreglo de la revisión (hallazgo que la pasada de Codex no anotó):** las tarjetas de Asistencia y Cierre de ventas
    perdían el aviso «parcial» de la tarjeta vieja. Hay dos reglas: la tarjeta usaba `grupo.parcial` (más del 10 % sin marcar,
    `UMBRAL_SIN_MARCAR`) y `entradaDesdeRazon` usa la cobertura de la razón (menos del 80 %); con 1 sin marcar de 8 la primera
    avisa y la segunda no. `cifrasClaveDeComercial` conserva ahora el aviso del grupo (`avisarSinMarcarDelGrupo`, frase de la
    tarjeta vieja: «Calculado sobre 7 de 8 citas: 1 sin marcar.»); las filas por closer y Hoy no cambian. Test nuevo en
    `tests/cifras-de-comercial.test.ts`. **Para Mani:** decidir si queda una sola regla de parcial.
    **Para Mani, además:** (1) los textos grises bajo cada título son las frases del Info que no están en ninguna ficha; el
    de la escalera es largo y pide ficha o recorte; (2) la página cuelga los enlaces de lista de Caminos y de «perdidos» del
    embudo sobre cifras ya armadas, porque esos constructores no reciben lista: conviene pasarlos como parámetro;
    (3) el enlace «Cómo cerró» de la ficha del deal ahora lleva a la tarjeta de la escalera.
    **Sin verificar:** `npm run test:humo`, la comparación (Comparar con), un programa con motivos de pérdida y con dos
    monedas, el boceto lado a lado, y datos reales.

- **14-nov (noche) · Carril D: E-3 Comercial desbloqueado (`5676be06`).** Las claves que pedía `lib/hub/cifras-de-recorridos.ts` ya
  tienen explicación: `explicacionesDeRecorridos()` en `lib/metricas/explicacion.ts` devuelve un `Record<string, ExplicacionDeConcepto>`
  con TODAS (escalones y grupos, `porcentaje_de_escalera`, `dias_medianos_de_escalera`, `cita_sin_resultado_de_escalera`,
  `embudo_comercial_{creados,agendaron,tuvieron_show,compraron}`, `conversion_del_paso`, `perdidos_del_paso`, `pasaron`,
  `siguen_en_etapa`, `perdidos_en_etapa`, `dias_medianos_en_etapa`, `citas_futuras`, `deals_perdidos`, `ticket_perdido`, `shows`,
  `no_asistio`, `citas_sin_marcar`, `deals_abiertos`, `deals_sin_dueno`). **Para Alejo:** la página pasa
  `explicacionesDeRecorridos()` como `explicaciones` a los constructores; no hay que renombrar ninguna clave del constructor (la de
  `tuvieron_show` se resolvió del lado de las variantes; la lista sigue siendo `embudo_comercial_shows`). Seis fichas nuevas
  (`embudo_comercial`, `conversion_por_etapa`, `tiempo_en_etapa`, `dias_cita_a_pago`, `perdidos_por_motivo`, `ticket_perdido`),
  texto y fundamento aprobados por Mani en `docs/diseno-cifra-y-pauta.md` §2.2 «Comercial · los recorridos». El catálogo de la
  escalera vive ahora en `lib/escalones.ts` (puro; `lib/queries/escalera.ts` lo re-exporta). Ninguna cifra cambió.
- **14-nov · E-3 Hoy.** Solo el Hub de un programa, sin commit ni push.
  - La página arma `cifrasDeHoy` y, solo con `veEquipoComercial`, `cifrasDeClosersDeHoy`; `Hoy` recibe las
    cifras por props y las entrega al reporte. `ProgramaDelReporte` admite las cifras opcionalmente: `/hub` de
    todos los programas conserva la presentación anterior, sin cambiar su página ni sus consultas.
    `lib/hub/explicaciones-de-hoy.ts` resuelve una vez el Record con `explicacionDe`, universo todas las áreas;
    el de closers reutiliza esas explicaciones. Mapa comprobado contra registro:
    `citas_realizadas → shows`, `citas_sin_marcar → citas_pendientes`, `citas_de_manana → citas_del_dia`.
    El resto usa su propia clave. No se editó registro, queries, esquema, migraciones ni fórmulas.
  - Cifras clave, cierre, conteos del embudo y de citas, dinero del día y semana usan `Cifra`; las cinco columnas
    numéricas por closer usan `tamano="celda"`. Se conservan embudo de barras, lista de citas, tabla de ventas,
    caja por origen, reparto semanal, alertas, cabecera y navegación. Sin tarjeta dentro de tarjeta.
    El bloque Objetivos / ¿Vamos a llegar? y sus explicaciones se conservan íntegros.
  - **Cobertura (390):** `mostrarCobertura`, opcional en `Cifra` y activado solo en Hoy, muestra en tarjetas y
    celdas el texto Parcial escrito por el constructor, con la fórmula numérica (su base) y los faltantes.
    En vacío muestra el motivo que ya escribió el constructor. No cambia ninguno de los dos umbrales de E-2.
    Pauta y Dinero mantienen su presentación en pantalla. Test puro nuevo `tests/explicaciones-de-hoy.test.ts`:
    fichas reales, los valores de referencia de los tres días (con entradas sintéticas, no una lectura de la app),
    y renderizado de tarjetas/celdas con 3 de 10 resueltas, siete sin resultado y Parcial, también por closer.
  - `hoy/citas.tsx` ya no reescribe cita sin resultado: usa `citaSinResultado` y `fueCancelada` del dueño.
    Se retira **solo** su entrada de deuda de `tests/show-y-sin-resultado-guardian.test.ts`.
    `rg -n 'resultado.*(===|!==)|fechaAgenda.*<=' components/dashboard/hoy/citas.tsx` da cero.
  - **Evidencia:** seis lecturas por listas distintas, en paralelo y solo con `veEquipo`: agendas, shows,
    canceladas, cierres, grupo_pendientes y caja. Cinco filas como máximo por lista;
    el corte es el del reporte, día entero, sin cohorte ni closer. Paridad de las cinco primeras en
    `tests/cifras-de-hoy.test.ts`; caja reutiliza la lista probada de Dinero. Los detalles ya existentes y su
    proyección `sinListas` conservan la reja. `tests/paginas.test.ts` ya simulaba `listaDeMetrica`; se amplió
    el reporte simulado con los campos que ahora consume el constructor, sin cambiar afirmaciones.
    **Sin vista previa del grupo:** Asistencia y Cierre conservan su enlace probado, pero no cinco filas porque
    falta el indicador de quién suma arriba. **Sin evidencia:** Envíos (formularios frente a personas, H10), Leads del día y Sin resultado (sin prueba
    específica aquí), Leads que hacen falta, quien no abre listas. Semana lleva los enlaces existentes, sin
    cinco filas ni total de lista; closers conserva detalles y enlaces probados, sin vista previa (su constructor
    no recibe filas). Citas de mañana y banderas siguen con sus enlaces anteriores.
  - **PDF:** reglas de impresión acotadas a `#reporte-diario [data-abre-explicacion]`: sin sombra, borde de
    interacción, hover ni transición; conserva texto y barras. Oculta «Cómo se calcula →» y el panel se marca
    `print:hidden`; el portal además queda fuera del reporte con la regla de impresión existente.
    `DescargarReporte` sigue usando `window.print()` y no depende del Info. No se cambió su comportamiento.
  - **DC-1, inventario del Info de este programa** (la versión de todos los programas no se retira):
    - Cupos vendidos → `cupos_vendidos.que/formula/variables`. Objetivo del día **queda** como explicación de
      ajuste en Info, incluida la frase original sobre faltante de cohorte / días hábiles; no está en esa ficha.
    - «Leads de hoy / formularios completos» → `leads.que/formula/variables`, que dice personas distintas y
      primera aplicación, incluyendo parciales. **Discrepancia ya existente, para Mani:** la frase anterior no
      describe ese dato; no se trasladó como si fuera correcta. No cambia el número (H12, sigue `null → 0`).
      Objetivo de leads → permanece en Configuración del Info; el valor y avance siguen junto a la Cifra.
    - Entró a caja → `entro_a_caja.que/formula/variables` (fecha del abono, monedas, adicionales y anulados).
    - Asistencia del día → `asistencia.que/formula/variables`; cuenta real en fórmula numérica; faltantes y
      condición de parcial en la lectura del constructor. Asistencia por cita → `show_por_cita.que/formula/variables`
      en la semana; conserva su denominador distinto. No se conserva una segunda fórmula de show en el Info.
    - Cierre → `cierre_de_ventas.que/formula/variables` y fórmula numérica. Los cuatro pasos del embudo →
      `registros`, `citas_del_dia`, `shows`, `cupos_vendidos` (`que/formula/variables`). El ejemplo de barra
      se sustituye por el visual real y su frase visible «100 % = la barra más larga», que se conserva.
    - Leads que hacen falta **se detiene y conserva su forma y su Info**, incluido el ejemplo numérico.
      La ficha `leads_que_hacen_falta` ya tiene `que/formula/variables` y el constructor conserva el motivo
      de vacío, pero no explican todo el ejemplo anterior. **Falta de campos, pedido a D:** la ficha/construcción no lleva las variables
      numéricas del antiguo ejemplo (faltante, días restantes, origen/muestra de las tasas, objetivo directo de
      cita a venta y citas/leads de la ventana). No se inventaron operandos ni se cambió la fórmula. Queda
      pendiente trasladar ese ejemplo dinámico completo. No se pierde ni cambia su redondeo anterior a entero;
      tampoco se expone el decimal del constructor (otra diferencia visible fuera de los tres días de base).
    - Vendido / Recaudado / Por cobrar → fichas homónimas, `que/formula/variables`; parciales del constructor.
      «Cómo nació» **se conserva** en la sección Lectura del Info, pendiente de decisión de Mani (describe una
      columna de la tabla conservada). No explica las tres Cifras de dinero.
    - Citas / realizadas / canceladas / sin resultado → `citas_del_dia`, `shows`, `citas_canceladas`,
      `citas_pendientes` (`que/formula/variables`). La frase sobre agrupar por closer y abrir el negocio
      **se conserva** en Lectura, para que Mani decida su destino.
    - Semana: objetivo × días transcurridos / días de semana → lectura de la barra de `llevamos` y `leads`
      generada por `armarCifra`; Programa y Semana en filtros. La explicación de la asistencia va a su propia ficha.
    - **Permanecen:** Pendientes (mañana, Sin Grain, Sin valor y Alertas por persistencia), Configuración
      (objetivo de leads, días del ritmo, mínimo de citas), Objetivos (fuera de alcance). «Leads y citas son
      hechos del mismo día, no necesariamente de las mismas personas» queda en Lectura, a decidir por Mani.
    Los «?» de los cinco títulos de bloque migrados se retiran solo en este programa. El «?» de Leads que
    hacen falta sigue apuntando a su fórmula anterior. Pendientes y Objetivos conservan
    su enlace. Ninguna fuente impresa se toma del Info.
  - **Bloqueos / pedido al carril D:** no se migran `shows_sin_grain`, `atendidos_sin_valor`,
    `atendidos_sin_grain`, `perdidos_con_pagos`, ni `llamadas_sin_resultado` (retirada por E-1 a favor de
    `citas_pendientes`). No hay ficha; no se escribió texto sustituto. Se conserva el bloque con casos y
    «Sin pendientes: …». Citas de mañana tampoco migra: el mapa existe, pero `citas_del_dia.que/formula`
    dice explícitamente «hoy»; cambiar solo el rótulo mentiría. Hace falta variante de día en la ficha.
  - **Hallazgos y preservación de línea base:**
    - H12: Leads sin medir continúa 0, tal como el constructor y la línea base; se propone «—» para otra
      decisión explícita, no en este cambio.
    - H13: se preservan las barras simples del día (Cupos y Leads) junto a sus Cifras, con los mismos valores
      y objetivos. No se introduce una marca de tiempo que afirme que pasó el 100 % del día. El constructor
      no trae `avance` diario: por eso se conserva la pieza simple, sin alterar la Cifra ni las barras semanales.
    - Nuevo: el constructor de closers devuelve USD 0,00 cuando no hay caja; la tabla vieja y la base dicen
      «—». La página conserva la ausencia de filas de caja para mostrar **«—»**, sin tocar el constructor.
    - H11 sigue abierto: Leads de semana son envíos. Las fichas `ventas` y `cierre_de_ventas` aún dicen
      «de pauta», y la fórmula de `vendido` dice «venta de pauta», aunque el universo es todas las áreas
      (extensión de H20). Pedido a D: texto neutral/variante; no se cambió ninguna ficha ni texto local.
    - La vista previa del grupo no trae el indicador tipado de quién suma arriba de Asistencia (la lista devuelve
      personas y fecha, no `conShow`): no se conectan las vistas previas de Asistencia/Cierre. Se conserva el enlace a la lista probada.
      Pedirlo al carril D antes de dar por cerrado el detalle de evidencia; no se reconstruye desde etapas.
  - **Retirado y `rg`:** se retiran de la ruta migrada el Info de métricas y los resúmenes/cálculos de presentación
    reemplazados; no se borra ninguna pieza compartida. `rg -n 'Ficha|CifraConEnlace|CuentaDeAsistencia|CifraConLista|ResumenDeCifra|CifraDeRazon|Comparativo' components/dashboard/hoy components/dashboard/operacion.tsx 'app/(app)/hub/secciones.tsx'`
    devuelve 54 líneas: siguen con llamadores. `Tasa`, `Conteo`, `Importe` y `Fila` siguen siendo llamados por
    las ramas anteriores que usa `/hub` de todos. No hay retirada de archivos sin prueba de cero llamadores.
  - **Verificación:** `npm run typecheck` pasó; `npm run lint` pasó con cero errores y las siete advertencias
    ajenas. `npm test -- tests/explicaciones-de-hoy.test.ts` y `npm test -- tests/paginas.test.ts` fallan antes
    de Vitest por `spawnSync ps EPERM` en el sandbox; no se saltó el lanzador y no se declaran verdes.
    Pendientes para la sesión externa: esos dos archivos, `tests/show-y-sin-resultado-guardian.test.ts`,
    `tests/frontera-cliente-guardian.test.ts`, y las pruebas existentes de cifras de Hoy/closers.
    No se abrió la app ni se descargó PDF ni se midió rendimiento: la instrucción de esta sesión prohíbe
    conectar a cualquier base. No se arrancó dev ni build (hay dev vivo). Faltan contraste visual claro/oscuro/375 px,
    clics y PDF página por página; E-3 y la casilla 4 del 390 **no se declaran cerrados**.
  - **14-nov, sesión externa (revisión).** Pasaron fuera del sandbox: `explicaciones-de-hoy`, `paginas`,
    `show-y-sin-resultado-guardian`, `frontera-cliente-guardian`, `cifras-de-hoy`, `vista-hoy` y
    `configuracion-hoy-acciones` (218 tests); typecheck y lint limpios. Recorrido con `dev:local` (gerente, 1-oct):
    sin errores de consola, la Cifra abre su explicación, 375 px sin scroll horizontal, claro y oscuro bien.
    **Arreglo:** en `tamano="celda"` la Cifra vacía ya no imprime el motivo («No se puede calcular… nunca significa
    cero») debajo del «—»: en la tabla de closers apretaba las cabeceras; el motivo sigue en la explicación y en las
    tarjetas, y Parcial se sigue mostrando en celdas. **Falta:** `npm run build` (había un `dev` vivo en la carpeta),
    el PDF página por página y una fecha con closers con datos.

- **14-nov · E-3 Dinero.** Integrada solo la rama `seccion === "dinero"` y su carga en la página del programa.
  - El servidor arma `cifrasDeDinero` y `cifrasPorCohorte`; `lib/hub/explicaciones-de-dinero.ts` arma una sola vez el
    Record desde las cinco fichas con `explicacionDe`, universo todas las áreas. Test puro nuevo:
    `tests/explicaciones-de-dinero.test.ts` (fichas, línea base, parcial y dos monedas), sin base ni reloj.
  - `Dinero` recibe las Cifras mediante `DashboardPrograma`: tarjetas Vendido/Recaudado/Por cobrar, una tarjeta de
    Entró a caja por moneda, y las cuatro celdas por cohorte. El parcial del constructor se ve en tarjetas y también
    como badge en celdas (la variante celda de `Cifra` todavía no pinta etiquetas). Ninguna cifra de Dinero necesita
    `RazonConCobertura`: aquí el parcial significa ventas sin valor vendido o sin saldo calculable.
  - La barra Recaudado/Por cobrar se conserva; recibe su fracción desde los datos que ya tiene la página. El componente
    no calcula ni formatea métricas; el porcentaje visible es la línea de Recaudado que escribe el constructor.
  - Evidencia: detalles y cinco filas de `contratado`/`caja`, con el mismo periodo, cohorte y closer. Las filas se leen
    solo para quien abre listas. Cada cohorte con id recibe su detalle probado de contratado. **Sin evidencia:**
    Sin cohorte (no existe lista probada que seleccione solo ventas sin cohorte); quien no abre listas conserva la
    explicación sin evidencia. Por cohorte hay botón a la lista, pero no cinco filas de vista previa: el constructor
    existente no recibe `evidencia` por cohorte y se mantiene su contrato.
  - **Retirado:** `CajaConVariacion` y sus imports exclusivos en `components/dashboard/piezas.tsx`.
    `rg -n 'CajaConVariacion' app components lib tests` da cero resultados tras retirarlo.
    `rg -n 'TarjetaVendido|<Caja\b|ResumenDeCifra' app components` confirma los usos conservados: TarjetaVendido
    en `/hub/secciones.tsx` (todos los programas), Caja en Hoy y Comercial, ResumenDeCifra en CifraConLista y el
    resumen de punto. La tarjeta vieja compartida y sus formatos no se tocan; Dinero usa `TarjetaDeCifrasDeDinero`.
    Dinero no tiene Info propio y no se retiró ninguno.
  - **Hallazgo visible / decisión propuesta:** sin abonos, Entró a caja pasa de «—» de la línea base a **USD 0,00**,
    exactamente lo que devuelve el constructor. Propuesta: conservar el cero, conforme a la regla del vacío (se midió
    y no hubo abonos); requiere revisión explícita de Mani. Las tres cifras de la línea base siguen siendo
    2.391 / 0 / 2.391 en USD; Tactical sigue 0 / 0 / 0. Cuando no hay valor vendido, el constructor no emite la línea
    porcentual; queda la barra vacía con su descripción accesible, sin inventar una razón. No se comprobó en base/app.
  - **Gráficas pendientes:** existe `GraficaConExplicacion`, pero no es un cambio directo: las dos gráficas actuales
    usan `Grafica`, tramos semana/mes y acumulados, dos cohortes alineadas, extras de dinero por moneda, enlaces y
    resúmenes por punto. La segunda cuenta Cupos con caja, no Entró a caja. Se conserva íntegro
    `graficas-de-dinero.tsx` y su resumen de punto hasta trasladar ese contrato sin perder cifras ni interacción.
  - No se tocó ¿Vamos a llegar?, Comercial, Hoy, Pauta, registro, queries, esquema ni migraciones.
  - **Revisión (Claude, misma fecha, antes del commit):** `docs/agents/handoff.md` devuelto (lo lleva Mani). Las tres
    cifras y Entró a caja van en una fila de cuatro, sin tarjeta dentro de tarjeta, con la barra bajo las tres.
    `tests/paginas.test.ts` simula `listaDeMetrica` (la página ahora lee las cinco filas de evidencia; sin eso dos casos
    de Dinero pedían la base).
  - **Hallazgo 20, para Mani (carril D):** la ficha `ventas` dice «Cuántos deals **de personas de pauta** pasaron a
    Abonado o Completo», y en Dinero la celda Ventas por cohorte es de todas las áreas: el panel muestra esa frase junto a
    «todas las áreas». No se escribió un texto local. Hace falta una frase neutra en la ficha o una variante para el
    universo de todas las áreas; lo mismo van a necesitar Hoy y Comercial.
  - **Verificación:** typecheck y lint limpios (7 advertencias ajenas); `npm run build` pasa;
    `tests/explicaciones-de-dinero`, `cifras-de-dinero`, `dinero-de-ventas`, `paginas`, `frontera-cliente-guardian` y
    `vigencia-centralizada` en verde (201). Con la base local y el rol developer: mismos valores que la línea base en
    ComunicArte (2.391 / 0 / 2.391, cohorte C1 con 3 ventas) y «¿Vamos a llegar?» idéntico; cada cifra y cada celda
    abre su explicación con fórmula, filtros, evidencia y enlace a la lista; consola sin errores; revisado en oscuro,
    claro y 375 px sin desborde horizontal. **Sin verificar:** dos monedas y sobrepago con datos reales (la semilla no
    tiene abonos), el rol paid trafficker en pantalla, `npm run test:humo` y el tiempo de la página con la evidencia.
    E-3 global sigue pendiente.

- **13-nov · E-3 Comercial — detenido antes de modificar código.** Al contrastar los constructores con E-1 se confirma el
  bloqueo del hallazgo 18: `cifras-de-recorridos.ts` requiere explicaciones sin ficha registrada para
  `porcentaje_de_escalera`, `dias_medianos_de_escalera`, `conversion_del_paso`, `perdidos_del_paso`,
  `pasaron`, `siguen_en_etapa`, `perdidos_en_etapa`, `dias_medianos_en_etapa`, `citas_futuras`,
  `deals_perdidos` y `ticket_perdido`. El embudo pide además `embudo_comercial_creados`,
  `embudo_comercial_agendaron`, `embudo_comercial_tuvieron_show` y `embudo_comercial_compraron`:
  la clave local `tuvieron_show` tampoco coincide con `embudo_comercial_shows` del vocabulario de listas.
  Las cantidades de escalera/grupos pueden corresponder a `ventas_por_escalon`, y
  `cita_sin_resultado_de_escalera` a `escalera_sin_resultado`; eso no resuelve las unidades porcentaje/días ni
  los otros conceptos. **Se necesita que el carril de Mani registre las fichas faltantes o confirme el mapa a fichas
  existentes, con su texto aprobado.** No se inventaron explicaciones locales ni se tocó `registro.ts`.
  - Leída la línea base suministrada; ninguna cifra ni pantalla se modificó. No se abrió la app, ninguna base ni secretos.
  - Solo cambia esta entrada del ticket. E-3 queda pendiente; no se construye una migración parcial que deje el Info
    con explicaciones duplicadas o retire explicaciones antes de tener sus fichas.
  - **Retirado: nada.** `rg -n 'seccionesDeInfoDeComercial|EnlaceAInfo|BarraDeCierre|DetalleDeEscalera|<Escalera' app components`
    confirma el llamador del Info en la página del programa, enlaces de Comercial y usos compartidos de `Escalera`
    en `/hub`, además de enlaces de Hoy y de la ficha del deal. No hay piezas reemplazadas con cero llamadores.
  - **Evidencia pendiente de conectar:** toda la integración; se conserva el criterio del hallazgo 17 (caminos,
    pérdidas del embudo y motivos sin lista probada). No se añadieron enlaces por similitud.
  - No se ejecutaron typecheck, lint ni tests: no cambió código ni se creó un test. Build y recorrido visual
    siguen a cargo de quien revisa, conforme al alcance de esta sesión.

- **13-nov (noche), E-1 hecho (carril D, Codex; revisado por Claude).** El texto vive en la ficha (`lib/metricas/registro.ts`) y
  lo arma `explicacionDe(clave, variante?)` en `lib/metricas/explicacion.ts`, con las diferencias de Pauta como variantes nombradas
  (`VARIANTES_DE_PAUTA`); el puente se borró y sus tipos viven en `lib/metricas/cifra.ts`, que deriva la unidad de la ficha
  (`unidadDeCifra`, con `dias`). Test sin excepciones: toda ficha con `que`, `formula` y `variables`; `explicacion-sin-jerga`
  recorre el registro entero. Claves nuevas: las nueve de Pauta (`presupuesto`, `agendas_dia`, `agendas_req`, `inversion_req`,
  `roas_proy`, `envios_sin_id`, `registros_sin_utm`, `ventas_sin_anuncio`, `embudo`) y `ventas_por_escalon` (un concepto con el
  escalón como dimensión, no siete claves: la regla vive solo en `escalonDeDeal`), `escalera_sin_resultado` (fila propia del
  diccionario: su predicado incluye Cierre Perdido, así que no es `citas_pendientes`), `grupo_de_citas`,
  `con_show_y_vendidos_hoy`, `deals_abiertos`, `deals_sin_dueno`, `descuento_promedio` (USD) y `descuento_promedio_porcentaje`
  (dos claves porque el USD se suma entre programas y el % nunca, ADR 0048). Retiradas: `citas_realizadas` (queda `shows`) y
  `llamadas_sin_resultado` (queda `citas_pendientes`). "Citas sin marcar" es `citas_pendientes`; "Tasas por programa" es una vista,
  no un concepto. Ninguna cifra cambió; el texto visible de Pauta solo cambió en Asistencia y De cita a venta, como aprobó Mani.
  **Para el carril P:** en `lib/hub/` los nombres locales `citas_realizadas` → ficha `shows`, `citas_sin_marcar` → `citas_pendientes`,
  `citas_de_manana` → `citas_del_dia` (mismo concepto, otro día). `ExplicacionDeConcepto` no cambió de forma.
  **Sin fuente, quedaron con el texto de §2.2:** Envíos (¿solo completos o también parciales? el diccionario se contradice) y la
  compensación exacta de `objetivo_semana` (regla del 146). **Revisar:** `agendas_meta` (pixel de Meta) quedó como variante de
  `costo_agenda_meta` según el mapa del ticket, pero es otro número; si se pinta solo, merece clave propia.

- **10-nov · Alejandro (carril P).** Commit 1: `FichaDeMetrica` gana `que`, `formula` (`forma` razón/suma/conteo/resta/producto,
  `terminos`, `por1000?`), `variables` y `aliasExcel?`, todos opcionales; no se tocó ninguna ficha. **Costura con el carril D:**
  Pauta no tiene claves en `ClaveDeMetrica` ni fichas en `REGISTRO` (solo `VOCABULARIO_PAUTA_SEMANAL`). Mientras D las registra,
  los textos de §2.1 de Pauta viven en el módulo de la Cifra ligados a su clave, y pasan a la ficha en un commit propio cuando
  existan.
- **10-nov · Alejandro.** Contrato y pieza:
  - `lib/metricas/cifra.ts`: `armarCifra` arma `CifraDeMetrica` en el servidor, todo ya escrito (valor, los ocho casos raros,
    estado DM-1, barra, comparación en gris, fórmula con "Con los números de esta cifra", cómo leer la tarjeta, filtros,
    evidencia). La escala de estado vive ahí y `cumplimiento-de-cohorte.ts` la importa.
  - Piezas evolucionadas: `cifra-con-lista.tsx` (`Cifra`, tamaños tarjeta y celda), `como-se-calcula.tsx`
    (`ExplicacionDeCifra`, las cinco secciones), `barra-de-avance.tsx` (forma con marca: lleno, rayado y "a hoy N"),
    `variacion.tsx` (`CambioDeCifra`). Nuevo `components/ui/sheet.tsx` (panel lateral; foco en Cerrar, Escape y vuelta del
    foco, verificados).
  - Primer uso: "¿Vamos a llegar a la meta de la cohorte?" en Hub › Pauta, con cuatro barras. Agendadas va con "todas las
    áreas" porque eso es lo que cuenta hoy la consulta (`agendasDeLaCohorte`), no "de pauta" como el boceto.
  - Semáforo con En meta / En seguimiento / Rezagado.
  - Verificado con `dev:local` en claro y oscuro, a 1280 y 375 px; consola limpia; `npm run build` en verde.
  - **Falta:** la evidencia (cinco filas y el botón a la lista) en el cumplimiento, que necesita una lista que cuente lo
    mismo que la cifra, con test; la celda en la tabla semanal; migrar el resto de los bloques; `test:humo`; ajustar
    `structure.md` §9.
  - Nota: `npm run db:local` falla al sembrar (el programa de prueba no tiene % de comisión, `mover-etapa.ts:338`). La base
    queda con datos parciales y sirve para mirar. No es de este carril.

- **11-nov · Mani (desbloqueo).** Decidido por el ADR 0038 (enmienda 11-nov): la llamada de un deal anulado no cuenta. Ya está en
  `main`: la barra de agendas del cumplimiento y la lista `agendas_creadas` cuadran (el `it.fails` pasó a test normal), así que
  **la evidencia de agendas ya se puede conectar**. El enlace de Asistencia de la tabla semanal ya no da 404: `show` abre
  `grupo_shows` y `cierre_ventas` abre `grupo_vendidos`, con área Paid (misma lectura que la cifra). Las dos notas de "Para
  retomar" sobre esto quedan resueltas.

- **13-nov · Alejandro (carril P). E-2, Comercial, primer commit: cifras clave y tabla de closers.** Ninguna pantalla cambia
  todavía (eso es E-3); nada llama aún a los constructores fuera de `tests/`.
  - `lib/metricas/razon-a-cifra.ts`: `entradaDesdeRazon(razon)`, la única traducción de `RazonConCobertura` a la Cifra. Archivo
    aparte y no dentro de `cifra.ts` para no chocar con E-1, que mueve tipos ahí. Si la consulta trae motivo, esa es la frase del
    parcial; la base en números ("12 de 30 …") solo cuando no lo trae; las citas por venir, su frase.
  - `lib/hub/cifras-de-comercial.ts` (puro): `cifrasClaveDeComercial` (Citas, Asistencia, Cierre de ventas, De cita a venta y
    "Citas sin marcar" si hay) y `cifrasDeCloser` (cada celda de la tabla de closers, con Vendido, Recaudado y Por cobrar).
    **El texto llega por parámetro** (`explicaciones`), con el universo ya puesto por quien llama (DC-2): el módulo no depende de
    dónde viva el texto ni toca `registro.ts`. `CONCEPTOS_DE_COMERCIAL` declara qué fichas necesita.
  - `tests/cifras-de-comercial.test.ts` (15): contra la pieza vieja (`textoDeRazon`) caso por caso; parcial, «—» con motivo, 0,
    en curso, comparación en puntos, sin jerga; y con base, la paridad cifra = lista (programa y por closer) con una anulada, una
    cancelada, tres sin marcar y otro programa sembrados. Typecheck y lint limpios.
  - **Hallazgos para Mani (ningún número cambia; son rótulos y texto):**
    1. **Hoy hay dos reglas de "parcial" en la misma pestaña.** La tarjeta usa `grupo.parcial` (más de 10 % sin marcar,
       `UMBRAL_SIN_MARCAR`) y la tabla de closers usa `estadoDeCobertura` (cobertura bajo 80 %, o citas por venir). El constructor
       usa la segunda en los dos lados, como pide esta enmienda. Efecto en E-3: con entre 10 % y 20 % sin marcar la tarjeta deja
       de decir "Parcial" (la cifra "Citas sin marcar" sigue saliendo), y con citas por venir empieza a decirlo.
    2. **"De cita a venta" hoy no avisa parcial** en la tarjeta aunque sale del mismo grupo que Asistencia. Con la Cifra lo dice
       igual que las otras dos (`razonAgendaAVenta`).
    3. **La cancelada SÍ cuenta en el grupo de citas** (el test lo fija: 8 personas con una cancelada). El borrador §2.2 dice de
       Canceladas "no cuentan en Citas ni en Asistencia": para Asistencia no es lo que hace el código. Corregir el texto o decidir.
    4. **En la tabla de closers, 0 citas hoy se pinta «—».** Con la Cifra es "0" (regla del vacío). El dinero de un closer sin
       ventas sigue en «—», ahora con su motivo.
    5. **Sin texto todavía:** "Citas sin marcar" (duda 7 de §2.2: ¿es `llamadas_sin_resultado`?). El constructor la pide como
       `citas_sin_marcar`; si se funde, cambia solo la llave.
  - **Falta de E-2 Comercial (segundo commit):** escalera, embudo "¿Dónde se pierden?", caminos, citas por semana y auditoría
    (Deals abiertos, Deals sin dueño, Ventas sin llamada), que dependen de la duda 7. Después Dinero, Hoy y el norte.
  - **Para E-3 Comercial:** la página lee las cinco filas de evidencia por lista (`leerEvidencia`) y las pasa en `evidencia`;
    la referencia de la comparación sale de `nombreDePedido`; guardar antes los valores de la pestaña en la base local.

- **13-nov · Alejandro (carril P). E-2, Dinero.** Tampoco cambia ninguna pantalla.
  - `lib/hub/contexto-de-cifras.ts` (puro): lo que toda Cifra del Hub dice igual (chips de "Calculada con", el periodo en
    palabras, la lista desde su `DetalleDeCifra`, la comparación solo si se pidió). Comercial y Dinero lo importan.
  - `lib/hub/cifras-de-dinero.ts` (puro): `cifrasDeDinero` (Vendido, Recaudado, Por cobrar y **"Entró a caja" como una Cifra
    por moneda**, nunca una suma; sin abonos, una sola en USD con 0; una moneda que el CRM no registra hace fallar) y
    `cifrasPorCohorte` (las cuatro celdas de cada fila de "Ventas por cohorte").
  - `tests/cifras-de-dinero.test.ts` (13): sobrepago, parcial, cero, comparación, una moneda que solo existe en el otro
    periodo, sin jerga; y con base la paridad cifra = lista (ventas y abonos del periodo, ventas por cohorte) con una venta
    anulada, abonos en COP y otro programa.
  - **Hallazgos para Mani (ningún número cambia):**
    6. **"Parcial" no es igual para las tres.** Una venta con abonos en otra moneda SÍ cuenta en Vendido y queda fuera de
       Recaudado y Por cobrar (así lo fija `tests/dinero-de-ventas.test.ts`); hoy la tarjeta dice una sola frase para las tres.
       El constructor lo separa: Vendido es parcial solo si hay ventas sin valor vendido. Y por eso "Vendido − Recaudado" no da
       "Por cobrar" cuando hay sobrepago o una venta sin saldo: en esos casos la resta no se escribe con números.
    7. **El "% recaudado de lo vendido" lo calcula hoy el componente** (`dinero-de-ventas.tsx`). Pasa tal cual al constructor
       como línea de Recaudado. Si debe ser una cifra con ficha propia, se pide a la consulta (N1).
    8. **Con dos monedas, la lista de "Entró a caja" es una sola** (todos los abonos): el botón dice "Ver todos los abonos" y
       no un total, que no sería el de esa moneda. Un filtro de moneda en la lista lo arreglaría (`vistaDeLista` ya admite
       `moneda`; falta que `urlDeLista` lo lleve). Para E-3.
    9. **Conceptos que Dinero pide:** `vendido`, `recaudado`, `por_cobrar`, `entro_a_caja`, `ventas` (`CONCEPTOS_DE_DINERO`).
       `por_cobrar` necesita `unidadesDePartes: ["usd", "usd"]` en su ficha y `entro_a_caja` cambia de unidad por moneda.
  - **Falta de E-2 Dinero:** el punto de las gráficas (`graficas-de-dinero.tsx`, hoy `ResumenDeCifra`), que en E-3 pasa a
    `grafica-con-explicacion.tsx`. Después Hoy y el norte.

- **13-nov · Alejandro (carril P). E-2, Hoy.** Tampoco cambia ninguna pantalla.
  - `lib/hub/cifras-de-hoy.ts` (puro): `cifrasDeHoy` con las cifras clave (Cupos vendidos, Leads, Leads que hacen falta,
    Entró a caja por moneda, Asistencia y sus sin marcar), el embudo del día, los cuatro conteos de citas, el dinero del día,
    la semana (cupos y leads con barra, asistencia por cita) y Citas de mañana. Recibe `DatosDeHoy`: los campos del reporte
    diario que la página copia, sin calcular. **Hoy no sigue cohorte ni closer:** "Calculada con" dice Programa y Día (o Semana).
  - Reutiliza a Comercial y a Dinero: las tasas del grupo quedaron en tres funciones (`cifraDeAsistencia`,
    `cifraDeCierreDeVentas`, `cifraDeCitaAVenta`), y `tresDeLasVentas` y `cifrasDeEntroACaja` son públicas.
  - **Un cambio en `lib/metricas/cifra.ts` (aviso al carril D):** `AvanceDeEntrada` gana tres campos opcionales (`ambito`,
    `origenDeLaMeta`, `dias`) para que la barra de la semana no diga "de la cohorte" ni "la cargan en Programa › Objetivos".
    Sin ellos el texto es el de siempre; los tests de Pauta y del semáforo siguen en verde.
  - `tests/cifras-de-hoy.test.ts` (13): cada bloque, los casos raros y, con base, la paridad sobre `armarReporteDiario` de
    verdad (citas, realizadas, canceladas, cupos, las dos tasas y sin marcar contra su lista; anulado y otro programa).
  - **Hallazgos para Mani (ningún número cambia):**
    10. **El paso "Envíos" del embudo del día abre hoy la lista de leads** (`detalleRegistros`): cuenta formularios y lista
        personas. El constructor lo deja sin lista hasta que haya una probada.
    11. **"Leads" de la semana son envíos** (`leadsDeLaSemana` suma `agruparEnvios`), con el rótulo Leads (N4). El constructor
        lo pinta con el concepto `leads` como hoy; hay que decidir el nombre o la consulta.
    12. **`leadsDelDia` nulo se pinta 0** (`?? 0` en el componente). Se conserva; §2.2 dice que sin medir va «—».
    13. **Cupos vendidos del día pierde su barra.** La barra de la Cifra tiene marca "a hoy" y en un día lo esperado es el
        objetivo entero. Queda el estado (contra el objetivo del día) y la línea "Objetivo del día: 2,5 · llevas el 80 %".
        Leads del día queda igual, sin estado (la enmienda solo nombra Cupos vendidos). Decidir en E-3 con el boceto al lado.
    14. **Sin texto ni concepto:** "Citas de mañana" (el constructor la pide como `citas_de_manana`) y las cinco banderas de
        Pendientes (realizadas sin Grain, atendidos sin valor, etc.), que **no entraron** al constructor.
    15. **Dos asistencias en la misma pestaña:** la del día es por persona (`asistencia`) y la de la semana por cita
        (`show_por_cita`). Cada una va con su concepto y su texto; el rótulo de hoy ("Asistencia a la cita") no las distingue.
  - **Falta de E-2:** "¿Vamos a llegar?" (`cifras-del-norte.ts`), el resto de Comercial, las banderas de Pendientes y la
    tabla "¿Cómo va cada closer?" de Hoy (es `cifrasDeCloser` de Comercial con el día).

- **13-nov · Continuación E-2 (sin commit, sin pantallas).** En el orden pedido: Norte → resto de Comercial → Pendientes y closers de Hoy.
  - Nuevos módulos **puros**, sin consultas ni reloj: `lib/hub/cifras-del-norte.ts`,
    `lib/hub/cifras-de-recorridos.ts` y `lib/hub/cifras-de-pendientes-y-closers.ts`. Reciben los resultados existentes y
    las explicaciones por parámetro; no modifican fórmulas, consultas, registro, esquema ni migraciones.
  - Norte: mes y cohorte × cupos/USD, llevamos, faltan, esperado, por día hábil y proyección (solo cohorte).
    «Calculada con» solo Programa y estado con fuente `esperado`; USD parcial cuando falta valor vendido.
    No incorpora evidencia: queda por probar la lista del mes y de la cohorte antes de conectarla.
  - Comercial: escalera principal/closer/calidad (cantidades, porcentaje y mediana), grupos, cita sin resultado;
    embudo comercial (cantidad, porcentaje y pérdida); caminos y tiempo en etapa; citas semanales y auditoría
    (abiertos, sin dueño, motivos y ventas sin llamada). Las cantidades se copian del resultado; el porcentaje de
    escalera pasa de 0–100 a fracción para el formato existente, como ya hace la pantalla.
  - Hoy: las cinco banderas, separadas en con casos/en cero, y las cinco columnas numéricas del comparativo actual:
    Citas, Asistencia, Ventas, Cierre y Entró a caja por moneda. Reutiliza las tasas de Comercial y la caja de Dinero;
    la caja continúa siendo de quien registró el abono, aunque la venta sea de otro closer.
  - Tests nuevos: `tests/cifras-del-norte.test.ts`, `tests/cifras-de-recorridos.test.ts` y
    `tests/cifras-de-pendientes-y-closers.test.ts`. Casos puros de vacío/cero/parcial/estado/formato y paridad con
    listas reales en PGlite para escalera, embudo, semanas, auditoría, banderas y comparativo. Las pruebas con base
    bloquean el cliente de la app: olvidar pasar PGlite falla antes de abrir una conexión real.
  - **Validación pendiente de ejecutar:** los tres comandos `npm test -- tests/<archivo>.test.ts` fallan ANTES de
    arrancar Vitest: el sandbox deniega `ps -axo pid=,ppid=,command=` en `scripts/test.mjs` (`spawnSync ps EPERM`).
    No se saltó el lanzador ni se ejecutó Vitest directamente. Typecheck pasó; lint terminó con 0 errores y
    7 advertencias en archivos ajenos a este cambio. Los tests escritos **no se declaran verdes** y E-2
    sigue abierto hasta ejecutarlos. No se accedió a ninguna base real ni a secretos.
  - **Hallazgos para E-1/E-3 (sin cambiar cifras):**
    16. Abiertos y sin dueño ignoran periodo y closer, **pero sí conservan cohorte** (`cargarEntradaDelEmbudo`).
        Caminos, tiempo en etapa y semanas tampoco siguen closer. Las explicaciones evitan afirmar filtros que esas
        consultas no aplicaron. Las tres banderas del deal son foto actual incluso al abrir un reporte de otro día.
    17. Los caminos conservan los conteos actuales, pero quedan **sin evidencia**: la pantalla enlaza «Pasaron» al
        siguiente paso global, sin una dimensión de camino en la lista. Falta probar que ese universo coincida;
        no se conectan esas listas por parecido. Las pérdidas del embudo y los motivos tampoco reciben una lista
        sin prueba. No se cambió ninguna consulta para hacerlos cuadrar.
    18. Las claves auxiliares de recorridos son de presentación hasta que E-1 fije sus fichas. En particular,
        `citas_futuras` se mantiene separada de Sin resultado, `citas_sin_marcar` cuenta personas del grupo y
        `cita_sin_resultado_de_escalera` conserva el universo de la escalera; el tiempo mediano de caminos continúa siendo el de la
        etapa del programa, no una mediana calculada por camino. Los textos se exigen al llamador, sin tocar el registro.
    19. Norte todavía tiene `tono` por umbrales de alertas; el constructor usa la escala contra esperado exigida por
        esta enmienda. Pueden cambiar las etiquetas de estado en E-3, **no las cantidades**. No hay comparación en Norte
        porque el resultado actual no trae un periodo comparado.

## Para retomar (11-nov, Alejandro)

**Paso 2 hecho: la celda de la tabla semanal es una Cifra.**
- `lib/pauta/cifra-de-celda-semanal.ts` (puro): `cifraDeCeldaSemanal` arma la Cifra de cada celda con `armarCifra`:
  "Calculada con" (programa, cohorte, área Paid, semana o periodo), "La línea pequeña" contra la columna de la izquierda
  (el Total no compara), Parcial con su motivo, En curso si la semana no ha cerrado, y el punto de estado solo con
  objetivo (`estadoDeCeldaSemanal`: el de Paid gana al de todas las áreas, una tasa se carga en puntos y la celda la
  trae en fracción, sin "aceptable" lo que no cumple es rezagado, un costo en USD no colorea).
- `cargarPautaSemanal` trae `partes` en cada fila de razón o resta (show, cierre, cita a venta, ROAS, Profit, CPM, CTR,
  landing, frecuencia y los dos costos por agenda): "Con los números de esta cifra" sale de datos reales.
- Cada celda con lista abre su evidencia (cinco filas y la lista completa de esa columna, con área Paid y la cohorte),
  solo si la sesión abre esa lista: Agendadas (`agendas_creadas`), Ventas y Vendido (`cierres`), y las tres tasas la
  parte de arriba de su fórmula en el grupo de citas de Paid (Asistencia `grupo_shows`; Cierre y De cita a venta
  `grupo_vendidos`, con el desbloqueo de Mani del 11-nov). La nota dice "de arriba de la fórmula" (`lista.parte`).
  `leerEvidencia(metrica, …)` en `lib/metas/cumplimiento-de-cohorte.ts` lee cualquier lista con un rango y la cohorte nula.
- Columna Total en `marca-suave` y semana abierta con "· en curso" (diseño §4.3).
- Tests: `tests/pauta-semanal-celdas.test.ts` (puro) y dos casos nuevos en `tests/pauta-semanal.test.ts` (las partes
  dan el valor de la celda; la lista de cada columna cuenta lo mismo que Agendadas, Ventas, Vendido y las partes de
  arriba de las tres tasas, con orgánica, anulada y otro programa sembrados).
- Verificado: typecheck, lint (0 errores), los tests del cambio, `npm run build` y recorrido en `dev:local` (oscuro,
  claro y 375 px sin desplazamiento horizontal de página; explicaciones de Agendadas, Asistencia y Ventas; consola limpia).
  Para ver valores se sembró en la base LOCAL de `comunicarte-local`: gasto manual del 28-oct al 10-nov, cuatro citas
  sobre deals de Paid y un objetivo de costo por agenda de C1. El punto de estado no se vio en pantalla (el gasto manual
  no tiene campaña con propósito agenda, así que el costo sale "—"); lo cubre el test puro.

**Paso 3 hecho (11-nov): el semáforo y la proyección del ROAS son Cifras.**
- `lib/semaforo/cifras-del-semaforo.ts` (puro): "¿Cómo va el costo por agenda hoy?" con cuatro Cifras (costo, agendadas,
  agendas según Meta, inversión). **No recalcula:** el costo es el del semáforo y del WhatsApp, que divide el gasto en
  campañas de agenda entre las agendas **según Meta** (no las del CRM, como dice el ejemplo del diseño §4.2); por eso el
  rótulo es "Costo por agenda (según Meta)" y no se tocó el cálculo (DM-1). El estado es el color del semáforo
  (`FuenteDeEstado.tono`, nuevo en `lib/metricas/cifra.ts`), así un gasto sin agendas de Meta sale "—" y Rezagado, igual
  que en el reporte. "Sin contar COP X de otras campañas" en el costo; "Ayer a esta hora" solo si se pidió comparar.
  Debajo quedan la trayectoria, la racha y solo las notas de problema.
- `lib/pauta/cifras-de-proyeccion.ts` (puro): ROAS a hoy (parcial con las citas pendientes, estado por el objetivo de
  ROAS) y ROAS proyectado (la última proyección confirmada contra lo real en su línea; los supuestos por closer en la
  explicación). `ComoSeCalcula` ya no lo usa `pauta-proyeccion.tsx`.
- Test: `tests/semaforo-y-proyeccion-cifras.test.ts` (incluye que ningún texto lleve "..": la hora "p. m." lo producía).
- Verificado: typecheck, lint, build, los tests del cambio y `dev:local` (oscuro, claro, 375 px, consola limpia). La
  proyección no se vio en local (no hay citas pendientes); la cubre el test.
- **Para Mani:** ¿el costo del bloque "hoy" debe ser el del CRM (como el ejemplo del diseño) o se queda el de Meta (como
  el semáforo y el WhatsApp)? Cambiarlo es cambiar el semáforo, no la pantalla.

**Paso 4 (11-nov), lo que se cerró y lo que queda abierto:**
- **`ComoSeCalcula` no se borra todavía, y no es del 419.** Lo usan dos bloques: la tabla de ROAS de pauta, que el 420
  convierte en "¿Qué trae ventas?" con toda celda como Cifra (diseño §5.1, 420 punto 5), y Mi espacio, cuyos conceptos
  (citas, realizadas, comisión, caja, % de cierre) no tienen texto todavía (403 F4). Migrarlos aquí sería adelantar esos
  tickets.
- **`structure.md` §9 punto 10** dice ahora cómo quedó construida la Cifra (constructores puros por bloque, `tono` del
  módulo dueño, evidencia solo con lista probada, el puente de textos y dónde queda `ComoSeCalcula`).
- **`npm run test:humo` verde** en escritorio y celular con los cinco roles, contra `dev:local`. Antes falló en cuatro
  roles por un defecto del propio humo, no de la app: una página con `loading.tsx` que redirige (`/dashboard`, `/perfil`,
  `/ajustes/canales`, Leads para el paid trafficker) responde 200 con el esqueleto y la redirección llega en el cliente;
  Playwright lo veía como `ERR_ABORTED` o "interrupted by another navigation". `e2e/humo.spec.ts` gana `ir`, que lo lee
  como redirección, y `primeraFicha` tolera que la redirección caiga mientras lee los enlaces.
- **Casillas abiertas:** (1) los textos de Pauta siguen en el puente y no en la ficha: esperan a que el 403 registre los
  conceptos; (2) el lado a lado visual con el boceto: se comparó por texto (mismas tarjetas, orden, estado y líneas) y se
  revisó cada bloque en claro, oscuro y 375 px, pero el boceto es una foto estática que no deja mostrar cada vista para una
  captura junto a la app; (3) `quick_review` de Rams no existe en esta sesión. Build, humo y consola limpia sí están.

**Siguiente:** cuando el 403 registre las fichas de Pauta, pasar los textos y borrar el puente; el lado a lado con Mani; y
el 420.

## Para retomar (10-nov noche, Alejandro)

Lo nuevo desde las notas de abajo (commits `31554eea`, `5496e2d7`, `205d23f7`, sin push):
- **Textos del puente** al día con D-A, D-B y D-E (tasas por deal sobre el grupo de citas de Paid, ROAS y Profit por la
  semana del registro, inversión sin gasto en —). El tipo del puente es `ClaveDeExplicacionDePauta`; `ClaveDePauta` es
  el de Mani en `lib/vocabulario-metricas.ts` (403 F2, con fichas sin texto). Pasar los textos a la ficha cuando él avise.
- **Paso 1 hecho para ventas.** `dealsDelArea` (`lib/queries/metricas-filtros.ts`) da a la lista de ventas
  (`cierres`, `contratado`) el filtro de área con la misma regla que la cifra; `combinacionDeFiltrosValida` lo admite.
  Las barras "Ventas · de pauta" y "Ventas totales" traen evidencia (`leerEvidenciaDeVentas`, desde
  `cohorte.desdeLista`), solo para quien abre la lista de ventas. Lista vacía: "Todavía no hay …", sin botón.
  Test: `tests/cumplimiento-evidencia.test.ts`.
- **Agendadas sin evidencia, esperando a Mani** (mensaje enviado el 10-nov): `agendasDeLaCohorte` cuenta agendas de
  deals anulados (`incluyendoAnulados(deals)` en `hechos/agenda.ts`) y `agendas_creadas` no. El test es `it.fails`:
  cuando se ponga rojo, conectar la evidencia de agendas.
- **Bug ajeno visto:** el enlace de Asistencia de la tabla semanal (`shows` con `area=paid`) da 404; `shows` no acepta área.
- Verificado en `dev:local` (claro, oscuro, 375 px, consola limpia); build en verde antes del último commit (no se
  repitió). Para ver filas se pasaron 3 deals de `comunicarte-local` a ganado en la base LOCAL.
- **Borrar a mano** `e2e/zz-419-evidencia.spec.ts` (desechable; `rm` está bloqueado para el agente).

**Siguiente:** paso 2 (la celda en la tabla semanal), luego 3 y 4 de abajo.

## Para retomar (10-nov, Alejandro se quedó sin créditos)

Estado: commits `241edac9` (campos de la ficha), `2b518987` (contrato y tests), `9d025099` (status coherente) y `76f75e84`
(pieza y cumplimiento) en `main`. Typecheck, lint, build y los tests del ticket en verde en local.

**Cómo está armado (lee esto antes de tocar nada):**
- `lib/metricas/cifra.ts` es puro (sin `lib/db`). `armarCifra(EntradaDeCifra)` → `CifraDeMetrica` con todo el texto ya
  escrito. Un "—" sin `motivo` lanza error a propósito. `fmtAvance` escribe lo esperado con decimal.
- `lib/metricas/explicaciones-de-pauta.ts` es un PUENTE: los textos de §2.1 por clave (`ClaveDePauta`). Cuando el carril D
  registre los conceptos de Pauta en `REGISTRO`, se pasan a `que`/`formula`/`variables`/`aliasExcel` de la ficha en un
  commit propio y este archivo se borra. Incluye `agendas_total` (Agendadas · todas las áreas), que no está en el diseño.
- Uso: un componente de servidor llama `armarCifra` y pasa el resultado a `<Cifra cifra={...} />` (cliente). Ejemplo vivo en
  `components/pauta/cumplimiento.tsx` (`cifraDeAvance`).
- `BarraDeAvance` tiene dos formas: con marca (props `lleno/atraso/marca/rotuloDeMarca/tono/etiqueta`) y la simple vieja
  (`llevamos/objetivo`), que siguen usando Hoy y "¿Vamos a llegar?" del programa.
- `ComoSeCalcula` (diálogo de texto libre) sigue vivo para `pauta-roas`, `pauta-proyeccion` y `mi-espacio`: se borra
  cuando esos bloques pasen a la Cifra.

**Siguiente, en orden:**
1. **Evidencia del cumplimiento.** Cada barra necesita `lista: { href, nombre, total, filas }`. Hay que encontrar la lista
   (`urlDeLista` en `lib/queries/vista-metrica.ts`, métricas `agendas_creadas` y `cierres`) que cuente EXACTAMENTE lo
   mismo que la cifra (cohorte desde el inicio de ventas hasta hoy) y escribir un test que compare cifra contra lista.
   Las cinco filas salen de la misma consulta paginada. Sin eso, no se inventa.
2. **La celda en la tabla semanal** (`components/pauta/tabla-semanal.tsx`, datos en `lib/queries/hechos/pauta-semanal.ts`):
   cada celda con `<Cifra tamano="celda">`, partes reales en `partes`, `comparacion` contra la columna anterior con
   `etiqueta: "La línea pequeña"` y estado por objetivo en las filas que lo tienen. Esta es la prueba de costura de la ola.
3. El semáforo como cuatro Cifras (§4.2), la proyección del ROAS (§4.5) y el resto del Hub.
4. `npm run test:humo` con `dev:local` arriba; ajustar `docs/structure.md` §9 a lo construido; marcar las casillas.

**Pendiente con Mani (carril D):** avisarle del commit `241edac9` en `registro.ts` y preguntarle quién registra las claves y
fichas de Pauta (no existen en `ClaveDeMetrica`). Si ya se le mandó el mensaje, esperar su respuesta.

**Trampas que ya costaron tiempo:**
- `tests/tracker-coherente.test.ts`: el `status:` del archivo tiene que ser igual al del tracker. El "en curso" va en un
  comentario después de `#`.
- Docker no arranca solo: `open -a Docker` antes de `npm run db:local`. La siembra falla al final (falta % de comisión
  del programa de prueba, `lib/deals/mover-etapa.ts:338`), pero la base queda usable. Para ver el cumplimiento se
  cargaron metas a mano en la base LOCAL (`objetivos`: `agendas` 60, `cupos`/`paid` 12, `inversion` 26.000.000 en
  `tactical-local`). Login local: `dev@retia.local`.
- Un contenedor flex al lado de un `float` pierde el ancho del float: por eso "Cerrar" del panel va `absolute`.
- `next build` rompe un `dev` vivo en la misma carpeta: detén el dev antes.
