# Tracker — Retia CRM

Este es el **único lugar** donde se marca el avance. Cada ticket tiene su archivo con objetivo,
alcance y criterios de "done"; aquí solo va el estado. Al cerrar un ticket: marcar la casilla,
cambiar `status: done` en su archivo y anotar la fecha.

Estados: `todo` · `en curso` · `done` · `bloqueado` · `reemplazado`.
Un ticket está **listo** cuando todos los de su columna "Depende de" están en `done`.

**El orden, los tracks, los hitos y las decisiones abiertas viven en [`docs/plan.md`](../plan.md)**
(§5 el orden, §7 la lista única de decisiones). Qué es el producto: [`docs/overview.md`](../overview.md).
Cómo está hecho: [`docs/structure.md`](../structure.md).

> 🧭 **27-sep:** Comercial dio luz verde y la documentación se centralizó en `plan.md`, `overview.md`,
> `structure.md`, `operations.md` y los ADR vigentes. Muchos tickets citan documentos que ya no están
> (spec, plan v2, la propuesta del 24-sep, la revisión del 22-sep, el "insumo"): **`docs/plan.md` §8
> dice dónde quedó cada referencia vieja**, y un ADR retirado se resuelve en `docs/adr/README.md`.
> 048, 049, 050, 051 y 053 pasan a `en curso`: tenían código y seguían en `todo`. A1 y A2 se cerraron el
> mismo día: ADR 0054 (el Estado lo pone el formulario) y ADR 0055 (webhook estándar, track propio).
>
> **Historia corta de las épocas:** el MVP (F0 a F4, tickets 001 a 035) se ejecutó del 16 al 20-sep. El
> 21-sep se abrió la época v2, el modelo tipo HubSpot (Lead, Envío, Deal y etapas: tickets 036 a 093),
> con la etapa E1b de atribución tras la reunión con Alejo. El 22-sep la revisión del modelo; el 24-sep la
> dirección de producto (tickets 094 a 102) y la reunión con los closers, tras la cual Mani adoptó la
> tabla de transiciones, el acuerdo de pago como nota (ADR 0053) y el orden P1: E2 → E3 mínimo → E4 →
> E6 mínimo → E1b → E5 → E7. **E2 (043 a 047) se cerró el 27-sep: el motor de etapas existe.** Sigue E3 mínimo (paso 2 del plan): A1 y A2 ya se cerraron (ADR 0054 y 0055), faltan sus tickets. El 094 también se cerró el 27-sep.

# Reparto para dos (desde el 28-sep)

El orden por etapas y carriles vive en [`docs/plan-reparto.md`](../plan-reparto.md). Las correcciones
de su §3 se aplicaron el 28-sep con el ok de Mani (069, 070, 074, 077, 079, 086 cambian de
dependencias; 048, 049 y 064 llevan su enmienda).

## Etapa E0 del reparto · Terreno para dos — **en curso · 28-sep**

| ✓ | # | Tarea | Depende de | Estado |
|---|---|---|---|---|
| [x] | · | §3 aplicado en tickets y tracker; `plan.md` §2 y `AGENTS.md` al día | · | done · 28-sep · Mani |
| [x] | 112 | [CI en cada push a `main` (sin protección)](./112-ci-y-main-protegido.md) | · | done · 28-sep: workflow y plantilla de PR; el CI midió el lock roto en Linux y se resincronizó. **Sin protección de `main` ni PR obligatorio** (Mani: velocidad); el CI es alarma, no reja |
| [x] | 113 | [Base local para desarrollar pantallas](./113-base-local-para-pantallas.md) | · | done · 28-sep: `npm run db:local` (Docker, 38 migraciones, seed por `lib/`) y `npm run dev:local`, probado de punta a punta. Falta un modo de login local (Auth.js solo tiene Google) · sembrar contra Postgres real destapó el `Date` en `moverEtapa` (arreglado) |
| [ ] | · | Plantilla de PR con el checklist de contratos de `AGENTS.md` | · | todo · carril Alejo |
| [x] | 105 | Cerrar: forjar la acción desde una sesión de closer | · | done · 28-sep: Mani lo forjó desde la vista closer; ni crear ni rotar |
| [x] | · | Ops: quitar `CRON_SECRET` y `SHEET_ID_*` de Vercel; cargar a Andrea (007) | · | done · 28-sep · Vercel limpio (prod y preview); Andrea dada de alta por Mani en `/ajustes/usuarios` |
| [x] | · | Agendar a Michael; después closers, Gerencia y Pauta (reparto §7) | · | done · 28-sep · Michael y el dueño del deal respondidos por Mani; precio 797; Pauta, Alejo Carvajal y Michael el 29-sep 8pm |
| [x] | 057 | 057, 058 y 059 del carril de Mani en E1, adelantados y en `main` | · | done · 28-sep · migración 0036 aplicada con el ok de Mani (sin la tabla del 110, que lleva la 0037) |

# Pauta y analítica (tickets 116 a 126) — abierto el 29-sep

Sale de la reunión con Pauta del 29-sep. El mapeo requisito por requisito, las decisiones (DP-1 a DP-25) y
las fórmulas viven en **[`docs/analytics.md`](../analytics.md)**; las decisiones de arquitectura, en los
ADR **0061** (estados de llegada por tabla), **0062** (el anuncio es la llave de la pauta) y **0063**
(métricas y objetivos). Mani: *"lo antes posible, sin fechas"*. Etapa y carril de cada uno:
[`plan-reparto.md`](../plan-reparto.md) §4.

