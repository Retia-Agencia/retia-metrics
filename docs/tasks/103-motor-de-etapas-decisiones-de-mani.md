---
id: 103
etapa: E2
serves: "ADR 0037 · decisiones de Mani del 27-sep (ticket 045, sección ⚠️)"
depends: [045, 046, 047]
status: todo
---

# 103 — El motor de etapas con las decisiones de Mani del 27-sep

## Por qué existe

El 27-sep dos sesiones trabajaron E2 en paralelo sobre el mismo `main`. Quedó el motor de Alejandro
(`lib/deals/mover-etapa.ts`), que está bien armado: transacción real, reja de concurrencia, hechos leídos
de la base, historial en la misma operación, guardián. Pero Mani tomó cinco decisiones en la otra sesión
que el motor no tiene, y dos de ellas lo contradicen. Ninguna de las cinco lanzaría un error: son
cifras que se ven creíbles y están mal.

## Lo que hay que cambiar

1. **Cohorte destino como columna aparte** (Mani: "guarda las dos"). Hoy Próxima Cohorte exige que
   `deals.cohort_id` sea una cohorte `futuro`, o sea que el deal **se muda** de cohorte. Eso le quita el
   deal a la conversión de su cohorte de origen. Nueva columna `deals.cohorte_destino_id` (FK a
   `cohorts`, `restrict`); `cohort_id` sigue siendo la de origen. T19, T20, T21 y T28 exigen la destino.
2. **Motivos en cuatro listas.** `motivos` gana `tipo` (`pgEnum`: `perdida`, `reagenda`, `retroceso`,
   `recuperacion`), porque el motor decide con él (ADR 0012: tipo en código, instancias en la base). Lo
   existente queda `perdida`. El índice único pasa a `(tipo, lower(nombre))`. El motor rechaza un motivo
   de la lista equivocada: P pide `perdida`, T29 `reagenda`, T15 `retroceso`, R `recuperacion`. La
   pantalla del catálogo elige el tipo.
3. **Mueven solo el dueño y los administradores**, y lo revisa el motor (Mani). Hoy el motor distingue
   sistema de persona pero deja "quién puede mover qué deal" a quien lo llame, que es la segunda puerta
   que alguien olvida. El `Actor` usuario trae su rol de vista; pasa si es el dueño o si
   `esAdministrador`. Un deal sin dueño solo lo mueve el sistema hasta que alguien lo reclame. El 403 dice
   la regla.
4. **Las llamadas cuentan desde que el deal entró a su etapa.** `llamadaSucedio` y `tieneLlamadaConFecha`
   miran TODAS las llamadas del deal. Con "un deal, muchas llamadas" (ADR 0037) eso falla en la segunda
   llamada: un deal que vuelve a Agendado desde Seguimiento (T27) puede pasar a Atendido (T10) con el
   `show` de la primera llamada, sin que la segunda haya ocurrido. Mismo criterio que ya usa el contacto
   (T1, T22): desde `entradaALaEtapaActual`.
5. **`deals.motivo_id` se escribe al perder** (P), en la misma transacción. Hoy el motivo queda solo en el
   historial y la ficha del deal no lo tiene.

## ✅ Confirmado por Mani el 27-sep

6. **El requisito se llena en el mismo movimiento, como en HubSpot.** Hoy `moverEtapa` solo lee hechos:
   para pasar a Seguimiento, la pantalla primero tiene que escribir la fecha (otra escritura) y después
   mover. Si la segunda falla, queda la fecha puesta y el deal sin mover. Propuesta: `moverEtapa` acepta
   los datos que la flecha pide (producto, fecha límite, acuerdo, cohorte destino, fecha de seguimiento),
   los escribe por `editarConRastro` y mueve, todo en la misma transacción. Lo que PRUEBA un hecho
   (llamadas, contactos, abonos) se sigue leyendo de la base, nunca del input.

## Alcance

- **Dentro:** una migración (`0026`, la genera y aplica la sesión principal) con el punto 1 y el 2; los
  cambios en `lib/deals/requisitos.ts` y `lib/deals/mover-etapa.ts`; el tipo en `lib/catalogo/motivos.ts`.
- **Fuera:** pantallas. El selector de tipo en `/ajustes` puede ir aquí solo si cabe sin rediseño.

## Done cuando

- [ ] Cada punto tiene su test en los dos sentidos, en `tests/mover-etapa.test.ts` o
      `tests/deal-requisitos.test.ts`.
- [ ] El punto 4 tiene el caso de la segunda llamada: un `show` viejo no lleva a Atendido.
- [ ] El punto 3 se prueba con un closer que no es dueño (403), el dueño (pasa), un administrador (pasa)
      y un deal sin dueño movido por una persona (403).
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí para código y tests, con revisión. La migración, no (AGENTS.md).
