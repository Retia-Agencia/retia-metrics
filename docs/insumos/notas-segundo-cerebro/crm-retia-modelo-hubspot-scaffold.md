---
type: note
owner: "[[retia]]"
updated: 2026-09-21
status: diseño-consolidado
tags: [crm, hubspot, leads, deals, pipeline, sync, retia]
---

> Copia cruda del second brain de Mani (`mani_vault/02 Projects/retia/notebook/crm-retia-modelo-hubspot-scaffold.md`),
> sin editar. Los `[[wikilinks]]` no resuelven aquí. La fuente de verdad técnica del repo sigue
> siendo `docs/spec.md`, `docs/plan-crm-v2.md` y `docs/adr/`; esto es el diseño del que salió todo
> eso, para que quien lea el repo tenga el mismo contexto que Mani cuando lo escribió.

# CRM de Retia: diseño consolidado (modelo HubSpot)

> ⚠️ **ENMENDADO el 2026-09-21 por la reunión con [[Alejo Carvajal]].** Este documento sigue mandando
> sobre el plan del repo en todo lo que es el modelo Lead → Deal → diez etapas. **Lo que no cubre, y
> que ahora vive en `retia-metrics/docs/plan-crm-v2.md` §12 y en los ADR 0043, 0044 y 0045:**
>
> - **El Área** (Gerencial, Comercial, Pauta, Media) como forma de agrupar leads y deals por origen.
> - **El origen humano** de un lead: el enlace de captación por closer y programa, y
>   `leads.traido_por_user_id`. Sin esto, *"leads por área"* muestra **Comercial en cero**.
> - **La Campaña como entidad** dueña de sus patrones UTM, con `ad_spend` colgando de ella. Sin
>   esto, el costo y los leads **no se cortan con la misma llave**.
> - **El estándar de UTM**, igual para todos los programas, y el **nivel** declarado en el patrón.
> - **El programa como frontera**, no como filtro: medido, solo 5 correos de 4.818 están en los dos.
>
> Tickets **083 a 091**, etapa **E1b** del tracker. Notas de la reunión: [[reunion-alejo-2026-09-21]].

**Qué es esto.** El documento de referencia para implementar el CRM de Retia. Consolida todo lo
que Mani decidió el 2026-09-20 en cuatro rondas, cruzado con lo ya construido en
`retia-metrics-mani` y con lo que muestran las dos hojas de Sheets. Está organizado por objeto,
no por conversación, para seguirlo en orden a la hora de construir. **No se implementa nada
todavía**: primero se cierra lo poco que queda en §12, se enmiendan la spec y los ADRs (§11), y
recién ahí salen tickets.

**El propósito, textual de Mani:** *"tener TODA la info de las operaciones de Retia; todo lo que
se usa en cada etapa para no perder visibilidad."*

Trabaja contra la tarea de Notion *"Diseñar el pipeline de etapas del lead en el CRM (modelo
HubSpot)"* (p1, owner [[retia]]), que hoy bloquea el ticket 034 del repo.

**Leyenda.** ✅ decidido por Mani · 💡 default propuesto con argumento, se puede tumbar ·
🔴 pendiente de Mani · 🟡 pendiente de reunión (closers, Michael, HubSpot de 30X) ·
⚠️ enmienda a un ADR o a la spec vigente · 🩸 dato de las hojas que hay que tener presente.

Insumos: [[flujo-de-leads-retia]], [[flujo-closers-retia-sheets]], [[dashboard-crm-closers-retia]],
[[retia-metrics]], [[dapta-forms-vs-typeform]], [[glosario-metricas]], [[atribucion-de-ventas]],
`docs/spec.md`, ADR 0004 a 0034, tickets 016, 034, 035, el esquema real de `lib/db/schema.ts`, y
el barrido de las 40 pestañas de las dos hojas (20-sep, 22:30).

---

## 1. Principios que ordenan el diseño

Salen de lo que Mani dijo; cada regla de abajo se puede rastrear a uno de estos.

1. **Toda la información de la operación, en un solo lugar.** Nada de lo que hoy vive en las
   pestañas de gestión, en WhatsApp o en el Claude de Michael queda afuera del CRM. Lo que no
   entra hoy (Calendly, Kapso, Grain por API) queda con su enganche previsto.
2. **La hoja califica, el CRM opera.** El `Estado` de llegada lo calcula la hoja (o el form de
   Dapta cuando llegue) y el CRM **solo lo trae**. El CRM no reimplementa esa lógica para no
   duplicar algo que se vuelve redundante ✅. Lo que el CRM sí es dueño de: la `etapa` del deal
   y todo lo que el closer hace.
3. **Cero error humano en los campos.** Cada etapa tiene requisitos de entrada; el sistema mueve
   el deal cuando el requisito se cumple y bloquea cuando no. Los filtros y las vistas hacen el
   trabajo de ordenar, no la memoria del closer ✅.
4. **Base normalizada, cero redundancia** ✅. Lo derivable se calcula, no se guarda. Las únicas
   copias aceptadas están declaradas en §2.9 y las escribe solo el sistema.
5. **Nada hardcoded de columnas.** El CRM recorre todas las columnas de la pestaña y las guarda
   ✅; una columna nueva aparece sola. Solo los ~10 campos que el código necesita para decidir
   tienen mapeo, y ese mapeo es configuración de la fuente, no código.
6. **Tipos en el código, instancias en la base** (ADR 0012, se conserva). Las diez etapas son
   tipos porque el código actúa según ellas ✅. Programas, productos, motivos, closers,
   plataformas, tasas de comisión son filas que el equipo crea. **El equipo crea sus productos;
   Mani construye la herramienta** ✅.
7. **Cada programa es independiente.** Un Lead pertenece a un programa; la misma persona en dos
   programas son dos Leads ✅. Un programa tiene una hoja. Las etapas, en cambio, son globales.

---

## 2. Modelo de datos

### 2.1 Vocabulario (HubSpot → Retia)

