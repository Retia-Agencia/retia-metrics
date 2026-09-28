---
id: 052
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-5 · insumo §3.1, ADR 0037"
depends: [051, 045]
status: done
---

# 052 — La regla de creacion y movimiento de deals del sync

## Objetivo

Que el sync cree y mueva deals segun el `estado` que trae la hoja, **llamando al motor de la etapa
2** y nunca escribiendo `deals.etapa` por su cuenta.

## La tabla (insumo §3.1)

| Evento del sync | Movimiento |
|---|---|
| `estado` = Setteo No Calificado, Lead **sin deal abierto** | crea deal en **Pendiente Setteo** |
| `estado` = Con Calendly, Lead **sin deal abierto** | crea deal en **Agendado** + Call `agendada` sin fecha, **Unclaimed** |
| `estado` = Con Calendly, Lead con deal en 1, 2 o 9 | **mueve a Agendado** + crea la Call (🩸 **9 casos medidos** de Setteo → Calendly que hoy nadie ve) |
| `estado` = Descartado o vacio | **no crea deal**; el Lead queda con su tag |
| re-envio del mismo Lead con deal en 4 o mas | **no mueve**; notifica al owner y guarda el envio |

## Alcance

- **Dentro:** la regla completa, como funcion que decide y delega.
- **Dentro:** la Call `agendada` sin fecha la crea el sync (su forma es el ticket 057).
- **Dentro:** la notificacion al owner cuando un deal avanzado recibe un re-envio (el dato; el
  canal es de la etapa 6).
- **Fuera:** validar transiciones o requisitos. Eso ya lo hace `moverEtapa()`.

## La regla que no se rompe

⚠️ **Ni una sola escritura de `deals.etapa` en este ticket.** El sync es uno de los tres escritores
que el ADR 0037 nombra; si implementa el requisito por su cuenta, diverge del closer y del dinero
**en silencio**. El guardian del ticket 046 lo caza, pero el criterio esta aqui.

## Done cuando

- [x] Cada fila de la tabla de arriba tiene su test.
- [x] Los 9 casos de Setteo → Calendly producen el movimiento y **su fila de historial** (con envíos
      sintéticos, ver la enmienda del 27-sep; el envío real llega con el 106).
- [x] Un `estado` Descartado no crea deal, ni siquiera cerrado.
- [x] `grep` confirma que este modulo no escribe `deals.etapa`.

## Kiro

Si, con revision.

---

## Enmienda 2026-09-24 (ADR 0049 y decisión de los deals históricos)

- **"Con Calendly" ya no crea la Call sin fecha para que el closer la complete:** el deal nace en
  Agendado y la Call llega de Calendly con su fecha real (ticket 096). Si la integración no existe
  todavía, el closer crea la Call a mano.
- **Deals históricos (decidido por Mani):** esta regla abre deals **solo para leads nuevos desde el
  corte**. Los leads viejos de Setteo entran con la migración de la etapa 7 respetando su estado de
  gestión (ticket 080), no como ~2.400 deals iguales en Pendiente Setteo.
- "Re-envío con deal en 4 o más" se lee con la lista explícita: deal en 4, 5, 6 o 7 (ninguna regla
  compara números de etapa).

---

> **27-sep:** crear un deal tambien es escribir su etapa, asi que el sync **abre con `abrirDeal()`**
> (`lib/deals/mover-etapa.ts`, ticket 047) con actor `sistema`, en Pendiente Setteo o Agendado, y mueve
> con `moverEtapa()`. `crearConRastro` rechaza un deal con etapa si no viene del motor.

---

## Enmienda 2026-09-27, noche (ADR 0054 enmendado, D4 cerrada)

- **La regla lee `leads.calificacion`**, con los tres valores del 051, no el texto de `leads.estado`:
  `descartado` no abre deal, `setteo_no_calificado` abre en Pendiente Setteo, `con_calendly` abre en
  Agendado (o mueve a Agendado desde 1, 2 o 9). Sin calificación: no abre nada.
- **La llama la ingesta, no "el sync":** `ingerirEntradas` aplica la regla solo cuando se lo pide su
  llamador. El webhook (106) la pide; el traslado desde Sheets **no**, porque los leads viejos entran
  por el 080 con su estado de gestión (decisión de Mani del 24-sep, arriba).
- "Los 9 casos de Setteo → Calendly de `dev`" del Done se prueban con envíos sintéticos: sin sync vivo,
  en `dev` ya no llegan envíos nuevos que los produzcan.

---

## Avance 2026-09-28 (Kiro, revisado por la sesión principal)

- **Hecho:** `lib/ingesta/regla-de-deals.ts` (`decidirAccionDeDeal` pura + `aplicarReglaDeDeal`, que abre
  con `abrirDeal()` y mueve con `moverEtapa()`, actor sistema). La llama `ingerirEntradas` solo con
  `aplicarReglaDeDeals: true` (el webhook sí, el traslado no), dentro de la misma transacción y después
  de recalcular el lead. 22 tests. La revisión corrigió una lectura de `deals` sin `vigente(deals)` que
  cazó el guardián de vigencia.
- 🔴 **Lo que falta, con causa encontrada:** con `con_calendly` y un deal en Pendiente Setteo, el motor
  **rechaza** el movimiento a Agendado porque esa flecha exige una llamada con fecha (`requisitos.ts`).
  La regla no tumba la ingesta: guarda el envío y deja el rechazo en `reglaDeDeals[].rechazo`, que hoy
  **nadie ve**. Son los 9 casos medidos de Setteo → Calendly.