🩸 El 29-sep el Typeform de Tactical dejó de mandar `estado` y ningún envío abrió deal durante horas. Parche
aplicado en el Typeform ese día (`docs/analytics.md` §2.4); el 117 lo vuelve innecesario.

| ✓ | # | Tarea | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 116 | [Las UTM completas en el envío: `utm_id`, `utm_content`, `utm_term`](./116-las-utm-completas-en-el-envio.md) | — | todo · carril Alejo · migración |
| [ ] | 117 | [Los estados de llegada por tabla, y los parciales por el webhook](./117-los-estados-de-llegada-por-tabla-y-los-parciales.md) | 115 | todo · carril Alejo · migración · reprocesa los 23 envíos de Tactical |
| [ ] | 118 | ["Se perdió en el Calendly": urgente arriba del Inbox](./118-se-perdio-en-el-calendly.md) | 117 | todo · carril Mani |
| [ ] | 119 | [La conexión con Meta: token por portafolio y cuentas por programa](./119-la-conexion-con-meta.md) | — | todo · carril Alejo · migración · espera el token de Anderson |
| [ ] | 120 | [La pauta de Meta: árbol y gasto por anuncio y día](./120-la-pauta-de-meta-por-anuncio-y-dia.md) | 119 | todo · carril Alejo · migración (retira `ad_spend`) |
| [ ] | 121 | [El área declarada por el closer al cerrar](./121-el-area-declarada-por-el-closer.md) | 083 | todo · carril Mani · migración |
| [ ] | 122 | [Los objetivos de la cohorte y el reparto de cupos por área](./122-los-objetivos-de-la-cohorte.md) | 083 | todo · carril Mani · migración |
| [ ] | 123 | [El embudo de Pauta y los costos por etapa](./123-el-embudo-de-pauta-y-los-costos-por-etapa.md) | 085, 089, 115, 120 | todo · carril Mani |
| [ ] | 124 | [El cumplimiento de la cohorte por área](./124-el-cumplimiento-de-la-cohorte-por-area.md) | 122, 123 | todo · carril Mani · espera PQ3 de Pauta |
| [ ] | 125 | [La tab Campañas: el árbol de Meta con su embudo](./125-la-tab-campanas-con-el-arbol-de-meta.md) | 120, 123 | todo · carril Mani |
| [ ] | 126 | [El embudo del formulario](./126-el-embudo-del-formulario.md) | — | todo · carril Alejo · 🟡 dónde vive el token de Typeform |

Enmendados el 29-sep por la reunión (bloque al final de cada archivo): 021, 051, 052, 062, 065, 067, 070,
071, 072, 077, 078, 083, 084, 085, 087, 088, 089, 090, 092, 093, 095, 100, 101, 102, 115. El 093 pasa a ser
la **vista interina de Pauta**, lo primero que se puede entregar.

# Época v2 — modelo HubSpot (tickets 036 a 082)

Orden y porqué: **[docs/plan-crm-v2.md](../plan.md)**. El diseño del que sale vive fuera del
repo y **manda sobre el plan en todo lo que sea diseño**:
`mani_vault/02 Projects/retia/notebook/crm-retia-modelo-hubspot-scaffold.md`.

**Regla que rige todas las etapas:** una etapa no se cierra sin `npm test`, `npm run typecheck` y
`npm run lint` limpios. **Las migraciones las genera y aplica la sesión principal, nunca un
subagente** (AGENTS.md).

## E0 · Enmiendas y ADRs — **done · 21-sep**

Sin una línea de código. Deja el terreno para que la etapa 1 sea un corte y no una serie de
remiendos.

| ✓ | Tarea | Estado |
|---|---|---|
| [x] | E0-1 · ADR **0035 a 0042** | done · 21-sep |
| [x] | E0-2 · `docs/spec.md` enmendada (insumo §11) | done · 21-sep · kanban entra, `onboarded_at` entra, comisión entra, cédula no, Calendly con PAT por programa, el histórico de C2 crece a migración one-time |
| [x] | E0-3 · Enmienda anotada en los ADR 0004, 0007, 0015, 0019, 0021, 0027, 0032 | done · 21-sep |
| [x] | E0-4 · Ticket 034 reescrito (absorbido) y 021 congelado | done · 21-sep |
| [x] | E0-5 · `docs/agents/context.md` con el vocabulario nuevo | done · 21-sep |
| [x] | E0-6 · Tickets 036 a 082 creados y registrados aquí | done · 21-sep |

🎯 **Decisión de Mani del 21-sep que cerró E1-4:** `sources` pasa a significar **solo** el intake
de leads crudos. Las **7** filas con `destino != people` se borran (eran insumo de la migración
inicial) y la pauta deja de entrar por Sheets: **el costo de una campaña se captura en el CRM**
(ADR 0039, tickets 039 y 067). El plan v2 §10 decía 5 filas; medido son 7.

## E1 · El esquema, de un solo corte

**Una rama y UNA migración (`0020`) para los siete.** Ninguno se fusiona a `main` por separado.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 036 | [`people` → `leads`, `estado` a texto, responsable fuera](./036-renombrar-people-a-leads.md) (E1-1) | — | done · 22-sep |
| [x] | 037 | [Las seis tablas del modelo nuevo](./037-las-tablas-del-modelo-nuevo.md) (E1-2) | 036 | done · 22-sep |
| [x] | 038 | [`calls` y `abonos` cuelgan del deal; `sales` se elimina](./038-calls-y-abonos-cuelgan-del-deal.md) (E1-3) | 037 | done · 22-sep |
| [x] | 039 | [Una sola fuente de leads por programa](./039-una-sola-fuente-de-leads-por-programa.md) (E1-4) | 036 | done · 22-sep |
| [x] | 040 | [`vigente()` cubre `deals`](./040-vigente-cubre-deals.md) (E1-5) | 037 | done · 22-sep |
| [x] | 041 | [`change_log` en las tablas operativas](./041-change-log-en-las-tablas-operativas.md) (E1-7) | 037, 038 | done · 22-sep |
| [x] | 042 | [Migración `0020`: `dev` y `production`](./042-migracion-0020-del-corte.md) (E1-6) | 036-041 | done · 22-sep · **aplicada en las dos ramas** |