| HubSpot | Retia | Qué es |
|---|---|---|
| Contact | **Lead** ✅ | una persona dentro de un programa. `people` renombrado |
| (fila del form) | **Envío** (`submission`) ✅ | cada vez que alguien llenó el form, parcial o completo. El historial del Lead |
| Deal + Pipeline | **Deal** ✅ | la oportunidad de venderle el programa a un Lead. Tiene owner, etapa, producto, cohorte |
| Calls + Meetings | **Call** ✅ | una llamada agendada entre closer y lead, colgada del deal |
| Payments | **Abono** ✅ (ADR 0013) | cada pago recibido, colgado del deal |
| (cartera) | **Cuota pactada** ✅ nueva | lo que se prometió pagar y cuándo |
| Order / cliente | **Student** ✅ | vista: deal en Abonado o Completo. No es tabla |
| Products | **Producto** (ADR 0016) | por programa, con su precio. El equipo los crea |
| Owner | `deal.owner` ✅ | el closer del deal. Sale del Lead |
| Companies, Tickets, Sequences, Marketing | fuera | y siguen fuera ([[2026-09-19-crm-propio-en-dapta-no-hubspot]]) |

### 2.2 Lead

- **Llave: `(programa, correo)`** ✅. Los programas son independientes de la persona; la misma
  persona en dos programas son dos Leads y **no se deduplican entre sí**. Es el índice único
  que ya existe (ADR 0005), se conserva.
- **Identidad dentro del programa** ✅: correo manda. Un envío nuevo con el mismo correo es el
  mismo Lead. Un envío con **teléfono igual y correo distinto** se suma al Lead existente
  **marcado** como "unido por teléfono"; un gerente puede **separarlo** (el envío vuelve a ser un
  Lead propio con su historial) o **dejarlo unido** (la marca se quita y queda quién confirmó).
  Los deals del Lead siguen normales mientras esté marcado, con aviso en la tarjeta ✅.
  🩸 Razón de la marca: 37 teléfonos en Tactical tienen más de un correo, y parte son personas
  distintas con número compartido. La fusión ciega por teléfono es el bug silencioso que hoy
  tiene el script.
- **Un Lead puede tener varios correos y teléfonos**, cada uno con el envío del que llegó y en
  qué orden ✅. Tabla `lead_contactos` (`lead_id`, tipo, valor normalizado, `submission_id`,
  `es_principal`, `confirmado`). Índice único `(programa, tipo, valor)`.
- **`estado`** ✅: texto, tal como viene de la hoja (ADR 0032). Es la clasificación de llegada y
  **no se mueve por el CRM**. Valores hoy: `🗑️ Descartado`, `📞 Setteo No Calificado`,
  `📅 Con Calendly` / `📅 Con Calendly (Juanito)`, `Cerrado`. Se agrupan dinámicamente y dos
  redacciones se pueden **combinar** como acto humano guardado como dato (ticket 034, se
  conserva).
- **`estado` vacío = "Sin Calificar"** ✅: el Lead existe, no tiene deal. Cuando un sync trae el
  valor, se actualiza y se aplica la regla de creación de deal (§4.2).
- **`estado` del Lead con varios envíos** 💡: el del envío completo **más reciente por posición
  en la hoja** (los parciales tienen fecha placeholder `1/1/0001`, no sirven para ordenar). Así
  un Descartado que vuelve y ahora dice Setteo cambia de estado y abre deal.
- **Razón de descarte**: ✅ **no se trae**. Hoy solo se descarta por capacidad de pago, así que
  el estado basta. (🩸 La razón vive solo en la pestaña `Descartados`, que no se lee.)
- **UTM del Lead** ✅: *"el UTM es el que entra al sheets desde el forms, y determina el origen
  del lead."* Cada envío guarda sus cinco UTM; el origen del Lead es el de su **primer envío**
  💡 (es "de dónde vino"). Los siguientes quedan en el historial.
- **Cédula: no se guarda** ✅ (salvo que el equipo lo pida). 🩸 Aparece en `Estudiantes
  Septiembre` de ComunicArte; no entra.
- Historial: envíos (§2.3), deals (abiertos y cerrados), contactos, y la marca de
  "desapareció de la hoja" (ADR 0032) con aviso en la tarjeta del deal si tiene uno ✅.

### 2.3 Envío (`submission`)

- Una fila por envío, parcial o completo ✅. **Llave: `Token`** de Typeform (o el id del webhook
  cuando entre Dapta). El Token **se rutea** ✅ (hoy no se mapea).
