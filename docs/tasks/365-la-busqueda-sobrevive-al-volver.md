---
id: 365
etapa: crm
serves: "Michael Castellanos, Daily Tech del 31-oct · A-172 · A-105 (la pieza de búsqueda y filtros) · ticket 'que toda lista sepa volver' (`enlaceConVuelta`)"
depends: []
status: todo
---

# 365 — La búsqueda de una lista sobrevive al abrir una ficha y volver

## Por qué (dicho en la reunión, 31-oct; causa sin leer en el código todavía)

Michael busca en Leads (un nombre, o el número de un lead), abre una ficha y al volver **la búsqueda se borró**: tiene
que escribirla otra vez. Mani lo ubicó como tema de migas de pan (breadcrumb): el "volver" no restituye la búsqueda.
Michael: es un cambio chico que vuelve la lista mucho más útil.

## Alcance

1. **Leer primero** cómo guarda hoy la lista de Leads la búsqueda (A-105: pieza única de búsqueda, filtros y orden;
   los filtros viven en la URL, la búsqueda por texto puede no estar) y cómo arma el "volver" `enlaceConVuelta`
   (`lib/`, el único lugar que lo pega). Decir en el ticket dónde se pierde.
2. Que la búsqueda por texto viaje en el mismo lugar que los filtros y el "volver" la restituya, junto con filtros,
   orden y página.
3. La misma regla en las otras listas que usan la pieza de A-105 (Deals, Calls, Students, Inbox), sin copiar la
   solución por lista: se arregla en la pieza.

## Fuera de alcance

- Recordar la búsqueda entre sesiones o al cambiar de programa.
- Guardar búsquedas con nombre.

## Done cuando

- [ ] Buscar en Leads, abrir una ficha y volver deja la búsqueda, los filtros y la página como estaban.
- [ ] Lo mismo en cada lista que usa la pieza de A-105.
- [ ] Un test cubre que el "volver" conserva la búsqueda (y que sin búsqueda no agrega nada a la URL).
- [ ] Ningún dato personal en la URL: si se busca un correo, el criterio sigue la regla de "ningún dato personal en
      URLs" (decidir en el ticket si la búsqueda por texto va en la URL o en estado de sesión del navegador).
- [ ] `npm run build` (toca componentes cliente), typecheck y lint limpios; recorrido en navegador con `dev:local`.
