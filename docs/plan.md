# Plan de implementación del CRM de Retia

> **Punto de entrada único del trabajo.** Quien retome (persona o agente) lee `AGENTS.md`, después este
> plan, y después el ticket. Consolidado el **27-sep-2026**, cuando Comercial dio luz verde para
> construir. Lo nuevo de ese día viene de Mani y va marcado 🆕; los choques que abre, 🔴.
>
> **La documentación vive en cuatro documentos y una carpeta, sin copias entre sí:**
> [`overview.md`](./overview.md) (qué es la herramienta, de principio a fin),
> [`structure.md`](./structure.md) (diagramas y componentes, técnicos y operacionales),
> [`operations.md`](./operations.md) (cómo se opera), este plan (en qué orden se construye y qué
> falta decidir) y [`adr/`](./adr/README.md) (el porqué de cada decisión). Un ADR manda sobre este
> plan. El estado de cada ticket vive **solo** en [`tasks/README.md`](./tasks/README.md); la memoria
> de sesiones, en [`agents/handoff.md`](./agents/handoff.md).
>
> Los documentos que se fundieron el 27-sep (spec, plan v2, propuesta del 24-sep, revisión del 22-sep,
> diseño, glosario, mapa de las hojas, insumos) siguen en git; la tabla de §8 dice dónde quedó cada
> referencia vieja.

Leyenda: ✅ decidido · 🟡 propuesta sin validar · 🔴 falta decidir · 🆕 dicho por Mani el 27-sep ·
⚠️ riesgo.

---

## 1. El norte

El CRM es el lugar donde vive la operación comercial de Retia, y tiene que trackear dos cosas: **el
camino de cada deal** y **el origen de cada lead** (`overview.md` §2). Existe para contestar la
pregunta de Daniel Tovar: *"no sé si estoy perdiendo plata o no con la pauta"*.

**Los tres tracks** 🆕 (Mani, 27-sep). La columna de la derecha son sus palabras:

| Track | Qué entrega | Cómo se sabe que cumplió |
|---|---|---|
| **1 · CRM** | la base del CRM desde el backend | *"asegurando escalabilidad y total integridad de TODA la información que se va a manejar, tanto del proceso comercial como para poder sacar métricas confiables"* |
| **2 · UI/UX** | el backend traducido a pantallas por rol, según las historias de usuario de cada uno (`overview.md` §4) | *"debe ser súper intuitivo y debe eliminar el error humano ya que se va a trabajar todo con valores y protocolos estandarizados"* |
| **3 · Integraciones** | un webhook propio y estándar para Typeform, Dapta Forms o cualquier formulario (y Calendly) | *"que este se rutee correctamente en nuestro CRM sin perder nada de info"* |

**Dos dolores que Mani pidió no perder de vista** 🆕:

- Los closers registran las llamadas a mano en las hojas de cada programa. Lo resuelven los pasos 3 y
  4 de §5 (llamadas y abonos sobre el deal, Inbox, cierre de llamada en un clic).
- El `Estado` del lead lo escribe hoy un Apps Script de la hoja. Mani quiere que lo asigne **el
  formulario, con su scoring**, cambiando el Typeform. Choca con una decisión construida: §4.3b.

**Cuándo está "funcionando en su totalidad".** El plan nunca tuvo fecha y no la inventa. La línea de
llegada es el ticket **082: apagar las pestañas de gestión de Sheets** (lo hace Mani), que solo pasa
cuando los closers operan en el CRM y lo histórico ya migró. Los hitos intermedios están en §5.

---

## 2. Dónde estamos (medido el 29-sep, no copiado)

El avance ticket por ticket vive **solo** en [`tasks/README.md`](./tasks/README.md); aquí va la foto.

- `main` al 29-sep: **1.478 tests en verde**, typecheck y lint limpios; el CI (112) corre en cada
  push, sin protección de `main` (Mani, 28-sep). Producción: https://retia-metrics-seven.vercel.app, que
  despliega cada push a `main`.
- **Base:** una sola, y es producción ("CRM Retia", ADR 0047 enmendado). 41 migraciones (0000 a 0040),
  todas aplicadas. Para probar pantallas hay base local en Docker con login local (113, 069).
- **Datos en producción:** los leads del traslado de Sheets (111, 28-sep: ComunicArte 2.478, Tactical
  2.891, conciliación en 0) y los que entran por el webhook de formularios (106). Los deals de la operación
  vieja todavía no: eso es la migración de E3/E4 (077, 078, 080). Los closers siguen trabajando en Sheets.

| Pieza | Estado al 29-sep | Qué falta |
|---|---|---|
| Esquema del modelo (Lead, Envío, Contacto, Deal, historial, actividades, Calls, Abonos) | ✅ live | · |
| Webhook de formularios + ingesta (`ingerirEntradas`), caja negra y salud (106, 110) | ✅ live | · |
| Estado del lead: lo manda el formulario (ADR 0054); T2 se borró el 28-sep | ✅ | Puntaje T4 sin pesos (§7.1) |
| Motor de etapas: transiciones, `moverEtapa()`, historial, guardián, saldo | ✅ | · |
| Llamadas del deal (057-059), abonos, acuerdo de pago, cartera, onboarding y cambio de cohorte (060, 061, 063) | ✅ en `lib/`, probados | **sin pantalla**: la da la Ficha del Deal (074) |
| Calendly: webhook firmado, reagenda, cancelación, no-show, la suelta (096) | ✅ live, conectado en los dos programas y verificado con una cita real | configuración: vincular cuentas de closers (§4.3c) |
| Navegación por objetos y selector de programa (097) | ✅ live | · |
| Kanban de Deals (069) | ✅ live | vista tabla; probar en un celular real |
| Ficha del Deal (074), Inbox (070, 071), Students (099), Calls (098), Leads (072) | ❌ | E3 y E4 |
| Atribución, dashboard sobre deals, pauta | ❌ | E5 a E8 |
| Migración de las pestañas de gestión | ❌ | E3 (077, 078) y E4 (080) |