- Campos promovidos (columna propia, porque el código decide o calcula con ellos): `lead_id`,
  `source_id`, `token`, `es_parcial`, `fecha_envio` (con la zona horaria de la fuente),
  `estado_hoja`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`,
  `posicion_en_hoja`.
- **Todas las demás columnas** van en `respuestas` (`jsonb`, llave = texto del encabezado) ✅.
  **Las promovidas NO se repiten dentro del `jsonb`** ✅: envío = 10 columnas + el resto en el
  documento; la unión es la fila completa, nada dos veces. Una columna nueva en la hoja aparece
  sola; los envíos viejos la tienen en `null` ✅. Ver §5.4.
- Parcial y completo con el mismo Token: los dos se guardan; la completa manda para el estado;
  la parcial es el evento "inició el form". El CRM **recalcula al llegar la hermana**, no decide
  una vez (hoy el script sí decide una vez cada 10 min).
- Los **parciales huérfanos** (236 en Tactical) y las demás inconsistencias de las hojas **se
  atienden después** ✅. Quedan como Leads sin deal, visibles con filtro.
- Un envío pertenece a un programa vía su fuente ✅; el Lead hereda el programa.

### 2.4 Deal

- **Llave: `(lead, programa)` con máximo un deal abierto a la vez** ✅ (índice único parcial,
  mismo molde que `cohorts_una_activa_por_programa_idx`). Los cerrados quedan. Reaplicar después
  de Cierre Perdido **abre deal nuevo** ✅; la ficha muestra los anteriores.
- Campos: `lead_id`, `program_id`, `cohort_id` (mutable, §2.8), `owner_user_id` (nulo =
  *Unclaimed*), `etapa` (10 valores, §3), `producto_id`, `motivo_id` (obligatorio en Cierre
  Perdido y al recuperar), `submission_origen_id` (opcional: el envío del que nació un deal
  manual), `fecha_pago_restante`, `num_cuotas`, `onboarded_at`, `creado_por` (sistema |
  usuario), `created_at`.
- **El dinero vive en el Deal** ✅. `sales` se disuelve: un deal tiene una sola venta; una segunda
  venta a la misma persona es otro deal. **El ticket lo da el producto** ✅: `deal.producto_id →
  producto.precio_lista`. No hay `precio_contrato` en el deal. 🩸 Las hojas muestran ocho
  precios distintos por descuentos (697/627/557/397; 1.500/1.200/1.000/900/800/400): cada
  precio que el equipo use **es un producto del catálogo**, y el equipo los crea ✅. Un
  "Bootcamp" previo que da entrada sin pagar es un producto de precio 0.
- Derivados, nunca almacenados: `abonado = sum(abonos)`, `saldo = precio_lista - abonado`,
  `valor_cuota = saldo / num_cuotas`, `es_student = etapa in (Abonado, Completo)`.
- **Cuotas pactadas** ✅: el deal guarda **fecha de pago del restante** y **en cuántas cuotas**;
  el valor por cuota se calcula. 💡 Si hace falta más de una fecha (cuota 2 el 5-oct, cuota 3 el
  5-nov), se generaliza a tabla `cuotas_pactadas` (deal, número, monto, fecha, `abono_id` cuando
  se cumple). Se arranca con los dos campos en el deal y se escala si el equipo lo pide.
- **Historial de etapas** obligatorio: `deal_etapa_historial` (deal, de, a, `user_id` o
  sistema, motivo, fecha). Sin esto no hay tiempo en etapa ni conversión por etapa.
- **Actividades**: `deal_actividades` (deal, tipo contacto | nota, canal, `user_id`, fecha,
  nota). Reemplaza las cinco columnas `Registro 1-5` de texto libre.
- **Owner por reclamo** ✅: los deals nacen sin owner en Pendiente Setteo o en *Unclaimed*
  (Agendado); un closer los reclama; un gerente reasigna (ADR 0021 se conserva en espíritu,
  cambia dónde vive el campo). La rotación ciega del script desaparece.

### 2.5 Call

- Colgada del deal ✅: `deal_id`, `closer_user_id`, `fecha_programada`, `fecha_llamada`,
  `link_calendly`, `link_grain`, `resultado` (ADR 0015: agendada, show, no_show, cancelada,
  reagendada, compromiso_pago, cerrada, perdida), `motivo_id`, `notas`.
- **Cuando el sync trae `Con Calendly`, el sistema crea la Call en `agendada` sin fecha** ✅; el
  closer la completa con el link de Calendly y la fecha al reclamar el deal.
- **Pegar el link de Grain = la llamada sucedió** ✅ (`resultado = show`, `fecha_llamada` si
  estaba vacía, y el deal pasa a Atendido).
- Por ahora la fecha la pone el closer ✅. **Calendly después**, con Personal Access Token **por
  programa** ✅ (cada programa tiene su Calendly como tiene su form): trae fecha real, closer del
  Round Robin y cancelaciones. Resuelve la duda de la spec §7 a favor de "por programa".
- Grain por API para insights de llamadas: fase posterior ([[extraccion-modelo-30x]]).

### 2.6 Abono

- Se conserva (ADR 0013), cuelga del deal en vez de `sales`: `deal_id`, `fecha`, `monto`,
  `moneda` (USD; si entra en COP el closer convierte, spec §7), `plataforma_id`,
  `comprobante` (link o foto, ticket 035), `user_id`, anulación (ADR 0026).
- El primer abono mueve el deal a Abonado; el que deja saldo en 0 lo mueve a Completo. Lo hace el
  sistema, nunca el closer a mano.

### 2.7 Student

- **Vista**: deals con etapa Abonado o Completo ✅. Listas por programa y cohorte = filtros ✅.
- Propio de un Student: `onboarded_at` ✅ (en el deal; timestamp, no booleano, para saber
  cuándo). **Comisión** ✅: entra. Es `tasa × precio del producto`; la **tasa es por programa**
  (🩸 hoy 80/697 en ComunicArte y 100/1.500 en Tactical) y vive en el programa como instancia.
  Se calcula, no se guarda.
- De la pestaña `Estudiantes` **no entra** nada más: ni factura, ni accesos, ni bonos, ni cédula ✅.

### 2.8 Cohorte

- Un deal tiene **una** cohorte a la vez ✅ y **se puede mover** a otra (cambio extraordinario)
  ✅. El movimiento queda en `deal_etapa_historial` o en `change_log` con quién y por qué.
  🩸 Los 12 "cohorte pasada" de ComunicArte se representan así: compraron en agosto, se movieron
  a septiembre. No hace falta relación N:N.
- La cohorte se asigna sola al cerrar: la activa del programa (spec §4, se conserva).

### 2.9 Redundancias declaradas (las únicas)

| Copia | Fuente | Quién la escribe |
|---|---|---|
| `deal.etapa` frente a `abonos` | la suma de abonos | solo el sistema al registrar un abono |
| `lead.estado` frente a los envíos | el envío completo más reciente | solo el sync |

Regla: **ninguna de las dos se edita a mano.** Con eso no pueden divergir. (Los campos
promovidos de `submissions` dejaron de ser una copia: el `jsonb` no los repite, §5.4.)

### 2.10 Esquema (sobre el real del repo)

```
programs            (existe)  + tasa_comision, calendly_pat (cifrado, después)
sources             (existe)  + tz_fechas (default America/Bogota), estado activa|rota,
                              índice único program_id  (un programa, una hoja)
