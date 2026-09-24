---
titulo: Plan CRM v2 — modelo HubSpot
creado: 2026-09-21
estado: aprobado por Mani el 21-sep · D1 a D6 cerradas · **etapa 0 CERRADA el 21-sep**
  (ADR 0035-0042 escritos, spec enmendada, 7 ADR anotados, tickets 036-082 creados)
reemplaza: no reemplaza a docs/plan.md (ese es el plan del MVP, ya ejecutado). Este abre la epoca siguiente.
enmiendas: §12 (21-sep, reunión con Alejo) · §13 (24-sep, dirección de producto y UI, ADR 0048-0052)
---

# Plan CRM v2 — modelo HubSpot

> **Qué es esto.** El plan de ejecución que convierte el diseño consolidado del CRM en trabajo
> ordenado sobre este repo. No es el diseño: el diseño ya existe y vive fuera del repo (§1). Esto
> dice **en qué orden se construye, por qué en ese orden, y qué se rompe en cada paso**.

---

## 1. De dónde sale este plan (el insumo original)

Todo el modelo de datos, las diez etapas, el flujo del lead y las reglas de sync salen de **una
sola fuente**, que es el resultado de cuatro rondas de brainstorming de Mani el 2026-09-20:

```
/Users/mani/Documents/mani_vault/02 Projects/retia/notebook/crm-retia-modelo-hubspot-scaffold.md
```

**Ese archivo manda sobre este en todo lo que sea diseño.** Si algo de aquí contradice algo de
allá, allá gana, salvo donde este plan diga explícitamente *"enmienda al insumo"* con el dato
medido que la justifica (hay tres, todas en §3).

Cuando necesites el detalle de una regla y aquí esté resumida, ve al insumo por su número de
sección. Las referencias de este documento con forma `insumo §N` apuntan ahí.

Insumos secundarios, mismo directorio del vault (`02 Projects/retia/notebook/`):

| Archivo | Para qué sirve |
|---|---|
| `flujo-de-leads-retia.md` | cómo llega hoy un lead, de punta a punta |
| `flujo-closers-retia-sheets.md` | qué hace hoy un closer en las hojas (lo que el CRM reemplaza) |
| `dashboard-crm-closers-retia.md` | qué mira hoy el equipo |
| `retia-metrics.md` | contexto del producto |
| `reportes-diarios-mike/` | los seis reportes reales de Michael (insumo del ticket 021) |

Dentro del repo, lo que sigue vigente y hay que leer antes de tocar nada: `AGENTS.md`,
`docs/estructura-bbdd.md` (el mapa real de las dos hojas), `docs/agents/context.md` (glosario) y
los ADR 0001 a 0034.

---

## 2. Estado medido del repo (21-sep, no copiado del tracker)

Todo lo de esta sección se midió contra `production` (`br-withered-mud-b4cvvg80`) el 21-sep con
consultas de solo lectura, no se dedujo del código ni del tracker.

### 2.1 Salud

| | |
|---|---|
| Tests | **677 pasando**, 57 archivos |
| Typecheck / lint | limpios |
| Migraciones | **20** (`0000` a `0019`), `dev` y `production` al día. La próxima es `0020` |
| Cron | `/api/cron/sync` corriendo solo, **diario**, verificado en producción el 20-sep |
| Tickets | 31 de 35 en `done`; abiertos 007, 021, 034, 035 (ver §7) |

### 2.2 Las filas que hay en `production`

```
people      4.791        calls        0
sources        10        sales        0
productos       2        abonos       0
users           3        change_log   2.340
```

🎯 **`calls`, `sales` y `abonos` están en CERO.** El CRM tiene 4.791 leads sincronizados y **ni un
solo registro operativo**. Ningún closer lo ha usado nunca.

**Esta es la medición que ordena todo el plan.** Significa que disolver `sales`, mover `calls` al
deal y colgar `abonos` del deal **no son migraciones de datos**: son cambios de esquema sobre
tablas vacías. El costo está entero en el **código** (27 archivos mencionan `sales`), no en los
datos. Y significa que **esta es la ventana más barata que va a existir**: con 300 llamadas
registradas encima, el mismo cambio es un *strangler* de semanas en vez de un corte limpio.

### 2.3 Lo que está muerto y nadie había mirado

| Hallazgo | Número |
|---|---|
| `people.estado` en el default `cola_setteo` | **4.791 de 4.791** |
| Personas con responsable (`responsable_closer_id`) | **0** |
| Personas con `entrada = crm` (alta manual) | **0** |
| Personas con más de una aplicación | 1.146 (2.588 envíos) |
| Envíos totales implícitos (futura tabla `submissions`) | **6.233** |
| Tabla `people` / columna `raw` | 5.264 kB / 2.579 kB |

El `pgEnum` de `estado` no carga un solo bit de información. Es la confirmación medida de la deuda
**F-01** y del diagnóstico del ticket 034.

### 2.4 Las fuentes reales

| programa | fuente | activo | destino | archivo | pestaña |
|---|---|---|---|---|---|
| comunicarte | Formulario actual | **sí** | people | `1NN6rlZXJJ…` | `New form` |
| comunicarte | Formulario anterior | **sí** | people | `1NN6rlZXJJ…` | `Forms viejo` |
| comunicarte | Estudiantes | no | sales | mismo | `Estudiantes Agosto` |
| comunicarte | Pauta | no | ad_spend | mismo | `ROAS ESTUDIASTES AGOSTO` |
| comunicarte | Registro de llamadas | no | calls | mismo | `Registro de llamadas` |
| tactical-investor | Formulario | **sí** | people | `1DBKL4zwWW…` | `De Cero a Tactical Investor` |
| tactical-investor | Estudiantes C1 / C2 | no | sales | mismo | 2 pestañas |
| tactical-investor | Pauta C1 | no | ad_spend | mismo | `ROAS COHORT JULIO` |
| tactical-investor | Registro de llamadas | no | calls | mismo | `Registro de llamadas` |

**Las dos fuentes activas de ComunicArte viven en el MISMO archivo de Sheets**, en dos pestañas.
Eso importa para la decisión D2 de §3.

### 2.5 Vercel

Team `agencia-dani`, plan **`hobby`** (verificado por API el 21-sep). `vercel.json` tiene un cron
diario (`0 12 * * *`).

🎯 **En Hobby el cron de Vercel solo puede correr una vez al día.** Los 15 minutos del insumo §5.5
no existen sin pagar Pro. Eso contesta la pregunta abierta §12.1 del insumo con un dato, no con una
opinión, y convierte las otras capas de disparo en **el mecanismo**, no en un refuerzo.

---

## 3. Decisiones de Mani del 21-sep

Se registran aquí porque una decisión sin registro se ve igual que un olvido. Cada una entra
además al ADR que le corresponde en la etapa 0 (§8).

### D1 · `people` pasa a llamarse `leads` ✅

El rename toca ~39 archivos y no agrega una sola función. Se hace **ahora** por una razón medida:
con las tablas operativas vacías y la capa de lectura a punto de reescribirse completa, el costo es
casi cero; después de que el equipo empiece a registrar, es caro y ya nadie lo hace. Es además el
vocabulario del insumo §2.1 y del glosario (`docs/agents/context.md`).

### D2 · Un programa, UNA fuente de leads ✅

Textual de Mani: *"cada programa tiene un intake de Sheets que recibe Leads crudos"*.

**Enmienda al insumo §2.10, con el dato:** el insumo pide un *"índice único sobre `program_id`"* en
`sources`. Ese índice **no se puede crear sobre la tabla de hoy**: ComunicArte tiene 5 filas con el
mismo `program_id` (2 activas de leads + 3 inactivas de otros destinos). La decisión de Mani es
correcta, pero el índice tiene que escribirse contra lo que `sources` signifique después del corte
(ver la tarea E1-4 en §6).

**Lo que cuesta la decisión, medido el 21-sep leyendo las dos pestañas de ComunicArte:**

```
New form      2.258 filas → 2.070 personas únicas   (6/8/2026 a 21/9/2026, VIVA)
Forms viejo      67 filas →    65 personas únicas   (20/7/2026 a 22/7/2026, MUERTA)
  de esas 65:  10 ya están en New form
               55 NO están en New form
```

**`Forms viejo` no es una segunda fuente activa: es una pestaña muerta hace dos meses.** Las 55
personas exclusivas **ya están en la base** y no se pierden (F-06: el CRM nunca borra un lead). Lo
que pasa es que dejan de tener envío en el modelo nuevo, porque `submissions` se reconstruye desde
la hoja que sí se lee. **Esas 55 se recuperan en la migración one-time (etapa 7), que es donde el
insumo §9 ya pone las pestañas viejas.** No se pierde nada; se mueve de mecanismo.

### D3 · Anular ≠ Cierre Perdido ✅ *confirmado por Mani el 21-sep*

Mani preguntó si anular debería ser simplemente pasar a Cierre Perdido. La respuesta es no, y el
argumento es que son dos hechos distintos:

| | Cierre Perdido | Anulado |
|---|---|---|
| Qué es | un resultado del negocio: el lead dijo que no | una corrección de tecleo: el registro nunca debió existir |
| ¿Cuenta en el embudo? | **sí**, es un deal perdido | **no**, en ninguna métrica |
| Motivo | obligatorio, de negocio | obligatorio, de corrección |
| Se recupera | sí, a cualquier etapa | no aplica: se corrige y ya |

**Si los fundimos, un error de dedo se convierte en una venta perdida y la tasa de conversión
miente.** Es exactamente la clase de bug del que este repo ya sangró tres veces: una cifra creíble,
equivocada, que no lanza ningún error. El ADR 0026 existe justo para separar "esto pasó y salió
mal" de "esto nunca pasó".

**Forma:** `anulado` **no es una etapa número 11**. Es una marca ortogonal a la etapa,
con su `anulado_por` / `anulado_en` / `anulado_motivo`, igual que hoy en `calls`, `sales` y
`abonos`. Un deal en cualquier etapa puede resultar un error (sobre todo los manuales, ADR 0021).
El predicado `vigente()` de `lib/queries/vigente.ts` se extiende a `deals` y su guardián con él, y
las métricas no cambian de forma: ya saben ignorar lo anulado.

### D4 · El disparo del sync: `onChange` de Apps Script, y el webhook propio después ✅

Textual: *"trigger onChange() mientras creamos el webhook de nuestro CRM"*. Con el plan Hobby
medido (§2.5), las capas quedan así:

| Capa | Qué es | Cuándo |
|---|---|---|
| **Aviso de la hoja** | trigger `onChange` en Apps Script que hace `POST /api/cron/sync` con `CRON_SECRET` | etapa 3, es el mecanismo principal |
| **Sync perezoso** | al abrir la app, si el último sync tiene más de 15 min, se dispara en segundo plano | etapa 3 |
| **Botón manual** | ya existe | se conserva |
| **Cron diario de Vercel** | red de seguridad, lo único que Hobby permite | se conserva tal cual |
| **Webhook propio del CRM** | los forms escriben directo; misma función de ingesta | etapa 3 deja el enganche, se activa con Dapta |

⚠️ Enmienda al **ADR 0007** (cron diario). No lo reemplaza: lo rodea.

### D5 · Cuotas: tabla `cuotas_pactadas` desde el arranque ✅ *(Mani delegó y confirmó el 21-sep)*

Mani preguntó cuál es más sostenible. **Elijo la tabla, no los dos campos en el deal**, y el
argumento que rompe el empate es este:

El modelo de dos campos calcula `valor_cuota = saldo / num_cuotas`, o sea **asume que las cuotas
son iguales**. En el momento en que un plan real no lo sea (un abono inicial grande y dos cuotas
chicas, que es lo normal), ese número **es falso y no lanza ningún error**. Y la vista de cartera
vencida solo podría responder *"¿entró todo el saldo antes de esa fecha?"*, cuando lo que un closer
persiguiendo plata necesita es *"le falta la cuota 2, vencía el 5 de octubre"*.

No es abstracción especulativa (ADR 0006): el propio insumo §2.4 nombra el caso de varias fechas
como real. Y hoy la tabla nace con **cero filas que mover**.

Forma: `cuotas_pactadas (deal_id, numero, monto, fecha_pactada, abono_id?)`. El deal conserva
`num_cuotas` como dato derivado de conveniencia **solo si hace falta**; por defecto no lo lleva.

### D6 · Un Deal se edita, y todo movimiento del CRM deja rastro ✅

Textual de Mani (21-sep): *"modificar la info de un Deal se puede hacer cuando sea necesario (para
asegurar integridad, todo movimiento en el CRM debe quedar en logs en Nerd Stats, trackeado, eso
puede ser de lo último que configuramos)"*.

Son dos mitades y se separan a propósito.

**La edición.** Un deal no es inmutable: producto, cohorte, owner, fechas y motivo se corrigen
cuando haga falta. Es coherente con D3: si editar fuera imposible, anular sería el único remedio
para un dato mal puesto y terminaría usándose para todo, que es justo lo que D3 evita.

**El rastro.** Toda escritura del CRM deja fila con quién, cuándo, y qué cambió de qué a qué. No
solo el catálogo, que es lo que `change_log` cubre hoy, sino **deals, etapas, calls, abonos y
actividades**.