## 3. Qué construye cada track, en un diagrama

Los componentes en detalle, el modelo de datos y los flujos están en `structure.md`.

```mermaid
flowchart TD
  subgraph T3["Track 3 · Entradas"]
    FORM["Formulario del programa<br/>Typeform · Dapta Forms · otro"]
    WH["Webhook de ingesta<br/>contrato 🔴 §4.3a"]
    HOJA["Hojas de Sheets<br/>solo el histórico"]
    ADS["Adaptador de Sheets<br/>traslado único"]
    CAL["Calendly del programa"]
    EMP["Emparejador de llamadas<br/>si hay duda, suelta"]
    FORM -->|"envío firmado"| WH
    HOJA --> ADS
    CAL --> EMP
  end
  subgraph T1["Track 1 · CRM"]
    ING["ingerirEntradas<br/>puerta única de lib/ingesta"]
    LEAD["Lead + Envío + Contactos<br/>llave (programa, correo)"]
    CALIF["Estado del envío<br/>🔴 lo da el form o lo calcula el CRM"]
    REGLA["Regla de deals · 052"]
    MOTOR["moverEtapa()<br/>único escritor de deals.etapa"]
    RASTRO["Historial de etapa + change_log"]
    DINERO["Abonos · saldo.ts"]
    ATRIB["Atribución: área, canal, campaña"]
    Q["Consultas sobre deals<br/>vigente() · saldo · por programa"]
    WH --> ING
    ADS --> ING
    ING --> LEAD --> CALIF --> REGLA --> MOTOR --> RASTRO
    EMP --> MOTOR
    DINERO --> MOTOR
    ATRIB --> LEAD
  end
  subgraph T2["Track 2 · Pantallas"]
    INBOX["Inbox"]
    DEALS["Deals · Kanban"]
    FICHA["Ficha del deal<br/>cierre de llamada en un clic"]
    DASH["Dashboard"]
    BUILDER["Builder de links"]
    INBOX --> MOTOR
    DEALS --> MOTOR
    FICHA --> MOTOR
    FICHA --> DINERO
    DASH --> Q
    BUILDER --> ATRIB
  end
```

---

## 4. Los tres tracks

### 4.1 Track 1 · CRM: la base y su integridad

**Las garantías que ya rigen**, y que todo ticket de este track tiene que respetar (detalle en
`AGENTS.md`, restricciones y contratos, y en `structure.md` §4.1):

- Toda tasa se cuenta sobre **personas**; la llave es `(programa, correo)` con índice único. El
  programa es **frontera**: una vista que cruce programas tiene que ser imposible por el tipo
  (ADR 0005, 0043, 0048).
- **`moverEtapa()` es el único escritor de `deals.etapa`**, con requisitos por etapa y un guardián que
  caza cualquier otro escritor (ADR 0037; tickets 045, 046).
- **Toda escritura deja rastro** en la misma operación (`lib/crm/rastro.ts`, ADR 0042).
- **Anulado no cuenta en ninguna métrica** y no es Cierre Perdido (`vigente()`, ADR 0026, 0038).
- **El dinero derivado tiene una sola definición** (`saldo.ts`, lo recrea el 060). Caja y ventas son
  dos métricas: la caja suma abonos por su fecha; las ventas cuentan deals en Abonado o Completo.
- **Toda mutación valida el alcance en el servidor** y lee, decide y escribe en la misma transacción.
- Fechas de Bogotá con `-05:00` explícito; moneda siempre al lado del número; todo por lotes.
- Lo configurable es una fila (ADR 0012); lo derivado no se guarda (ADR 0024).

**Tickets, en el orden de §5:**

| Bloque | Tickets | Qué deja |
|---|---|---|
| Motor de etapas (E2) | 043 · 044 · 045 · 046 · 047 | las 11 etapas y sus transiciones, requisitos de entrada, `moverEtapa()` con historial, guardián, saltos y retrocesos con motivo |
| Alcance | 094 | un closer ve solo los programas de su membresía (sin dependencias, puede ir ya) |
| Entrada (E3 mínimo) | 048 · 049 · 050 · 051 (en curso) · 052 | la ingesta llamada desde el webhook, el estado del lead desde su envío, la regla que abre y mueve deals |
| Llamadas y dinero (E4) | 057 · 058 · 059 · 060 · 061 · 063 · 035 | calls del deal, Grain = la llamada sucedió, no-show a Re-agenda, abonos y saldo, acuerdo de pago, `onboarded_at`, comprobante con foto (Supabase Storage) |
| Atribución (E1b) | 083 · 084 · 085 · 101 · 092 · 102 · 086 · 087 | áreas, campañas con su patrón, emparejador determinista, canales, generador de links, rol Paid Trafficker, origen humano, CPL. Una sola migración para 083, 084, 092, 101 y 102 |
| Reportes (E5) | 064 · 065 · 066 · 067 · 088 · 089 · 090 · 062 · 093 | consultas del dashboard sobre deals, embudo por etapa, Urgencias, ROAS, registros vs agendas, series con dimensiones, rendimiento por área, comisión. El 093 no tiene dependencias |

