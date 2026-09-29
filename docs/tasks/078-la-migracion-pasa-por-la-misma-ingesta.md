---
id: 078
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-2 · ADR 0029, invariante 2 del plan v2"
depends: [077]
status: todo
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
`0041_huellas-y-rarezas-de-migracion` (SQL leído: solo agrega; RLS de la tabla nueva puesto a mano).
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
