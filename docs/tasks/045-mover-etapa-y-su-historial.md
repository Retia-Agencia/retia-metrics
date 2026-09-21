---
id: 045
etapa: E2
serves: "plan v2 §6 etapa 2 · tarea E2-3 · ADR 0037, ADR 0042"
depends: [043, 044]
status: todo
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
