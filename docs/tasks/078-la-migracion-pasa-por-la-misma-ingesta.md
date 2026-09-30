---
id: 078
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-2 · ADR 0029, invariante 2 del plan v2"
depends: [077]
status: en curso
---

# 078 — La migracion pasa por la MISMA ingesta, nunca por inserts crudos

## Objetivo

Que la migracion one-time no sea un segundo camino de escritura.

## Por que

- **La ingesta es UNA funcion** (invariante 2): si la migracion escribe por su lado, implementa
  otra vez la identidad del lead, los centinelas y la regla de deals, y **diverge en silencio**.
- **ADR 0029:** un script que mete filas de negocio en una base **con datos reales** hace lo mismo
  que un humano en una pantalla. Llama a la funcion y **nunca a `db.insert` en crudo**. De ahi
  salen gratis la validacion y el rastro: **no hay que acordarse de registrar**.
- 🩸 Los 5 enlaces de PayPal entraron a `production` con `change_log` en **0** y siguen sin rastro
  a proposito. Esta migracion va a escribir miles de filas: sin rastro, no hay forma de auditarla
  despues ni de deshacerla con criterio.

## Alcance

- **Dentro:** el script de migracion, llamando a `ingerirEnvio` y a las mutaciones del CRM.
- **Dentro:** el actor sale de `actorDelScript()` (`SCRIPT_ACTOR_EMAIL`), que **se niega a arrancar
  sin el**.
- **Dentro:** idempotencia: correrlo dos veces no duplica. Se prueba corriendolo dos veces.
- **Dentro:** primero **`dev` completo y verificado**; `production` **solo con el ok explicito de
  Mani** (ADR 0018).
- **Fuera:** las excepciones del ADR 0029 (sembrar una base vacia, el acceso de emergencia). **No
  aplican aqui**: la base esta viva.

## Done cuando

- [ ] Cero `db.insert` crudos en el script.
- [ ] Toda fila migrada tiene su rastro en `change_log`.
- [ ] Corrido dos veces sobre `dev`, los conteos no cambian.
- [ ] Ok explicito de Mani antes de `production`.

## Kiro

Si, con revision.

---

## Diseño (29-sep, sesión 46 de Alejo): ADR 0059, **aceptado (ok de Mani, 29-sep)**

Grill con Alejo sobre el mapeo del 077. El ADR 0059 decide: el deal histórico nace en su etapa (actor
`migracion`, sin recorrer el motor); huella `huella_migracion` con índice único parcial en `deals` y `abonos`
(**migración aditiva, la aplica Mani**); si el lead ya tiene deal vivo, gana el vivo y la fila es rareza;
dos pasos (extractor → template local con datos personales, **fuera de git** → importador con ensayo); rastro
del script y hechos del sistema, toda actividad migrada es `nota`; sin fecha de venta, la del cierre de
ventas de la C1 como rareza "fecha aproximada"; Parcial sin monto o `Ya pago` → Compromiso Verbal sin abono.

**Orden para construir (Mani dio el ok el 29-sep):** (1) migración de las huellas + la tabla de rarezas del 080;
(2) el escritor histórico en `lib/deals/` con su guardian y tests en PGlite; (3) el extractor, puro sobre
matrices (testeable sin Google); (4) el importador con ensayo; (5) ensayo en la base local (`npm run
db:local`) con las hojas del día.

**Paso (1) preparado (29-sep, Alejo), rama `migracion/078-huellas-y-rarezas`, SIN aplicar:** migración
`0042_huellas-y-rarezas-de-migracion` (era la 0041; se renumeró el 29-sep porque la 0041 de `main`, valores del lead de Typeform, se aplicó antes. SQL leído: solo agrega; RLS puesto a mano; se quitaron las columnas de la 0041 de main que drizzle-kit arrastraba por no tener ella snapshot).
`huella_migracion` en `deals` y `abonos` con índice único parcial; tabla `rarezas_migracion` (programa,
huella, `tipo` en texto, detalle obligatorio, enlaces opcionales a lead/deal/abono/call, único
`(huella, tipo)`). Tests: `tests/migracion-huellas.test.ts`. **Falta que Mani la revise, la fusione y la
aplique** (y `npm run db:local` para la base de Docker).

**Paso (2) hecho (29-sep, Alejo), misma rama:** `abrirDealHistorico` en `lib/deals/mover-etapa.ts` (vive en
el motor porque escribe la etapa: nace en cualquiera, una fila de historial del sistema con su fecha, notas
del sistema en la misma transacción, frontera de programa para lead, producto y cohorte) y
`lib/deals/historico.ts` (`registrarAbonoHistorico`, `registrarLlamadaHistorica`, `duenoDesdeLaHoja`). Nada
mueve la etapa; solo se cuelga de deals de la migración, nunca del vivo. La huella repetida devuelve
`ya_migrado` y el cupo ocupado `lead_con_deal_vivo` (lo decide el índice; funciona dentro de una transacción
externa, para el ensayo). Guardián: `tests/migracion-escritor-guardian.test.ts` (solo el motor, `historico.ts`
y `lib/migracion/` los mencionan). Revisado por Codex: tres hallazgos (frontera de producto/cohorte, colgar del
vivo, alias en el guardián), arreglados con su test.

**Paso (3) hecho (29-sep, Alejo), misma rama:** el extractor, puro sobre matrices, en `lib/migracion/`
(`template.ts` con los tipos de rareza, `celdas.ts`, `extraer-setteo.ts`, `extraer-llamadas.ts`,
`extraer-estudiantes.ts`). Toda fila termina en deal, llamada, `sinDeal` (alcance, no rareza) o rareza. Tests
en `tests/migracion-extractor.test.ts` con los encabezados reales. Corrido en solo lectura contra las hojas del
29-sep (solo conteos), lo que destapó y se arregló:
- **~260 fechas con año de dos dígitos** (`5/08/26`, siempre día/mes): `parsearFecha` ahora las lee como 20yy.
  Un día ISO sin hora ya no retrocede un día (hallazgo de Codex).