productos           (existe)  precio_lista es EL ticket; el equipo crea uno por precio
leads               ← people. (program_id, email_principal) único. estado texto, estado_razon NO.
                      Sin responsable (va en deals).
lead_contactos      (lead_id, tipo correo|telefono, valor, submission_id, es_principal, confirmado)
                      índice único (program_id, tipo, valor)
submissions         (lead_id, source_id, token, es_parcial, fecha_envio, estado_hoja,
                      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
                      posicion_en_hoja, respuestas jsonb)   ← respuestas NO repite las promovidas
deals               (lead_id, program_id, cohort_id, owner_user_id?, etapa, producto_id?,
                      motivo_id?, submission_origen_id?, fecha_pago_restante?, num_cuotas?,
                      onboarded_at?, creado_por)
                      índice único parcial (lead_id, program_id) WHERE etapa NOT IN (completo, perdido)
deal_etapa_historial(deal_id, de, a, user_id?, motivo_id?, fecha)
deal_actividades    (deal_id, tipo, canal, user_id, fecha, nota)
calls               (deal_id, closer_user_id, fecha_programada?, fecha_llamada?, link_calendly?,
                      link_grain?, resultado, motivo_id?, notas)   sin person_id
abonos              (deal_id, fecha, monto, moneda, plataforma_id, comprobante, user_id)  sin sale_id
sales               ← se elimina
students            ← vista
```

---

## 3. Las diez etapas del Deal ✅

Globales para todos los programas ✅. Son tipos en el código. **Cada etapa tiene un requisito
de entrada** que viene de la anterior; el sistema mueve el deal cuando el requisito se cumple y
no deja avanzar sin él ✅. Cierre Perdido se alcanza desde cualquier etapa con **motivo
obligatorio**, y se **recupera** también con motivo ✅.

| # | Etapa | Entra cuando (requisito) | Quién mueve | Siguientes |
|---|---|---|---|---|
| 1 | **Pendiente Setteo** | `estado` = Setteo No Calificado; o deal manual | sistema (sync) / closer | 2, 10 |
| 2 | **En Contacto** | el owner registra el primer contacto (actividad con fecha); o deal manual | closer | 4, 6, 10 |
| 3 | **Pendiente Re-agenda** | la Call quedó en `no_show` o `cancelada` | sistema | 4, 10 |
| 4 | **Agendado** | `estado` = Con Calendly (sistema crea la Call, deal en *Unclaimed*); o el closer crea una Call con fecha y link | sistema / closer | 3, 5, 10 |
| 5 | **Atendido** | la Call tiene link de Grain | sistema | 6, 7, 10 |
| 6 | **Compromiso Verbal** | producto asignado + fecha prometida; o deal manual | closer | 7, 10 |
| 7 | **Abonado** | primer abono con saldo > 0 | sistema | 8, 10 |
| 8 | **Completo** | saldo = 0 | sistema | terminal |
| 9 | **Próxima Cohorte** ✅ nueva | el closer lo marca (el lead quiere entrar pero a la siguiente) | closer | 2, 4, 10 |
| 10 | **Cierre Perdido** | motivo obligatorio | closer | recuperable a cualquier etapa con motivo |

Reglas que acompañan la tabla:

- **Saltos permitidos** ✅: En Contacto → Compromiso Verbal (cierre por chat sin llamada). El
  dashboard distingue "cierre con llamada" de "cierre por chat" porque un deal sin Call es
  cierre por chat; no hace falta campo nuevo. Un deal manual puede nacer en 1, 2 o 6 ✅.
- **Re-agenda expira solo por decisión del closer** ✅. No hay timer que lo mande a Perdido.
- **Compromiso Verbal que vence**: la fecha prometida pasa y no hay abono → el deal se pinta en
  rojo en el Kanban; el closer decide. 🟡 Michael: qué hacen hoy.
- **Abonado que no completa**: `fecha_pago_restante` vencida sin abono → rojo en el Kanban
  (vista de cartera vencida, §8). Sigue en Abonado hasta que el closer decida.
- **Retroceso**: permitido con motivo, queda en el historial.
- **Requisitos por etapa** son la palanca contra el dato incompleto que hoy sufre el registro.
  🟡 Closers: qué campo les da más pereza, para no exigir lo que no van a llenar.

### 3.1 Qué mueve el sistema solo

| Evento | Movimiento |
|---|---|
| sync: `estado` = Setteo No Calificado, Lead sin deal abierto | crea deal en Pendiente Setteo |
| sync: `estado` = Con Calendly, Lead sin deal abierto | crea deal en Agendado + Call `agendada` sin fecha, *Unclaimed* |
| sync: `estado` = Con Calendly, Lead con deal en 1, 2 o 9 | mueve a Agendado + crea la Call (🩸 9 casos medidos de Setteo → Calendly que hoy nadie ve) |
| sync: `estado` = Descartado o vacío | no crea deal; el Lead queda en la base con su tag |
| sync: re-envío del mismo Lead con deal en 4 o más | no mueve; notifica al owner y guarda el envío |
| closer pega link de Grain en la Call | Call `show`; deal a Atendido |
| Call queda en `no_show` o `cancelada` | deal a Pendiente Re-agenda |
| closer crea Call con fecha sobre un deal en Re-agenda | deal a Agendado |
| se registra el primer abono | deal a Abonado |
| `sum(abonos) >= precio_lista` | deal a Completo |

Todo lo demás lo mueve el closer, y el sistema valida el requisito antes de aceptar.

---

## 4. El flujo de un lead, de punta a punta

### 4.1 Entrada

```
Typeform (hoy) / Dapta (después)
  └─ escribe una fila en la pestaña cruda de la hoja del programa
       └─ el Apps Script de la hoja escribe `Estado` (≤10 min)          ← la hoja califica
            └─ el CRM sincroniza (≤15 min, o al abrir la app, o por aviso de la hoja)
                 ├─ crea/actualiza el Envío (todas las columnas)
                 ├─ crea/actualiza el Lead (correo → mismo Lead; teléfono → unido y marcado)
                 └─ aplica la regla de deal según `estado` (§3.1)
