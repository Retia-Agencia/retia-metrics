---
id: 077
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-1 · insumo §9, spec §7 (enmendada)"
depends: [111]
status: done
---

# 077 — Barrer las pestanas de gestion de las dos hojas

> **Va de ULTIMO, con el scaffold completo.** Es la enmienda de la spec §7: el "historico de C2"
> crece de alcance y se convierte en la migracion one-time.

## Objetivo

Traer al CRM lo que vive en las pestanas de gestion: `Setteo`, `Registro de llamadas`,
`Estudiantes` y `Forms viejo`, de los dos programas.

## Las coordenadas (copiadas del ticket 039 antes de borrar esas filas de `sources`)

| programa | que | archivo | pestana |
|---|---|---|---|
| comunicarte | Estudiantes | `1NN6rlZXJJ…` | `Estudiantes Agosto` |
| comunicarte | Registro de llamadas | `1NN6rlZXJJ…` | `Registro de llamadas` |
| comunicarte | Formulario anterior | `1NN6rlZXJJ…` | `Forms viejo` |
| comunicarte | Pauta | `1NN6rlZXJJ…` | `ROAS ESTUDIASTES AGOSTO` |
| tactical-investor | Estudiantes C1 | `1DBKL4zwWW…` | `Estudiantes Cohort Julio` |
| tactical-investor | Estudiantes C2 | `1DBKL4zwWW…` | `Septiembre Estudiantes Cohort` |
| tactical-investor | Registro de llamadas | `1DBKL4zwWW…` | `Registro de llamadas` |
| tactical-investor | Pauta C1 | `1DBKL4zwWW…` | `ROAS COHORT JULIO` |

(Los ids completos estan en `docs/estructura-bbdd.md`. `Forms viejo` sigue siendo una fila
**inactiva** de `sources`, no una coordenada suelta: por eso sus envios tienen donde apuntar.)

## Alcance

- **Dentro:** leer las pestanas con Google Workspace MCP o con el lector del repo, y **mapear cada
  una** al modelo nuevo.
- **Dentro:** lo que no se pueda clasificar queda **visible con su rareza**. ⚠️ **No se anula**:
  anular significa "esto nunca paso", y de la hoja **si paso** (ADR 0038).
- **Dentro:** el script recibe el **alcance del Setteo como parámetro** (`trabajado-y-reciente` por defecto, `total`
  para migrarlo todo) y los días de corte (30): decisión de Mani del 28-sep, ver el ticket 080.
- **Fuera:** inserts crudos. Eso es el ticket 078.
- **Fuera:** apagar las pestanas. Eso es el ticket 082, y va despues de verificar.

## Done cuando

- [ ] Las ocho pestanas estan leidas y su mapeo, escrito.
- [ ] Ninguna fila se descarta en silencio: lo que no entra queda listado con la razon.

## Kiro

Si, **con los casos raros revisados uno por uno**.

---

## Nota 2026-09-24: la migración trae los deals históricos

Por la decisión de Mani del 24-sep, el sync abre deals solo para leads nuevos desde el corte. Los
deals de los leads viejos de Setteo **nacen aquí**, desde la pestaña Setteo, respetando su "Estado
gestión" (ver el ticket 080).


---

## Enmienda 2026-09-28 (plan de reparto §3, ok de Mani)

Depende del traslado (111) y de las mutaciones de E4 (060, 069, 070), no del 075. Los tickets 077 a 081 se corren en el corte del hito B: sin lo abierto de hoy (Setteo, agendados, estudiantes con saldo) los closers llegarían al CRM sin su pipeline.

## Idea de Mani, 28-sep: un template de importación

Recopilar la gestión (setteo, llamadas, estudiantes, pagos) en un **template canónico** desde otra
sesión, y después **subirlo** para inyectarlo. La recomendación de la sesión 42: sí para la gestión
(heterogénea, pide criterio; separar "recopilar" de "inyectar" hace revisable lo primero y deja el
importador fijo, idempotente y con ensayo, que es lo que pide el 078), **no** para leads y envíos (el
traslado 111 ya los lee directo de la fuente; un paso de copiado solo agrega errores). Decisión previa
que merece ADR: un deal histórico "nace" en su etapa por migración, porque no puede recorrer las
transiciones del motor. Diseñarlo con `/grill-with-docs` al abrir E7. `tipo_fuente` ya tiene `upload`.