### 4.2 Track 2 · UI/UX por rol

**Cómo se elimina el error humano, con lo que ya está decidido** (cada punto tiene su ADR o ticket):

- **Nada que decida se escribe a mano.** Resultados de llamada y etapas son listas (ADR 0015, 0037);
  el precio sale del producto; motivos, plataformas y canales son catálogos; un link con UTM sale del
  builder, nunca armado a mano (ADR 0051).
- **El motor exige el requisito antes de mover** (044): no hay Atendido sin Grain, ni Cierre Perdido
  sin motivo, ni Próxima Cohorte sin cohorte destino.
- **Cierre de llamada = pegar el Grain y un clic** (N2), con seis salidas explícitas (`structure.md`
  §3.2).
- **El programa se elige una vez**, arriba, y todas las listas son de ese programa (ADR 0050).
- **Sistema de diseño Tinta obligatorio**: ningún color, sombra ni radio a mano (`structure.md` §9).
- **Una pantalla se prueba haciendo clic en todo lo que se abre**, y un permiso se prueba forjando la
  petición, no mirando que el botón no aparezca (`AGENTS.md`, convenciones).

**Tickets:**

| Bloque | Tickets | Qué deja |
|---|---|---|
| Operación (E6 mínimo) | 097 · 069 · 070 · 071 · 074 · 099 | navegación por objetos con selector de programa, Kanban de Deals, Setteo y Unclaimed, Inbox, ficha del deal, Students por cohorte con onboarding |
| Resto de E6 | 072 · 073 · 098 · 100 · 091 · 076 | tab Leads, ficha del lead, tab Calls, tab Programs, aviso de otros programas del correo, bitácora en Nerd Stats |
| Reportes | 095 · 068 · 021 | tab Dashboard (un programa o "todos" con lo sumable), Nerd Stats reescrito, snapshot en PDF |
| Cierre | 075 | revisión profunda de toda la UI |

✅ **A4 decidida por Mani el 28-sep: la UI se prueba USÁNDOLA**, porque tiene que servir y ser intuitiva; no
se agregan tests de componente ni Playwright por ahora (R5 queda abierta). Riesgo asumido: este repo no tiene
tests de componente y el 20-sep dos bugs pasaron con 669 tests en verde. Lo que lo cubre: cada pantalla se
recorre con clic en todo lo que se abre y la consola abierta, y una regla de permiso se prueba forjando la
petición (`AGENTS.md`, Conventions). Para usarla sin tocar producción hace falta un login local (hoy Auth.js
solo tiene Google; ver `npm run dev:local`).

### 4.3 Track 3 · Integraciones

#### 4.3a El webhook estándar de formularios

> ✅ **Cerrado el 27-sep: ADR 0055** (A2). El programa sale de la URL de cada formulario; un adaptador
> por proveedor y un mapeo por fuente; los parciales llegan por *partial submission point*. Es un track
> propio. Lo de abajo es el contexto previo; quedan abiertas solo las 🔴 2 y 4, como recomendación en
> el ADR.

**Decidido ✅** (22-sep, T1; ADR 0004, 0036, 0039):

- Firma HMAC-SHA256 verificada sobre el **cuerpo crudo**; nunca responde con redirección; la ruta va
  en la lista pública de `proxy.ts` o cada envío falla sin que nadie lo vea.
- **El programa sale de la fuente registrada**, nunca de un campo del formulario. Una fuente
  desconocida es un **error visible**, no un lead en cualquier programa.
- Idempotente por `(fuente, token, es_parcial)`: un reintento no duplica, y la parcial y la completa
  del mismo envío conviven (migración 0022).
- **Se guardan todas las respuestas** del envío en `submissions.respuestas` (ADR 0036).
- Es **un adaptador más** de la puerta única `ingerirEntradas`: fila de hoja y payload de webhook
  producen el mismo Envío.

**🆕 Lo que pidió Mani el 27-sep:** que sea **nuestro webhook, estandarizado**, el mismo para Typeform,
Dapta Forms o cualquier formulario. Coincide con la meta que ya estaba escrita desde el 21-sep
("webhook propio del CRM"); el 22-sep se había arrancado como un endpoint solo de Typeform.

**Precedente en otro repo de Retia:** `dapta-forms-sheets` (`docs/protocolo.md`), probado de punta a
punta con un lead real el 7-sep y todavía sin tráfico de verdad. Tres decisiones suyas aplican directo
a este problema: el destino viaja **en la URL** (`/api/forms/<slug>`) para saber qué secreto usar
antes de leer un cuerpo sin verificar (D1); cada fila lleva `score_version` (D3); ante una falla
permanente responde 200 y guarda **el sobre crudo** para no perder el lead (D4). El payload de Dapta
(capturado en un envío de prueba) trae `submission.score` y `outcome`, y llegan dos webhooks por lead,
parcial y completo con el mismo id (verificado con un lead real).

**🔴 Por decidir (va a un ADR antes del ticket):**

1. La forma del contrato: un adaptador por proveedor detrás de una ruta que lleva la fuente en la URL,
   o un JSON propio de Retia que cada formulario tenga que respetar. Si un proveedor no deja moldear su
   payload (por verificar en Typeform), el segundo camino le obliga a un intermediario.
