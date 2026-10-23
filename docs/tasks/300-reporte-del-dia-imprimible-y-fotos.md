---
id: 300
etapa: hub
serves: "docs/hub.md O1 · ADR 0086 · reemplaza al 021 (snapshot del dashboard)"
depends: [299]
status: todo
---

# 300 — El reporte del día: vista imprimible y una foto por día

## Por qué

El reporte de Michael se mandaba como PDF por WhatsApp. Hub › Hoy ya tiene la estructura (252) y el 299 la deja fiel,
pero no se puede sacar del CRM ni ver cómo estaba un día anterior. Decidido por Mani el 23-oct:

- **Vista imprimible**, guardada como PDF con el navegador (sin librería de PDF, ADR 0006). Lo manda a mano quien lo
  descargue; **Juanito lo mandará más adelante** (fuera de este ticket).
- **Una foto por día**, solo para ver días anteriores.

Reemplaza al 021, congelado desde el 21-sep: ese ticket fotografiaba el dashboard viejo y pedía un PDF generado.

## Objetivo

Que cualquiera que vea el Hub de un programa abra el reporte del día en una página lista para imprimir, y pueda abrir
el de un día pasado tal como quedó ese día.

## Alcance

1. **La vista imprimible:** `/p/[programa]/hub/hoy/reporte` (y la de "todos" en `/hub/reporte`). Los mismos datos que
   Hoy, con los mismos componentes de `components/dashboard/hoy.tsx`, de modo que lo que traigan el 253, el 254 y el
   257 entre solo. Una hoja de estilo `@media print` (carta, márgenes, sin menú ni botones, tablas que no se parten) y
   un botón "Descargar PDF" que llama `window.print()`. En papel la cifra no abre su lista.
2. **La foto del día:** una tabla (migración, la aplica la sesión principal) con programa, fecha, hora de la foto,
   origen (`cron` o `manual`, y quién), versión del contrato y el contenido. Un día y programa tiene una foto vigente;
   tomarla otra vez la reemplaza y deja rastro en `change_log`.
   - **Qué se guarda:** el objeto de datos que pinta la vista (el del 299 para esa fecha), validado con un esquema zod
     con `version`, no el HTML. Razón: el cron no tiene que renderizar React, y la foto se puede leer después como
     dato. Regla del contrato: **solo se agregan campos opcionales**; un bloque que no estaba en la foto se ve como
     "no estaba en la foto del día", nunca como cero.
   - **Cuándo:** todos los días hábiles a las 20:00 de Bogotá (el cierre del semáforo, HQ-3), con `pg_cron` y `pg_net`
     contra una ruta `POST /api/cron/...` protegida con `CRON_SECRET`, el mismo molde del 272 (ADR 0093). Y un botón
     "Tomar foto ahora" para quien administra.
3. **Ver días anteriores:** un selector de fecha en la vista imprimible. Hoy se calcula en vivo; un día pasado se lee
   de su foto, con la hora en que se tomó a la vista. Un día sin foto lo dice; **no se recalcula**, porque un día pasado
   recalculado sale distinto del reportado (anulaciones, llamadas cargadas tarde).
4. **Permisos:** las mismas guardas de Hoy (`paginaConRol`, alcance del ADR 0048 y 0094). La foto guarda el objeto
   completo y la proyección por rol se hace al pintar: el paid trafficker no ve el comparativo de closers, igual que en
   Hoy (`veEquipoComercial`).

## Fuera

- Que Juanito mande el reporte (ticket futuro: con un PDF generado en el servidor o un enlace al reporte).
- Las fotos de las demás pestañas del Hub.

## Done cuando

- [ ] La vista imprimible da las mismas cifras que Hoy para hoy, con test sobre el objeto, y el PDF del navegador cabe
  en hojas carta sin cortar tablas (revisado a mano en Chrome).
- [ ] El cron toma la foto del día de cada programa activo, idempotente (correrlo dos veces deja una sola foto), con
  test; sin `CRON_SECRET` responde 401 y no escribe.
- [ ] Un día pasado se lee de su foto aunque los datos del CRM cambien después, con test.
- [ ] Un closer o un paid trafficker forjan la acción de "tomar foto" y reciben 403 sin que la base se mueva; un
  programa ajeno responde 404.
- [ ] Recorrido en escritorio y 375 px, `npm run test:humo` en verde.