---

## Mapeo, primera pasada (29-sep, sesión 46 de Alejo)

Leído con `npm run inspeccionar` y un conteo de valores **solo de columnas no personales** (el texto libre y
los datos de contacto se contaron, no se imprimieron). Las cifras son de ese día; se vuelven a medir en el
ensayo. `Forms viejo` ya entró con el traslado (111, los 65 del 079): aquí no se vuelve a leer.

### Setteo → deal (+ actividades)

| | ComunicArte | Tactical |
|---|---|---|
| Filas | 982 | 1.521 |
| Llave | `Correo` (982/982) | `Correo` (1.512/1.521: **9 sin correo**, rareza) |
| Estado gestión | Pendiente 725 · En proceso 196 · No interesado 57 · Cerrado 3 · vacío 1 | En proceso 742 · Pendiente 705 · Agendado 58 · No interesado 11 · Cerrado 4 · **`Andrea` 1** (rareza) |
| Dueño | `Closer asignado`: Andrea 391 · Juanjo 274 · Dana 208 · vacío 85 · Maru 24 | `Responsable`: vacío 855 · Jero 426 · Andrea 67 · Maru 58 · Dana 38 · Sebastian 30 · Alejo 30 · Michael 17 |
| Fecha de detección | `Fecha detección` (982) | `Columna 1` (sin nombre; confirmar que es la detección) |
| Actividad | `Fecha de contacto` 282 · Registro 1-4 (157/71/8/2) | `Fecha de contacto` 868 · `Fecha de ultimo contacto` 18 · Registro 1-2 (795/392); 3-5 vacíos |

- Etapa y alcance: la decisión de Mani del 28-sep (ticket 080), parámetro `trabajado-y-reciente` / `total`.
- El deal se busca por `(programa, correo normalizado)` contra el lead que ya dejó el traslado. **Sin lead en
  el CRM → rareza**, no se crea un lead desde el Setteo (el lead lo manda el formulario, ADR 0004).
- Dueño: solo si el nombre es un usuario del CRM (`mismoCloser`); si no, el deal nace sin dueño.
- Cada `Registro N` no vacío → una `deal_actividades` tipo `nota`. Fecha: `Fecha de contacto` para el
  Registro 1 y `Fecha de ultimo contacto` para el último (solo Tactical); los del medio, sin fecha real (080).
- `Situación profesional`, `Ingresos`, `Disposición` **no se leen**: son del envío, que ya está en el CRM.
  (Traen `#ERROR!` en 197 y 167 filas: otro motivo para no copiarlas.)

### Registro de llamadas → calls

| | ComunicArte | Tactical |
|---|---|---|
| Filas | 285 | 229 |
| Sin fecha | 21 | 6 |
| Sin correo | 20 | **75** (un tercio: el teléfono solo une y marca, ADR 0035) |
| Closer | Andrea 223 · Alejo 19 · Dana 17 · vacío 15 · Maru 11 | Andrea 166 · Dana 25 · Alejo 18 · juanse 9 · Sebastian 8 · vacío 2 · Maru 1 |
| Show | Sí 114 · No 108 · vacío 53 · `no` 9 · `si` 1 | Sí 114 · No 108 · vacío 7 |
| Cierre | No 111 · vacío 110 · Sí 55 · `no` 9 | No 140 · vacío 59 · Sí 30 |
| Categoría | casi vacía (15 con valor) | vacío 167 · FOLLOW UP 31 · PENDIENTE RE AGENDA 20 · RECHAZO DIRECTO 4 · FIT/PRODUCTO 4 · FINANCIERO 3 |

- ✅ **Encabezados corridos de ComunicArte, confirmados:** la columna J dice `Subcategoría` pero trae texto
  de `Registro 3` (`pendiente onboarding`, `link enviado…`), y hay dos `Subcategoría` (J y N). Se mapea por
  **posición** en esa pestaña y se revisa a mano (080).
- Resultado: `Show = No` → `no_show`; `Show = Sí, Cierre = Sí` → `cerrada`; `Show = Sí, Cierre = No` → `show`
  (la etapa del deal la decide el 080 con la categoría); Show vacío → `agendada` **y rareza** si la fecha ya
  pasó. Sí/si/no se comparan sin mayúsculas.
