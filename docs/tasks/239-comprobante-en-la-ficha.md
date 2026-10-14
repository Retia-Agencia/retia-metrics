---
id: 239
etapa: dinero
serves: "235 (A-146) · ADR 0085 puntos 3, 4, 5 y 10"
depends: [238]
status: done
---

# 239 — Subir y ver el comprobante de un abono desde la ficha

## Por qué existe

Es el caso de Michael con menos piezas: un abono ya registrado recibe su comprobante como archivo, igual que hoy recibe
el link con "Pegar comprobante".

## Alcance

- **Server actions** `pedirSubidaDeComprobante` y `confirmarComprobante` (guarda de ruta, programa visible,
  `puedeTrabajarDeal`, zod). Confirmar cuelga el archivo del abono con `editarConRastro` (queda en `change_log`) y deja
  la nota del actor si el deal está en Ganado completo, como `pegarComprobante`.
- **Componente cliente reutilizable** para elegir el archivo, comprimir la imagen en el navegador (JPEG, lado largo
  ≤ 2.000 px) y subirlo directo a Storage. Lo reusa el 240. Nada de `lib/db` en el cliente (correr `npm run build`).
- **Ver:** ruta del servidor `/p/[programa]/archivos/[id]` que pasa la guarda (C-1: quien abre la ficha; el paid
  trafficker no) y redirige a una URL firmada de 60 s.
- **`tieneComprobante`** en `lib/deals/abono-sin-comprobante.ts` (link o archivo listo), y que la usen el kanban, el
  Inbox y la ficha.
- **Adaptador de disco** para `dev:local` (sale del 238): guarda en una carpeta ignorada por git y recibe la subida en
  una ruta local que solo existe con `esLocal()` (`lib/db/es-local.ts`), para poder hacer el recorrido visual.
- En la ficha: el diálogo de comprobante ofrece "Subir archivo" o "Pegar link".

## Done cuando

- [ ] Desde el celular, un closer sube la foto de un abono existente y la ve en la ficha.
- [ ] El aviso "abono sin comprobante" se apaga con el archivo en kanban, Inbox y ficha.
- [ ] Forjando la petición: sin sesión, desde otro programa y como paid trafficker, el archivo no se entrega; un closer
      que no es dueño del deal no puede subir. La base sin moverse.
- [ ] Pegar link sigue funcionando como hoy.
- [ ] Humo de la UI (`npm run test:humo`) limpio en escritorio y celular.
