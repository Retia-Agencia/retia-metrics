# 0007 — El cron de sync corre una vez al dia, no cada 15 minutos

**Fecha:** 2026-09-14

El diseno original pedia sincronizar cada 15 minutos para que el dashboard estuviera casi en vivo.
El plan Hobby de Vercel no permite crons mas frecuentes que uno por dia.

**Decidimos correr el cron una vez al dia, a las 12:00 UTC (7am Colombia)**, y dejar el boton
"Sincronizar ahora" de `/ajustes/fuentes` como la valvula para forzarlo cuando haga falta.

Se registra porque cambia una suposicion del producto: el dashboard no es tiempo real, es una foto
diaria mas lo que el gerente refresque a mano. Cualquier feature que asuma frescura de minutos
(una alerta de "el registro de llamadas lleva 48h vacio", por ejemplo) tiene que contar con eso.

**Como se revierte:** subir de plan en Vercel y cambiar el `schedule` en `vercel.json`. No hay
nada en el codigo atado a la frecuencia; el cron es idempotente y correrlo mas seguido no rompe
nada.

## Enmienda 2026-09-21 (plan v2, ADR 0040): el cron diario pasa a ser la red, no el mecanismo

**No queda `superseded`: queda rodeado.** El cron diario se conserva tal cual, con su `schedule` en
`vercel.json`, y por la misma razon de siempre — **verificado por API el 21-sep: el team
`agencia-dani` sigue en plan `hobby`**, asi que los 15 minutos no existen sin pagar Pro.

Lo que cambia es su **papel**. Ahora hay cuatro capas sobre la misma funcion HTTP: el aviso
`onChange` de la hoja (el mecanismo principal), el sync perezoso al abrir la app, el boton manual,
y este cron como **red de seguridad**.

La frase de este ADR *"el dashboard no es tiempo real, es una foto diaria mas lo que el gerente
refresque a mano"* se sustituye por: **el dashboard se refresca cuando la hoja cambia**, y el cron
existe para cuando el aviso no llegue. Lo que **sigue siendo cierto** es la advertencia del final:
la garantia dura sigue siendo diaria, asi que una funcion que dependa de frescura de minutos tiene
que degradar bien en vez de romperse. Detalle completo y su parte de seguridad, en el **ADR 0040**.
