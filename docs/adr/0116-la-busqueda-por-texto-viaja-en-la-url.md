# 0116: La búsqueda por texto de las listas viaja en la URL

- **Estado:** aceptado · 31-oct-2026 (Mani, ticket 365).
- **Confirma:** ADR 0023: el estado de una lista sale de la URL, no de la sesión ni de memoria cliente.
- **Enmienda:** la regla de privacidad que prohibía todo dato personal en URLs. Los identificadores de rutas siguen
  siendo ids opacos; la única excepción en query strings es `q`, el texto libre del buscador de una lista.

## Contexto

Leads y Deals guardaban la búsqueda en `useState`. Al abrir una ficha, el componente desaparecía y “Volver” reconstruía
la lista sin el texto, aunque los filtros, el orden y la página sí sobrevivían en la URL. Calls, Students, Media y
Notificaciones ya usaban `?q=` y demostraban el contrato correcto, pero contradecían la regla absoluta de privacidad.

## Decisión

La búsqueda libre de una lista se representa con `?q=` y se filtra en el servidor con `leadsQueCasan`. Es la única
información personal admitida en un query string. No habilita correos, teléfonos ni nombres como identificadores de ruta:
las fichas y acciones conservan ids opacos.

“Volver” consume la entrada anterior del historial cuando pertenece a esta app. Si no existe —entrada directa, enlace
externo o pestaña nueva— usa el destino validado por `destinoDeVolver`. Así cada salto conserva la URL exacta de la vista,
incluidos búsqueda, filtros, orden, página, pestaña/sección y vista.

Las zonas con scroll interno guardan su posición por URL en `sessionStorage`; el scroll de página queda a cargo del
navegador. El cambio de programa conserva su contrato: descarta los filtros del programa anterior.

## Consecuencias

- Una búsqueda puede quedar en el historial del navegador y ser visible al copiar la URL. La excepción es deliberada y
  está limitada a `q`; no se usa para secretos ni identificadores de objetos.
- Los buscadores de listas usan `BuscadorUrl`; un buscador en memoria no puede ocupar el slot `buscador`.
- Cambiar búsqueda, filtro, orden, página, sección o vista crea una entrada recuperable con Atrás.
- Los enlaces mantienen `href` y `?desde=` como fallback para pestañas nuevas y navegación sin JavaScript.
