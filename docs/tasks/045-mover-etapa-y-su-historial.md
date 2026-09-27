---
id: 045
etapa: E2
serves: "plan v2 §6 etapa 2 · tarea E2-3 · ADR 0037, ADR 0042"
depends: [043, 044]
status: done
---

# 045 — `moverEtapa()`: el unico camino para cambiar `deals.etapa`

## Objetivo

Una funcion que valida la transicion (043), valida el requisito (044), escribe la etapa **y** su
fila en `deal_etapa_historial`, todo junto. Nadie mas escribe esa columna.

## Por que un modulo unico — la decision de arquitectura mas importante del plan

**Tres escritores mueven etapas:** el sync (insumo §3.1), el closer, y el sistema al registrar un
abono. Si cada uno implementa el requisito, **divergen en silencio**. Ya paso dos veces aqui: el
saldo escrito en dos sitios con la reja y la pantalla dando cifras distintas (ADR 0024), y la
vigencia olvidada en una consulta, que infla una metrica sin lanzar un error (ADR 0026).

## Alcance

- **Dentro:** `moverEtapa(dealId, a, { actor, motivo })` en `lib/deals/etapas.ts`.
- **Dentro:** la fila de historial **en la misma operacion** que el cambio. No hay forma de mover
  sin dejar rastro (ADR 0042).
- **Dentro:** el error cuando no se puede, con **el requisito que falta nombrado** y no un "no
  permitido" a secas.
- **Dentro:** el actor sale de la sesion (o `actorDelScript()`), nunca del input.
- **Fuera:** quien la llama. El sync la llama en el ticket 052, el closer en la etapa 6, el dinero
  en el ticket 060.

## La trampa del driver

La base es `neon-http`: **sin transacciones interactivas**. El cambio de etapa y su fila de
historial no se pueden envolver en un `BEGIN` con logica adentro. Se escriben juntos por lotes
(`ejecutarJuntas`, el molde de F-04) o con la fila de historial primero y la etapa despues, de
forma que un fallo a mitad deje **historial de mas** y nunca **etapa sin historial**. Sobra un
renglon de bitacora; falta una conversion.

## Done cuando

- [ ] `moverEtapa` es la unica funcion que escribe `deals.etapa` (lo vigila el ticket 046).
- [ ] Cada transicion del insumo §3 tiene test en los dos sentidos: la permitida pasa, la prohibida
      se rechaza **nombrando el requisito que falta**.
- [ ] Todo movimiento deja su fila de historial, **probado matando la escritura de la etapa** para
      ver que el historial no queda huerfano al reves.
- [ ] Cero UI: el modulo se prueba sin navegador.

## Kiro

Parcial. Los tests si, con revision. El diseno del contrato, no.

---

## ✅ Cerrado 2026-09-27

- **`lib/deals/mover-etapa.ts`**, no `etapas.ts`: la tabla de transiciones se queda pura y el motor que
  escribe vive aparte (la ADR 0037 y `structure.md` §4.1 ya dicen la ruta nueva).
- **Transaccion de verdad** (ADR 0047), no el truco de `neon-http` que describe arriba: la etapa y su
  fila de `deal_etapa_historial` van juntas o no van. Probado haciendo fallar el historial despues del
  update (FK de un actor que no existe) y, mordido, quitando la transaccion.
- **El rastro es `deal_etapa_historial`, no `change_log`** (`lib/crm/rastro.ts` lo decia): por eso el
  motor es la excepcion nombrada de `tests/rastro-operativo.test.ts`.
- **Los hechos los lee el motor, nunca el llamador.** Quien mueve es un `Actor` (`sistema` o un
  `usuario` de la sesion) y el motor rechaza con 403 que una persona tome una flecha del sistema (a
  Atendido, Abonado, Completo) o que el sistema tome una de closer.
- **Reja de concurrencia en la base:** el update lleva `where etapa = de`; si otro movio el deal entre la
  lectura y la escritura, 409 en vez de pisarlo.
- **A1** vuelve a la etapa de donde vino Abonado segun el historial; otro destino es 409.
- **Migracion 0025** (aplicada en `dev`): `deals.acuerdo_pago` y `deals.fecha_limite_pago` (ADR 0053,
  adelantadas del 061) y `deals.fecha_seguimiento` (T24).
- **Cohorte destino sin columna nueva:** Proxima Cohorte exige que `deals.cohort_id` sea una cohorte
  `futuro`. Ir ahi ES pasar el deal a vender la siguiente cohorte, y el cambio queda en `change_log`.
- **"La llamada sucedio"**, mientras `calls` no tenga el link de Grain (058): una llamada vigente con
  resultado `show`, `compromiso_pago`, `cerrada` o `perdida`.
- **`lib/queries/saldo.ts` vuelve** (ADR 0024): precio del producto menos abonos vigentes; con abonos en
  otra moneda el saldo es `null`, nunca una conversion en silencio.
- Pendiente para quien llame (052, 060, UI): la primera fila de historial al crear un deal (`de` nulo),
  y `deals.motivo_id` al perder (hoy el motivo queda solo en el historial).
- `tests/mover-etapa.test.ts`: 14 tests.

## ⚠️ Decisiones de Mani del 27-sep que CORRIGEN lo cerrado arriba (van al ticket 103)

Se tomaron en otra sesión, en paralelo, sin saber que el 045 ya estaba cerrado. **Mandan sobre lo de
arriba** donde chocan: A contradice "cohorte destino sin columna"; C y los permisos no están en el motor.

El 044 dejó los requisitos como predicados puros sobre `HechosDelDeal` (`lib/deals/requisitos.ts`).
El 045 decide **dónde vive cada hecho**, y tres respuestas ya están tomadas:

- **A. Próxima Cohorte guarda las dos cohortes**, la de origen y la destino. El deal no "se muda" en
  silencio: así la conversión de la cohorte de origen no pierde el deal, y se puede leer "de la cohorte 5
  se pasaron 12 a la 6". Hace falta una columna para la cohorte destino (migración de la sesión principal).
- **B. La fecha de seguimiento es del DEAL**, no de la llamada: una sola "próxima vez que lo contacto", que
  es lo que lee el Inbox. `calls.fecha_seguimiento` queda para lo histórico de la hoja.
- **C. Motivos en listas distintas** para perdido (P), otra llamada (T29) y "se echó para atrás" (T15):
  sin eso, el reporte de "por qué perdemos" se mezcla con los de re-agenda. El catálogo `motivos` hoy es uno
  solo y no tiene tipo: hay que decidir si gana una columna de tipo o se parte (molde del ADR 0012).
- **D. Recuperar (R) exige un motivo de una cuarta lista, "recuperación"** (¿por qué volvió?).
- **E. Mueven el dueño del deal y los administradores**, y lo revisa el motor, no la pantalla. Un deal
  sin dueño lo mueve solo el sistema hasta que alguien lo reclame.
- La B coincide con la 0025 (`fecha_seguimiento` en el deal, como `date`).