2. Dónde queda un envío que llega y no se puede procesar, para reprocesarlo. El repo no lo decide; el
   puente de Dapta usa el sobre crudo.
3. Cómo se da de alta una fuente webhook desde la app, sin tocar código (ADR 0012): hoy `sources` no
   tiene identificador del formulario y `tipo_fuente` no tiene un valor para webhook.
4. Cómo se entera alguien de que una fuente dejó de recibir (el equivalente del 055).

**Hechos por verificar:** el payload real de Typeform, y si Typeform manda las respuestas parciales
por webhook (hoy hay 1.152 parciales en Tactical y 193 correos que solo existen como parcial).

⚠️ **Riesgo operativo (T3):** Typeform tiene que seguir escribiendo en Sheets hasta que los closers
trabajen en el CRM, aunque el CRM ya no lea la hoja, o se quedan sin ver los leads nuevos.

✅ Las cuatro 🔴 se cerraron el 27-sep (ADR 0055 y las respuestas de Mani: sobre crudo + 200, aviso en la
app). Tickets: **105** (la fuente webhook), **106** (la ruta y el adaptador de Typeform), **107** (el aviso).

#### 4.3b El Estado del lead sale del formulario 🆕

> ✅ **Cerrado el 27-sep: ADR 0054** (A1), **enmendado esa noche:** el form manda el Estado completo con
> los nombres de la hoja (`descartado`, `setteo_no_calificado`, `con_calendly`) y el CRM confía en él,
> sin calcular ni validar. T2 se retira del repo: A8 se cerró el 28-sep (Mani: *"el CRM no calcula NADA, solo recibe los leads con estado ya definido y los rutea"*). El script de la hoja se borra
> después del hito B. Lo de abajo es el contexto previo.

**Lo que dijo Mani el 27-sep:** *"Ahorita Estado es un campo que llena un script de sheets, pero esto
debe ser asignado directamente desde el forms según el scoring que les da: toca cambiar el Typeform
para que funcione así."*

**Con qué choca:**

- **T2 (22-sep), construido y validado:** el CRM calcula el Estado con las cuatro reglas del Apps
  Script, configuradas por fuente (`lib/ingesta/calificacion.ts`, migración 0023). Coincide con la
  hoja en 6.397 de 6.400 envíos.
- **T4 (23-sep):** el puntaje del lead vive en el CRM, sin pesos (`structure.md` §6).
- Lo de Mani **retoma el diseño del 21-sep**: *"Dapta debe entregar el Estado ya lleno, su scoring
  nativo califica dentro del form"*, que el 22-sep se cambió por T2 porque ya no había hoja en el
  camino (historia en el ADR 0004).
- Según la evaluación del 18-ago (vault, `dapta-forms-vs-typeform`), Dapta Forms puntúa cada opción de
  forma nativa y Typeform no. Hoy el Typeform ya decide quién ve el Calendly según el ingreso. 🔴 Lo
  primero es verificar si el Typeform puede producir el Estado que se necesita.

**Estado de las preguntas (29-sep):**

1. ✅ Qué manda el formulario: **el Estado y el score** (ADR 0054 y decisión de Mani del 29-sep).
   El CRM recibe ambos; el score alimenta `submissions.puntaje` y `leads.puntaje`.
2. ✅ T2 **se borró** el 28-sep (A8 cerrada: *"el CRM no calcula NADA"*).
3. ✅ El scoring del form ordena el Setteo. El CRM no calcula ingreso ni bandas: recibe `score` por la
   llave `puntaje` del mapeo y lo copia a `submissions.puntaje` y `leads.puntaje`. Alejo dejó esa ruta
   implementada; falta configurar la variable en ambos Typeform.
4. ✅ No se agrega lógica de ingreso al CRM. Cada formulario puede tener su scoring por programa; el
   webhook acepta el valor por su mapeo (ADR 0055).
5. ✅ D4 cerrada (ADR 0054): se decide con `leads.calificacion`; `leads.estado` guarda lo que escribió la
   hoja para comparar en la migración y nadie decide con él.

**Lo que no cambia:** un envío sin Estado o score, o con un valor que el CRM no reconoce, no se
adivina: queda sin calificar/sin score y se reporta. El Setteo lo ordena por score cuando existe y por
recencia cuando no.

#### 4.3c Calendly (ticket 096)

Cuelga cada llamada de su deal por el **correo del invitado**, nunca por el teléfono; si hay duda, la
llamada queda **suelta** (ADR 0049; flujo en `structure.md` §2.2).

**Live desde el 29-sep (Alejo):** el **webhook** (A5, Mani 28-sep). Calendly empuja cada evento solo; nadie
aprieta un botón para traer llamadas. Ruta `POST /api/webhooks/calendly/<id del programa>`, firmada con la
clave de la suscripción (`programs.calendly_signing_key`), caja negra en `sobres_crudos`, idempotente por la
huella `calendly:<uuid>`. Eventos: `invitee.created` crea la llamada (o, si trae `old_invitee`, es una
**reagenda** y mueve la MISMA llamada); `invitee.canceled` y `invitee_no_show.created` pasan la llamada a
`cancelada`/`no_show` y el deal de Agendado a Re-agenda; `invitee_no_show.deleted` lo deshace. "Conectar
Calendly" ya corrió en los dos programas (el plan de las dos cuentas alcanza: A5 cerrada del todo) y una cita
y una cancelación reales pasaron de punta a punta. Reagenda y no-show solo están probados en tests.