⚠️ **Corrección al "eso puede ser de lo último".** Lo que va de último es la **pantalla**, no el
rastro. El rastro se diseña en la etapa 1 y se escribe desde el primer día, por la misma razón del
ADR 0029: *no hay que acordarse de registrar, no hay forma de escribir sin que quede registrado*.
Si se retrofitea al final, **todo lo escrito antes no tiene historia y no hay manera honesta de
fabricarla**. Ya pasó exacto: los 5 enlaces de PayPal entraron a `production` con `change_log` en
**0**, y siguen sin rastro a propósito, porque un historial de auditoría fabricado se ve idéntico
al de verdad.

Forma: el historial de etapas lo cubre `deal_etapa_historial` (E2-3). Lo demás va por `change_log`
extendido a las tablas operativas, con su guardián (E1-7). La **pantalla** en Nerd Stats es E6-7.

---

---

## 4. Qué se conserva y qué se rompe

### 4.1 Se conserva (no se toca)

Esto es la mayor parte de la inversión del MVP y sobrevive intacta:

- **Todo `lib/catalogo/`**: el molde, `borrarSiNoSeUso`, `change_log`, `exigirAccesoAlPrograma`,
  los seis catálogos. ADR 0012, 0026, 0029.
- **Auth y roles completos**: `requireRole`, `paginaConRol`, `esAccesoTotal` / `esAdministrador` /
  `trabajaLeads`, `rolDeVista`, `revalidarToken`, `exigirMismoOrigen`. ADR 0003, 0025, 0028.
- **`lib/closers/identidad.ts`** y su índice único. ADR 0030.
- **`lib/queries/vigente.ts`** y su guardián. ADR 0026, 0027. **Se amplía a `deals` (D3).**
- **`lib/queries/saldo.ts`**. ADR 0024. Cambia de dónde lee, no qué significa.
- **El motor de lectura de hojas**: `lib/sheets/leer.ts`, `mapeo.ts`, `auth.ts`, el candado de
  `sync.ts` y `ejecutar-juntas.ts`. ADR 0019, 0031.
- **`lib/format.ts`**, `lib/dias-habiles.ts`, `lib/rangos.ts`, `lib/errors*.ts`.
- **Tests con PGlite**. ADR 0020.

Son **20 de los 34 ADRs intactos**. Lo que se construyó no se bota.

### 4.2 Se rompe (se reescribe)

La capa de dominio operativa entera. `people → calls → sales → abonos` pasa a
`lead → deal → calls / abonos`:

| Qué | Archivos |
|---|---|
| Consultas | `lib/queries/dashboard.ts`, `ventas.ts`, `personas.ts`, `nerd-stats.ts`, `vista-dashboard.ts` |
| Mutaciones | `lib/mutations/` completo (`registro.ts`, `abonos.ts`, `anulaciones.ts`, `personas.ts`) |
| Sync | `lib/sheets/sync.ts`, `dedup.ts`, `plan-sync.ts`, `plantilla-lead.ts` |
| Pantallas | `/mi-dia`, `/personas`, `/personas/[id]`, `/programas/[slug]`, `/nerd-stats` |

**No es un refactor: es reescribir el dominio conservando la plomería.** Decirlo así evita la
trampa de estimarlo como si fuera renombrar cosas.

---

## 5. El esquema destino

Sale del insumo §2.10, corregido con lo medido. Lo que cambia respecto al insumo va marcado ⚠️.

```
programs          (existe)  + tasa_comision, calendly_pat (cifrado, después)
sources           (existe)  + tz_fechas (default America/Bogota), estado activa|rota
                            ⚠️ D2: índice único sobre program_id para el intake de leads.
                            Ver E1-4: hay que decidir qué pasa con las 5 filas de otros destinos.
productos         (existe)  precio_lista ES el ticket; un producto por cada precio que se use
leads             ← people renombrado (D1). (program_id, email_principal) único (ADR 0005).
                            estado pasa de pgEnum a TEXTO (absorbe el ticket 034).
                            responsable_closer_id SE VA: el owner vive en el deal.
lead_contactos    (lead_id, tipo correo|telefono, valor, submission_id, es_principal, confirmado)
                            único (program_id, tipo, valor)
submissions       (lead_id, source_id, token, es_parcial, fecha_envio, estado_hoja,
                   utm_source, utm_medium, utm_campaign, utm_term, utm_content,
                   posicion_en_hoja, respuestas jsonb)
                            ⚠️ respuestas NO repite las promovidas (insumo §5.4, opción A')
                            ⚠️ NO se rellena desde people.raw: la construye el primer sync v2
deals             (lead_id, program_id, cohort_id, owner_user_id?, etapa, producto_id?,
                   motivo_id?, submission_origen_id?, onboarded_at?, creado_por,
                   anulado_por?, anulado_en?, anulado_motivo?)          ⚠️ D3
                            único parcial (lead_id, program_id) WHERE etapa NOT IN (completo, perdido)
deal_etapa_historial (deal_id, de, a, user_id?, motivo_id?, fecha)
deal_actividades     (deal_id, tipo contacto|nota, canal, user_id, fecha, nota)
cuotas_pactadas   (deal_id, numero, monto, fecha_pactada, abono_id?)    ⚠️ D5
calls             (deal_id, closer_user_id, fecha_programada?, fecha_llamada?,
                   link_calendly?, link_grain?, resultado, motivo_id?, notas)   sin person_id
abonos            (deal_id, fecha, monto, moneda, plataforma_id, comprobante, user_id)  sin sale_id
sales             ← SE ELIMINA (0 filas, §2.2)
students          ← vista: deals en etapa Abonado o Completo. NO es tabla
```

Las **diez etapas** (insumo §3) son un `pgEnum`: son tipos porque el código decide según ellas, que
es exactamente lo que manda el ADR 0012. No se contradice con que `lead.estado` sea texto: ese es
una instancia que escribe la hoja.

---

## 6. Las siete etapas de trabajo

Reordena el §13 del insumo en dos puntos: las enmiendas van **completas** antes de tocar esquema
(para que la etapa 1 sea una sola migración pensada y no tres parches), y la **UI se va al final**
por decisión de Mani del 21-sep: *"la UI es otra cosa que me va a tocar definir luego de construir
ya que es literal lo que el equipo va a ver"*.

Regla que rige todas: **una etapa no se cierra sin `npm test`, `npm run typecheck` y `npm run lint`
limpios.** Y las migraciones las genera y aplica la sesión principal, nunca un subagente
(`AGENTS.md`).

---

### Etapa 0 · Enmiendas y ADRs — ✅ **CERRADA el 21-sep**

> Resultado: **ADR 0035 a 0042** escritos · `docs/spec.md` enmendada · enmienda anotada en los ADR
> 0004, 0007, 0015, 0019, 0021, 0027 y 0032 · **47 tickets, 036 a 082**, creados y registrados en
> `docs/tasks/README.md`. Detalle en el CIERRE 18 del handoff.

**Sin una línea de código.** Deja el terreno para que la etapa 1 sea un corte y no una serie de
remiendos.

| # | Tarea |
|---|---|
| E0-1 | Escribir los ADRs nuevos de §8 (0035 a 0041) |
| E0-2 | Enmendar `docs/spec.md` según el insumo §11 (kanban entra, `onboarded_at` entra, comisión entra, cédula no, histórico de C2 con alcance mayor) |
| E0-3 | Anotar las enmiendas en los ADRs vigentes que cambian: 0004, 0007, 0015, 0019, 0021, 0027, 0032 |
| E0-4 | Reescribir el ticket 034 (queda absorbido, ver §7) y congelar el 021 |
| E0-5 | Actualizar `docs/agents/context.md` con el vocabulario nuevo: Lead, Envío, Deal, Etapa, Cuota pactada, Student, Unclaimed |
| E0-6 | Crear los tickets de las etapas 1 a 7 en `docs/tasks/` y registrarlos en `docs/tasks/README.md` |

**Done cuando:** un agente nuevo puede leer `AGENTS.md` + los ADRs y reconstruir el modelo sin
abrir el insumo del vault.

**Kiro:** no. Es criterio, no volumen.

---

### Etapa 1 · El esquema, de un solo corte

La etapa más delicada del plan, y la más barata **hoy** (§2.2).

| # | Tarea |
|---|---|
| E1-1 | Renombrar `people` → `leads` en esquema y en los ~39 archivos que la nombran (D1). `estado` de `pgEnum` a texto. `responsable_closer_id` fuera |
| E1-2 | Crear `lead_contactos`, `submissions`, `deals`, `deal_etapa_historial`, `deal_actividades`, `cuotas_pactadas` |
| E1-3 | `calls.person_id` → `calls.deal_id`; `abonos.sale_id` → `abonos.deal_id`; **eliminar `sales`** |
| E1-4 | `sources`: `tz_fechas`, `estado activa\|rota`, y el índice único de D2. **Decisión pendiente aquí:** las 5 filas con `destino != people` (Estudiantes, Pauta, Registro de llamadas) ¿se borran, o `destino` sobrevive y el índice único es parcial `WHERE destino='people' AND activo`? Los datos de esas pestañas los necesita la etapa 7, pero pueden vivir en el ticket en vez de en la tabla. **`ad_spend` es el caso incómodo**: el insumo §8 lo quiere de vuelta para el ROAS |
| E1-5 | Extender `vigente()` y su guardián a `deals` (D3) |
| E1-7 | **D6:** `change_log` extendido a las tablas operativas (`deals`, `calls`, `abonos`, `deal_actividades`) con su guardián, igual que el del molde de catálogo. Se escribe **ahora**, no al final |
| E1-6 | Migración `0020…` en adelante. **Primero `dev`, verificar, y `production` solo con el ok explícito de Mani** (ADR 0018) |

**Riesgos y cómo se atajan:**

- Es un corte grande y los tests van a caer en masa. Se hace **en su propia rama**, no en trozos
  sobre `main`.
- ⚠️ `drizzle-kit generate` es interactivo: cuando una columna se va y otra llega en el mismo
  cambio pregunta si es un renombre. Por eso lo corre la sesión principal (`AGENTS.md`).
- ⚠️ Nada de subconsultas correlacionadas con la plantilla `sql` de drizzle. Si dudas del SQL que
  sale, imprime `query.toSQL().sql`.

**Done cuando:** 
- [ ] Migraciones aplicadas en `dev`, verificadas contra `neon.branch_id`
- [ ] `npm test`, `typecheck` y `lint` limpios
- [ ] `grep -r "\bsales\b" lib app components scripts` no devuelve nada
- [ ] El guardián de `vigente` cubre `deals`, **mordido quitando el arreglo para verlo caerse**
- [ ] Ninguna escritura sobre `deals`, `calls`, `abonos` o `deal_actividades` puede ocurrir sin su
      fila de `change_log`, y el guardián que lo exige está **mordido** (D6)

**Kiro:** el rename mecánico sí (E1-1, la parte de reemplazo en 39 archivos). El esquema y las
migraciones no.

---

### Etapa 2 · El motor de etapas

**El corazón del sistema y la razón de que vaya antes que el sync.** Insumo §3 y §3.1.

Un módulo puro, `lib/deals/etapas.ts`, que contesta dos preguntas y nada más:

1. *¿este deal puede pasar de la etapa A a la B?*
2. *si no puede, ¿qué requisito le falta?*

| # | Tarea |
|---|---|
| E2-1 | El `pgEnum` de las diez etapas y la tabla de transiciones permitidas del insumo §3 |
| E2-2 | Los requisitos de entrada de cada etapa, como predicados puros |
| E2-3 | `moverEtapa()`: valida, escribe `deal_etapa_historial`, y es **el único camino** para cambiar `deals.etapa` |
| E2-4 | Guardián: ningún `update(deals).set({etapa})` fuera de este módulo. Mismo molde que `vigente` e `identidad` |
| E2-5 | Los saltos permitidos (En Contacto → Compromiso Verbal, el cierre por chat) y el retroceso con motivo |

🎯 **Por qué esto es un módulo único y no lógica repartida.** Tres escritores mueven etapas: el
sync (insumo §3.1), el closer, y el sistema al registrar un abono. **Si cada uno implementa el
requisito, divergen en silencio.** Es literalmente lo que ya pasó en este repo con el saldo
(ADR 0024: la reja y la pantalla dando cifras distintas) y con la vigencia (ADR 0026: una consulta
olvidada infla una métrica sin lanzar un error). No repetir esa herida es la decisión de
arquitectura más importante de todo el plan.

**Done cuando:**
- [ ] Cada transición del insumo §3 tiene su test, en los dos sentidos: la permitida pasa y la
      prohibida se rechaza con el requisito que falta nombrado
- [ ] El guardián está **mordido**: se le inyecta un `update` clandestino y falla
- [ ] Cero UI. Este módulo se prueba sin navegador

**Kiro:** parcial. La tabla de transiciones y sus tests sí, con revisión. El diseño del contrato no.

---

### Etapa 3 · Sync v2

Insumo §4 y §5. Aquí es donde `estado` por fin se lee (deuda F-01, abierta desde agosto).

