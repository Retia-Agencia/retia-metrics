---
id: 267
etapa: hub
serves: "ADR 0089 (el CRM calcula, Juanito manda) · pedido de Mani del 15-oct: la pantalla deja claro qué sale en las alertas"
depends: [259, 260, 266]
status: todo
---

# 267 — La vista previa del reporte por WhatsApp

## Objetivo

Que quien configura el reporte en Programa › General vea **el mensaje exacto** que Juanito va a mandar, armado con
las cifras de ahora, y que ese texto y el del WhatsApp salgan de **la misma función** (Mani, 15-oct: *"el UI del CRM
debe dejar claro qué sale en las alertas"*).

## Decisiones (Mani, 15-oct)

1. **El texto lo arma el CRM.** Función pura nueva `armarMensaje(envio, sincronizacion)` en
   `lib/reporte-whatsapp/mensaje.ts`, portada tal cual de `src/semaforo/mensaje.js` de Juanito (§18.CR de su handoff):
   encabezado `🚦 Semáforo de pauta · <programa> · <hora>` (o `🚦 Cierre del día`), emoji por color, costo con
   `COP` al lado, meta y aceptable, gasto y agendas, ayer a esta hora, días seguidos en rojo, motivo, notas,
   trayectoria solo en el cierre, aviso si Meta no se pudo leer y `Ver en el Hub: <enlace>`. Números con el formato
   del CRM (`lib/format.ts`), nunca uno nuevo.
2. **El contrato del 259 gana `texto: string`** en cada envío (`lib/reporte-whatsapp/contrato.ts` y la lista blanca
   de `tests/semaforo-endpoint.test.ts`). El endpoint lo llena con `armarMensaje`. Los campos estructurados se quedan
   (Juanito no los usa, pero sirven para depurar y para el Hub).
3. **La vista previa** vive en la tarjeta "Reporte por WhatsApp" de Programa › General: un bloque de texto
   (`whitespace-pre-wrap`, tipografía de la app, sin colores a mano: sistema "Tinta", `docs/structure.md` §9) con
   *"Así se vería ahora"*, para el tipo **día** y, si hay resumen de cierre, el de **cierre**. Lo calcula el servidor
   con `semaforoDelPrograma` y `armarMensaje` y lo pasa por props (nada de `lib/db` en el cliente). Usa la
   configuración GUARDADA; si cambian los interruptores sin guardar, una línea dice "Guarda para ver la vista previa
   con estos cambios". Sin métricas encendidas o sin grupo: lo dice en vez de mostrar un mensaje vacío.
4. **Juanito manda `envio.texto`** y su `src/semaforo/mensaje.js` se borra (un solo dueño del texto). Orden de
   despliegue: primero el CRM (el campo ya existe), después Juanito. El aviso de "el CRM no respondió" se queda en
   Juanito, porque justamente no hay CRM que lo arme.

## Done cuando

- [ ] `tests/reporte-whatsapp-mensaje.test.ts`: los mismos casos de `test/semaforo-retia.test.js` de Juanito (día con
      umbral en rojo, cierre con trayectoria, sin dato con motivo, Meta en error) dan el mismo texto.
- [ ] El endpoint devuelve `texto` y el test de la lista blanca lo admite y sigue mordiendo con una llave de más.
- [ ] `tests/paginas.test.ts`: la ficha arma la vista previa sin romperse con un programa sin reporte.
- [ ] Recorrido local: encender el reporte, guardar y ver el mensaje; `npm run build` (toca un componente cliente).
- [ ] Juanito (PR aparte en su repo, con su convención): manda `envio.texto`, borra `src/semaforo/mensaje.js` y
      ajusta sus tests; suite en Linux con la línea base; despliegue como el PR #28 (merge commit + workflow
      `alcance: todo`, esperando a que no haya pushes de closers en los minutos siguientes).
