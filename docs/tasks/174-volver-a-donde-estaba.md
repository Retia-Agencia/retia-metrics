---
id: 174
etapa: O3
serves: "docs/anotaciones.md A-57; ADR 0077"
depends: [168, 170, 171, 172, 173]
status: todo
---

# 174 — Volver a donde estaba

Sesión **S7**, ola O3 parte 3 (al final: toca todas las pantallas). Sin migración.

## Por qué existe

Mani (3-oct): no hay forma de regresar a la pantalla de la que se venía (A-57). El botón Atrás del navegador sirve a
medias: un pop-up o un filtro cambian la URL, y entrar a una ficha desde un enlace compartido no tiene "atrás".

## Alcance

1. **Un componente `Volver`** en la cabecera de `PageShell` para las pantallas de detalle (ficha del deal, del lead,
   detalle de llamada como página si existe, cohortes): muestra "← {nombre de la lista}" (por ejemplo "← Deals",
   "← Calls · filtrados", "← Mi espacio").
2. **El origen viaja en la URL:** todo enlace desde una lista a un detalle agrega `?desde=<ruta relativa con su
   query>`. El componente lo valida (solo rutas internas que empiezan por `/`, nunca `//` ni un esquema: sin open
   redirect) y lo usa; sin `desde`, vuelve a la lista natural del objeto (Deals para un deal, Leads para un lead).
3. Un helper para armar los enlaces (`enlaceConVuelta(href, origen)`), uno solo; ninguna pantalla concatena `desde`
   a mano.

## Archivos

`components/page-shell.tsx`, el componente y el helper nuevos, y los enlaces de las listas (Deals, tarjeta del Kanban,
Leads, Calls, Students, Inbox, Mi espacio, Dashboard → lista). Tests del helper (rutas válidas y las que se rechazan).

## Done cuando

- Desde cualquier lista filtrada, abrir un detalle y pulsar "Volver" deja la lista con sus mismos filtros y página.
- Un `desde` externo o malformado se ignora (test).
- `npm run build` en verde; recorrido en `dev:local`, escritorio y 375 px.