- Subcategorías con código (`FU-3`, `RD-1`, `FIN-1`) → catálogo de motivos si existe el código; las de texto
  libre (`Follow up programado para martes`) van a `notas`. `Cartera` (2-3 filas) va a `notas`.
- Huella: `sheets:<programa>:registro:<fila>`. Una llamada sin deal al que colgar queda con `deal_id` nulo
  y **listada como rareza**; no se emparejan por cercanía (ADR 0027).

### Estudiantes → deal en Abonado/Completo + abonos

| Pestaña | Filas | Fecha de la venta | Monto | Tipo de pago |
|---|---|---|---|---|
| CA `Estudiantes Agosto` | 30 | **ninguna** | `Precio` (697 ×20, 397 ×4, otros) | Total 30 |
| CA `Estudiantes Septiembre` | 48 | columna `x` sin encabezado (37/48) | `Cash collected` + `Precio final` | total 35 · parcial 12 · vacío 1 |
| TI `Estudiantes Cohort Julio` | 35 | **ninguna** | `Precio` (`$1,500` ×20 … **`Ya pago` ×4**) | Total 25 · **Parcial 10** |
| TI `Septiembre Estudiantes Cohort` | 31 | `Fecha` (25/31) | `Cash collected` + `Precio final` | total 18 · parcial 13 |

- Un deal por estudiante, en la cohorte de la pestaña, etapa **Completo** si lo cobrado cubre el precio y
  **Abonado** si no. Un abono por lo cobrado (`Cash collected`; en Julio/Agosto, `Precio` cuando es Total).
- Montos en USD, con dos formatos (`$1,500` y `1300`): se parsean a número; lo que no es número (`Ya pago`)
  es rareza.
- Plataforma: se empareja sin mayúsculas contra el catálogo (`mercadopago`, `Mercado pago` y `MercadoPago` son
  una). **Combinadas o ambiguas → rareza:** `hotmart / mercadopago`, `Global66/bancolombia`, `dollarapp alejo`,
  `bancolombia alejo`, `Transferencia bancolombia`, `Bootcamp` (4, ¿es una plataforma?).
- `Origen` **no se lee** (se re-deriva del envío, 080): trae `#N/A` ×10 en Julio.
- `Numero de asistentes` y `Factura`/`Acceso`/`Mail onboarding` no se migran. `Mail onboarding = Si` (todo
  Tactical) → ¿`onboarded_at`? (pregunta abajo).
- 🩸 En TI Julio, `Situación profesional` trae **notas de pago** (`segundo pago 17 de agosto`, `Paga 18 de
  Septiembre`, `Pago completo`): son el acuerdo de pago, no una situación. → `acuerdo_pago` como texto, marcado.

### Lo que NO se migra

- `ROAS ESTUDIASTES AGOSTO` (9 filas) y `ROAS COHORT JULIO` (31): son **tablas resumen** (compradores por
  canal, ROAS calculado), no filas de pauta. La atribución se re-deriva; el gasto diario no está ahí.
- `Cartera por cobrar Hotmart` (TI): la API no la encontró con ese nombre (`Unable to parse range`). Buscar el
  nombre exacto con `npm run descubrir`; son 3 personas, sin monto (structure.md §10).

### Preguntas nuevas que salieron de leerlas (se suman a las del 080)

1. **Fecha del abono de Julio (TI) y Agosto (CA)**: no hay columna de fecha. ¿El inicio de ventas de la
   cohorte, marcado como fecha aproximada, o se pide a quien lleva la cartera?
2. **Los 10 `Parcial` de TI Julio** solo tienen `Precio`: no se sabe cuánto se cobró. ¿Se cruza con los
   consolidados de Michael, o entran como rareza sin abono?
3. **Jero, juanse, Sebastian, Michael**: ¿alguno tiene cuenta en el CRM? (La lectura de `users` en producción
   quedó para hacerla con permiso.)
4. **`Bootcamp`** como plataforma de pago: ¿qué es?
5. **`Mail onboarding = Si`** → ¿se marca el deal como onboarded (`onboarded_at`) con fecha desconocida?
