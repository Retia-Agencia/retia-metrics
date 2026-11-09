# 0129 — El MCP del CRM es una puerta total con reglas de orientación, no una interfaz rígida

- **Estado:** aceptada como principio · 9-nov-2026 (pedido de Mani tras usar el MCP en Ventas Francisco); el diseño concreto queda en el ticket 411 con sus decisiones abiertas D1 a D6.
- **Enmienda:** ADR 0119 (el MCP del CRM) en lo que dice «solo lectura» y «once herramientas». Relacionadas: ADR 0042 (rastro), ADR 0117 (deshacer), ADR 0025 (developer), ADR 0043 y 0048 (programa y alcance), ADR 0115 (N1, N2, N8), tickets 348, 383, 384, 385, 386, 411.

## Contexto

El MCP nació como once consultas de solo lectura, cada una pensada para una pregunta (ADR 0119, ticket 348). El 9-nov, para
comprobar un traspaso de lead entre dos closers, hicieron falta ~18 llamadas: el servidor respondió en menos de ~2 s cada
una, pero la forma del MCP obligó a buscar por programa, abrir fichas una a una, adivinar el nombre de un parámetro y leer
cinco veces las mismas opciones. Además, un filtro con un nombre devolvió cero resultados sin error. Mani lo planteó así:
*«este MCP NO debe poner limitaciones sobre las acciones ni métricas consultados; no es una interfaz rígida, sino una puerta
de entrada con reglas de orientación que permiten tener visibilidad completa y control total sobre el CRM según el rol.»*

## Decisión

1. **Capacidad de la app = capacidad del MCP, por rol.** Todo lo que una persona puede ver o hacer en la app con su rol, lo
   puede ver o hacer por el MCP. Las excepciones se nombran y se justifican (p. ej. emitir tokens, secretos de fuentes).
2. **Las herramientas son puertas, no preguntas.** Pocas herramientas de alto alcance (buscar, consultar hechos con
   dimensiones, acciones con vista previa), no una por pregunta. Los filtros aceptan nombre o id y fallan con un mensaje que
   dice qué corregir; **nunca devuelven vacío por un valor que no entendieron**, y todo filtro por defecto se declara.
3. **Las reglas de orientación no se relajan:** rol y alcance dictados por el servidor en cada llamada, el programa como
   frontera (404, no 403), el developer sin restricción, una sola definición por cifra (N1) y la lectura por las mismas
   consultas que las pantallas. Una herramienta flexible no cruza programas: el tipo de la consulta lo impide.
4. **Escribir sigue pidiendo vista previa, confirmación humana en el chat, rastro con origen `mcp` y deshacer** (ADR 0119
   punto 8, ticket 384). «Sin límites» no quita la confirmación; quita la lista cerrada de lo que se puede hacer.
5. **La cobertura se vigila con un guardián,** no con la memoria de nadie: una capacidad de la app sin equivalente en el MCP
   (o sin excepción nombrada) falla un test.
6. **Se mide:** duración en servidor, bytes de respuesta y consultas por llamada, por herramienta.

## Consecuencias

- El ticket 384 (escrituras) pasa a ser la fase F2 del 411; el 386 y el 387 se reordenan detrás (D4 pendiente de Mani).
- `docs/mcp.md` se reescribe en el mismo commit que el código (§3, §4 puntos 7, 8 y 20, §7). Mientras tanto, lo que diga que el
  MCP es «solo lectura» o de «once herramientas» describe el estado de hoy, no el destino.
- Riesgo asumido: más superficie de escritura. Se compensa con confirmación, rastro, deshacer y petición forjada por rol.