## E1b · El esquema del origen y la atribución — **abierto el 21-sep**

Sale de la reunión con **Alejo Carvajal** y de las decisiones de Mani del 21-sep.
Decisiones: **ADR 0043, 0044 y 0045**. Argumento y medición: [plan v2 §12](../plan.md).

🩸 **Por qué existe:** el número que pidió Gerencia —*"cantidad de leads por área"*— hoy mostraría
**Comercial en cero**, porque un lead que trae un closer no deja rastro en ningún UTM. Y el costo de
la pauta y el origen de un lead **no se pueden cortar con la misma llave**, porque `ad_spend` guarda
la campaña en texto libre. Ninguna de las dos cosas lanza un error.

**Una rama y UNA migración para 083, 084, 092, 101 y 102.** Ya no es la `0021`: ese número lo tomó
la de RLS del 23-sep (ADR 0047), así que es **la siguiente libre**. Léela línea por línea antes de aplicarla.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 083 | [El catálogo de áreas](./083-catalogo-de-areas.md) | 042 | todo |
| [ ] | 084 | [`campanas` y `utm_patron`](./084-campanas-y-el-patron-utm.md) | 083 | todo · **tres** campos de patrón, sin `nivel_utm` |
| [ ] | 085 | [El emparejador determinista y su guardián](./085-el-emparejador-determinista.md) | 084 | todo |
| [ ] | 092 | [La URL del formulario y el generador de links](./092-url-del-formulario-y-generador-de-links.md) | 084 | todo · 🩸 **destapa que `programs` no tiene la URL del formulario**, sin la cual el 086 tampoco se puede calcular. Encogió el 21-sep: **sin árbol**. **24-sep: es el builder v1** (destinos con checkouts, canal, campaña, dos opcionales; ADR 0051) |
| [ ] | 101 | [El catálogo de Canales (el "Origen" del builder)](./101-catalogo-de-canales.md) | 083 | todo · 24-sep, ADR 0051 · el mapeo UTM → área **es** este catálogo |
| [ ] | 102 | [El rol Paid Trafficker y `manejaPauta`](./102-rol-paid-trafficker.md) | 094 | todo · 24-sep, ADR 0052 · migración de la sesión principal |

## E2 · El motor de etapas

El corazón del sistema, y la razón de que vaya **antes** que el sync.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 043 | [Las once etapas y la tabla de transiciones](./043-enum-de-etapas-y-tabla-de-transiciones.md) (E2-1) | 042 | done · 27-sep · `lib/deals/etapas.ts`, migración 0024 (Seguimiento; aplicada en `dev`) |
| [x] | 044 | [Requisitos de entrada por etapa](./044-requisitos-de-entrada-por-etapa.md) (E2-2) | 043 | done · 27-sep · `lib/deals/requisitos.ts`, por flecha y no por etapa |
| [x] | 045 | [`moverEtapa()` y su historial](./045-mover-etapa-y-su-historial.md) (E2-3) | 043, 044 | done · 27-sep · `lib/deals/mover-etapa.ts`, migración 0025 (aplicada en `dev`) |
| [x] | 046 | [Guardián: nadie escribe `deals.etapa` fuera del motor](./046-guardian-del-motor-de-etapas.md) (E2-4) | 045 | done · 27-sep · `tests/motor-etapas-guardian.test.ts` + reja en `lib/crm/rastro.ts` |
| [x] | 047 | [Saltos permitidos y retroceso con motivo](./047-saltos-permitidos-y-retroceso.md) (E2-5) | 045 | done · 27-sep · `abrirDeal()`: dónde nace un deal |
| [x] | 103 | [El motor con las decisiones de Mani del 27-sep](./103-motor-de-etapas-decisiones-de-mani.md) | 045, 046, 047 | done · 27-sep · cohorte destino aparte, motivos por tipo, solo dueño y administradores mueven (el admin también los sin dueño), la llamada que cuenta es la más reciente, motivo al perder, datos en el mismo movimiento · migración 0026 en `dev` |
| [x] | 104 | [Las cuatro listas de motivos, desde lo que ya usan](./104-las-cuatro-listas-de-motivos.md) | 103 | done · 27-sep · 13 motivos estandarizados desde `_ListasDropdown`, cargados en `dev` con `npm run cargar-motivos`; falta correrlo en producción cuando exista |

## E3 · Sync v2

