---
id: 029
fase: F1
serves: "ADR 0026 puntos 1-4 y 6; carencia destapada en el recorrido visual del 18-sep"
depends: [003, 019]
status: done
---

# 029 — Anular una llamada, una venta o un abono

## Objetivo
Un registro mal hecho se puede anular desde la app, con motivo, y deja de contar en toda metrica
sin desaparecer del historial de la persona.

## Por que
Hoy no hay **ni un solo `.delete(`** en `lib/`, `app/` ni `scripts/`, y `calls` no tiene columna
para desactivar una fila. Un closer que le da a "Cerrada" por error inventa una venta permanente
que entra en el conteo de ventas, en la caja por fecha de abono y en el comparativo entre closers.
La unica salida es entrar a la base a mano, que es lo que este CRM existe para evitar.

Decision y razones completas en el **ADR 0026**.

## Alcance

- Dentro: migracion que suma `anulado_en timestamptz`, `anulado_por uuid` (FK a `users`) y
  `motivo_anulacion text` a `calls`, `sales` y `abonos`.
- **Dentro, y es el corazon del ticket: `lib/queries/vigente.ts` con EL predicado.** Toda consulta
  sobre esas tres tablas lo importa; ninguna escribe `isNull(anuladoEn)` a mano (ADR 0024).
- **Dentro: test guardian** que recorre `lib/queries/*.ts` y falla si una consulta lee `calls`,
  `sales` o `abonos` sin el predicado. Mismo molde que el guardian de slugs del ticket 009. Sin
  este test, la cuarta consulta que alguien agregue va a inflar las cifras en silencio.
- Dentro: mutacion `anularRegistro` en `lib/mutations/anulaciones.ts`, con la cascada del ADR 0026
  punto 2 (venta → sus abonos; llamada cerrada → su venta → sus abonos) en UNA escritura atomica
  con `ejecutarJuntas`.
- Dentro: permisos del ADR 0026 punto 6 (closer: lo suyo, cohorte activa; gerente: cualquiera) y
  `motivo_anulacion` obligatorio.
- Dentro: UI. En `/personas/[id]` (que deja de ser de solo lectura) y en la lista de ventas y
  abonos de `/mi-dia`. Lo anulado se muestra **tachado, con quien y cuando**, nunca escondido
  (ADR 0026 punto 4).
- Dentro: `change_log` de cada anulacion.
- Dentro: actualizar TODAS las consultas de `lib/queries/dashboard.ts`, `vista-dashboard.ts`,
  `ventas.ts`, `saldo.ts`, `personas.ts` y `nerd-stats.ts`.
- Fuera: borrar del catalogo (es el 030).
- Fuera: editar un registro pasado. Anular deja la huella, editar la borra (ADR 0026).
- Fuera: des-anular. Si se anulo por error se registra de nuevo; un `undo` duplicaria los caminos
  por los que una cifra puede cambiar.

## Done cuando

- [x] Anular una venta anula sus abonos en la misma escritura; la caja recaudada del dia baja en
      el monto correcto.
- [x] Anular una llamada `cerrada` anula su venta y sus abonos.
- [x] Anular un abono NO anula la venta, y el saldo se recalcula solo (sale de `saldo.ts`).
- [x] El test guardian falla si se agrega una consulta sobre esas tablas sin el predicado.
      **Escribirlo ANTES de tocar las consultas** y verlo en rojo: es el unico que demuestra que
      no quedo ninguna sin filtrar.
- [x] `/personas/[id]` muestra lo anulado tachado, con motivo, quien y cuando.
- [x] Un closer no puede anular un registro de otro closer, ni uno de una cohorte cerrada.
- [x] Sin `motivo_anulacion` no se anula.
- [x] `/nerd-stats` y el dashboard dan las mismas cifras entre si despues de una anulacion.
- [x] Ningun test existente cambia de resultado.

## Como quedo (18-sep)

- Migraciones **0013** (las tres tablas suman `anulado_en`, `anulado_por`, `motivo_anulacion`, con
  un `CHECK` por tabla que exige los tres juntos) y **0014** (`sales.call_id`, ver ADR 0027).
  Aplicadas en **`dev` y `production`** (las dos ramas en 15), y en ese orden: primero la
  migracion, despues el push. Al reves el despliegue habria reventado con *column does not exist*,
  porque cada consulta del embudo ya filtra por `anulado_en`.
- El guardian resulto cubrir mas de lo que pedia el ticket: mira `lib/`, `app/`, `components/` y
  `scripts/`, no solo `lib/queries/`. Ensancharlo destapo **cuatro lecturas en `lib/mutations/`**
  que el alcance original habria dejado fuera.
- **Hueco del ticket, resuelto con ADR 0027:** `sales` no sabia de que llamada nacio, asi que la
  cascada "llamada cerrada → su venta" no se podia cumplir. Se agrego la columna y el caso de las
  filas viejas se rechaza con mensaje en vez de adivinar.
- **`ventasDePersona` se partio en dos** (`ventasDePersona` para `/mi-dia`, `ventasParaHistorial`
  para `/personas/[id]`): son dos preguntas distintas desde que existe la anulacion.
- **`production` tiene ~4.600 personas y cero llamadas, ventas y abonos**, asi que alla la
  anulacion todavia no tiene nada que tocar. Lo unico del ticket que no se ejercito contra esa base
  es abrir el dashboard desplegado con sesion; el login es de Mani.
- Recorrido visual hecho el 18-sep. Tres hallazgos, los tres arreglados: la pantalla no se
  refrescaba tras anular (`revalidatePath` que no coincidia con nada), tres botones "Anular"
  identicos apilados bajo cada venta, y una venta anulada que seguia mostrando "Saldo pendiente".

## Notas

⚠️ **El riesgo de este ticket no es escribir la anulacion: es olvidar una consulta.** Una cifra
inflada se ve creible y no lanza ningun error. Es el mismo fallo que costo la primera version de
`/nerd-stats` (conteos en cero, sin excepcion, destapados por un test que ya estaba escrito). De
ahi que el guardian vaya primero y en rojo.

La migracion la genera y aplica la **sesion principal**, nunca un subagente (AGENTS.md).
