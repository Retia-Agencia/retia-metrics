---
id: 269
etapa: hub
serves: "ADR 0089 · Mani, 15-oct: un solo envío por hora que contenga los mensajes de los tres programas"
depends: [268]
status: todo
---

# 269 — Un mensaje por hora con todos los programas

## Objetivo

Que a cada hora llegue **un solo** mensaje al grupo de alertas de paid con los programas que tocan a esa hora, uno
debajo del otro y bien separados, en vez de un mensaje por programa (5 horas × 3 programas = 15 mensajes al día).

## Decisiones (Mani, 15-oct)

1. Cada programa conserva su bloque tal cual lo arma `armarMensaje` (267): encabezado con su nombre, color,
   cifras y enlace a su Hub. Lo que cambia es que se mandan juntos.
2. El texto consolidado lo arma **el CRM** (un solo dueño del texto, como en el 267): el endpoint devuelve, por
   hora, un envío con el `texto` de todos los programas que tocan, en el orden de los programas, separados por
   una línea en blanco y un separador visible. La vista previa de Programa › General sigue mostrando el bloque del
   programa (la consolidación es de la entrega, no del programa).
3. Si un programa falla al calcular, su bloque dice el error y los demás salen igual (el comportamiento de hoy,
   ahora dentro del mismo mensaje).
4. Juanito no cambia más allá de mandar lo que llega (ya manda `texto` al grupo único del 268).

## Done cuando

- [ ] `tests/semaforo-endpoint.test.ts`: dos programas a la misma hora salen en un solo envío con los dos bloques;
      un programa con error no tumba al otro; la lista blanca sigue mordiendo.
- [ ] Recorrido: la vista previa no cambia; el endpoint local con dos reportes encendidos a la misma hora devuelve
      un envío.
- [ ] En producción con el 268 desplegado: a la siguiente hora llega un solo mensaje al grupo.

## Fuera

- El presupuesto del día (espera la respuesta de Pauta).