Aquí es donde `estado` por fin se lee: cierra **F-01**, abierta desde agosto.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 048 | [Una sola función de ingesta](./048-una-sola-funcion-de-ingesta.md) (E3-1) | 042 | done · 28-sep · cierra con el traslado (111): `ingerirEntradas` la llaman el webhook y el traslado |
| [x] | 049 | [El Envío con todas las columnas](./049-el-envio-con-todas-las-columnas.md) (E3-2) | 048 | done · 28-sep · cierra con el traslado (111); migración 0022 ya en producción |
| [x] | 050 | [Identidad del Lead: el teléfono une **y marca**](./050-identidad-del-lead.md) (E3-3) | 048 | done · 28-sep · `resolverIdentidad` en `ingerirEntradas`; el traslado midió 69 uniones por teléfono y 2 teléfonos de otro lead (para el gerente, etapa 6) |
| [x] | 051 | [El Estado del lead es el que manda el formulario](./051-el-estado-del-lead-desde-el-envio.md) (E3-4) | 049, 050 | done · 27-sep noche · `lib/ingesta/estado.ts` traduce, no califica; T2 desconectado; migración 0027 en `dev` |
| [x] | 052 | [La regla de creación y movimiento de deals](./052-regla-de-creacion-y-movimiento-de-deals.md) (E3-5) | 051, 045 | done · 28-sep: la cita se lee en Calendly antes de la transacción (`lib/calendly/resolver-cita.ts`); cita vigente → Agendado con su llamada (`calendly:<uuid>`); cancelada, no encontrada o error → Pendiente Setteo con nota del sistema en el deal (migración **0032**). Falta el envío real, que es del 106 |
| [x] | 053 | [Zona horaria por fuente](./053-zona-horaria-por-fuente.md) (E3-6) | 039, 049 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 054 | [Configurar una fuente sin adivinar](./054-configurar-una-fuente-de-verdad.md) (E3-7) | 039 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 055 | [Alertas: una fuente se rompe, no se apaga](./055-alertas-y-fuente-rota.md) (E3-8) | 054 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 056 | [El sync se dispara por capas](./056-disparo-del-sync-por-capas.md) (E3-9) | 048 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 105 | [La fuente webhook: un formulario es una fila](./105-la-fuente-webhook.md) | 048 | done · 28-sep: la forja desde una sesión de closer la hizo Mani |
| [x] | 106 | [La ruta del webhook y el adaptador de Typeform](./106-la-ruta-del-webhook-y-el-adaptador-de-typeform.md) | 105, 051 | done · 28-sep: envíos reales de los dos programas en producción. Cierre en el ADR **0058**: caja negra (migración **0034**), nombre del lead (**0033**), un solo mapeo webhook/hoja, variables genéricas, `xxxxx` = sin UTM, re-agenda crea su llamada, matriz de casos (`tests/webhook-matriz.test.ts`). Fuera: el parcial real (el equipo decide el Partial Submit Point) |
| [x] | 107 | [Una fuente que dejó de recibir se ve en la app](./107-aviso-de-fuente-sin-envios.md) | 106 | done · 28-sep · `lib/queries/salud-fuentes.ts` (calculado, nada guardado); marca por fuente y umbrales editables en `/ajustes/fuentes`; migración **0035** aplicada en producción |
| [x] | 110 | [La salud del CRM: cada entrega de webhook, a la vista](./110-la-salud-del-crm.md) | 106 | done · 28-sep · código, tests y `/ajustes/salud` en `main`; migración 0037 en producción; conciliación en 0 tras el traslado (ComunicArte 2.739/2.739, Tactical 3.304/3.304). El pulido de la pantalla va al 075 |
| [x] | 111 | [Traslado de leads y envíos desde Sheets](./111-traslado-desde-sheets.md) | 106, 048 | done · 28-sep · `npm run trasladar -- --aplicar` corrió en producción con el ok de Mani: 2.465 leads de ComunicArte (con los 65 de Forms viejo, el 079) y 2.877 de Tactical; segundo ensayo = 0 nuevos. La ingesta escribe el resumen por lotes (ensayo de 12+ min a 2 min) |
| [x] | 108 | [Retirar el sync de Sheets](./108-retirar-el-sync-de-sheets.md) | 106 | done · 28-sep · cron, ruta manual, botón, `lib/sheets/sync.ts`, `plan-sync.ts`, `origen.ts`, scripts y sus tests fuera; `sync_runs` queda como historial. Falta quitar `CRON_SECRET` y `SHEET_ID_*` de Vercel (`GOOGLE_SERVICE_ACCOUNT_JSON_B64` se queda: probar una fuente de hoja la usa) |
| [x] | 109 | [El programa lleva su formulario y su token de Calendly](./109-formulario-y-token-de-calendly-del-programa.md) | 105 | done · 28-sep: migración **0030**; Forms Link y Calendly Token obligatorios en `/ajustes/programas` (un programa no se activa sin los dos); la lectura de la cita (hoy `citaDeCalendly`) probada contra Calendly real; migración **0031**: nace inactivo y un CHECK exige los dos; Mani cargó los dos tokens y se borraron de `.env.local` |
| [ ] | 086 | [Origen humano del lead y el enlace de captación](./086-origen-humano-y-enlace-de-captacion.md) | 085, 092 | todo · ⏳ **el dato lo escribe la ingesta; después no se puede reconstruir** |
| [ ] | 087 | [🩸 El CPL deja de preguntar por `entrada`](./087-el-cpl-deja-de-preguntar-por-entrada.md) | 085, 086 | todo · **va con el 086, nunca después** |