```

### 4.2 Casos, todos

| Caso | Qué pasa en el CRM |
|---|---|
| Envío completo nuevo, estado Setteo | Lead + Envío + Deal en Pendiente Setteo |
| Envío completo nuevo, estado Con Calendly | Lead + Envío + Deal en Agendado (*Unclaimed*) + Call sin fecha |
| Envío completo nuevo, estado Descartado | Lead + Envío, sin deal, tag Descartado |
| Envío con `estado` vacío | Lead + Envío, sin deal, tag Sin Calificar; se reevalúa en cada sync |
| Envío parcial (mismo Token, luego la completa) | los dos envíos; la completa manda; el parcial es "inició" |
| Parcial huérfano | Lead + Envío, sin deal; **se atiende después** ✅ |
| Re-envío mismo correo, cambia el estado | nuevo Envío; `lead.estado` = el nuevo; regla de deal (crea o mueve según §3.1) |
| Re-envío mismo correo, deal ya en Agendado o más | nuevo Envío; notifica al owner; no mueve |
| Teléfono igual, correo distinto | contacto sumado al Lead, marcado; lista de "posibles duplicados" para el gerente |
| Misma persona en otro programa | **otro Lead**, sin cruce ✅ |
| Lead llegó por WhatsApp / referido, sin form | deal manual (ADR 0021), en 1, 2 o 6; el closer elige programa; cuenta en el embudo, no en el CPL |
| Lead desaparece de la hoja | categoría "desapareció" (ADR 0032); aviso en la tarjeta del deal ✅ |
| Alguien edita la hoja a mano (correo, estado) | el sync lo trae en la corrida siguiente; la hoja manda sobre `estado` |
| Cambia la redacción del form | columna nueva aparece sola en `respuestas`; si cambia un encabezado promovido, alerta (§5.6) |
| Lead con UTM distinto (lead magnet, Rosario, Milena) | es **un canal más** del mismo intake; el CRM recibe el UTM y lo muestra ✅. `Lead Magnet Ruta` está vacía; si Dapta la llena, se decide entonces |

### 4.3 Vistas que el closer necesita (mínimo, validado por uso del panel actual)

- **Kanban** por programa con las diez etapas ✅, filtros por owner, cohorte, canal, antigüedad.
- **Pendiente Setteo** como tabla para reclamar ✅ y **Unclaimed** (Agendados sin owner) ✅.
- **Mis deals**, **mis Calls de hoy**, **cartera vencida** (§8).
- **Base de Leads** con filtros por estado (Descartado, Sin Calificar, Parcial), sin deal.
- **Ficha del Lead**: todos los envíos con diff entre ellos, contactos, deals abiertos y cerrados.
- **Ficha del Deal**: todo lo de §2.4 a §2.6 en una pantalla, más el historial de etapas.

---

## 5. Fuentes y sync

### 5.1 Lo que ya existe (se conserva)

Tabla `sources` y pantalla `/ajustes/fuentes` con botón **Probar** (ticket 016); mapeo por texto
de encabezado (ADR 0019); sync por programa que recalcula desde cero con candado en la base
(ADR 0031, 0005); función HTTP `/api/cron/sync` protegida con `CRON_SECRET`.

### 5.2 Configurar una fuente: los datos y quién los da

| Dato | Quién | Se muestra | Nota |
|---|---|---|---|
| Programa | gerente; ya debe existir | sí | ✅ **un programa, una hoja** (hoja = archivo de Sheets ✅) |
| Link de la hoja | gerente pega el link | sí, el CRM extrae el ID (`/d/<id>/`) y lo muestra truncado (S-13) | rechaza lo que no sea Sheets |
| Correo de la service account | **el servidor**, del `client_email` del JSON | sí, botón Copiar, a cualquier gerente ✅ | **La service account sí se necesita**: `GOOGLE_SERVICE_ACCOUNT_JSON_B64` **es** la service account (llave privada + correo). Vigente: `retia-metrics-sync@retia-growth.iam…` ✅; el `@retia-metrics.iam…` de `docs/estructura-bbdd.md` está obsoleto, corregir |
| Pestaña | gerente elige de una **lista** que el CRM lee de la hoja | sí | 💡 lista en vez de texto: sin error de tipeo ni problema con emojis, y prueba que el permiso quedó bien |
| Zona horaria de las fechas | gerente, selector, **default Bogotá** ✅ | sí | 🩸 las dos hojas actuales vienen en **UTC** (Typeform); hay que ponerlas explícitas. Probar muestra el último envío convertido para que el gerente vea si cuadra |
| Rango | nadie | no | ✅ se lee **hasta el último encabezado no vacío**; una columna nueva entra en el sync siguiente y los envíos viejos la tienen en `null` |
| Mapeo de los ~10 promovidos | Probar lo propone por texto; el gerente confirma | sí | ✅ es parte de configurar la fuente. Obligatorios: correo, fecha, estado, token. UTM en amarillo si faltan (sin UTM no hay CPI ni ROAS) |
| Credencial, secreto del cron, API habilitada | dev, variables de entorno, una vez | no | ya existen |

### 5.3 Paso a paso para el gerente (texto de la pantalla)

1. Confirma que el programa existe en Ajustes. Un programa solo puede tener una hoja.
2. Abre el Sheet donde caen los leads del formulario y copia el link del navegador.
3. Pégalo acá. Te mostramos el nombre de la hoja para que confirmes que es la correcta.
4. Comparte esa hoja con este correo, permiso **Lector**: `[client_email]` (Copiar).
5. Elige la pestaña donde caen los leads crudos (la que escribe el formulario; no Setteo, no
   Estudiantes). Si la lista no carga, la hoja aún no está compartida.
6. Indica en qué zona horaria vienen las fechas (Typeform: UTC).
7. Pulsa **Probar**. Confirma qué columna es el correo, la fecha, el estado, el token y los UTM.
   Sin los cuatro primeros no se puede activar.
8. Activa. Los leads aparecen en menos de 15 minutos, o ya mismo con el botón **Sincronizar**.

### 5.4 Todas las columnas, sin plantilla: cómo (Postgres, no NoSQL)

Dos piezas: **~10 campos promovidos** con columna propia (los que el código filtra, indexa o
cruza), y **todo lo demás en `respuestas jsonb`** con el encabezado como llave. Postgres indexa
y consulta `jsonb`; el repo ya lo usa en `people.raw`.

Explicado simple: cada envío es una caja. **Opción A**: dentro va una hoja con todas las
respuestas escritas (el `jsonb`), y por fuera, pegadas, las 10 etiquetas que hay que leer
rápido. **Opción B** (EAV, "entidad-atributo-valor"): no hay hoja; cada respuesta es una fichita
en un archivador gigante, una fila por pregunta por envío; para ver un lead se juntan 40
fichitas.

| | A' · promovidas + `jsonb` **del resto** ✅ | A'' · solo `jsonb` con índices de expresión | B · una fila por respuesta |
|---|---|---|---|
| Redundancia | **ninguna**: las 10 etiquetas van por fuera y no se repiten adentro | ninguna | ninguna |
| Leer un lead | una fila | una fila | ~40 filas y un join |
| Llaves e índices sobre correo, fecha, estado | columnas normales | índices sobre `respuestas->>'…'`; la llave `(programa, correo)` del Lead pide columna igual | join |
| Columna nueva | aparece sola | aparece sola | aparece sola |
| Cambio de mapeo | el sync siguiente mueve el valor de la caja a la etiqueta solo | nada que mover | nada que mover |
| Costo | el patrón del repo, sin la copia | consultas más torpes en todo el código | más código y más lento en cada pantalla |

✅ **A'** (Mani, 20-sep, cuarta ronda). Mani señaló que la A original repetía los 10 valores en
el documento; se corrigió: el `jsonb` guarda **solo las columnas no promovidas**. Único matiz:
las promovidas se guardan normalizadas (correo en minúsculas, fecha como timestamp con zona,
teléfono en dígitos), así que el texto exacto de la celda no queda en el CRM. No hace falta:
la hoja es la fuente (ADR 0004) y el sync recalcula desde ella.

### 5.5 Frecuencia y disparo ✅ cada 15 min, más manual

- La función de sync es HTTP; "el cron" es solo un reloj que la llama. No puede ser un
  `setInterval` dentro de la app porque Vercel es serverless: no hay proceso vivo entre
  peticiones.
- 🔴 El cron de Vercel en plan **Hobby** solo corre una vez al día; cada 15 min exige **Pro**.
  No pude verificar el plan (el conector de Vercel pide OAuth).

Lo que se adopta, por capas:

| Capa | Cómo | Estado |
|---|---|---|
| **Sync perezoso** | al abrir la app, si el último sync tiene >15 min, se dispara en segundo plano | ✅ base |
| **Botón manual** | closer, gerente o developer | ya existe ✅ |
| **La hoja avisa al CRM** 💡 | trigger `onChange` de Apps Script en la hoja que hace `POST /api/cron/sync` con el secreto cuando cae una fila. Apps Script sí puede llamar hacia afuera (lo que no podía era recibir con firma) | casi tiempo real, $0; es la respuesta a "¿no hay otra manera cuando sea necesario?" |
| **Cron diario** | el que ya existe, como red | se conserva |
| **Webhook estándar del CRM** ✅ mediano plazo | los forms (Dapta) escriben directo al CRM; `tipo_fuente` nuevo con su ADR (ADR 0012). La ingesta es **la misma función** para fila de Sheet y para payload: los dos se normalizan a un Envío | la meta |

El candado del ADR 0031 ya evita que dos disparos se pisen; ninguna capa necesita nada nuevo
en el motor. ⚠️ Enmienda el ADR 0007.

### 5.6 Alertas ✅

- Disparan: pestaña renombrada o borrada; un encabezado promovido desaparece; el sync falla
  tres veces seguidas. La fuente pasa a **rota** sin desactivarse; el gerente la repara
  eligiendo la pestaña o el campo otra vez.
- Destinatarios: gerentes del programa y developers ✅.
- Canal ✅: dentro de la app, banner que exige "visto" y queda en `change_log` quién lo vio
  (la lección del semáforo de 30X: una alerta sin acuse es decoración). 💡 correo como segundo
  canal si el equipo lo pide.

### 5.7 El paso a Dapta ✅ (pendiente de hacer)

- Mientras Dapta escriba en la hoja (puente `dapta-forms-sheets`), el CRM no cambia nada.
- **Dapta debe entregar el `Estado` ya lleno** ✅ (su scoring nativo califica dentro del form):
  así la calificación sigue fuera del CRM y el Apps Script deja de hacer falta.
- Dapta manda dos webhooks por lead (parcial y completo, mismo id): encaja en el modelo de Envío.
- Después, el webhook directo al CRM (§5.5).

---

## 6. Reclamo y trabajo del closer

- Los deals nacen sin owner. **Pendiente Setteo** es una tabla donde el closer reclama ✅;
  **Unclaimed** son los Agendados sin owner ✅. Un gerente puede asignar o reasignar.
- El contacto de setteo se registra **a mano** como actividad (sin Kapso en el CRM por ahora,
  spec §2). Cada actividad tiene fecha, autor, canal.
- Al reclamar un Agendado, el closer completa la Call: link de Calendly y fecha ✅.
- Después de la llamada: pega el Grain (→ Atendido), y según el resultado marca Compromiso
  Verbal (producto + fecha prometida), registra el abono (→ Abonado), marca Próxima Cohorte, o
  Cierre Perdido con motivo.
- **Playbook de onboarding de closers** ✅: se escribe cuando la herramienta esté terminada. Sale
  de la reunión con Andrea Machado y Maru Marquez y de este documento.

---

## 7. Dinero

- **Ticket = precio del producto** ✅. El equipo crea un producto por precio que use (descuentos
  incluidos) ✅. Sin `precio_contrato` en el deal.
- **Abonos**: cada pago, con comprobante (link o foto, ticket 035). Caja del período =
  `sum(abonos)` en el rango, aunque el deal sea de antes (spec §5.3, se conserva).
- **Cuotas pactadas** ✅: `fecha_pago_restante` y `num_cuotas` en el deal; `valor_cuota =
  saldo / num_cuotas`. Vista de **cartera vencida**: deals en Abonado con fecha pasada y saldo > 0.
  🩸 Hoy la cartera vive en cuatro lugares sin dueño; esto los reemplaza.
- **Moneda**: USD (spec §7). 🩸 La caja real se mueve en COP (bloque de totales de
  `Estudiantes Septiembre`: `$49.423.529`). En la migración, los cobros en COP se convierten **a
  la tasa del día de la migración** ✅.
- **Comisión** ✅: `tasa_programa × precio_lista`, calculada, visible en el dashboard por closer.

---

## 8. Reporting

Lo que HubSpot llama Dashboards, Reports y Goals, contra lo que existe y lo que falta:

| Vista | Existe | Falta |
|---|---|---|
| Dashboard por programa (agendas, llamadas, show, ventas, % cierre, caja, meta dinámica, por closer y origen) | ✅ tickets 004, 005 | conversión **etapa a etapa**, tiempo promedio en etapa, deals abiertos por etapa y owner, Unclaimed por antigüedad |
| Snapshot PDF | ticket 021 | igual sobre lo nuevo |
| Meta y meta dinámica **por cohorte**, no por closer | ✅ ADR 0022, 0023 | se conserva |
| **Réplica de `🚨 Urgencias`** | no | agendas de ayer, promedio 7 días, semáforo, **desglose por `utm_source / utm_medium`** con % del día y "otros". 🩸 Los canales reales: `facebook / cpc`, `direct / organic`, `instagram rosario / linktree`, `instagram milena / linktree`, `instagram rosario / stories`, `leadmagnetdiagnostico / pdf`, `(sin atribución)` |
| **ROAS por cohorte** | no (a mano en la hoja) | compradores por canal en tres cubos como mínimo: Meta Ads, orgánico (Instagram + "automatizado" = Juanito), sin UTM. Necesita `ad_spend`, sembrado e inactivo en el repo. 🟡 Michael: cómo marca Juanito su rastro en el UTM y por qué murió el ROAS |
| **Cartera vencida** | no | §7 |
| Comisión por closer | fórmula en la hoja | calculada (§7) |

**UTM y origen humano.** Los `utm_source` ya nombran personas (`instagram rosario`,
`instagram milena`). 🔴 Mani pidió confirmar de dónde salen: de los encabezados de `_urg_data`
en la hoja de ComunicArte, fila 1, que son los pares `source / medium` que el semáforo agrupa.
Mani: *"deberían ser utm-source"*. Se quedan como `utm_source`; la tarea de [[retia-ops]]
*"Extender el esquema de UTM a origen humano"* decide si además se normalizan a un catálogo.

---

## 9. Migración one-time ✅ (lo último)

- Se hace **cuando el CRM tenga el scaffold completo** ✅, vía Google Workspace MCP, barriendo
  las pestañas de gestión de las dos hojas. Pasa por **la misma ingesta** que el sync (envíos →
  leads → deals), nunca por inserts crudos, y deja `change_log` (ADR 0029).
- Reemplaza el "histórico de C2 de último" de la spec §7 con un alcance mayor: no solo
  estudiantes, también Setteo, Registro de llamadas y `Forms viejo`.
- **El mapa detallado se escribe entonces**, no ahora ✅. Lo que ya se sabe que va a exigir
  decisión en ese momento:
  - Setteo `En proceso` sin nota → ¿En Contacto igual?
  - Registro con `Show = Sí, Cierre = No` → Atendido o Perdido según categoría.
  - `Show = No` → Re-agenda o Perdido.
  - `Registro 1-5` → una actividad por nota, fecha desconocida salvo primera y última
    (Tactical tiene `Fecha de ultimo contacto`, ComunicArte no).
  - `Origen` de Estudiantes es un VLOOKUP por correo y da `#REF!` en Septiembre: la atribución
    se **re-deriva** desde el envío del Lead, no se copia.
  - `Estudiantes Septiembre` de ComunicArte: la columna `x` es la fecha de venta sin encabezado y
    `Numero de asistentes` es un contador de filas; no se leen como campos. Los 12 "cohorte
    pasada" entran con `cohort_id` = septiembre y una fila de historial "movido desde agosto".
  - `Registro de llamadas` de ComunicArte tiene los encabezados corridos (bug del `onEdit`):
    mapear por posición y por nombre, revisar a mano.
  - `_kpis` apunta a pestañas equivocadas (`Estudiantes ComunicArte` vacía): leer las pestañas
    **con datos**, no las que el script nombra.
  - COP → USD a la tasa del día ✅.
  - Consolidados C2 de Michael vs las hojas cuando difieran: 🟡 Michael.

