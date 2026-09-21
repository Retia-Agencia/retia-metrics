---
titulo: Plan CRM v2 — modelo HubSpot
creado: 2026-09-21
estado: aprobado por Mani el 21-sep · D1 a D6 cerradas · etapa 0 sin arrancar
reemplaza: no reemplaza a docs/plan.md (ese es el plan del MVP, ya ejecutado). Este abre la epoca siguiente.
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

### Etapa 0 · Enmiendas y ADRs

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
| **0038** | Anular no es Cierre Perdido | D3, pendiente de que Mani confirme. Amplía el ADR 0026 a `deals` |
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

### 🟡 Mani (no bloquea arrancar la etapa 0)

1. **E1-4**: qué pasa con las 5 filas de `sources` con `destino != people` (Estudiantes, Pauta,
   Registro de llamadas). ¿Se borran, o `destino` sobrevive y el índice único de D2 es parcial? El
   caso incómodo es `ad_spend`, que el insumo §8 quiere de vuelta para el ROAS.

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

## Referencias

- **Insumo original (manda sobre este documento en diseño):**
  `/Users/mani/Documents/mani_vault/02 Projects/retia/notebook/crm-retia-modelo-hubspot-scaffold.md`
- Contrato del repo: `AGENTS.md`
- Mapa real de las hojas: `docs/estructura-bbdd.md`
- Glosario: `docs/agents/context.md`
- Memoria de sesiones: `docs/agents/handoff.md`
- Tracker: `docs/tasks/README.md`
- Decisiones: `docs/adr/`