## E4 · Calls, dinero y Students

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 057 | [Las Calls cuelgan del deal](./057-calls-colgadas-del-deal.md) (E4-1) | 052 | done · 28-sep · `agregarLlamada` y `completarAgendada` en `lib/deals/llamadas.ts`; migración 0036 |
| [x] | 058 | [Pegar el Grain = la llamada sucedió](./058-grain-significa-que-la-llamada-sucedio.md) (E4-2) | 057 | done · 28-sep · `pegarGrain`: show, fecha si faltaba y Atendido (T10/T7), en una transacción |
| [x] | 059 | [`no_show` y `cancelada` van a Re-agenda](./059-no-show-y-cancelada-van-a-reagenda.md) (E4-3) | 057 | done · 28-sep · `marcarFallida`: Re-agenda desde Agendado (T8) y desde Atendido con motivo (T29) |
| [x] | 060 | [Abonos sobre el deal](./060-abonos-sobre-el-deal.md) (E4-4) | 057, 045 | done · 28-sep · `lib/deals/abonos.ts` (`registrarAbono`, `anularAbono`) + `tests/abonos-del-deal.test.ts` y `tests/saldo-centralizado.test.ts` recreado. Sin migración. Falta la pantalla para registrar/anular (074) y el comprobante con foto (035) |
| [x] | 061 | [Acuerdo de pago y cartera vencida](./061-cuotas-pactadas-y-cartera-vencida.md) (E4-5) | 060 | done · 28-sep · `lib/deals/pago.ts` (`editarAcuerdoDePago`, `fechaLimiteMaxima`) y `lib/queries/cartera.ts` (`carteraVencida`); sin migración (las columnas ya venían de la 0025). Falta la pantalla (074) y la cartera en el día del closer (071) |
| [ ] | 062 | [La comisión se calcula, nunca se guarda](./062-comision-calculada.md) (E4-6) | 060 | todo |
| [x] | 063 | [`onboarded_at` y cambio de cohorte](./063-onboarded-at-y-cambio-de-cohorte.md) (E4-7) | 060 | done · 28-sep · `lib/deals/estudiante.ts` (`marcarOnboarded`, `cambiarCohorte`), `lib/queries/estudiantes.ts` (Students es una consulta) y la cohorte activa se asigna sola en el primer abono. Sin migración. Falta la pantalla (074) |
| [ ] | 035 | [Comprobante: link **o** foto](./035-comprobante-link-o-foto.md) (E4-8) | 060 | todo · **aterriza aquí**, colgando de `abonos.deal_id`. Siguen debiéndose los dos análisis. 22-sep: la foto va a Supabase Storage (ADR 0047) |
| [x] | 096 | [Calendly: cada llamada a su deal; si hay duda, suelta](./096-calendly-cuelga-llamadas-de-deals.md) | 057, 045 | done · 29-sep · código completo y live; webhook verificado en los dos programas; 0038 y 0039 aplicadas; Maru creada y cuentas vinculadas en producción desde `/ajustes/usuarios` (ComunicArte: `soymarumarquez@gmail.com`; Tactical: `equipo@ttrading.co`) |

## E5 · Lectura y reporting

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 064 | [Dashboard sobre deals](./064-dashboard-sobre-deals.md) (E5-1) | 060 | done · sesión 47 · cierres desde deal_etapa_historial, dueño por ownerUserId, show centralizado |
| [ ] | 065 | [Conversión etapa a etapa y tiempo en etapa](./065-funnel-por-etapa.md) (E5-2) | 064 | todo |
| [ ] | 066 | [Réplica de `🚨 Urgencias` con desglose UTM](./066-replica-de-urgencias.md) (E5-3) | 064 | todo |
| [ ] | 067 | [ROAS por cohorte y captura de pauta](./067-roas-por-cohorte-y-captura-de-pauta.md) (E5-4) | 064 | todo |
| [ ] | 068 | [`nerd-stats` reescrito](./068-nerd-stats-reescrito.md) (E5-5) | 064 | todo |
| [x] | 093 | [Filtros por UTM con lo que YA hay](./093-filtros-utm-con-lo-que-ya-hay.md) | — | done · 29-sep · vista interina de Pauta en el dashboard: registros, agendas por el origen del deal, sin UTM (Tactical 25,3%) y macros aparte; drill-down canal → campaña → content/term |
| [ ] | 088 | [Registros vs agendas por canal](./088-registros-vs-agendas-por-canal.md) | 049, 052, 085 | todo · la vista de **Media** |
| [ ] | 089 | [Series con dimensiones, no escalares](./089-series-con-dimensiones.md) | 064 | todo · ⏳ **gratis ahora, reescritura después** |
| [ ] | 090 | [Rendimiento por área](./090-rendimiento-por-area.md) | 085, 088, 089 | todo · la vista de **Gerencia**. Estados con acción, no una tabla |
| [ ] | 095 | [La tab Dashboard: un programa o "todos" solo con lo sumable](./095-dashboard-con-selector-y-todos-los-programas.md) | 064, 089, 094 | todo · 24-sep, ADR 0048 y 0050 · la garantía vive en el tipo |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) (E5-6) | 064, 065, 066, 067 | **congelado hasta aquí** · se descongela con el dashboard nuevo, no antes |

## E6 · UI