---

## 10. Lo que sigue fuera (y por qué)

Kapso/WhatsApp dentro del CRM, Calendly (hasta el PAT por programa), Grain por API, factura
electrónica, accesos y bonos del onboarding, cédula, secuencias y email marketing, lead magnet
como fuente propia. Cada uno tiene su enganche previsto en este documento o su razón en
[[2026-09-19-crm-propio-en-dapta-no-hubspot]]: **captura y visibilidad sí, plataforma comercial
no**. El Kanban con requisitos por etapa y alertas con acuse sigue siendo captura y visibilidad.

---

## 11. Enmiendas a la spec y a los ADRs ⚠️

Para que cada cambio sea decisión y no descuido (una decisión sin registro se ve igual que un
olvido, [[2026-09-19-crm-propio-en-dapta-no-hubspot]]):

| Vigente | Cambio | Origen |
|---|---|---|
| Spec §2 *"No incluye vista kanban"* | entra el Kanban | ✅ |
| Spec §2 *"No gestiona el onboarding"* | entra solo `onboarded_at` | ✅ |
| Spec §2 *"No conecta Calendly"* | sigue sin conectar; PAT por programa después | ✅ |
| Spec §7 histórico de C2 de último | migración one-time completa, de último, con más alcance | ✅ |
| Spec §6 datos | comisión entra; cédula no | ✅ |
| ADR 0004 Sheets fuente de verdad de leads | se conserva: la hoja manda sobre `estado`; el CRM sobre `etapa` | ✅ |
| ADR 0005 dedup `(program_id, email)` | se conserva como llave del Lead; se suma `lead_contactos` | ✅ |
| ADR 0007 cron diario | cada 15 min: perezoso + manual + aviso de la hoja + cron de red | ✅ |
| ADR 0012 tipos vs instancias | las diez etapas son tipos; productos por precio, tasa de comisión y motivos son instancias | ✅ |
| ADR 0013 abonos separados | se conserva; `abonos.deal_id` | ✅ |
| ADR 0015 resultados de llamada | se conservan; `no_show`/`cancelada` mueven a Re-agenda; `show` sale del link de Grain | ✅ |
| ADR 0019 plantilla de lead | solo los ~10 promovidos se mapean; el resto entra en `jsonb` sin plantilla | ✅ |
| ADR 0021 responsable en `people` | el owner vive en `deals`; el reclamo reemplaza la rotación | ✅ |
| ADR 0027 la venta sabe su llamada | las calls cuelgan del deal; `sales` desaparece | ✅ |
| ADR 0032 estado como viene | se conserva; `etapa` es del deal; razón de descarte no se trae | ✅ |
| Ticket 034 | cambia de alcance: "estado de la hoja sobre Lead + combinar redacciones"; deja de estar bloqueado cuando §12 cierre | |

