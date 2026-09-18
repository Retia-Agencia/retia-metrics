---
id: 029
fase: F1
serves: "ADR 0026 puntos 1-4 y 6; carencia destapada en el recorrido visual del 18-sep"
depends: [003, 019]
status: todo
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

- [ ] Anular una venta anula sus abonos en la misma escritura; la caja recaudada del dia baja en
      el monto correcto.
- [ ] Anular una llamada `cerrada` anula su venta y sus abonos.
- [ ] Anular un abono NO anula la venta, y el saldo se recalcula solo (sale de `saldo.ts`).
- [ ] El test guardian falla si se agrega una consulta sobre esas tablas sin el predicado.
      **Escribirlo ANTES de tocar las consultas** y verlo en rojo: es el unico que demuestra que
      no quedo ninguna sin filtrar.
- [ ] `/personas/[id]` muestra lo anulado tachado, con motivo, quien y cuando.
- [ ] Un closer no puede anular un registro de otro closer, ni uno de una cohorte cerrada.
- [ ] Sin `motivo_anulacion` no se anula.
- [ ] `/nerd-stats` y el dashboard dan las mismas cifras entre si despues de una anulacion.
- [ ] Ningun test existente cambia de resultado.

## Notas

⚠️ **El riesgo de este ticket no es escribir la anulacion: es olvidar una consulta.** Una cifra
inflada se ve creible y no lanza ningun error. Es el mismo fallo que costo la primera version de
`/nerd-stats` (conteos en cero, sin excepcion, destapados por un test que ya estaba escrito). De
ahi que el guardian vaya primero y en rojo.

La migracion la genera y aplica la **sesion principal**, nunca un subagente (AGENTS.md).