⚠️ **Antes de abrir esta etapa hay que decidir la garantía** (ticket 075): o entran tests de
componente, o la garantía sigue siendo el recorrido visual a mano **haciendo clic en todo lo que
se abre**. Este repo no tiene tests de componentes y el 20-sep dos bugs pasaron con 669 en verde.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 094 | [Un closer ve solo sus programas](./094-alcance-del-closer-por-membresia.md) | — | done · 27-sep · `lib/auth/alcance.ts`; dashboard, sidebar, buscador y ficha por id lo usan; ajeno = 404 |
| [x] | 097 | [Navegación por objetos y selector de programa](./097-navegacion-por-objetos-y-selector-de-programa.md) | 094 | done · 29-sep (Alejo): tabs por objeto en `/p/<programa>/<tab>` y selector de programa (`39bf931`, `d953769`); celular revisado en producción (cajón, selector y menú encima, sin scroll horizontal a 390 px) |
| [x] | 069 | [Kanban por programa](./069-kanban-por-programa.md) (E6-1) | 057, 097 | done · 29-sep · `/p/<programa>/deals`: tablero con arrastre nativo y menú "Mover a…", todo por `moverEtapa` desde una server action con el actor de la sesión; filtros por URL; `ETAPAS_EN_ORDEN` en `lib/deals/etapas.ts`. Login local para `dev:local`. Recorrido contra la base local con consola abierta (escritorio y 390 px emulados). Falta: probarlo en un celular de verdad y la vista tabla |
| [x] | 070 | [Pendiente Setteo y Unclaimed](./070-pendiente-setteo-y-unclaimed.md) (E6-2) | 069 | done · 29-sep · `/p/<programa>/inbox`: Agendados sin dueño (por antigüedad) y Pendiente Setteo (score de Typeform desc, sin score al final, luego recencia), con el origen por UTM. `reclamarDeal` (fila bloqueada: el segundo reclamo es 409) y reasignar por `editarDeal`. El score entra por la llave `puntaje` del mapeo de la fuente (sin defecto). Implementó Kiro; revisión, recorrido local y reclamo forjado por la sesión principal. Score, calidad y valor configurados el 29-sep en las dos fuentes (`puntaje`, `leadQuality`, `leadValue`); 0041 aplicada en producción; fix del resumen del lead (`decideValores`). Leads previos recalculados. Falta: verificar con un envío nuevo; "quién lo trajo" (llega con el 086) |
| [x] | 071 | [El Inbox (antes Mis deals)](./071-mi-dia-del-closer.md) (E6-3) | 069, 061, 070, 096, 097 | done · 29-sep · código en `main`; recorrido visual funcional a 390 px realizado con consola y estados/interacciones revisados |
| [ ] | 072 | [Base de Leads con filtros](./072-base-de-leads-con-filtros.md) (E6-4) | 069 | todo · 24-sep: es la tab **Leads** |
| [x] | 098 | [La tab Calls](./098-tab-calls.md) | 057, 096, 097 | done · 29-sep · ruta `/p/<programa>/calls`, filtros, llamadas sueltas, Grain y resultados; recorrido visual funcional a 390 px realizado con consola |
| [ ] | 099 | [La tab Students por cohorte](./099-tab-students-por-cohorte.md) | 060, 061, 097 | en curso · Alejo · 29-sep: pantalla y consulta en main; falta el recorrido visual |
| [ ] | 100 | [La tab Programs](./100-tab-programs-ficha-del-programa.md) | 097, 101 | todo · 24-sep · destinos, Calendly, comisión, equipo |
| [ ] | 073 | [Ficha del Lead, con el diff entre envíos](./073-ficha-del-lead.md) (E6-5) | 072 | todo |
| [x] | 074 | [Ficha del Deal](./074-ficha-del-deal.md) (E6-6) | 069, 060 | done · 29-sep · `/p/<programa>/deals/<id>`: cabecera, llamadas, pago y abonos, actividades e historial en una pantalla; `editarDeal`, `anularDeal` (rechaza con abonos vigentes y anula en cascada sus llamadas), `registrarActividad`; `puedeTrabajarDeal` (`lib/deals/permiso.ts`) y `duenosPosibles` (`lib/deals/duenos.ts`) en un solo lugar. Recorrido contra la base local (escritorio y 390 px) y permiso mordido forjando la acción. 1.415 tests. Falta: celular de verdad y ver el prellenado de Compromiso Verbal con un deal Atendido |
| [ ] | 075 | [Revisión profunda de TODA la UI](./075-revision-profunda-de-la-ui.md) (E6-8) | 069-074 | todo |
| [ ] | 114 | [Auditoría de cálculos y reglas fijas](./114-auditoria-de-calculos-fijos.md) | · | en curso · 29-sep · A1 y A3 arreglados (regla de Agendado y resultados fallidos en un solo módulo); A2 va con el 064; B4, B5 y C6 pendientes · **carril Mani** (29-sep), se atacan en su momento |
| [x] | 115 | [El origen es del envío; el deal recuerda el envío que lo abrió](./115-el-origen-es-del-envio.md) | · | done · 29-sep · el deal guarda el envío que lo abrió; relleno 69/69; migración 0043 quita `leads.utm_*` (con `lock_timeout`) |
| [ ] | 076 | [Bitácora en Nerd Stats](./076-bitacora-en-nerd-stats.md) (E6-7) | 068, 041 | todo · es la **pantalla** de un rastro que se escribe desde E1 |
| [ ] | 091 | [`otrosProgramasDelCorreo`: visibilidad cruzada](./091-otros-programas-del-correo.md) | 073 | todo · una consulta, **no** una tabla. Ninguna métrica la usa |

## E7 · Migración one-time