**Para qué sirve el PAT de cada programa** (`programs.calendly_token`, ADR 0057). No trae llamadas; eso lo
hace el webhook. El PAT es la llave con la que el CRM **le pregunta** cosas a Calendly en cuatro momentos:
1. **Al entrar un envío "Con Calendly"** (052): lee la cita exacta de ese invitado *antes* de escribir, para
   crear el deal en Agendado con la fecha real y no en un Agendado sin fecha.
2. **"Conectar Calendly"** (`lib/calendly/suscripcion.ts`): crea la suscripción del webhook por la API
   (Calendly no deja crearla desde su panel).
3. **Vincular la cuenta de cada closer** (`/ajustes/usuarios`): lista las cuentas de la organización para
   elegir, y el servidor vuelve a comprobarla.
4. **"Buscar llamada"** (`buscarLlamadaDelDeal`): consulta a pedido para un deal cuya cita no apareció al
   entrar el envío. Existe en `lib/` sin pantalla; con el webhook vivo es solo un respaldo (decisión K1, §7).

**Lo que falta, todo configuración:** vincular la cuenta de Calendly de cada closer por programa (lo hace un
administrador, compartida o personal: Mani 29-sep); crear el usuario de Maru desde la app; y las decisiones
K1 a K3 de §7. Sin la integración, el closer crea la llamada a mano y el modelo funciona igual.

#### 4.3d Lo que viene de Sheets

- **Traslado de leads y envíos:** una sola vez, por la misma puerta, con el Estado tal como lo escribió
  la hoja y la calificación del CRM al lado para compararla.
- **Migración de las pestañas de gestión (E7):** 077 · 078 · 079 · 080 · 081 → 082. Los deals viejos
  entran con su estado de gestión, no como ~2.400 deals iguales en Pendiente Setteo. Los casos que ya se
  sabe que piden decisión están en `structure.md` §11.
- ✅ **El sync de Sheets se descarta (Mani, 28-sep; cierra A6).** Los leads entran solo por el webhook.
  053 a 056 quedan `reemplazado`; el código del sync vivo (cron, corridas, candado, `POST /api/sync`) se
  retira con el ticket 108. Lo que sirve para leer una hoja UNA vez (lectura, mapeo, dedup, adaptador de
  Sheets) se queda para el traslado.

#### 4.3e Después de v1

Ventas que vuelven solas desde los checkouts (Hotmart, PayPal, MercadoPago), Kapso, recordatorios,
acortador de links (`overview.md` §8).

---

## 5. Orden de construcción

El orden oficial es el de **P1, operación antes que analítica** (decidido el 24-sep): E2 → E3 mínimo
→ E4 → E6 mínimo → E1b → E5 → E7. Lo que este plan agrega es **dónde cae cada track** y dónde entran las
piezas que no tenían ticket (producción, webhook).

| Paso | Track 1 · CRM | Track 2 · UI/UX | Track 3 · Integraciones | Termina cuando |
|---|---|---|---|---|
| **0 · Terreno** | ✅ reparar el lock (§2) | · | ✅ producción en CRM Retia y Vercel apuntando a ella (28-sep) | ✅ decisiones A1 a A3 de §7 |
| **1 · Motor** | 043 → 044 → 045 → 046 → 047 · 094 en paralelo | · | ✅ ADR 0055 (webhook) y ADR 0054 (Estado), 27-sep | un deal se mueve solo por `moverEtapa()` |
| **2 · Entrada** | 048 · 049 · 050 (en curso) · ✅ 051 · 052 | · | ✅ 105 (fuente webhook) · ✅ 106 (ruta + adaptador de Typeform) · ✅ 107 (aviso); payload real de Typeform | **Hito A: los leads entran solos al CRM** (primero `dev`, luego producción) |
| **3 · Llamadas y dinero** | 057 · 058 · 059 · 060 · 061 · 063 · 035 | · | 096 cuando se decida su forma | una llamada y un abono mueven el deal |
| **4 · Operación** | · | 097 · 069 · 070 · 071 · 074 · 099 | · | **Hito B: los closers operan en el CRM.** Typeform deja de escribir en Sheets después de 066 y 067 (reparto §3, 28-sep), no aquí: Urgencias vive en la hoja |
| **5 · Atribución** | 083 · 084 · 085 · 101 · 092 · 102 · 086 · 087 | pantalla del builder y de campañas | reunión con Pauta | el origen de cada lead se clasifica solo |
| **6 · Reportes y resto de UI** | 064 · 065 · 066 · 067 · 088 · 089 · 090 · 062 · 093 | 095 · 068 · 021 · 072 · 073 · 098 · 100 · 091 · 076 · 075 | · | el dashboard sale de los deals |
| **7 · Migración** | · | · | traslado · 077 → 078 → 079 · 080 · 081 → 082 | **Hito C: se apagan las pestañas de gestión** |

🟡 Tres cosas del orden son lectura de este plan y no decisión de nadie: el paso 0 como paso propio,
el lugar del webhook en el paso 2 (T1 dice que su primera versión crea lead, envío y contactos, y que
el deal llega con el motor) y los hitos A, B y C. El traslado de leads sin deal podría adelantarse; no
está decidido cuándo. Y el paso 5 depende de una reunión (Pauta), no de código: si llega antes, se
adelanta.