- **Columnas `Correo`/`WhatsApp` cruzadas en una hoja:** 87 filas de `Registro de llamadas` y 26 de 31 de
  `Septiembre Estudiantes Cohort`. Se toma el correo de `WhatsApp` solo si `Correo` no trae uno
  (`correoDeLaFila`).
- Conteos resultantes (trabajado-y-reciente, 30 días): CA 658 deals de Setteo, 285 llamadas, 77 estudiantes con
  77 abonos; TI 1.272 deals de Setteo, 229 llamadas, 66 estudiantes (14 en Compromiso Verbal sin abono).

**Paso (4) hecho (29-sep, Alejo), misma rama:** `lib/migracion/consolidar.ts` (el estudiante absorbe su fila de
Setteo y sus notas; un correo en dos pestañas de Estudiantes queda marcado; la llamada se cuelga solo si su correo
tiene UN deal migrado), `lib/migracion/importar.ts` (cruza lead por correo, cohorte por código, producto USD por
precio exacto y único, plataforma por nombre sin espacios y sin ambigüedad; lo que no cruza es rareza; escribe las
rarezas con sus enlaces y sin duplicar) y `scripts/migrar-gestion.ts`:
- `npm run migracion:extraer -- --programa <slug> [--alcance total] [--dias 30]` → template en `.migracion/`
  (ignorado por git: lleva correos).
- `npm run migracion:importar -- <template.json> [--aplicar] [--local --programa <slug local>] [--onboarded-desde-mail]`
  → ensayo con rollback por defecto. Exige `SCRIPT_ACTOR_EMAIL`. Solo imprime conteos; un error sale sin parámetros.

Probado en la base local de Docker (Postgres real): ensayo con el template real de CA (se deshizo entero) y dos
corridas `--aplicar` con 20 leads de prueba: la primera creó 20 deals, 5 abonos y 20 llamadas, la segunda todo
`ya_migrado` y 0 rarezas nuevas. Revisado por Codex: seis hallazgos (programa cruzado con `--programa`, llamada al
último de dos deals, producto en COP, plataformas que colisionan, abono sin deal invisible, parámetros en el error),
arreglados con su test.

**Origen del deal migrado (29-sep, Alejo; ADR 0060, costura con el 115):** el importador pasa
`submissionOrigenId` a `abrirDealHistorico`: el envío más reciente del lead, o nulo si no tiene ninguno. La
pregunta vive en `lib/ingesta/envio-de-origen.ts` (`envioMasReciente`, mismo orden que `resumirEnvios`;
`enviosDeOrigenPorLead`, una lectura por programa) para que el alta manual del 115 la importe en vez de
copiarla. El escritor rechaza un envío de otro lead (la FK solo mira que exista). Tests en
`tests/envio-de-origen.test.ts`, `tests/migracion-importador.test.ts` y `tests/migracion-escritor-historico.test.ts`.

**Falta para cerrar el 078:** (0042 aplicada en producción y merge a `main` hechos el 29-sep) el ensayo contra
producción (sin `--aplicar`) de los dos programas. Las preguntas abiertas del 077 (cuentas, `Bootcamp`,
`Mail onboarding`) no bloquean el ensayo: caen como rarezas o quedan apagadas por defecto.

**Ensayo contra producción de los dos programas, hecho (30-sep, Alejo, templates del 30-sep):** antes, el
importador escribía fila por fila (~20 consultas por deal a ~90 ms cada una por el pooler): CA tardó 40 minutos
en una transacción y TI no terminó. Desde `0f63581` escribe en lote (`crearVariosConRastro`,
`abrirDealesHistoricos`, `registrarAbonosHistoricos`, `registrarLlamadasHistoricas`; las mismas reglas, el índice
sigue decidiendo): **CA en 18 s y TI en 23 s**. Después: 0 transacciones abiertas y 0 filas migradas.

| | Deals creados | Sin lead | Gana el vivo | Abonos (sin deal) | Llamadas colgadas / sueltas | Rarezas |
|---|---|---|---|---|---|---|
| CA | 691 | 13 | 24 | 72 (5) | 69 / 235 | 467 |
| TI | 1.272 | 29 | 13 | 47 (7) | 74 / 156 | 741 |

**Las sueltas de la hoja no llegan al Inbox (30-sep, ok de Mani):** una llamada sin deal se asigna a mano solo si
es de Calendly (`lib/calendly/suelta.ts`: `sueltaPorAsignar` / `esSueltaPorAsignar`, que importan el Inbox, Calls y
`asignarLlamadaSuelta`). Las de la hoja que la migración no pudo colgar quedan como rareza `llamada_sin_deal`, y
asignarlas forjando la petición da 404 (colgarlas de un deal vivo lo prohíbe el ADR 0059 punto 3). En producción,
al 30-sep, las 23 sueltas son todas de Calendly: el Inbox no pierde ninguna.

Antes de `--aplicar` sigue abierto el otro hallazgo del handoff (30-sep): los estudiantes sin producto (43 en CA y
23 en TI: no hay producto USD con ese precio).

Sin resolver en el extractor (va al importador o al 080): el cruce del `Agendado` con su llamada, los 12
"cohorte pasada" de CA Septiembre (no hay columna que los marque), y el catálogo de motivos por código de
subcategoría.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Si las pestañas traen la columna "origen del deal" al corte, el importador la lleva a `deals.area_declarada_id` (121). Si no, los deals históricos quedan sin área declarada (ADR 0059).