---

## 12. Lo que queda abierto

### 🔴 Mani (poco, y ninguna bloquea el esquema)

1. §5.5 Plan de Vercel (Hobby o Pro). Define si el cron diario de red se puede volver de 15 min.
2. §2.4 Si una sola `fecha_pago_restante` + `num_cuotas` alcanza, o se quiere fecha por cuota
   desde el inicio (tabla `cuotas_pactadas`).

(§5.4 quedó cerrada: opción A', `jsonb` sin repetir las promovidas.)

### 🟡 Closers (Andrea Machado y Maru Marquez)

- Validar las diez etapas y sus requisitos de entrada. ¿Sobra, falta, se salta alguna?
- Qué campo les da más pereza llenar (define qué se exige por etapa).
- Cómo se enteran hoy de un Calendly nuevo; si el reclamo libre les sirve.
- Qué hacen con un no show, con un compromiso vencido, con "próxima cohorte".
- Qué es una venta sin llamada (Jero, Maru, los 27 estudiantes sin fila).
- Qué les serviría del Kanban antes de que exista. Las nueve de [[flujo-de-leads-retia]] §5.

### 🟡 Michael Castellanos (antes de que salga)

- Por qué se dejó de calcular el ROAS; cómo marca Juanito su rastro en el UTM.
- Qué pasa cuando un compromiso verbal vence o un parcial nunca completa.
- Si alguien edita el `Estado` de la hoja a mano.
- Sus consolidados C2 o la hoja, cuando difieran en la migración.

### 🟡 HubSpot de Daniel Tovar (revisión pendiente, tarea p1 de [[retia-ops]])

- Sus etapas contra las diez de Retia; propiedades exigidas por etapa; pagos parciales; Goals
  por rep o por equipo. Se mira como fuente de diseño, no como alternativa.

---

## 13. Orden sugerido de implementación 💡

Para cuando se abra el trabajo. No son tickets todavía; es el orden que minimiza migraciones
dobles.

1. **Enmiendas** (§11): spec, ADRs nuevos (Lead y contactos, Envío y `jsonb`, Deal y diez
   etapas, `sales` disuelto, cuotas, sync por capas, alertas). Cierra el 034 y lo reescribe.
2. **Esquema** (§2.10): renombrar `people` → `leads`; `lead_contactos`; `submissions`; `deals` +
   historial + actividades; `calls.deal_id`; `abonos.deal_id`; eliminar `sales`; campos nuevos
   de `sources` y `programs`. Primero en `dev` (ADR 0018).
3. **Sync v2** (§5): Envíos con todas las columnas, Token y UTM completos, estado del Lead,
   regla de creación de deals, zona horaria, lista de pestañas, correo de la service account,
   sync perezoso, alertas.
4. **Deals y Kanban** (§3, §4.3, §6): etapas, requisitos, movimientos automáticos, reclamo,
   Unclaimed, actividades.
5. **Calls** (§2.5) con el flujo Grain → Atendido y la Call creada por el sync.
6. **Dinero y Students** (§7, §2.7): abonos sobre deal, cuotas, cartera vencida, comisión,
   `onboarded_at`, cambio de cohorte.
7. **Reporting** (§8): funnel por etapa, réplica de Urgencias, ROAS en tres cubos.
8. **Migración one-time** (§9) y apagado de las pestañas de gestión de la hoja.
9. **Playbook de closers** (§6) y arranque con Andrea y Maru.

## Related
[[retia]] · [[retia-ops]] · [[dashboard-crm-closers-retia]] · [[flujo-de-leads-retia]] ·
[[flujo-closers-retia-sheets]] · [[retia-metrics]] · [[dapta-forms-vs-typeform]] ·
[[atribucion-de-ventas]] · [[glosario-metricas]] · [[preguntas-abiertas]] ·
[[2026-09-19-crm-propio-en-dapta-no-hubspot]] · [[2026-09-16-retia-crm-contrato-de-extension]]
