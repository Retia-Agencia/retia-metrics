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
