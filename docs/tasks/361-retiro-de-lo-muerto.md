---
id: 361
etapa: plataforma
serves: "ADR 0115 N7 · auditoría 30-oct R-02, R-10, R-11, R-13, K-12, G-14"
depends: []
status: todo
---

# 361 — Retiro de lo muerto, y el guardián del diccionario

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **R-02:** `lib/queries/hechos/abono.ts`, `lib/queries/hechos-embudo.ts` y `embudoPorCanal` (`dashboard.ts:648`) no los
  llama nadie fuera de tests, y `metricas.md` §1.3, §1.5 y §3.1 los cita como canónicos.
- **R-11:** sin llamadores: `dealsPerdidosPorMotivo`, `periodoAnterior` (`serie.ts`), `programaActivoPorSlug`,
  `programaPorSlug`, `avisoDelFormulario`, `colorDeCupos`, `linkFijoDelCreador`, `lib/auth/closer.ts`,
  `components/admin/canales-admin.tsx`, `components/deals/boton-de-etapa.tsx`, `descripcion-de-destino.ts`,
  `dialogo-anotar.tsx`, `components/perfil-propio.tsx`, `components/proxima-fase.tsx`, `components/ui/separator.tsx`,
  `lib/abonos/plataforma.ts`.
- **R-10:** `/ajustes/areas` enlazada (`ajustes/page.tsx:44`) administra una tabla que ninguna métrica lee y habla del
  "origen declarado", retirado; `ajustes/canales/acciones.ts` solo lo usa el componente muerto; los comentarios de
  `lib/ingesta/calificacion.ts`, `estado.ts` y `adaptador-typeform.ts` citan `estados_llegada`, borrada en la 0059.
- **R-13:** dos sistemas de color para cupos (`colorDeCupos` muerto) y las alertas con su umbral propio sin documentar.
- **K-12 / G-14:** las rutas viejas de Dashboard y Metas siguen con guardas distintas a las del Hub; se borran el 14-nov
  (`docs/operations.md`).
- **Del 362 (30-oct):** `/ajustes/canales` redirige a `/hub?seccion=origen`, que es el Hub de "todos los programas" y
  se guarda con `paginaConRol("gerente", "closer")`: un paid trafficker con el enlace viejo no pasa, aunque el 248
  dice que la pestaña Origen es suya. Y `tests/ingesta-estado.test.ts:44` todavía dice que `estados_llegada` sigue en
  el esquema.

## Alcance

1. Un commit de retiro por grupo, sin mezclar con otros cambios. Antes de borrar cada pieza, grep de llamadores.
2. `/ajustes/areas` y las tablas `areas`/`canales`: si nadie las lee, migración que las quite (primero el código sin
   ellas, luego la migración, con `lock_timeout`).
3. Las rutas viejas se borran el 14-nov; hasta entonces, la misma guarda que `hub/lista`. `/ajustes/canales`, hasta
   borrarse, redirige al Hub › Origen del primer programa visible (`/p/<programa>/hub?seccion=origen`), donde sí entra
   el paid trafficker.
4. Guardián del diccionario (N7): recorre `docs/metricas.md`, extrae cada función citada en backticks y falla si no
   existe o si no tiene un llamador fuera de `tests/`.

## Done cuando

- [ ] Guardián del diccionario en verde y mordido (una función inventada en el doc lo hace fallar).
- [ ] Grep limpio de cada pieza borrada; typecheck, lint y `npm run build`.
- [ ] Ningún comentario de `lib/` ni de `tests/` dice que `estados_llegada` existe (los guardianes que la nombran para
      vigilar que nadie la lea se quedan).
- [ ] Un paid trafficker que abre `/ajustes/canales` llega a Hub › Origen de su programa (forjado con su sesión).
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