**Reglas de ejecución** (de `AGENTS.md`, no se negocian):

- Un paso no se cierra sin `npm test`, `npm run typecheck` y `npm run lint` limpios.
- **Las migraciones las genera y aplica la sesión principal**, nunca un subagente, y el SQL que genera
  `drizzle-kit` se lee antes de aplicarlo. Primero PGlite (`npm test`); producción con el ok de Mani.
- En paralelo se reparte **por archivos**: dos tickets con migración no van juntos, y nadie más que el
  coordinador toca el tracker y el handoff.

---

## 6. Qué paso sirve a qué criterio de aceptación

Criterios de `overview.md` §9:

| # | Criterio | Lo cumplen |
|---|---|---|
| 1 | El closer registra una llamada cerrada con su venta y su primer abono, sin WhatsApp | pasos 3 y 4: 057, 058, 060, 074 |
| 2 | Un cierre lo ven igual los closers **del programa** y el gerente; un closer sin membresía no | 094 y 095 |
| 3 | El gerente filtra por programa y fechas y ve agendas, show, ventas, % de cierre y caja | paso 6: 064, 065, 095 |
| 4 | Un programa nuevo con su cohorte, fuente y recursos, sin tocar código | hecho con fuentes de Sheets (016). Con el webhook depende de la 🔴 3 de §4.3a y del 100 |
| 5 | Un closer nuevo, asignado a un programa, registra y aparece en las métricas | 094, 057, 064. En operación faltan los closers reales en la base de producción, que todavía no existe (ticket 007) |
| 6 | Recursos y links de pago vigentes en un clic | ✅ hecho (022, 023) |

---

## 7. Decisiones abiertas (la lista única)

Lo que no está aquí, está decidido. Cada una dice qué bloquea y cuándo hace falta. Cuando una se
cierra, baja a un ADR (con `/grill-with-docs`) o a su ticket, y sale de esta lista.

**A. Mani** (técnicas y de producto):

| # | Qué | Bloquea | Cuándo |
|---|---|---|---|
| A4 | ~~Garantía de la UI~~ ✅ 28-sep: se prueba usándola, contra la base local con login local (069); CI (R4) existe | · | cerrada |
| A5 | ~~Calendly: webhook o consulta~~ ✅ **webhook**, live y verificado el 29-sep en los dos programas (el plan de las cuentas alcanzó); token por programa (ADR 0057) | · | cerrada |
| A7 | Las fichas técnicas de §7.1 que siguen abiertas: D5, R2, R3, P2, T4 | ver cada ficha | según el ticket |
| K1 | ~~"Buscar llamada" con el webhook vivo~~ ✅ 29-sep: **se retira `buscarLlamadaDelDeal`, sin pantalla.** Los dos casos que cubría ya tienen dueño: una entrega que falla queda en `sobres_crudos` con su error y se ve en `/ajustes/salud`; una que llega antes que el envío la adopta el 052; y la que no casa queda suelta (K2). Un botón que no cubre ningún caso nuevo es código que envejece sin que nadie lo mire. El retiro va con el cierre del 096 (carril de Alejo, `lib/calendly/`) | · | cerrada |
| K2 | ~~Dónde se asigna la llamada suelta~~ ✅ 29-sep: **en el Inbox (071)**, con `asignarLlamadaSuelta`. Una suelta no tiene deal, así que la Ficha (074) solo la vería quien ya sospecha que existe; el Inbox es la cola de lo que no tiene dueño. La tab Calls (098) la muestra, pero no es donde se trabaja. El 096 cierra sin pantalla | · | cerrada |
| K3 | **La llamada de prueba del 29-sep** (suelta, cancelada, sin deal; no cuenta en nada): ¿se borra o se deja? Borrarla es escribir en producción | nada | cuando Mani quiera |
| K4 | ~~Tono de Seguimiento~~ ✅ 29-sep: `info` (`structure.md` §3), elegido en la sesión del 069 porque es "hay que hacer algo con la llamada", como Agendado y Atendido. Mani puede cambiarlo | · | cerrada |

**A2. Para después (Mani, 28-sep):** revisar si las alertas de la app (fuente sin envíos, 107; y las
que vengan) se mandan también por correo, de forma estandarizada y simple: un solo mecanismo para todas,
no uno por alerta. No bloquea nada.

**B. Closers** (por chat, cuando llegue el ticket que la necesita):

- ~~Qué pregunta del formulario es el ingreso, en qué moneda y periodo, y si las bandas son iguales en
  los dos programas (070, 071).~~ ✅ Lo resuelve el scoring del formulario; el CRM solo recibe `score`.
- ~~El X de "deal sin actividad en X días" (071).~~ ✅ 3 días hábiles por defecto, configurable.
- ✅ ~~De quién es el deal si el lead agenda con otra closer por Round Robin (096).~~ De esa closer
  (Mani, 28-sep).
- ~~¿"Estudiante" desde el primer abono o con el pago completo? ¿Quién hace el onboarding?~~ ✅ Students
  muestra deals en `abonado` o `completo`, con su lead, por cohorte y programa; el onboarding lo marca
  el closer dueño, gerente o developer (099).