Va de último, con el scaffold completo. Absorbe el "histórico de C2" de la spec §7 con más alcance.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 077 | [Barrer las pestañas de gestión](./077-barrer-las-pestanas-de-gestion.md) (E7-1) | 111 | done · 29-sep · Alejo · las ocho pestañas leídas (encabezados reales) y su mapeo escrito en el ticket; el extractor del 078 lo implementa y ninguna fila se descarta en silencio (deal, llamada, sin deal por alcance o rareza) |
| [ ] | 078 | [Pasa por la MISMA ingesta, nunca inserts crudos](./078-la-migracion-pasa-por-la-misma-ingesta.md) (E7-2) | 077 | en curso · Alejo · en `main` (29-sep): migración 0042 aplicada en producción con el ok de Mani, escritor histórico, extractor e importador (`npm run migracion:extraer` / `migracion:importar`). **Falta el ensayo contra producción** de los dos programas (sin `--aplicar`) y aplicar en el corte del hito B |
| [x] | 079 | [Recuperar las 55 de `Forms viejo`](./079-recuperar-las-55-de-forms-viejo.md) (E7-3) | 111 | done · 29-sep · cerrado por el traslado (111), que lo tenía en su alcance: `Forms viejo` entró en la misma corrida (ComunicArte 2.465 leads, conciliación 2.739/2.739) |
| [ ] | 080 | [Los casos raros de la migración](./080-los-casos-raros-de-la-migracion.md) (E7-4) | 078 | en curso · Alejo · 29-sep: decisiones de los casos escritas en el ticket |
| [x] | 081 | [COP → USD a la tasa del día](./081-cop-a-usd-en-la-migracion.md) (E7-5) | 078 | descartado · 28-sep (Mani): *"solo usamos USD aquí"*. No hay conversión ni tasa ni marca de abono convertido; un monto que aparezca en COP al barrer se lista como rareza (080) y no se convierte |
| [ ] | 082 | [Apagar las pestañas de gestión](./082-apagar-las-pestanas-de-gestion.md) (E7-6) | 079, 080 | todo · lo hace Mani |

---

# Época MVP (tickets 001 a 035) — ejecutada

Se conserva como historia. **Tres siguen abiertos:** 007 (partido), 021 (congelado hasta E5) y
035 (se muda a E4).

## F0 · Contrato de extensión

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 008 | [Renombrar Corte a Cohorte](./008-renombrar-corte-a-cohorte.md) | — | done · 16-sep (migración 0002 en `production`) |
| [x] | 009 | [Test guardián de slugs](./009-test-guardian-de-slugs.md) | — | done · 16-sep (`it.fails` hasta 010) |
| [x] | 010 | [Programas dinámicos](./010-programas-dinamicos.md) | 008, 009 | done · 16-sep (prueba manual en base real pendiente) |
| [x] | 011 | [Molde de catálogo + plataformas de pago](./011-molde-de-catalogo-y-plataformas.md) | 008 | done · 16-sep (migración 0003 en `production`; ADR 0020) |
| [x] | 012 | [Catálogos de motivos y orígenes](./012-catalogos-motivos-y-origenes.md) | 011 | done · 16-sep (migración 0004 en `production`) |
| [x] | 013 | [Pantalla de catálogos](./013-pantalla-de-catalogos.md) | 011 | done · 16-sep · **enmienda cerrada el 20-sep** (ADR 0034: plataformas por programa, selectores acotados, `/ajustes` por rol) |
| [x] | 014 | [Administrar programas y cohortes](./014-administrar-programas-y-cohortes.md) | 010, 011 | done · 16-sep (migración 0006 en `production`) |
| [x] | 015 | [Administrar usuarios y closers](./015-administrar-usuarios-y-closers.md) | 011 | done · 16-sep (migración 0005 en `production`; login real pendiente) |
| [x] | 016 | [Plantilla de lead + fuentes configurables](./016-fuentes-configurables.md) (ADR 0019) | 014 | done · 19-sep (migración 0018 en `dev` y `production`; `/ajustes/fuentes` deja de ser solo lectura; mapeo combinado campo por campo; una fuente ACTIVA siempre cuadra) |
| [x] | 030 | [Borrar del catálogo lo que nunca se usó](./030-borrar-del-catalogo.md) (ADR 0026) | 011 | done · 20-sep · los SEIS catálogos borran desde la app · falta el recorrido visual |

## F1 · Llamadas y ventas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 001 | [plataformaPago como enum](./001-reemplazado-plataforma-pago.md) | — | reemplazado por 011 |
| [x] | 017 | [Productos por programa](./017-productos-por-programa.md) | 011 | done · 16-sep (migración 0007 en `dev` y `production`; productos sin sembrar en `production`) |
| [x] | 018 | [Esquema del registro + abonos](./018-esquema-registro-y-abonos.md) | 012, 017 | done · 17-sep (migración 0008 en `dev` y `production`) |
| [x] | 002 | [cohorteActiva + registrarLlamada](./002-cohorte-activa-y-mutacion-registro.md) | 018 | done · 17-sep (sesión paralela A) |
| [x] | 019 | [Registrar abono](./019-registrar-abono.md) | 018 | done · 17-sep (`registrarAbono` + `saldoDeVenta`, sin migración) |
| [x] | 026 | [Responsable + alta manual](./026-responsable-y-alta-manual.md) (ADR 0021) | 015 | done · 17-sep (sesión paralela C; migración 0010 en `dev` y `production`) |
| [x] | 003 | [Pantalla /mi-dia](./003-pantalla-mi-dia-registro.md) | 002, 019, 015, 026 | done · 17-sep (buscador, registro y abonos sobre las mutaciones de 002/019/026; sin migración) |
| [ ] | 007 | [Alta de los closers reales](./007-onboarding-closer-id.md) | 015 | **en curso · PARTIDO el 21-sep** por el plan v2: el criterio 1 (cargar a Andrea) sigue vivo e independiente; el criterio 2 (`registrarLlamada` con cuenta real) queda **obsoleto**, esa mutacion se reescribe en la etapa 4. Nota previa: · 18-sep: en `production` ya están el gerente, Maru (`closer_id: Maru`, 2 programas) y los 2 productos. Falta el correo de Andrea (su `closer_id` ya se sabe: `Andrea`) y **probar `registrarLlamada` con una cuenta real de closer**, que es el otro criterio |
| [x] | 029 | [Anular un registro](./029-anular-registros.md) (ADR 0026, ADR 0027) | 003, 019 | done · 18-sep (migraciones 0013 y 0014 en `dev` y `production`; desplegado; recorrido visual hecho, 3 hallazgos arreglados) |