| # | Tarea |
|---|---|
| E3-1 | **Una sola función de ingesta** que normaliza a Envío, sirva la entrada de una fila de hoja o de un payload de webhook |
| E3-2 | Envío: todas las columnas, las ~10 promovidas por fuera y el resto en `respuestas jsonb` **sin repetir** (insumo §5.4, opción A') |
| E3-3 | Identidad del Lead: correo manda; teléfono igual con correo distinto **se une y se marca**, nunca se fusiona a ciegas (insumo §2.2) |
| E3-4 | `lead.estado` desde el envío completo más reciente por posición en la hoja |
| E3-5 | La regla de creación y movimiento de deals del insumo §3.1, **llamando al motor de la etapa 2** |
| E3-6 | Zona horaria por fuente, default Bogotá. 🩸 Las dos hojas de hoy vienen en **UTC** (Typeform) |
| E3-7 | Configuración de fuente: lista de pestañas leída de la hoja, correo de la service account con botón Copiar, el paso a paso del insumo §5.3 |
| E3-8 | Alertas (insumo §5.6): pestaña renombrada, encabezado promovido que desaparece, tres fallos seguidos. Fuente pasa a **rota** sin desactivarse. Banner con acuse en `change_log` |
| E3-9 | Disparo por capas de D4: `onChange` de Apps Script, sync perezoso, botón manual, cron diario |

⚠️ **El centinela.** `parsearFecha` ya tiene su piso de plausibilidad (año 2000) porque una hoja
mandaba `1/1/0001` como "vacío" y eso borraba fechas reales en el dedup. **Cada campo nuevo que se
promueva tiene que responder la misma pregunta: ¿cuál es el valor que esta fuente escribe cuando no
sabe?**

**Done cuando:**
- [ ] Una corrida completa sobre `dev` produce 6.233 envíos aproximadamente y 4.791 leads
- [ ] Los deals se crean según §3.1 y **cada movimiento tiene su fila de historial**
- [ ] Una fuente con un encabezado promovido faltante pasa a `rota` y avisa, **sin desactivarse**
- [ ] El `onChange` de la hoja dispara el sync de verdad, medido

**Kiro:** sí, la mayor parte. E3-1 y E3-3 con revisión cercana: la identidad del lead es donde un
bug es silencioso.

---

### Etapa 4 · Calls, dinero y Students

Insumo §2.5, §2.6, §2.7 y §7.

| # | Tarea |
|---|---|
| E4-1 | `calls` colgadas del deal. El sync crea la Call `agendada` sin fecha cuando llega `Con Calendly` |
| E4-2 | **Pegar el link de Grain = la llamada sucedió**: `resultado = show`, fecha si estaba vacía, deal a Atendido |
| E4-3 | `no_show` / `cancelada` mueven a Pendiente Re-agenda (ADR 0015 se conserva) |
| E4-4 | Abonos sobre el deal. El primero mueve a Abonado; el que deja saldo en 0 mueve a Completo. **Lo hace el sistema, nunca el closer a mano** |
| E4-5 | `cuotas_pactadas` (D5) y la vista de cartera vencida |
| E4-6 | Comisión: `tasa_programa × precio_lista`, **calculada, nunca guardada** |
| E4-7 | `onboarded_at` y el cambio de cohorte con su fila de historial |
| E4-8 | **Ticket 035** (comprobante link o foto) aterriza aquí, con los dos análisis que Mani exigió antes de codear |

**Done cuando:**
- [ ] `saldo` sigue viviendo en un solo módulo y `tests/saldo-centralizado.test.ts` sigue verde
- [ ] Ningún movimiento de etapa por dinero se escribe fuera del motor de la etapa 2
- [ ] Cartera vencida responde por cuota, no solo por el total

**Kiro:** sí.

---

### Etapa 5 · Lectura y reporting

Insumo §8.

| # | Tarea |
|---|---|
| E5-1 | Reescribir `lib/queries/dashboard.ts` sobre deals. Se conservan las definiciones (caja ≠ ventas, meta de cohorte, días hábiles) |
| E5-2 | **Nuevo:** conversión etapa a etapa, tiempo promedio en etapa, deals abiertos por etapa y owner, Unclaimed por antigüedad |
| E5-3 | Réplica de `🚨 Urgencias` con desglose por `utm_source / utm_medium` |
| E5-4 | ROAS por cohorte en tres cubos (Meta Ads, orgánico, sin UTM). Depende de `ad_spend`, ver E1-4 |
| E5-5 | `nerd-stats` reescrito |
| E5-6 | **Ticket 021** (PDF) se descongela aquí y no antes: el PDF recibe el mismo objeto que pintó la pantalla (ADR 0024) |

**Kiro:** sí.

---

### Etapa 6 · UI

> ⚠️ **24-sep: la forma de la UI ya está decidida** (ADR 0050): tabs por objeto, selector de programa,
> Inbox en lugar de "Mi día" y una tab Dashboard. La tabla de abajo se lee con la §13: el Kanban es la
> vista tablero de la tab Deals, E6-2 y E6-3 son el Inbox, y entran las tabs Calls, Students y
> Programs (tickets 097 a 100).

Decisión de Mani del 21-sep: se define **después** de construir, con el motor funcionando enfrente.
*"Debe ser lo más amigable y fácil de usar posible, enfocado a utilidad sobre todo."*

| # | Tarea |
|---|---|
| E6-1 | Kanban por programa con las diez etapas, filtros por owner, cohorte, canal, antigüedad |
| E6-2 | Pendiente Setteo como tabla para reclamar, y Unclaimed |
| E6-3 | Mis deals · mis Calls de hoy · cartera vencida |
| E6-4 | Base de Leads con filtros (Descartado, Sin Calificar, Parcial), sin deal |
| E6-5 | Ficha del Lead: envíos con diff entre ellos, contactos, deals abiertos y cerrados |
| E6-6 | Ficha del Deal: todo en una pantalla más el historial de etapas |
| E6-8 | **Revisión profunda de toda la UI**, no solo de lo nuevo. Ver §11 |
| E6-7 | **D6:** bitácora en Nerd Stats. Toda escritura del CRM, filtrable por usuario, tabla y rango. Es la **pantalla** de un rastro que ya lleva escribiéndose desde la etapa 1 |

⚠️ **El riesgo que hay que decidir antes de empezar esta etapa.** Este repo **no tiene tests de
componentes**, y eso ya dejó pasar dos bugs con 669 tests en verde (20-sep): un `disabled` mal
escrito que dejó un botón muerto, y una función de `lib/` que nadie llamaba y estaba mal desde el
día que se escribió. Base UI además **lanza en tiempo de ejecución**, no en compilación, cuando una
parte vive fuera de su contenedor: eso tumbó el layout entero al abrir un menú y estuvo roto días.

Un Kanban con arrastre, diez columnas y requisitos por etapa es **la superficie más grande de este
tipo que va a tener el proyecto**. Hay que decidir al abrir la etapa 6: o entran tests de
componente, o la garantía sigue siendo el recorrido visual a mano **haciendo clic en todo lo que se
abre** y mirando la consola. Lo que no se vale es asumir que los 677 tests cubren esto.

**Kiro:** sí, con revisión visual obligatoria de cada entrega.

---

### Etapa 7 · Migración one-time

Insumo §9. Va de último, con el scaffold completo.

| # | Tarea |
|---|---|
| E7-1 | Barrer las pestañas de gestión de las dos hojas: Setteo, Registro de llamadas, Estudiantes, `Forms viejo` |
| E7-2 | **Pasa por la misma ingesta de E3-1**, nunca por inserts crudos, y deja `change_log` (ADR 0029) |
| E7-3 | Recuperar las **55 personas exclusivas de `Forms viejo`** (D2) con sus envíos |
| E7-4 | Resolver los casos que el insumo §9 ya enumera: Setteo `En proceso` sin nota, `Show = Sí / Cierre = No`, `Registro 1-5` → actividades, el `Origen` con `#REF!`, los encabezados corridos de `Registro de llamadas` de ComunicArte, `_kpis` apuntando a pestañas vacías |
| E7-5 | COP → USD a la tasa del día de la migración |
| E7-6 | Apagar las pestañas de gestión de la hoja |

**Kiro:** sí, con los casos raros revisados uno por uno.

---

## 7. Impacto sobre los cuatro tickets abiertos

| Ticket | Qué le pasa |
|---|---|
| **007** · Alta de closers | **Se parte en dos.** El criterio 1 (Andrea con su correo, `closerId` y programas) sigue vivo e independiente: cárgalo cuando tengas el correo. El criterio 2 (*"`registrarLlamada` probado con una cuenta real"*) **queda obsoleto**: esa mutación se reescribe en la etapa 4. La tabla de `closer_id` reales del ticket sigue siendo el insumo correcto, pero ahora alimenta al **owner del deal** (`owner_user_id`, FK real a `users`), no a un texto sobre la persona. ADR 0011 (closerId como texto copiado) sobrevive **solo** para lo histórico que entra por la etapa 7 |
| **021** · Snapshot PDF | **Se congela hasta la etapa 5.** No por bloqueo sino por desperdicio: el dashboard que fotografiaría está a punto de ganar funnel por etapa, Urgencias y ROAS. Hacerlo antes es hacerlo dos veces |
| **034** · Categorías de lead | **Queda absorbido y deja de existir como ticket.** Su alcance ES el insumo §2.2 + §11. Dos cambios sobre lo que decía: (a) el backfill desde `people.raw` **ya no aplica**, porque `submissions` lo reconstruye el primer sync v2 desde la hoja; (b) `people.estado` → texto pasa a ser parte del corte de la etapa 1, no una migración propia. Se reescribe en E0-4 como nota de absorción, no se borra |
| **035** · Comprobante link o foto | **Sobrevive casi igual, se muda a la etapa 4.** Lo único que cambia es que cuelga de `abonos.deal_id`. **Siguen debiéndose los dos análisis que exigiste antes de codear**: cuánto crece el almacenamiento por mes, y quién puede ver el comprobante de un abono ajeno (esa segunda **no** la contesta el ADR 0009) |

---

## 8. ADRs a escribir en la etapa 0

El último vigente es el **0034**. Los nuevos arrancan en 0035.

| # | Título | Qué decide |
|---|---|---|
| **0035** | El Lead y sus contactos | `people` → `leads` (D1); la llave `(programa, correo)` se conserva; `lead_contactos`; unión por teléfono **marcada**, nunca ciega |
| **0036** | El Envío y todas las columnas sin plantilla | `submissions`; ~10 promovidas + `respuestas jsonb` **sin repetir** (opción A'); enmienda al ADR 0019 |
| **0037** | El Deal y las diez etapas | el deal como objeto; las etapas como tipos; el motor único; `sales` se disuelve; enmienda a los ADR 0021 y 0027 |
| **0038** | Anular no es Cierre Perdido | D3, **confirmada por Mani el 21-sep**. Amplía el ADR 0026 a `deals` |
| **0039** | Un programa, una fuente de leads | D2, con las 55 personas de `Forms viejo` y su ruta por la etapa 7 |
| **0040** | El sync se dispara por capas | D4, plan Hobby medido; enmienda al ADR 0007 |
| **0041** | Las cuotas pactadas son filas | D5, con el argumento de la cuota desigual |
| **0042** | Todo movimiento del CRM deja rastro | D6; amplía `change_log` a las tablas operativas; el rastro se escribe desde el día uno y solo la pantalla va al final |

---

## 9. Invariantes de diseño que no se negocian

Salen de heridas que este repo ya tiene documentadas. Van aquí para que no haya que redescubrirlas.

1. **Si dos lugares responden la misma pregunta, la respuesta vive en un módulo y los dos la
   importan.** Ya aplica a `saldo`, `vigente`, `rolDeVista`, `identidad de closer`,
   `exigirAccesoAlPrograma`. **Se suma: el motor de etapas.**
2. **La ingesta es UNA función**, sirva una fila de hoja o un payload de webhook. Es lo que hace que
   Dapta después salga gratis en vez de ser un segundo camino que mantener.
3. **Un guardián que no se puede hacer fallar es decoración.** Todo guardián nuevo se muerde en los
   dos sentidos: caza lo malo **y** no marca lo bueno. El del molde pasó en verde con un `DELETE`
   clandestino inyectado.
4. **Todas las fechas son de Bogotá y el `-05:00` va explícito.** `new Date(a,m,d)` y
   `toISOString().slice(0,10)` siguen prohibidos para una fecha de negocio.
5. **Un valor que una fuente escribe cuando no sabe es un centinela, y un centinela que se cuela no
   falla: miente.** Cada campo promovido nuevo responde esa pregunta.
6. **El developer es el dueño y no se le restringe nada.** Todo `rol === "..."` escrito a mano que
   lo excluya es un bug. Las preguntas viven en `lib/auth/roles.ts`.
7. **Nada de subconsultas correlacionadas con la plantilla `sql` de drizzle.** Meter una tabla en la
   plantilla desactiva la calificación de columnas y el conteo devuelve 0 sin lanzar un error.
8. **Antes de trabajar una deuda vieja, verifícala.** El 20-sep tres de seis deudas "pendientes" ya
   estaban resueltas. El 21-sep `calls`, `sales` y `abonos` resultaron vacías y eso cambió el plan
   entero. **Cuesta un comando.**

---

## 10. Lo que sigue abierto

### ✅ Mani — cerrado el 21-sep, ya no queda nada abierto de su lado

> ⚠️ **Ya no es cierto desde el 21-sep por la tarde:** la §12 y la revisión del 22-sep abrieron
> preguntas nuevas (D2-D5, R1-R11, P1-P3), y el 24-sep se cerraron varias (§13). Lo abierto hoy está
> en la tabla "Decisiones pendientes" de `docs/tasks/README.md`.

1. ~~**E1-4**: qué pasa con las filas de `sources` con `destino != people`.~~ **Contestada el
   mismo 21-sep** (textual): *"Borrar todas. Porque eso era solo para la migración inicial ya que
   todo se manejaba manual en Sheets... cuando el CRM se vuelva el centro, las llamadas solo van a
   vivir aquí. Lo único que va a entrar de afuera son Leads crudos que llenan un forms de un
   programa."* Y sobre la pauta: *"el costo de una campaña... sí toca indicarlo manualmente o
   traerlo de los Paid Traffickers; las pautas deben poderse asignar un costo."*
   → `sources` pasa a significar **solo el intake de leads**, la columna `destino` desaparece, y
   **`ad_spend` sobrevive pero deja de entrar por Sheets: se captura en el CRM**. Argumentos en el
   **ADR 0039**; lo ejecutan los tickets **039** (el corte) y **067** (la captura y el ROAS).
   ⚠️ **Corrección medida:** son **7** filas con `destino != people`, no 5. Este documento contó
   las 5 de ComunicArte, que incluyen 2 de leads. Verificado contra `dev` el 21-sep.

*(D3 y D5 quedaron confirmadas el 21-sep y ya no están abiertas.)*

### 🟡 Closers (Andrea Machado y Maru Marquez)

No bloquean construir. Con `deal_etapa_historial` guardando todo movimiento, la conversión se
recalcula cuando respondan.

- Validar las diez etapas y sus requisitos de entrada
- Qué campo les da más pereza llenar (define qué se exige por etapa)
- Si "Setteo No Calificado" es etapa o salida: de eso depende si la conversión da 0,9% o 2,6%
- Qué hacen con un no show, un compromiso vencido, una próxima cohorte
- Qué es una venta sin llamada

### 🟡 Michael Castellanos

- Por qué se dejó de calcular el ROAS; cómo marca Juanito su rastro en el UTM
- Qué pasa cuando un compromiso verbal vence o un parcial nunca completa
- Si alguien edita el `Estado` de la hoja a mano
- Sus consolidados C2 o la hoja, cuando difieran en la etapa 7

### 🟡 HubSpot de Daniel Tovar

Revisión pendiente como **fuente de diseño, no como alternativa**: sus etapas contra las diez,
propiedades exigidas por etapa, pagos parciales, Goals por rep o por equipo.

---

## 11. Pendiente transversal: la revisión profunda de la UI

**Mani, 21-sep:** *"la UI es otra cosa que me va a tocar definir luego de construir ya que es
literal lo que el equipo va a ver. Debe ser lo más amigable y fácil de usar posible, enfocado a
utilidad sobre todo."*

Esto no es la etapa 6 y no se cumple construyendo las pantallas nuevas. Es **una pasada completa
sobre la aplicación entera**, y hay que hacerla porque el punto de partida lo pide:

1. **La UI de hoy se construyó ticket por ticket, sobre el modelo viejo.** `/mi-dia`, `/personas`,
   `/programas/[slug]` y `/nerd-stats` nacieron para persona → llamada → venta. Después de la
   etapa 5 van a estar funcionando sobre deals, pero **con la forma de la época anterior**. Eso
   produce una app que funciona y se siente cosida.
2. **Nunca ha existido un criterio de UI escrito para este repo.** Hay ADRs para el dinero, los
   roles, la vigencia y el catálogo. Para la interfaz no hay ninguno, así que cada pantalla nueva
   resuelve la navegación, los vacíos y los errores a su manera.
3. **El equipo real todavía no la ha usado.** Cero closers, cero registros (§2.2). La primera
   revisión con criterio de usabilidad va a encontrar cosas que ningún test ve.

**Qué cubre la revisión, como mínimo:** navegación y jerarquía entre las pantallas; qué ve alguien
que abre la app por primera vez; los estados vacíos; los mensajes de error; el flujo completo de un
closer en un día sin tener que acordarse de nada; el celular, porque un closer registra un abono
desde el teléfono en mitad de una llamada; y la consistencia de los componentes entre pantallas.

⚠️ **Y el aviso que ya está en la etapa 6, repetido aquí porque es donde se paga:** este repo **no
tiene tests de componentes**. El 20-sep dos bugs pasaron con 669 tests en verde, y Base UI lanza en
tiempo de ejecución, no en compilación. Una revisión de UI que solo **carga** las pantallas no
sirve: hay que **hacer clic en todo lo que se abre** y mirar la consola del navegador. Antes de
abrir esta revisión hay que decidir si entran tests de componente o si la garantía sigue siendo el
recorrido manual.

**Cuándo:** después de la etapa 5, en paralelo o justo después de la etapa 6. **No antes**, porque
revisar la usabilidad de pantallas que están por reescribirse es trabajo que se bota.

---

## 12. Enmienda del 21-sep · La reunión con Alejo Carvajal

**Qué es esto.** El primer stakeholder de la fase 1 del rol de Ops habló, y lo que dijo tiene
consecuencias sobre este plan. Se escriben aquí y no en una nota aparte porque una implicación que
vive fuera del plan es una implicación que nadie va a leer cuando tome el ticket.

**Fuente:** `docs/insumos/fleeting/2026-09-21-reunion-alejo-areas-y-utms.md`.
⚠️ **Son notas, no transcript** (Granola gratuito no sirve transcripts). Lo que no está anotado no
se sabe si se preguntó.

**Alejo lleva dos sombreros** —Gerencial y Media, según `mapa-retia`— y por eso pidió cosas de los
dos lados en la misma reunión. Conviene no leerlas como una sola.

---

### 12.1 🩸 El hallazgo que ordena la enmienda: el número que pidió va a dar CERO

Alejo nombró su dolor de gerente textualmente: **"rendimiento de las áreas · cantidad de leads por
área"**, y agregó el trabajo que falta: *"ahí toca definir qué UTMs pertenecen a cada área"*.

Ese número, construido como está el sistema hoy, **se puede calcular y va a mentir**:

| Área | ¿Trae leads? | ¿Los trae con UTM? | Lo que mostraría la pantalla |
|---|---|---|---|
| **Pauta** | sí | sí (`facebook / cpc`) | correcto |
| **Media** | sí | sí (`instagram / stories / organico`, `tiktok / linktree`) | correcto |
| **Comercial** | **sí** (un closer trae un referido) | **no** | **cero leads** |
| **Gerencial** | no aplica | — | — |

**Un closer que trae un lead es invisible**, porque el UTM de hoy solo describe pauta. La pantalla
no lanzaría ningún error: mostraría a Comercial en 0 y un gerente concluiría que los closers no
aportan pipeline. Es exactamente la clase de bug de la que este repo ya sangró tres veces (ADR
0024, ADR 0026, el centinela de `parsearFecha`): **una cifra creíble, equivocada, sin excepción.**

🎯 Mani ya había escrito la extensión que lo arregla, antes de esta reunión y por otro camino
(`retia-ops/notebook/mi-enfoque-del-rol.md`): **UTM de todo, no solo de campañas — también de
origen humano.** La reunión con Alejo es la primera evidencia externa de que hace falta. **Es
barato mientras el CRM se construye y caro después**, y la ventana es la misma que ya justificó el
corte de la etapa 1: `submissions` todavía no existe con datos propios.

---

### 12.2 El "área" no existe en este repo, y es la unidad con la que Retia se organiza

`grep -rin "área\|gerencial\|paid traffick"` sobre `docs/` devuelve **cero**. El sistema conoce
programas, cohortes, closers, productos y roles. **No conoce áreas**, y las cuatro áreas —Gerencial,
Comercial, Pauta, Media— son la manera en que la empresa se mira a sí misma.

**Forma que le corresponde, por el ADR 0012:** el código no decide nada según cuál área sea, así
que **las áreas son filas, no un enum**. Molde de `lib/catalogo/`: tabla con `activo`, un esquema
zod, pantalla con guard, `change_log` en cada cambio, y `borrarSiNoSeUso`.

⚠️ **Y la trampa que hay que nombrar antes de que alguien la pise: área NO es rol.** El rol contesta
*"¿qué puede hacer esta sesión?"* y vive en `lib/auth/roles.ts`. El área contesta *"¿a quién se le
atribuye este lead?"* y es una dimensión de reporte. Son dos preguntas y van dos módulos. Fundirlas
repite literalmente el bug que este repo ya bautizó en `AGENTS.md`: *"cuando una variable de permiso
se llame como un rol, sospecha"*. Un `rol === "closer"` usado para decir "esto es de Comercial"
dejaría al developer afuera y además sería falso: el gerente no vende y sigue siendo de Gerencial.

---

### 12.3 UTM → área es una CLASIFICACIÓN, no una normalización

El ticket **066** dice explícitamente *"Fuera: normalizar los UTM"*, y esa decisión sigue en pie:
el texto del UTM se guarda como llegó (ADR 0004, misma lógica que la ortografía del closer). Lo que
Alejo pidió es otra cosa: **mapear cada UTM a un dueño**, sin tocar el texto.

Molde propuesto, para que la etapa 5 no lo invente a mano:

```
areas              (id, nombre, activo, ...)              catálogo, ADR 0012
utm_clasificacion  (id, area_id, utm_source?, utm_medium?, prioridad, activo)
```

- Se clasifica por **patrón**, no por fila: un `utm_source` nuevo entra mañana y no debe romper nada.
- Lo que no case cae en **`(sin clasificar)`**, y `(sin clasificar)` **se muestra**, nunca se
  reparte ni se esconde. Mismo criterio que `(sin atribución)` del ticket 066: un cubo invisible es
  un cubo que crece hasta que alguien se da cuenta un semestre después.
- La clasificación es **editable desde la app**, porque el que sabe a qué área pertenece
  `instagram / rosario` es Alejo, no el código.

🎯 **El dato para el mapeo ya existe y ya está anotado en el repo.** El ticket 066 dejó escrito que
los `utm_source` de ComunicArte **ya nombran personas** (`instagram rosario`, `instagram milena`).
Esas personas son Media. El mapeo no arranca en cero: arranca leyendo los `utm_source` distintos
que hay en `submissions` después del primer sync v2 y pidiéndole a Alejo que asigne cada uno.

---

### 12.4 ✅ Lo que Alejo pidió y el modelo ya sabe contestar

Vale escribirlo, porque es la mitad de la reunión y sería un desperdicio construirlo dos veces.

| Lo que pidió | Dónde ya vive |
|---|---|
| Deals con etapas estandarizadas al estilo HubSpot | ADR 0037, etapa 2 completa |
| Close rate y show rate por closer | `lib/queries/dashboard.ts`, se conservan (E5-1) |
| Estado del lead por etapa | el embudo por etapa, ticket **065** |
| Qué anuncios están vendiendo, por fecha y canal | tickets **066** (Urgencias con desglose UTM) y **067** (ROAS) |
| Inversión por pauta | `ad_spend` capturado en el CRM, ticket **067** (ADR 0039) |
| % de cierre por closer para Gerencial | ya existe; y sin meta individual, por el ADR 0023 |
| Centralizar leads crudos de los forms | etapa 3 completa |
| "Leads perdidos y entradas duplicadas en los sheets" | el dedup por correo es una restricción dura (ADR 0005) y las 55 de `Forms viejo` ya tienen ticket (**079**) |

🎯 **Y el mejor hallazgo de la revisión: "registros vs agendas por canal" —la métrica de Media— ya
es contestable con el esquema de la etapa 1, sin agregar una columna.**

```
Registro = una fila de  submissions            (todo el que llenó el Typeform)
Agenda   = un deal que alcanzó la etapa 4       (Agendado)
El puente = deals.submission_origen_id          ← ya está en el esquema del ADR 0037
```

El `deals.submission_origen_id` se puso para saber de qué envío nació un deal. Resulta que es
exactamente la llave que permite dividir agendas entre registros **por UTM**. No hay que cambiar el
modelo: **falta la vista**, y hoy no tiene ticket.

⚠️ El detalle que hace que la cuenta sea honesta: el ticket **052** decide que un `estado`
Descartado o vacío **no crea deal**. Por eso el denominador tiene que salir de `submissions` y no
de `deals` — si sale de `deals`, la tasa de calificación de TikTok daría 100% y el ejemplo que
Alejo puso a mano desaparecería de la pantalla.

---

### 12.5 El trabajo, ya como tickets

**Las decisiones se cerraron el 21-sep** (§12.6, §12.8.6, §12.10.2.b) y el trabajo quedó escrito:
**ADR 0043 a 0046**, tickets **083 a 093**, y una etapa nueva **E1b** en el tracker.

| # | Etapa | Depende de | Qué es |
|---|---|---|---|
| **083** | **E1b** | 042 | Catálogo de áreas. Molde `lib/catalogo/`. **El área no se guarda en `leads`: se deriva** |
| **084** | **E1b** | 083 | `campanas` y `utm_patron`, con **tres** campos de patrón. Migración: la siguiente libre (la **0021** la tomó RLS el 23-sep) |
| **085** | **E1b** | 084 | El emparejador **determinista** y su guardián |
| **086** | **E3** | 048, 084 | `leads.traido_por_user_id` + el enlace de captación. ⏳ **lo escribe la ingesta** |
| **087** | **E3** | 085, 086 | 🩸 El CPL deja de preguntar por `entrada`. **Va con el 086, nunca después** |
| **088** | **E5** | 049, 052, 085 | Registros vs agendas por canal — la vista de **Media** |
| **089** | **E5** | 064 | Series con dimensiones, no escalares. ⏳ **gratis ahora, reescritura después** |
| **090** | **E5** | 085, 088, 089 | Rendimiento por área — la vista de **Gerencia**, estados con acción |
| **091** | **E6** | 073 | `otrosProgramasDelCorreo`: visibilidad cruzada sin cruzar la frontera |
| **092** | **E1b** | 084 | La URL del formulario y el **generador de links**. 🩸 Destapa que `programs` **no tiene la URL del formulario** (ADR 0046) |
| **093** | **E5** | **—** | ⚡ **Sin dependencias.** Filtros por los tres UTM que **ya son columnas** (85% de cobertura). Lo único que entrega valor hoy (§12.14) |

**Dos tickets viejos quedan tocados:** el **067** enmendado —el grano de `ad_spend` ya no se decide
ahí, lo fija el 084— y el **070** ampliado: el origen va a la vista, o la regla de "el closer revisa
el UTM antes de reclamar" es inaplicable.

⚠️ **El orden que no es negociable:** 086 y 087 son de la **etapa 3**, no de la 5. El dato del origen
lo escribe la ingesta (ticket 048); los leads que entren antes **no tienen origen y no se puede
reconstruir**, porque *"lo trajo Maru"* no está escrito hoy en ninguna parte.

Fuera de este repo, anotado para que no se vuelva a descubrir:

- **Videos editados y publicados por creador.** Alejo lo marcó **explícitamente como no
  prioritario**. Y no es de este repo: es un dashboard de producción de contenido, que pertenece a
  la herramienta de contenido (`retia/notebook/herramienta-de-contenido-retia.md`). Meterlo aquí
  rompería la frontera de dominio del **ADR 0033** — este repo es el CRM comercial. Se anota y se va.
- **Transcripts de llamadas.** Alejo los nombró como métrica de closer. El CRM ya guarda **el link
  de Grain**, y el link es la etapa 5 del deal (*"pegar el link de Grain = la llamada sucedió"*,
  ticket **058**). **Ingerir y analizar el transcript es otro sombrero** —sales enablement, no ops—
  y el propio consolidado del rol ya advirtió que *"se come la semana sin pedir permiso"*. El
  enganche queda; el análisis no entra al plan v2.

---

### 12.6 Las decisiones de Mani — tomadas el 21-sep ✅

Las tres quedaron cerradas el mismo día. Se registran con su argumento porque una decisión sin
registro se ve igual que un olvido.

**Decisión A ✅ · El área entra al CRM.** Textual de Mani: *"Área va dentro como una nueva manera de
agrupar leads y deals según origen."* Catálogo por el molde del ADR 0012. Lo que la frase agrega a
lo que este documento proponía: el área **no es solo una dimensión de reporte, es una forma de
agrupar en la pantalla**, y aplica a `leads` **y a `deals`**, no solo a la métrica de gerencia.

**Decisión B ✅ · El origen acepta que un lead llegue por humano.** Textual: *"el origen debe aceptar
que un lead llega por humano también, por closers directamente."* El diseño está en §12.8, porque
la pregunta que Mani hizo al decidir —*"¿toca crearlos manual? ¿cada closer tiene el suyo?"*— tiene
una respuesta que no es obvia y que toca una regla ya escrita.

**Decisión C ✅ · A los closers se les enseña el CRM completo, no solo las etapas.** Textual: *"se
les tiene que mostrar cómo van a usar el CRM para manejar sus leads, deals, calls, students,
cohorts, programas, productos, plataformas, métodos de pago, recursos, etc., desde que llegan hasta
que cierran. Cómo esos componentes funcionan dentro del CRM."*

Eso **amplía** lo que este documento recomendaba (llevar solo las diez etapas) y no lo contradice
en lo que importa: **el recorrido se hace sobre el modelo, no sobre la app.** Enseñar la UI del MVP
—que corre sobre persona → llamada → venta, el modelo que se está reemplazando— compraría
validación del modelo equivocado. El entregable es un recorrido de punta a punta por los objetos y
cómo se enganchan, no una demo.

---

### 12.7 Las respuestas de Alejo que llegaron después (21-sep)

Cuatro de las cinco preguntas sin rastro quedaron contestadas fuera de la reunión. Importan porque
tres de ellas **cambian el diseño**, no solo el contexto.

| Pregunta | Respuesta | Qué cambia |
|---|---|---|
| **Success floors** | *"cuando el CRM ya se tenga, se puede definir lo que muestran las métricas del dash gerencial y el reporte daily"* | 🎯 Los umbrales **llegan después**, así que la vista gerencial se construye sin ellos. La consecuencia de diseño: la pantalla tiene que nacer **con el slot del umbral vacío**, no rediseñarse para recibirlo |
| **¿Cómo sabe si la semana va bien?** | *"ver si las inversiones se convierten en ventas, ver el performance de cada área"* | Confirma que C-2 y C-4 no son un capricho: son literalmente su definición de semana buena. Y la primera mitad es exactamente el ROAS del ticket **067** |
| **¿La operación ideal?** | *"toda la info centralizada y súper bien organizada, sin perder NADA de visibilidad"* | Es un criterio de diseño, no una métrica. Y coincide palabra por palabra con lo que ya protege el repo: **el CRM nunca borra un lead**, se anula en vez de borrar, y `borrarSiNoSeUso` desactiva lo que tiene referencias |
| **¿Qué es lo tedioso?** | 🎯 ***"no saber qué decisiones tomar"*** | **El dato más importante de toda la reunión.** Ver abajo |

🎯 **"Lo tedioso es no saber qué decisiones tomar" cambia qué es el dashboard gerencial.**

El dolor declarado **no es recolectar el dato ni leerlo: es que el dato no dice qué hacer.** Una
tabla de "leads por área" con cuatro números correctos no resuelve nada de lo que Alejo acaba de
describir; le da el mismo problema con mejor tipografía.

Y esto ya tiene precedente medido, en el análisis del semáforo de 30X que vive en el vault: ahí el
sistema **detecta perfecto** —umbral, semáforo, accionable escrito, dueño nombrado— y **nadie
atiende los rojos**, hasta 10 días seguidos con ~$200 diarios quemándose. La conclusión de ese
análisis fue *"detectar no es actuar"*. La frase de Alejo es la misma herida vista desde el otro
lado: **para él, ni siquiera está claro qué acción propone el número.**

**Lo que se sigue de ahí, para cuando se diseñe C-4:** la vista de gerencia no es una tabla de
cifras, es un tablero de **estados con acción**: qué está fuera de umbral, desde cuándo, de quién
es, y qué se hace. El número es el respaldo de la frase, no el producto. Es el mismo criterio que
ya rige el resto del repo —`saldoLegible` decide **la etiqueta y el valor juntos**, porque un saldo
negativo es un sobrepago y no una deuda— aplicado una capa más arriba.

⚠️ **Y no se puede construir todavía**, porque un estado necesita un umbral y los umbrales llegan
después (fila 1). Lo que sí se puede hacer ahora es **no cerrarse la puerta**: que la consulta
devuelva el número con su contexto (contra qué se compara, desde cuándo) y no un escalar suelto.

---

### 12.8 El origen humano: cómo se marca un lead que trae un closer

La pregunta exacta de Mani al tomar la decisión B: *"¿será que estos toca crearlos manual para que
tengan su UTM? ¿Cada closer tiene el suyo? ¿Cómo sería?"*

**Respuesta corta: no toca crearlos manual, y el closer no escribe ningún UTM.** Tiene un enlace, y
el enlace escribe el UTM por él. Abajo el porqué, que es donde está lo que no es obvio.

#### 12.8.1 Por qué NO se teclea el UTM a mano

Es la opción más directa —que el closer escriba `utm_source = closer maru` al dar de alta— y es la
que hay que descartar, por tres razones que ya están escritas en este repo:

1. 🩸 **Vuelve el ADR 0030 por la puerta de atrás.** `Maru`, `maru`, `closer maru` y `Maru Marquez`
   serían **cuatro closers** en el reporte de gerencia, sin un solo error. Ese ADR existe porque
   pasó de verdad: `mani` y `Maru` produjeron dos filas en el comparativo. Y el ticket **066** dice
   explícitamente *"Fuera: normalizar los UTM"*, así que ese campo **no tiene quien lo defienda**.
2. **Ensucia el campo que sirve para reconciliar con Meta.** El `utm_*` es texto copiado de una
   fuente externa (ADR 0004). Un valor inventado dentro del CRM se mezcla con `facebook`,
   `instagram` y `tiktok` en toda consulta de pauta, y entra sin avisar a los tres cubos del ROAS
   del ticket **067**.
3. **Es texto donde hay una FK disponible.** El closer ya es una fila de `users`. Guardar su nombre
   en vez de su id es exactamente el error que el ADR 0030 tuvo que remendar con un índice único
   sobre la forma normalizada.

#### 12.8.2 Lo que sí: un enlace de captación por closer, y el UTM entra solo

El closer no da de alta a nadie: **manda su enlace**, el lead llena el formulario como cualquier
otro, y el UTM entra por el camino que ya existe.

```
https://<form del programa>?utm_source=closer&utm_medium=referido&utm_campaign=<closer>
```

Lo que esto gana, y por eso es la opción correcta y no solo una alternativa:

- **Cero trabajo manual.** Entra por el sync, por la fuente activa del programa. Respeta el ADR 0039
  sin tocarlo.
- **El lead trae sus respuestas.** Presupuesto, urgencia, experiencia: lo que el closer necesita
  para trabajar el deal. Un lead creado a mano **no las tiene**, y esa es la diferencia práctica
  más grande entre los dos caminos.
- **Nadie teclea, así que no hay ortografía que defender.** El enlace lo genera el CRM.
- **No es un mecanismo nuevo: es el que Media ya usa.** `instagram rosario` e `instagram milena`
  —los `utm_source` reales de ComunicArte— son literalmente esto: un UTM que nombra a una persona.
  Lo único que falta es hacerlo explícito y para closers.

**El enlace no es una tabla.** Es la URL de la fuente del programa más los parámetros del closer:
es **derivable**, así que se calcula y se muestra con un botón Copiar, no se guarda. Misma regla que
la comisión del ADR 0024 (*"calculada, nunca guardada"*) y por la misma razón: un enlace guardado y
la fuente cambiada son dos verdades.

#### 12.8.3 Dónde vive el dato, y por qué la clasificación es UNA tabla y no dos

```
leads.traido_por_user_id   uuid NULL  →  users(id)      la FK, no texto
```

Y la clasificación del §12.3 **contesta las dos preguntas a la vez** en vez de duplicarse:

```
utm_clasificacion (id, area_id, user_id?, utm_source?, utm_medium?, utm_campaign?, prioridad, activo)
```

Son la misma pregunta con distinto grano —*"¿de quién es este UTM?"*— y **el área de un closer se
deduce del closer**, así que partirla en dos tablas obligaría a mantener sincronizado que
`utm_campaign = maru` es de Comercial y que Maru es de Comercial. Dos lugares con la misma
respuesta es justo lo que el repo prohíbe.

**Quién escribe `traido_por_user_id`, y quién gana:** lo escribe **la función de ingesta del ticket
048 y nadie más** —los dos caminos pasan por ahí—, y **el primero que lo escribe gana**. Si Maru lo
trajo y tres meses después el mismo correo reaplica por una campaña de Meta, el lead sigue siendo
de Maru: la atribución de quién trajo a una persona se paga una vez. Es el mismo criterio con el
que el dedup ya conserva la fecha más antigua.

#### 12.8.4 El alta manual sobrevive como respaldo, y NO genera envío

El alta manual ya existe (`leads.entrada = 'crm'`, ADR 0021, **0 filas** hoy) y se queda, porque el
enlace falla en la vida real todo el tiempo: el lead llegó por WhatsApp, por un evento, por un
amigo. Ahí el closer lo crea y se marca como quien lo trajo, eligiéndose de un selector.

⚠️ **Lo que ese lead NO tiene es envío, y eso es correcto, no una carencia.** Se verificó contra el
esquema: `submissions.source_id` es `notNull`, y una `source` nueva de tipo "alta manual" **la
rechazaría la base** — el índice único parcial `sources_una_activa_por_programa_idx` solo admite
una fuente activa por programa (ADR 0039). O sea que la idea de fabricarle un envío sintético al
lead manual **no es una preferencia de diseño: la base no la deja.** El modelo ya lo tenía previsto
por otro lado: el ADR 0037 admite *"deal manual"* como entrada a Pendiente Setteo y a Compromiso
Verbal sin pasar por un `estado` de hoja.

#### 12.8.5 🩸 Esto rompe la regla del CPL que ya estaba escrita

**Es la consecuencia que no se ve y hay que arreglar en el mismo movimiento.**

El ADR 0021 dice, y el comentario de `lib/db/schema.ts` lo repite: *"el CPL usa solo las del
formulario, porque la pauta solo paga esas"*. Esa regla se apoya en `entrada`, que hoy solo tiene
dos valores: `formulario` y `crm`.

**Con el enlace del closer, un lead de Comercial entra por el formulario.** O sea que a partir de
ese momento `entrada = 'formulario'` **deja de significar "lo pagó la pauta"**, y el CPL empezaría a
dividir la inversión de Meta entre leads que Meta no trajo. El costo por lead saldría **más barato
de lo que es**, y una campaña mala se vería aceptable. No lanzaría ningún error.

**El arreglo, en una línea:** el denominador del CPL deja de preguntar por `entrada` y pasa a
preguntar por **la clasificación del UTM**: cuenta los leads cuyo UTM cae en el área **Pauta**.
Queda mejor que antes, porque tampoco estaba contando bien los orgánicos de Media, que también
entran por el formulario y tampoco los paga la pauta.

→ **Enmienda al ADR 0021 y al ADR 0037** (los dos repiten la regla), más el comentario del esquema.
Va junto con el candidato **C-2**, nunca después: separadas, la pantalla del CPL y la clasificación
darían cifras distintas sobre lo mismo, que es la herida del ADR 0024.

#### 12.8.6 Lo decidido sobre el origen (Mani, 21-sep) ✅

**1 · El enlace es por closer Y programa.** ✅ Textual: *"recuerda que los Leads SIEMPRE tienen un
programa asignado al entrar... el programa es parte de la PK de Leads."*

Es correcto y **el esquema ya lo enforza**, verificado: `leads_programa_email_idx` es único sobre
`(program_id, email_normalizado)`, no sobre el correo solo. **La misma persona en los dos programas
son dos leads, y eso no es un duplicado: es el diseño.** Lo mismo en `lead_contactos_valor_idx`,
`deals_uno_abierto_por_lead_y_programa_idx`, `calls_huella_idx`, `ad_spend_huella_idx`,
`productos_programa_nombre_idx` y `cohorts_programa_codigo_idx`. Y `lead_contactos.program_id` está
**denormalizado a propósito** justo para poder hacerlo.

Para el enlace eso sale gratis: como la URL se deriva de la fuente del programa (ADR 0039, una
fuente activa por programa), **un enlace por closer y programa es lo único que se puede construir**.
La regla general quedó escrita en `AGENTS.md` como restricción no-negociable, porque Mani la enunció
como permanente: **el programa no es un filtro, es una frontera**, y se enforza en el tipo de la
consulta, no en la revisión.

⚠️ **Lo que esto SÍ deja decidir:** las tablas nuevas. `areas` y `utm_clasificacion` son
**globales**, sin `program_id`, por el mismo molde que `motivos` y `origenes`: contestan *"¿qué es
este canal?"*, y un canal es un canal en los dos programas. Los nombres de campaña no colisionan
entre programas (`De_Cero_a_Tactical_Investor_...` vs `Metodo_Comunicarte_...`), así que un patrón
de un programa simplemente nunca casa con envíos del otro. **La clasificación es global; la
agregación es siempre por programa.** Son capas distintas y confundirlas es el error.

**2 · El lead traído NO se auto-asigna.** ✅ Textual: *"los Closers definen eso; supongo que deben
revisar bien el UTM."* Se descarta la excepción que este documento proponía, y el ADR 0021 queda
intacto: *"sin responsable es un estado válido"*, sin reparto automático.

🎯 **Y la segunda mitad de la frase es un requisito de pantalla, no una suposición.** Si el closer
tiene que *"revisar bien el UTM"* para decidir si reclama un lead, entonces **el origen tiene que
estar a la vista en la lista de Unclaimed y Pendiente Setteo**: el área, los UTM, y quién lo trajo
si se sabe. Hoy esa lista (ticket **070**) no muestra nada de eso. Sin ese cambio, "revisar bien el
UTM" es imposible de hacer y la regla que Mani acaba de poner no se puede cumplir.
→ **Entra al alcance del ticket 070.**

**3 · Para Alejo, sin resolver:** ¿un lead que trae un closer cuenta distinto para su comisión o su
meta que uno que le asignaron? Es de negocio.

---


---

### 12.9 ¿Se puede normalizar `(correo, programa)`? Medido, y la respuesta es no

Pregunta de Mani (21-sep): *"¿crees que haya una mejor manera de hacerlo para que quede normalizado
y simple pero sin perder el objetivo de que todo lead debe tener un programa asignado?"*

Lo que incomoda es real: **la misma persona en los dos programas son dos filas**, con su correo, su
teléfono y su nombre repetidos. La forma de libro de texto para arreglarlo existe y tiene nombre —
el split Party/Contact:

```
personas (id, email_normalizado UNIQUE)              el ser humano, una vez
leads    (id, persona_id, program_id)  UNIQUE(persona_id, program_id)
```

**No se hace, y no por gusto: se midió.**

#### 12.9.1 El número

Consulta de solo lectura contra `production` (rama `br-withered-mud-b4cvvg80`, verificada por
`neon.branch_id` y no por el nombre de la variable, como manda `AGENTS.md`), el 21-sep:

```
filas en leads .................. 4.823
correos distintos ............... 4.818
correos en MAS DE UN programa ....... 5      ← 0,1 %

por programa:  tactical-investor 2.690  ·  comunicarte 2.133
```

🎯 **Cinco personas.** Toda la redundancia que la normalización eliminaría son **cinco filas de
4.823**. El repo tiene su propia regla para esto y aplica entera: *"antes de trabajar una deuda
vieja, verifícala; cuesta un comando"*.

#### 12.9.2 Y lo que costaría, que es lo que decide

Aunque fueran 500, hay tres costos que no dependen del volumen:

1. 🩸 **Reabre el problema de identidad a escala de empresa.** Hoy la llave del dedup es
   `(program_id, email)`, así que **un merge equivocado hace daño dentro de un programa**. Con una
   tabla `personas` la llave pasa a ser el correo global, y con ella **la regla del teléfono del
   ADR 0035** —*"un teléfono que apareció con un correo distinto entra sin confirmar y un gerente
   decide"*— empieza a cruzar programas. El radio de explosión de una fusión mala pasa de un
   programa a toda Retia, para ahorrar cinco filas.
2. **Construye el puente que la restricción del 21-sep quiere que no exista.** Mani no pidió que
   cruzar programas se desaconseje: pidió que **no sirva de nada y no se pueda**. Un `persona_id`
   compartido es, literalmente, la columna por la que un `join` cruza la frontera. Hoy **no existe
   forma de escribir esa consulta sin notarlo**; con `personas` sería un join más.
3. **Una junta en cada consulta, y un segundo corte encima del primero.** La etapa 1 acaba de
   cerrar con la migración 0020 y la ingesta (ticket 048) está por escribirse. Meter `personas`
   ahora es la 0021 y reescribir lo que aún no existe.

**La conclusión que importa:** lo que hay **ya es la forma normalizada de este dominio**. El lead no
es una persona: es *"una persona en un programa"*, y el programa es parte de su identidad, no un
atributo suyo. Repetir el correo en dos filas no es desnormalización, es **que son dos hechos
distintos**. Es exactamente la misma lógica por la que `lead_contactos.program_id` está denormalizado
a propósito, y el comentario del esquema ya lo decía: *"es la misma redundancia declarada que ya
tiene `leads.emailNormalizado`"*.

#### 12.9.3 Lo que sí se hace, que cuesta una consulta y no una tabla

El objetivo de fondo de Alejo era *"sin perder NADA de visibilidad"* (§12.7), y para eso no hace
falta unir las tablas. Hace falta **una proyección de solo lectura**:

> `otrosProgramasDelCorreo(email, programaActual)` en `lib/queries/`, que contesta
> *"este correo también existe en el otro programa, y va en tal etapa"*.

- Se resuelve con un `select` sobre `leads`, que **ya tiene el correo normalizado**. Cero esquema
  nuevo, cero migración.
- Sale en la ficha del Lead como un aviso, no como un dato agregado: **ninguna métrica la usa.**
- Es la regla que `AGENTS.md` ya tiene escrita: **la proyección es del llamador, el predicado es del
  módulo.** El predicado "son la misma persona" vive en un lugar; que la pantalla lo muestre no
  significa que el embudo lo sume.

**Y así la frontera sigue siendo dura donde importa** —nada se une por defecto, ninguna cifra cruza—
mientras el único hecho cruzado que sirve de verdad, *"a esta ya la conocemos del otro lado"*, se
entrega **deliberadamente, en un solo sitio y sin poder colarse en un total**.

---

### 12.10 El CPL rebanado, y el dashboard que no es estático

Pedido de Mani (21-sep): *"¿para el CPL se puede por área? Para tener métricas de lo que se invierte
en pauta vs. lo que convierte. O que el CPL se pueda calcular según distintos filtros. El dash de
métricas para los Managers... creo que sería bueno si no fuese estático sino que deja crear vistas y
filtros a gusto."*

#### 12.10.1 🩸 Hoy el costo y los leads NO se pueden cortar con la misma llave

Se midió contra el esquema. Un lead trae su origen en `submissions.utm_source / utm_medium /
utm_campaign / utm_term / utm_content`. El costo vive en `ad_spend`, y `ad_spend` **no tiene ni una
columna UTM**: tiene `campana` y `creativo`, **texto libre**, cargados a mano por quien captura la
pauta.

**Son dos textos que nadie garantiza que coincidan.** Unir uno con otro para calcular un CPL
rebanado sería comparar cadenas entre dos sistemas que no se hablan — que es, letra por letra, la
herida del ADR 0030 (`Mani` y `mani` como dos closers), ahora entre la hoja del paid trafficker y
el Typeform. Y fallaría del modo peor: **no lanzaría ningún error, simplemente el CPL de una
campaña saldría con menos leads de los que tuvo y por lo tanto más caro**, o al revés.

**El arreglo, y por qué hay que decidirlo ahora:** el costo se captura **con los mismos UTM que
traen los leads**, no con un nombre libre de campaña. Entonces el CPL de cualquier rebanada es

```
CPL(rebanada) = Σ ad_spend de esa rebanada  ÷  leads de esa rebanada
                └──────── las dos mitades cortadas con la MISMA llave ────────┘
```

y **la misma tabla `utm_clasificacion` del §12.3 corta los dos lados a la vez**, así que "CPL por
área", "por campaña", "por anuncio" o "por fecha" salen todos del mismo mecanismo en vez de ser
cuatro consultas.

⏳ **La ventana:** el ticket **067** todavía está en `todo` y dice explícitamente que ahí se decide
*"si la carga es por campaña/día o un total por cohorte"* y que hay que *"re-pensar el índice
`ad_spend_huella_idx`, que existía para deduplicar filas de una hoja y ya no tiene sentido como
llave"*. Esa decisión **es esta**. Tomarla después de que haya pauta cargada significa re-capturar
a mano el histórico, porque el UTM de un gasto pasado no está escrito en ninguna parte del CRM.

#### 12.10.2 ✅ La campaña es una entidad, y sus UTM son filas (Mani, 21-sep)

Propuesta de Mani: *"al crear campañas deban tener uno o más UTMs asociados, para tener métricas por
campaña y por UTM."*

**Sí, y es mejor que lo que este documento proponía en §12.10.1** (poner las cinco columnas UTM
sueltas sobre `ad_spend`). Tres razones, y la tercera es un hallazgo medido:

1. **El juego de UTM de una campaña es estable y se reusa.** Escribirlo en cada fila de gasto diario
   lo repite cientos de veces e invita al error de tecleo — la misma herida de comparar cadenas,
   ahora dentro del CRM en vez de entre dos sistemas.
2. **"Uno o más" es la cardinalidad correcta y Mani la vio bien.** Una campaña tiene varios conjuntos
   y varios creativos, así que una campaña es **muchos patrones UTM**, no uno.
3. 🩸 **Y lo que lo vuelve obligatorio: hoy el significado de cada campo UTM NO es el mismo en los
   dos programas.** Medido contra los consolidados C2 que entregó Michael:

   | | ComunicArte | Tactical Investor |
   |---|---|---|
   | `utm_campaign` | campaña | campaña |
   | `utm_content` | **anuncio** | **conjunto** |
   | `utm_term` | — | **anuncio** |

   **`utm_content` significa "anuncio" en un programa y "conjunto" en el otro.** Cualquier código
   que escriba `utm_content = el anuncio` va a estar **bien en un programa y mal en el otro, sin
   lanzar un error**.

#### 12.10.2.b ✅ El significado de cada campo UTM se ESTANDARIZA (Mani, 21-sep)

Textual: *"toca definir qué significa cada campo `utm_...`; no se puede significar cosas distintas
para cada programa, eso rompe la estandarización que queremos hacer."*

**Correcto, y corrige lo que este documento decía tres párrafos arriba.** La versión anterior
proponía tratar el significado como dato de la campaña, o sea **acomodarse al desorden**. Estandarizar
es mejor, y encaja con el mandato del rol de Ops: *"cuál es el estándar de lo que debería pasar"*.

**El estándar queda así**, y vive en `docs/agents/context.md` y en `estandares.md` del vault:

| Campo | Qué lleva | Macro de Meta |
|---|---|---|
| `utm_source` | la plataforma u origen | `facebook`, `instagram`, `tiktok`, `closer` |
| `utm_medium` | el tipo de tráfico | `cpc`, `organico`, `referido`, `stories` |
| `utm_campaign` | **la campaña** | `{{campaign.name}}` |

⚠️ **Reducido a tres el mismo 21-sep** (§12.15): `utm_content` y `utm_term` quedaron **fuera de
alcance**. Lo que sigue de esta subsección sobre el `nivel` del patrón **ya no aplica** y se conserva
porque explica de dónde salió el estándar.

Se eligió esa asignación y no la contraria porque **es la que ya usa Tactical Investor**, que es el
programa con más volumen (2.690 de 4.823 leads) y el que tiene los tres niveles poblados. Cambiar el
que ya está bien para acomodar al que le falta un nivel sería trabajo de más y riesgo de más.

⚠️ **Y hay que ser honestos con lo que el estándar NO arregla, porque es la mitad del asunto:**

1. **El CRM no puede imponerlo: se configura en Meta.** Las macros las escribe el paid trafficker al
   armar la campaña. **Es una acción de Ops, no un ticket de código**, y va al playbook de paid
   traffickers antes que a este repo.
2. **Rige hacia adelante.** Los 4.823 leads que ya están en `production` traen la convención vieja, y
   `submissions.utm_*` **no se reescribe**: es texto copiado de la fuente y el ADR 0004 manda que se
   guarde como llegó. Reescribirlo para que "cuadre" es exactamente la clase de arreglo que borra la
   evidencia de lo que pasó.
3. **Por eso el patrón declara el NIVEL al que apunta, y el modelo deja de preguntar qué significa
   un campo.** Un patrón de nivel `anuncio` del histórico de Tactical empareja por `utm_term`; uno
   del histórico de ComunicArte, por `utm_content`. **El código nunca pregunta "¿qué significa
   `utm_content`?"** — pregunta *"¿qué patrones de nivel anuncio casan con este envío?"*. Así el
   histórico se clasifica bien **sin reescribir el crudo y sin un `if programa` en el código**, y el
   estándar hace que de la fecha del corte en adelante todos los patrones nuevos se escriban igual.

```
utm_patron (..., nivel: pgEnum('campana','conjunto','anuncio'), ...)
```

`nivel` es un **`pgEnum` y no catálogo** por la regla del ADR 0012 leída al derecho: **el código
decide con él** (agrupa el desglose por nivel), igual que `deals.etapa`. Los tres niveles son los de
Meta y no los inventa Retia.

4. **Lo que no cumpla el estándar se ve, no se adivina.** Un envío cuyos UTM no casan con ningún
   patrón cae en `(sin clasificar)` **con su conteo a la vista** — que es el mecanismo de detección
   que esta sección ya tenía, ahora haciendo doble trabajo: además de atrapar canales nuevos,
   **atrapa campañas mal configuradas en Meta**. Detectar es barato; adivinar el nivel sería una
   cifra creíble y equivocada.

**La forma, y por qué es UNA tabla de patrones y no dos.** Lo que §12.3 llamó `utm_clasificacion` y
lo que esta sección necesita **son la misma cosa**: *"un patrón UTM apunta a un dueño"*. Si se parten
en dos, la misma cadena `facebook / cpc / De_Cero_a_Tactical_...` la resuelven **dos mecanismos que
pueden discrepar**, que es el olor que este repo prohíbe desde el ADR 0024.

```
campanas   (id, program_id NOT NULL, nombre, plataforma, cohort_id?, activo)     catálogo, ADR 0012
ad_spend   (campana_id, fecha, inversion, moneda, ...)                cuelga de la campaña
utm_patron (id, program_id?, utm_source?, utm_medium?, utm_campaign?,
            utm_term?, utm_content?,
            campana_id? XOR user_id? XOR area_id?,  prioridad, activo)
```

**El área nunca se guarda en el patrón cuando se puede derivar.** Un patrón apunta a **un** destino:
a una campaña (y la campaña sabe que es de Pauta), a un usuario (y el usuario sabe que es de
Comercial), o directamente a un área cuando no hay ninguna de las dos — que es el caso del orgánico
de Media, donde `instagram rosario` no tiene campaña ni dueño en `users`. Un `CHECK` garantiza que
sea exactamente uno. Guardar el área **además** del destino permitiría escribir la contradicción
"patrón de área Media apuntando a una campaña de Pauta".

⚠️ **Corrección a lo que decía §12.8.6:** ahí se dijo que la clasificación era *global, sin
`program_id`*. Con campañas —que sí son de un programa— el patrón lleva `program_id` **nullable**:
`null` = aplica a todos (los orgánicos, `facebook / cpc`), con valor = acotado a ese programa. Y el
emparejador solo considera patrones cuyo programa case con el del envío, así que **la frontera del
21-sep se mantiene dura y además hay menos candidatos que comparar**.

#### 12.10.3 🩸 La regla que hace o rompe todo esto: el emparejamiento tiene que ser DETERMINISTA

**Si un envío casa con dos patrones de campañas distintas, ese lead se cuenta en las dos y el CPL de
ambas sale mal. Sin un solo error.**

No es hipotético: es literalmente lo que ya pasó en este repo. El ADR 0031 documenta que colgar una
corrida de sync de `fuentes[0]` —una consulta **sin `ORDER BY`**— atribuía cada corrida a uno de los
dos formularios **de forma no determinista**, o sea que corridas idénticas podían quedar registradas
distinto. La misma trampa, un nivel más arriba y con dinero encima.

**Las tres reglas, y ninguna es opcional:**

1. **Un envío resuelve a lo sumo UNA campaña.** No "la primera que aparezca".
2. **Gana el patrón más específico**, medido como cantidad de campos UTM no nulos. Un patrón de tres
   campos le gana a uno de dos, siempre, sin importar el orden de la consulta.
3. **Un empate es un ERROR que la app muestra, no una elección silenciosa.** Dos patrones igual de
   específicos que casan el mismo envío son una configuración mal hecha, y la respuesta correcta es
   que alguien la arregle — no que el sistema escoja. La garantía vive en un **índice único sobre la
   combinación de campos del patrón** dentro del programa, no en el código (ADR 0005).

**Y el corolario que hay que pintar en la pantalla:** un envío que no casa con ningún patrón cae en
`(sin clasificar)` **y se ve**, con su conteo, para que alguien le asigne dueño. Mismo criterio que
`(sin atribución)` del ticket 066: un cubo invisible crece hasta que alguien se da cuenta un
semestre después.


#### 12.10.4 ⚠️ "CPL por área" solo significa algo donde hay costo

Y aquí conviene no darle a Mani lo que pidió al pie de la letra, porque al pie de la letra miente:

| Área | ¿Tiene inversión? | Qué daría un "CPL por área" |
|---|---|---|
| **Pauta** | sí | el CPL real, útil |
| **Media** (orgánico) | **no** | **$0**, que se ve espectacular y no significa nada |
| **Comercial** (referidos) | **no** | **$0**, igual |
| **Gerencial** | no aplica | — |

Una tabla de CPL por área mostraría a Media y a Comercial **ganándole a Pauta por goleada**, y la
conclusión obvia —"hay que mover el presupuesto a orgánico"— sería un artefacto de dividir por un
costo que no existe, no un hallazgo.

**La regla que se sigue, y que el repo ya tiene a medias:** una división solo se muestra si el
numerador **y** el denominador existen en esa rebanada; si no, la celda dice **"sin pauta"**, no
`$0`. El precedente está escrito en el propio ticket 067: *"una cohorte sin pauta cargada se ve
vacía, no se rellena con ceros: un cero parece un dato"*. Esto solo lo extiende a la rebanada.

**Y lo que Mani realmente quiere sí sale, mejor partido en dos:**

1. **Dentro de Pauta**, el costo se rebana por lo que quiera: campaña, anuncio, canal, fecha,
   cohorte. Ahí viven CPL, CPI, CAC y ROAS, y es literalmente *"lo que se invierte vs. lo que
   convierte"*.
2. **Entre áreas**, la comparación no es de costo sino de **aporte y calidad**: cuántos leads trae
   cada una, qué tasa de calificación tienen, cuántos cierran. Es la misma vista que Alejo pidió
   para Media (registros vs agendas), aplicada a las cuatro.

Las dos juntas contestan la pregunta de gerencia sin inventar un número.

#### 12.10.5 El dashboard con filtros: qué se decide ahora y qué es YAGNI

**Lo que hay que decidir ahora porque cuesta cero ahora y es una reescritura después:**
las consultas de `lib/queries/` devuelven **filas con sus dimensiones pegadas** (programa, área,
canal, closer, cohorte, fecha) en vez de escalares pre-agregados. Un `{ leads: 412 }` no se puede
filtrar por nada; una serie con sus dimensiones se filtra, se agrupa y se guarda sin tocar la
consulta. **Es la misma clase de decisión que la del origen humano: gratis mientras la capa de
lectura se está escribiendo (etapa 5), cara el día después.**

**Lo que NO se construye todavía**, por la escalera de simplicidad:

| | v1 | Después, si lo piden |
|---|---|---|
| Filtros | **desde la URL**, que el ADR 0023 ya manda. Compartibles copiando el link, cero almacenamiento | — |
| Vistas guardadas | no | una tabla por usuario, cuando exista la queja de re-armar el filtro |
| Constructor de consultas | **no, y probablemente nunca** | — |

⚠️ **Y la tensión que hay que nombrar, porque las dos cosas vienen del mismo stakeholder.** Alejo
dijo que lo tedioso es *"no saber qué decisiones tomar"* (§12.7). **Un lienzo en blanco de filtros
es exactamente lo contrario de eso:** le entrega el trabajo de averiguar qué mirar, que es el
trabajo que dijo que no sabe hacer.

**Se resuelve con el orden, no eligiendo uno:** el dashboard **abre con la vista opinada** —las
métricas que pidieron, con su estado y su acción— y los filtros son la **salida de emergencia** para
el día que quiera cavar. Puerta de entrada opinada, techo abierto. Al revés, un constructor como
pantalla inicial, es un producto que se ve más potente y sirve menos.

🔒 **Y una frontera que no es un filtro:** el **programa**. Por la restricción no-negociable que
Mani fijó el 21-sep, ninguna vista, guardada o improvisada, puede cruzar ComunicArte con Tactical.
No basta con no ofrecerlo en la interfaz: **el tipo de la consulta no debe admitirlo**, igual que el
comparativo entre closers del ADR 0023.

---

### 12.12 El CRM genera los links, y eso arregla el agujero del estándar

Mani (21-sep): *"el CRM debe tener la capacidad de crear nuevas campañas, conjuntos y anuncios para
generar links para cada programa. Para esto, al crear el programa se le debe asignar el link de su
forms, su calendly y demás info necesaria... ¿Puede ser parte de recursos?"*

#### 12.12.1 🩸 Lo primero: destapó un prerequisito que falta

Verificado contra el esquema:

| Dato | ¿Existe? | Dónde |
|---|---|---|
| Calendly del programa | ✅ | `programs.calendly_url` |
| Página de venta | ✅ | `programs.web_url` |
| **URL pública del formulario** | ❌ | **en ninguna parte** |
| Dónde caen las respuestas | ✅ | `sources.sheet_id` + `sources.tab` |

**El CRM sabe dónde CAEN las respuestas, no dónde la gente LLENA.** Y el ADR 0044 dice que el enlace
de captación del closer es *"la URL de la fuente del programa más los parámetros"*. **Ese enlace no se
puede calcular hoy.** El diseño era correcto y le faltaba el dato.

#### 12.12.2 ¿Va en recursos? No, y la prueba es concreta

| | Recurso (ADR 0017) | Link de campaña |
|---|---|---|
| Para quién | **un lead**, elegido por un humano | nadie: se pega en Meta o en una bio |
| Cuándo | en un momento de la conversación | una vez, al crear la pieza |
| Para qué existe | que el lead lo lea | **que se pueda rastrear** |

La prueba: un closer buscando qué mandarle a un lead **nunca** quiere ver *"anuncio 5 de la campaña de
junio"*, y un trafficker buscando su link **nunca** lo busca en `/recursos`. Dos dominios, dos
pantallas (ADR 0033).

**Lo que sí se comparte es el generador.** *"URL del formulario + parámetros UTM"* es **una sola
función** que sirve al link del closer y al del anuncio. El mecanismo en un módulo, las pantallas
separadas — que es la regla que `AGENTS.md` ya tiene escrita.

#### 12.12.3 🎯 Y arregla el agujero que el §12.10.2.b había dejado abierto

Ahí se escribió, con razón, que **el CRM no puede imponer el estándar de UTM porque las macros se
configuran en Meta**. Con el link generado **sí puede**: el trafficker no escribe parámetros, **pega
un link que ya los trae correctos**.

**Y el beneficio de fondo es más grande que el estándar.** Con macros hay **dos actos independientes
que tienen que coincidir**: alguien configura `{{ad.name}}` en Meta, y alguien escribe el patrón que
reconocerá ese texto. Si divergen, el lead cae en `(sin clasificar)` o casa con el patrón equivocado.

Con el link generado hay **un solo acto**: crear el anuncio produce el link **y** el patrón, de la
misma fila. **No pueden discrepar por construcción.** Mismo molde que `crearConRastro`, que escribe la
fila y su `change_log` en la misma operación.

#### 12.12.4 🩸 Y obliga a corregir dónde cuelga el gasto

El ADR 0045 decía que `ad_spend` cuelga de la campaña. **Meta reporta gasto por anuncio.** Si el gasto
cuelga de la campaña y los leads se atribuyen al anuncio, **las dos mitades del CPL vuelven a cortarse
a distinto nivel** — el problema que el ADR 0045 existía para resolver, ahora un escalón más abajo.

El gasto cuelga de la **pieza**, al nivel más fino que se capture, y la regla del cero decide qué se
muestra: con gasto solo de campaña, el CPL por anuncio dice **"sin desglose"**. **Nunca se prorratea:**
un reparto inventado se ve igual que un dato.

#### 12.12.5 Los dos límites honestos

1. **El árbol del CRM puede divergir del de Meta y el CRM no lo sabe.** Si alguien pausa o borra un
   anuncio allá, acá sigue existiendo. Lo único que se puede decir es *"sin leads desde tal fecha"*, y
   **eso no distingue un anuncio pausado de uno caro**. Se dice así; no se infiere el estado.
2. **Un anuncio creado en Meta sin pasar por el CRM sale sin UTM correcto.** La mejora real sobre las
   macros es que **falla visiblemente** —no hay link que copiar— en vez de silenciosamente. Pero sigue
   dependiendo de que el trafficker use el CRM primero: **eso es playbook, no código.**

→ **ADR 0046**, ticket **092**, y el **086** gana la dependencia.

---

### 12.14 Lo que se puede hacer HOY, medido

Mani (21-sep): *"los dos límites honestos se solucionan cuando los Paid Traffickers tengan su perfil y
rol para entrar al CRM. Por ahora toca asegurar que podamos analizar los Leads que ya tienen UTM en el
dash de métricas, es solo filtros."*

#### 12.14.1 La medición, contra `production`

```
leads ......................... 4.823
  con utm_source .............. 4.097   (85%)
  con utm_medium .............. 4.098
  con utm_campaign ............ 4.097

utm_term / utm_content ........ 0       ← NO existen, ni en columna ni en raw
deals · calls · abonos ........ 0
submissions · ad_spend ........ 0

sin UTM:  tactical-investor 703/2.690 (26%)  ·  comunicarte 23/2.133 (1%)
```

#### 12.14.2 "Es solo filtros" es cierto para una mitad

✅ **Sí para `utm_source`, `utm_medium` y `utm_campaign`:** ya son **columnas de `leads`** con 85% de
cobertura. Filtrar y agrupar por ellas **no depende de E1b ni de E3**, así que es el único trabajo de
esta sesión que entrega valor sin esperar nada. → ticket **093**, sin dependencias.

🩸 **No para conjunto ni anuncio.** `utm_term` y `utm_content` **no existen**: no son columnas de
`leads` y tampoco están en `raw` (cero filas). El dato está en la hoja y el mapeo **no lo promueve**.
*"Qué anuncios están vendiendo"* —lo que pidió Pauta— **no es un filtro: son dos columnas más en la
ingesta**, o sea el ticket 049 (E3).

🩸 **Y el límite que manda sobre todo lo demás: la mitad de abajo del embudo está en CERO.** `deals`,
`calls`, `abonos`, `submissions` y `ad_spend`: **0 filas**. Filtrar por UTM hoy contesta *cuántos
registros trae cada canal* y **nada más**. No hay agendas, ni shows, ni ventas, ni costo, así que
**ninguna tasa tiene numerador**. Eso no lo arregla ninguna pantalla: lo arregla que el equipo empiece
a usar el CRM.

#### 12.14.3 🎯 Y la medición soltó un hallazgo que nadie buscaba

**La brecha de atribución es muy desigual entre programas:**

| Programa | Leads sin UTM | % |
|---|---|---|
| Tactical Investor | **703** de 2.690 | **26%** |
| ComunicArte | 23 de 2.133 | 1% |

**Uno de cada cuatro leads de Tactical no tiene origen**, contra uno de cada cien en ComunicArte.
No es un bug del dashboard: es algo que pasa en el intake de Tactical y **es una pregunta para Pauta**,
de las que valen plata. Va a `preguntas-abiertas`.

#### 12.14.4 El rol de paid trafficker cierra los dos límites, y es una decisión aparte

Mani tiene razón en que los dos límites del ADR 0046 —el árbol que diverge de Meta, y el anuncio
creado sin pasar por el CRM— **se cierran cuando el trafficker trabaja dentro del CRM**: si arma la
pauta ahí, no hay dos árboles ni links sin UTM.

⚠️ **Pero es un CUARTO ROL y eso toca la arquitectura de permisos.** Hoy hay tres preguntas en
`lib/auth/roles.ts` —`esAccesoTotal`, `esAdministrador`, `trabajaLeads`— y **un paid trafficker no
cumple ninguna**: no vende, no administra el CRM, no trabaja leads. Necesitaría una cuarta
(`manejaPauta`), y la regla del ADR 0025 sigue mandando: **la pregunta nueva se agrega en
`lib/auth/roles.ts`, nunca en el archivo que la necesita**, y nunca se escribe un `rol === "..."` a
mano.

**No se construye ahora** y no bloquea nada: las campañas las puede cargar un gerente hasta que el
trafficker tenga cuenta. Queda anotado para que no se improvise el día que haga falta.

---

### 12.15 El estándar se reduce a tres UTM, y aparecen DOS categorías de huérfano

Mani (21-sep): *"entonces UTM term y content no es necesario. Usemos los otros 3 que tienen más
sentido."* Y enseguida: *"una categoría debería ser 'sin utm' para no perder visibilidad de los que no
tuvieron nunca."*

#### 12.15.1 Lo que la reducción borra

| Se borra | Por qué |
|---|---|
| El `pgEnum` **`nivel_utm`** | Con un solo nivel no hay nada que declarar |
| La tabla **`piezas`** (conjuntos y anuncios) del ADR 0046 | Una campaña tiene **un** juego de UTM y **un** link |
| La regla *"el código nunca pregunta qué significa `utm_content`"* | Existía para reconciliar dos convenciones; nadie lee el campo |
| La corrección del ADR 0046 punto 5 | `ad_spend` vuelve a colgar de la **campaña**: sin nivel de anuncio, los dos lados cortan igual |

**Y la inconsistencia medida se disuelve en vez de resolverse.** `utm_content` era el anuncio en
ComunicArte y el conjunto en Tactical; como **nadie lee ese campo**, deja de importar. El hallazgo se
conserva escrito porque explica de dónde salió el estándar, no porque haya que arreglarlo.

**Lo que cuesta, dicho una sola vez:** *"qué anuncio está vendiendo"* —que Alejo nombró en la reunión
como métrica de Pauta— **deja de ser contestable**. No es un aplazamiento: es una salida de alcance. A
cambio se contesta a nivel **campaña**, que es donde de verdad se mueve presupuesto, y se borran un
enum, una tabla y una regla de reconciliación.

📌 **Las dos columnas que ya existen se quedan vacías y sin leer.** `submissions.utm_term` y
`submissions.utm_content` **no se borran**: quitarlas cuesta una migración sobre una tabla ya en
`production` y volver a ponerlas costaría otra, y el dato sigue en la hoja si algún día se quiere. Van
**marcadas en el comentario del esquema como deliberadamente no leídas**, para que nadie las cablee
creyendo que tapa un hueco.

#### 12.15.2 🎯 «Sin UTM» y «sin clasificar» son DOS cosas, y fundirlas sería el error

Mani pidió que *"sin utm"* sea una categoría propia. Al escribirlo aparece que hay **dos** huérfanos
distintos, y tienen dueño distinto, arreglo distinto y pronóstico distinto:

| | **Sin UTM** | **Sin clasificar** |
|---|---|---|
| Qué pasó | el envío llegó **sin origen**: el campo está vacío | el envío **sí trae UTM**, pero no casa con ningún patrón |
| Qué se sabe | **nada**: nunca se supo de dónde vino | de dónde vino sí; **a qué área pertenece, no** |
| De quién es el problema | **de la captación**: el link no estaba parametrizado (Pauta · Media) | **de la configuración del CRM**: falta escribir un patrón |
| Cómo se arregla | **aguas arriba**, y para los que ya entraron **es irrecuperable** | con **una fila**, y **repara hacia atrás**: el UTM crudo sigue ahí |
| Tamaño hoy | **726 de 4.823 (15%)** — Tactical 26%, ComunicArte 1% | 0, porque todavía no hay patrones |

**Fundirlos en un solo cubo escondería la diferencia que importa:** uno se arregla en un minuto y
repara el pasado; el otro no se arregla nunca y solo se puede frenar hacia adelante. Un tablero que
muestre «800 sin atribución» no dice cuál de los dos problemas tiene el negocio.

**Entonces son dos categorías visibles y permanentes**, con su conteo y su porcentaje, en toda vista
que agrupe por origen. Y **«sin UTM» no es un estado de error**: es un hecho del lead, igual de válido
que `facebook / cpc`, que responde *"a esta persona no sabemos cómo la conseguimos"*. Ocultarlo
inflaría todas las demás categorías en proporción — exactamente lo que el repo ya evita con
`(sin atribución)` del ticket 066.

---

### 12.16 Lo que la reunión no dejó grabado

De las siete preguntas que Mani llevaba preparadas (`retia-ops/notebook/consolidado-rol-devops-2026-09-21.md`
§9), **las notas solo dejan rastro de dos**. Las otras cinco quedan abiertas en
`retia-ops/notebook/preguntas-abiertas.md`, sección Alejo: sus success floors, la operación ideal,
qué mira para saber si la semana va bien, su dashboard del Sheets que no entrega nada, y qué le
parece tedioso. **Y no se sabe si se preguntaron: no hay transcript.**

Para este plan importa una sola de esas cinco: **sin success floors no hay umbral**, y una pantalla
de "rendimiento de áreas" sin umbral es una tabla de números que nadie sabe leer. Se puede construir
sin ellos y se puede pintar el umbral después — pero hay que pedirlos antes de la etapa 5, no
después.

---

## 13. Enmienda del 24-sep · Dirección de producto y UI, antes de la reunión con Comercial

**Documento de referencia:** `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md`. Nació
como paquete para la reunión con los closers y quedó como **guía del desarrollo** hasta que la
reunión la corrija. Tiene el flujo de hoy y el propuesto de cada rol, el modelo de datos contra el
esquema real, la convención de UTM, las pantallas por rol y la tabla de transiciones.

### 13.1 Lo que se decidió (Mani, 24-sep)

| # | Decisión | Dónde quedó |
|---|---|---|
| 1 | Un closer ve solo los programas de su membresía activa; dentro, "todos ven todo" | ADR 0048 · ticket 094 |
| 2 | El Dashboard ofrece "todos los programas" y ahí **solo suma lo sumable** (conteos, caja USD, gasto) | ADR 0048 · ticket 095 |
| 3 | Toda lista operativa es de un programa, con selector obligatorio | ADR 0048, 0050 · ticket 097 |
| 4 | Calendly por programa **cuelga llamadas de deals, no los crea**; si hay duda, la llamada queda suelta; el host es dueño si el deal no tiene | ADR 0049 · ticket 096 |
| 5 | "Mi día" se reemplaza por el **Inbox** | ADR 0050 · ticket 071 |
| 6 | Los dashboards por programa se reemplazan por una tab **Dashboard** con filtro | ADR 0050 · ticket 095 |
| 7 | Navegación con **tabs por objeto** tipo HubSpot | ADR 0050 · tickets 097 a 100 |
| 8 | UTM: tres se leen, dos se capturan (`utm_content`, `utm_term`) | ADR 0051 |
| 9 | El link del closer lleva su **código** en `utm_content` | ADR 0051 · ticket 086 |
| 10 | Builder v1: destinos (forms y checkouts), canal, campaña, dos opcionales; rol **Paid Trafficker** | ADR 0051, 0052 · tickets 092, 101, 102 |
| 11 | Checkouts: destino ya, venta automática después | ADR 0051 punto 7 |
| 12 | Deals históricos: el sync abre deals solo para leads nuevos desde el corte; los viejos, con la migración | tickets 052, 077, 080 |
| 13 | La cohorte es por programa y define la lista de estudiantes | ticket 099 |
| 14 | **Seguimiento es la etapa 11**; un deal tiene muchas llamadas y nunca se duplica; la llamada que falla va a Re-agenda con motivo; la conversión cuenta deals distintos | tickets 043, 059, 065, 096 |

### 13.2 Lo propuesto, que se valida con los closers antes de congelarlo 🟡

- **La tabla de transiciones completa** (T1 a T23, P, R, A1, A2), que cierra los huecos de D2: ticket
  043 y documento de referencia §2.5.
- **Qué pasa después de cada llamada:** cinco salidas explícitas (pagó ahora, compromiso, seguimiento,
  próxima cohorte, perdido); la segunda llamada no hace retroceder; el show se cuenta en llamadas y el
  cierre en deals. Tickets 044, 058, 059, 065.
- **Qué cae en el Inbox** y el X de "deal sin actividad en X días". Ticket 071.

### 13.3 Impacto sobre el orden

No cambia el orden de etapas (y **P1 sigue sin decidir**). Los tickets nuevos caen así: **094** no tiene
dependencias y puede ir antes de E6; **101** y **102** van con E1b (la misma migración); **096** con E4;
**095** con E5; **097 a 100** con E6.

### 13.4 Lo que sigue abierto

Está en la tabla "Decisiones pendientes" de `docs/tasks/README.md`: lo de los closers (transiciones,
Inbox, dueño en conflicto de Calendly, estudiante confirmado, onboarding, antigüedad de la migración),
lo de Gerencia (áreas de cada canal, qué ve el Paid Trafficker, precio de ComunicArte) y lo técnico de
Mani (webhook o consulta de Calendly, Vercel Pro, CI, D3-D5).

---

## Referencias

- **Insumo original (manda sobre este documento en diseño):**
  `/Users/mani/Documents/mani_vault/02 Projects/retia/notebook/crm-retia-modelo-hubspot-scaffold.md`
- Contrato del repo: `AGENTS.md`
- Mapa real de las hojas: `docs/estructura-bbdd.md`
- Glosario: `docs/agents/context.md`
- Memoria de sesiones: `docs/agents/handoff.md`
- Tracker: `docs/tasks/README.md`
- Decisiones: `docs/adr/`
- Dirección del 24-sep (guía del desarrollo hasta la reunión con Comercial):
  `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md`