- **Asimetría del motor:** abrir un deal NUEVO directo en Agendado sí se permite sin llamada; moverlo ahí
  desde Setteo no. El mismo hecho ("agendó por Calendly") se acepta o se rechaza según si el lead ya
  tenía deal.
- **La fecha no viene en el link** (verificado el 28-sep en la hoja de Tactical, columna "Agenda aquí tu
  entrevista"): es `https://calendly.com/d/<evento>/<nombre>/invitees/<uuid>`, sin fecha. Se lee
  preguntándole a la API de Calendly por ese invitado, que pide un token (decisión A5, ticket 096).
  Mani (28-sep) quiere usar la fecha de Calendly; falta el token. Opción descartada por ahora: dejar que
  el sistema entre a Agendado sin fecha (afloja una regla del motor).

> **28-sep, más tarde: resuelto el camino.** Los tokens de Calendly de los dos programas funcionan (rol
> `owner`, ven todas las citas) y los 10 ids de invitado probados de la hoja de Tactical aparecieron en la
> API con su fecha. Mani: el token vive en la base, en el programa (ADR 0057, ticket **109**). Con el 109
> hecho, la regla crea la llamada con su fecha y el movimiento Setteo → Agendado pasa el motor.

---

## Cierre 2026-09-28 (Kiro)

**Hecho.** La regla ya lee la cita real de Calendly y pasa el motor sin aflojarlo. Cambios:

- **`lib/calendly/cita.ts`:** `fechaDeCita` → **`citaDeCalendly`**, que devuelve `{ inicio: Date;
  cancelada: boolean } | null`. `cancelada` es `true` si el evento o el invitado están en `status:
  "canceled"`. Se conserva todo lo demás (uuid exacto, paginación, `ErrorDeCalendly` visible, nunca
  `null` silencioso). Tests actualizados en `tests/calendly-cita.test.ts`, más los dos casos de
  cancelación (evento y invitado).
- **La consulta a Calendly va FUERA de la transacción de ingesta** (una llamada HTTP dentro retiene
  una conexión del pooler). El webhook, antes de `ingerirEntradas`, para cada envío "Con Calendly"
  (el adaptador ahora expone `linkAgenda`), lee `programs.calendly_token` con una consulta propia (NO
  `listarProgramas`, que lo oculta), resuelve la cita con `lib/calendly/resolver-cita.ts` y arma el
  mapa `citasPorCorreo` (correo normalizado → `ResultadoCita`) que le pasa a la ingesta. El token no
  se loguea ni sale en la respuesta; el fetch es inyectable (los tests lo stubean, cero red).
- **La regla** (`decidirAccionDeDeal` puro + `aplicarReglaDeDeal`): con cita **vigente** abre en
  Agendado o mueve a Agendado desde 1/2/9, **creando antes** la llamada (`calls` con `dealId`,
  `programId`, `cohortId` del deal si aplica, `emailLead`, `fechaAgenda = inicio`, `resultado agendada`,
  sin closer, `origen calendly`, `huellaFila = calendly:<uuid>`) por `crearConRastro`. La llamada
  cumple `llamada_con_fecha`, así que `moverEtapa` pasa **sin tocar el motor**. Abrir directo en
  Agendado también crea su llamada (quita la asimetría). Con cita **cancelada / no encontrada / error**
  el deal se queda o se abre en Pendiente Setteo, sin llamada, con la nota lista.
- **Reenvío idempotente:** el índice `calls_huella_idx` (por programa + huella `calendly:<uuid>`)
  impide duplicar la llamada; `crearLlamadaDeCita` captura la violación única y no crea una segunda.
  Además, tras el primer envío el deal queda en Agendado (avanzado), así que un reenvío del mismo
  `con_calendly` cae en `notificar_reenvio` y ni siquiera intenta crear la llamada.

**La NOTA (resuelto por la sesión principal, 28-sep, con el ok de Mani).** Kiro la dejó solo en el
resultado de la ingesta porque `deal_actividades.user_id` era NOT NULL. Así se perdía: el resultado solo
viaja en la respuesta del webhook. **Migración 0032** (aplicada en producción): `deal_actividades.user_id`
acepta nulo = el sistema (como `deal_etapa_historial.user_id` y `deals.creado_por`), y el CHECK
`deal_actividades_contacto_con_usuario` impide que el sistema registre un **contacto** (que es lo que
habilita En Contacto): el sistema solo deja notas. `aplicarReglaDeDeal` escribe la nota con
`dejarNota()` por `crearConRastro`, sobre el deal nuevo o el deal en 1/2/9 que se queda donde está.

**Verificación (revisión de la sesión principal):** `npm test` **1.017** pasando, `npm run typecheck`,
`npm run lint` y `npm run build` limpios. `resolverCitaDeEnvio` probado contra **Calendly real** con el
token de Tactical guardado en la base: una cita activa sale `vigente` con la fecha exacta, una cancelada
sale `cancelada`, un uuid falso `no_encontrada` y un token malo `error`.

**Lo que queda fuera, a propósito:**

- **La prueba de punta a punta con un envío real** llega con el 106 (fuente webhook creada, URL y
  secreto en Typeform, un envío de prueba). Hasta entonces el payload de los tests es inventado.
- **Nadie ve todavía la nota ni el aviso de re-envío:** no existe pantalla de deal. El botón "buscar
  llamada" y el dropdown de llamadas de Calendly son del 096 (pedido de Mani anotado ahí).
- ⚠️ Caso raro sin test: un lead con el deal CERRADO que reenvía el MISMO envío abre un deal nuevo en
  Agendado, y su llamada choca con la huella `calendly:<uuid>` de la del deal viejo: el deal nuevo
  queda en Agendado sin llamada. Hace falta el mismo uuid de invitado dos veces; se revisa si aparece.