## F2 · Métricas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 020 | [Días hábiles + meta dinámica](./020-dias-habiles-y-meta-dinamica.md) | 008 | done · 16-sep |
| [x] | 027 | [Ventana de venta de la cohorte](./027-ventana-de-venta-de-la-cohorte.md) (ADR 0022) | 014 | done · 17-sep (migración 0009 en `dev` y `production`) |
| [x] | 004 | [Consultas del dashboard](./004-consultas-dashboard.md) | 018, 020, 027 | done · 17-sep (sesión paralela B) |
| [x] | 005 | [Dashboard en /programas/[slug]](./005-dashboard-real-programas.md) | 004, 010 | done · 17-sep (filtro por closer dentro de las consultas del 004; sin migración) |
| [x] | 006 | [Historial de una persona](./006-historial-persona.md) | 005 | done · 17-sep (`/personas/[id]` de solo lectura; se entra desde el buscador de `/mi-dia`; sin migración) |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) | 005 | **CONGELADO hasta la etapa 5** del plan v2 (21-sep): el dashboard que fotografiaria esta por ganar funnel por etapa, Urgencias y ROAS; hacerlo antes es hacerlo dos veces. Nota previa: desbloqueado 19-sep: formato PDF y lo toman los dos roles. Sigue de último |
| [ ] | 035 | [Comprobante: link **o** foto subida](./035-comprobante-link-o-foto.md) | 019 | todo · **se muda a la etapa 4** del plan v2 (21-sep): colgara de `abonos.deal_id`. Siguen debiendose los dos analisis. Nota previa: nuevo 20-sep (Mani) · enmienda PARCIAL al ADR 0017: los recursos siguen siendo links · pide analisis de crecimiento y de control de acceso antes de codear |
| [x] | 034 | [Categorías de lead dinámicas](./034-categorias-de-lead-dinamicas.md) (ADR 0032) | 016 | **reemplazado · 21-sep** · absorbido por [plan-crm-v2](../plan.md): su alcance ES el insumo §2.2. El backfill desde `people.raw` ya NO aplica (el primer sync v2 reconstruye los envios desde la hoja) y `estado` enum→texto pasa al corte de la etapa 1. Nota previa: el más grande que queda · cierra F-01 y F-06 · Mani lo quiere en sesión propia · necesita migración |

## F3 · Recursos

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 022 | [Recursos + enlaces de pago](./022-recursos-y-enlaces-de-pago.md) | 011, 017 | done · 17-sep (migración 0011 en `dev` y `production`; enlaces reales sin cargar) |
| [x] | 023 | [Pantalla de Recursos](./023-pantalla-de-recursos.md) | 022 | done · 17-sep (`/recursos`; `/documentos` redirige; sin migración; falta revisión visual en celular) |

## F4 · Nerd Stats

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 024 | [Rol developer](./024-rol-developer.md) | 010 | done · 17-sep (ADR 0025; migración 0012 en `dev` y `production`; stash de Kiro rescatado y cerrado) |
| [x] | 025 | [Nerd Stats](./025-nerd-stats.md) | 024 | done · 17-sep (`/nerd-stats`, primera ruta exclusiva de developer; sin migración) |
| [x] | 028 | ["Ver como" del developer](./028-ver-como-del-developer.md) (ADR 0028) | 024 | done · 18-sep · `rolDeVista` + cookie + selector + guardián sobre `app/` y `lib/`. 543 tests. **Sin migración.** La primera entrega dejó 3 sitios pasando el rol crudo que el guardián no veía: ver la nota del ticket |
| [x] | 031 | [Perfil propio: el closerId sin pasar por /ajustes/usuarios](./031-perfil-propio.md) | 028 | done · 18-sep · decisión cerrada (**opción 1**: solo `esAdministrador` edita; un closer lo ve en lectura). `/perfil` nuevo, mutación por el molde, el id sale SIEMPRE de la sesión. 556 tests. ✅ **recorrido en navegador hecho**: el menú abre sin tumbar el layout, escritura real con su fila en `change_log`, y la server action **invocada a mano saltándose la UI** devuelve 403 en vista `closer` |
| [x] | 032 | [La vista `todo` es MENOS capaz que la vista `closer`](./032-el-developer-no-puede-crear-persona.md) | 028 | done · 18-sep · `trabajaLeads` en vez del literal, guardián ampliado a cualquier `.rol` y a `scripts/`, y un test que fija **vista `todo` ⊇ vista `closer`**. 545 tests |
| [x] | 033 | [`Mani` y `mani` no pueden ser dos closers](./033-identidad-del-closer-sin-mayusculas.md) (ADR 0030) | 028 | done · 18-sep · salio del primer recorrido REAL en `production` (criterios 1, 5 y 6 ejercidos; sus datos de prueba ya borrados). `lib/closers/identidad.ts` + indice unico sobre la forma normalizada (migracion **0015**, aplicada en `dev` y `production`) + guardian. 570 tests |

## Lo que antes vivía aquí

Las secciones narrativas de este archivo se movieron el 27-sep a su lugar:

| Antes aquí | Ahora en |
|---|---|
| Decisiones pendientes | `docs/plan.md` §7 (la lista única) |
| Decisiones resueltas | el ADR de cada una; las que no tienen ADR, en `docs/overview.md` |
| Incidente del 16-sep, deuda técnica heredada | `docs/operations.md` §9 y §10 |
| Ideas sin decidir y futuro | resueltas, o en `docs/overview.md` §8 (fuera de v1) |

El texto anterior: `git show da68cdf:docs/tasks/README.md`.