- Cómo mandan el comprobante: foto, link o PDF (035, 060).
- ~~Hasta cuántos días atrás vale migrar Setteo con deal (080).~~ ✅ 28-sep (Mani): lo trabajado + los últimos 30 días, con parámetro para migrar TOTAL.
- Uso desde el celular; quién prueba primero; cómo y cuándo se paga la comisión.
- **Los motivos (104, ya cargados):** revisar los 13 que salieron de su `_ListasDropdown`; sobre todo
  reagenda y recuperación, que no tenían equivalente en la hoja. Se ajustan desde el catálogo.
- Confirmar: la venta sin llamada y los perdidos que se recuperan (transiciones T4, T5 y R de
- **Con qué cuenta de Calendly recibe llamadas cada closer en cada programa** (096). Hoy Andrea no tiene
  cuenta propia; en ComunicArte las candidatas son `info@eventoscomunicarte.com` (Milena) o la de Maru, y
  en Tactical `equipo@`, `registro@` o `jvieira@ttrading.co`. Lo vincula un administrador; mientras no
  esté, las citas entran sueltas.
  `structure.md` §3.1; no confundir con la ficha T4 de §7.1).

**B2. Equipo (Mani, 27-sep):** ¿para qué sirven las preguntas del formulario que hoy no deciden nada?
Ingreso filtra quién ve el Calendly (por confirmar en la ramificación de la pregunta de pago) y ordenará
Setteo (070); **motivación y urgencia no se usan en ninguna parte**, y la situación profesional solo se
copia a Setteo para que el closer la lea. Tres preguntas: ¿ordenan la cola o cambian a dónde va el lead?;
¿quién fija el criterio y con qué datos (lo que respondieron los que compraron, de la migración de las
pestañas de gestión)?; ¿las que no sirvan se quitan del formulario? Se cruza con T4.

**C. Gerencia (Alejo, Daniel):** el área de cada canal (101); qué ve el Paid Trafficker (102); los
umbrales de éxito del dashboard; ✅ ~~el precio de lista de ComunicArte~~: **797** (Mani, 28-sep; 697 solo se respeta a quien ya lo
tenía cotizado); el límite de los
descuentos; si un lead traído por un closer cuenta distinto en su comisión; ratificar que se construye
y no se compra HubSpot (R10).

**D. Pauta** (Jero consigue la reunión; prioridad altísima según los closers): la convención de UTM y
el builder (083, 084, 085, 092, 101); qué checkouts usan y si mandan webhooks; si además capturan
`utm_id` y `fbclid` (R6); por qué Tactical tiene 26% de leads sin UTM.

**E. Michael** ✅ respondidas por Mani el 28-sep:
- **ROAS:** vuelve (067). Se dejó de calcular solo porque no había datos fáciles para calcularlo.
- **Juanito:** la pregunta estaba mal planteada. Juanito es el bot de Retia para los recordatorios antes
  de la llamada. No hace setteos ni deja rastro en el UTM, así que no toca la atribución.
- **Estado de la hoja:** nadie lo edita a mano. Confirma el ADR 0054: el CRM traduce lo que manda el
  formulario.
- **Pago parcial que no se completa:** se presiona al lead de ese deal hasta completarlo. **Un deal no
  se cierra sin el pago completo** (061, cartera vencida).
- **Si Michael se va mañana:** se rompe el seguimiento de métricas de Retia como agencia, no el CRM.
- **Consolidados de C2 contra la hoja:** **manda la hoja** (080, 081).
- **Comisión:** se verifica después (062, E5).

**F. Media:** si el orgánico usa el mismo formulario que la pauta; qué cuentas o creadoras van en
`utm_content` (`rosario`, `milena`, otras).

### 7.1 Las fichas técnicas abiertas, con su contexto

Vienen de la revisión del modelo del 22-sep (su texto completo:
`git show da68cdf:docs/auditorias/revision-modelo-hubspot-2026-09-22.md`). Deciden Mani y, donde se
dice, alguien más.

| Ficha | El problema | Opciones y recomendación escrita |
|---|---|---|
| ~~**D3 · ¿Abonado cuenta como deal abierto?**~~ | ✅ **Decidida (Mani, 28-sep, ticket 060): A.** Abonado ocupa el cupo del lead; un segundo producto espera a que se complete el pago | · |
| ~~**D4 · `leads.estado` o `calificacion`**~~ | ✅ Cerrada por el ADR 0054: decide `leads.calificacion`; `leads.estado` queda como texto de la hoja, sin lectores que decidan | · |
| **D5 · UTM en dos tablas** | `leads` y `submissions` guardan los mismos `utm_*`, sin estar declarado; el 093 filtraría por uno y el 088 por el otro: dos cifras para la misma pregunta | Recomendación: el origen del lead es el de su primer envío, derivado, y `leads.utm_*` se elimina; mientras tanto, lo que lea `leads.utm_*` lo marca como temporal |
| **R2 · El rastro por triggers** | Hoy el rastro lo garantiza un guardián por regex que no ve alias de tabla, `.delete(` ni algunas tablas | Con las transacciones reales del ADR 0047, triggers `AFTER INSERT/UPDATE` con `SET LOCAL app.user_id` harían que la base garantice el rastro, como el dedup. Recomendación: sí; el guardián de etapas (046) encoge |
| **R3 · Vercel Pro** | Hobby permite un cron al día y es para uso no comercial | Recomendación: Pro (20 USD/mes por miembro). ~~Habilita la consulta de Calendly cada 15 min~~: A5 se resolvió por webhook, así que Calendly ya no lo pide; queda por el uso comercial |
| ~~**R4 · CI**~~ | ✅ Hecho (112, 28-sep): `.github/workflows/ci.yml` en cada push, sin proteger `main` | · |
| ~~**R5 · Playwright**~~ | ✅ Reemplazada por A4 (Mani, 28-sep): la UI se prueba usándola contra la base local | · |
| **P2 · Empates en el emparejador** | En Postgres dos `NULL` no chocan en un índice único, y todos los campos del patrón son opcionales | Hace falta `NULLS NOT DISTINCT` **y** detectar el empate en tiempo de ejecución, como error visible (084, 085) |
| **P3 · El costo del proceso** | `AGENTS.md` pesa ~50 KB y el handoff ~2.900 líneas: cada sesión gasta contexto en historia | Recomendación: `AGENTS.md` solo reglas, contratos y comandos, cada regla con su ADR; el handoff con el estado actual y lo siguiente. La consolidación del 27-sep ya movió los documentos |
| **T4 · El valor del puntaje** | El motor existe sin pesos; no hay datos de venta para calibrarlo | Opciones: A categoría (A/B/C), B puntaje de 0 a 100, C valor esperado en USD. Recomendación: A por ahora y C cuando haya histórico, calibrando con la migración de las pestañas de gestión. Preguntas: ¿solo ordena la cola o también cambia a dónde va un lead?; ¿quién fija los pesos? Se cruza con A1 |

---

## 8. Mapa de documentos y referencias viejas

| Documento | Qué es | Cuándo se lee |
|---|---|---|
| `AGENTS.md` | el contrato del repo: restricciones, contratos, comandos, convenciones | siempre, primero |
| **`docs/plan.md`** | este plan | siempre, segundo |
| `docs/plan-reparto.md` | complemento de este plan: el orden en etapas para que Mani y Alejo (Dávila) trabajen en paralelo, quién toma qué y cuándo se cierra una etapa. No define qué se construye: eso sigue aquí y en los tickets | antes de tomar un ticket, para saber en qué etapa y carril cae |
| `docs/overview.md` | qué es la herramienta de principio a fin: problema, programas, roles, recorrido de un lead, métricas, alcance, criterios, historia, vocabulario | para entender el producto o el dominio, y antes de nombrar algo |
| `docs/structure.md` | diagramas y componentes: operación de hoy, flujos, motor de etapas y transiciones, arquitectura, modelo de datos, ingesta, atribución, pantallas, sistema de diseño, mapa de las hojas, migración | al construir cualquier pieza; §9 antes de tocar una pantalla |
| `docs/operations.md` | entornos, URLs de los programas, variables, base de datos, scripts, despliegue, secretos, incidentes, deuda, datos de validación | al operar, migrar, desplegar o validar cifras |
| `docs/adr/README.md` y `docs/adr/` | las decisiones vigentes y el índice de las retiradas | antes de tocar un área decidida |
| `docs/tasks/README.md` y `docs/tasks/NNN-*.md` | estado de cada ticket y su detalle | al tomar un ticket |
| `docs/agents/handoff.md` | memoria de sesiones | al arrancar y al cerrar una sesión |

**Dónde quedó cada referencia vieja.** Los tickets y los comentarios del código citan documentos que se
fundieron el 27-sep. Su texto sigue en git (`git show da68cdf:<ruta>`).

| Referencia vieja | Hoy está en |
|---|---|
| `docs/spec.md`, "spec §N" | `overview.md` (§2 qué es, §8 alcance, §9 criterios, §6 datos) |
| `docs/plan-crm-v2.md`, "plan v2 §N", "etapa EN", "E-N" | el orden, en §5 de este plan; el porqué, en los ADR |
| "plan v2 §12" (la atribución por área) | ADR 0043, 0044, 0045 y 0051; `structure.md` §7 |
| `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md`, "propuesta §0" | `overview.md` §10 (lo que dijeron los closers) y §7 de este plan |
| "propuesta §2.3 a §2.6" (flujos, etapas, transiciones) | `structure.md` §2 y §3 |
| "propuesta §3.2 a §3.7" (modelo, UTM, builder, pantallas, dashboard, Calendly) | `structure.md` §5, §7, §8 y §2.2 |
| `docs/auditorias/revision-modelo-hubspot-2026-09-22.md`, fichas D, R, P, S, T | §7 y §7.1 de este plan; las cerradas, en su ADR (S1 y S2: ADR 0047; T1 y T3: ADR 0004 y §4.3a; T2: §4.3b) |
| `docs/auditorias/auditoria-arquitectura-2026-09-19.md` | sus lecciones, en `structure.md` §4.1 |
| `docs/design.md` | `overview.md` §1, §2 y §4 |
| `docs/design-system.md` | `structure.md` §9 |
| `docs/estructura-bbdd.md` | `structure.md` §10 y `operations.md` §2 |
| `docs/agents/context.md` (el glosario) | `overview.md` §11 |
| "insumo §N" (el diseño consolidado del 20-sep, `crm-retia-modelo-hubspot-scaffold.md`) | lo vigente, en los ADR y en `structure.md`; el original vive en el vault (`mani_vault/02 Projects/retia/notebook/`) |
| `docs/insumos/` (reuniones, notas del vault, consolidados de C2) | lo útil, en `overview.md` §3 y §10, `structure.md` §1 y §11 y `operations.md` §11; el crudo, en git, en Granola y en el vault |
| un ADR que ya no está en `docs/adr/` | `docs/adr/README.md`, tabla de retirados |
