# Manuales de Retia

Un manual por rol, escrito para quien opera el CRM, no para quien lo construye. Cada uno es **un solo archivo
`.html` autocontenido** (estilos dentro, sin dependencias salvo Google Fonts), para que se pueda:

- abrir directo en el navegador, o
- publicar como artifact desde cualquier cuenta de Claude: pedirle a Claude "publica
  `docs/manuales/<archivo>.html` como artifact".

| Manual | Para quién | Archivo |
|---|---|---|
| Operación comercial | closers (y gerencia, para entender el flujo) | [`operacion-comercial.html`](./operacion-comercial.html) |
| Mapa del CRM | gerencia y quien construye: actores, componentes, traspasos y lo que falta. **Excepción a "sin jerga":** cita tickets y decisiones, porque es para planear. Es una vista de `overview.md` §4, `plan.md` §4 y `structure.md` §8 y se regenera desde ellos | [`mapa-crm.html`](./mapa-crm.html) |

## Reglas para escribirlos

- **Salen del CRM real, no de memoria:** el motor de etapas (`lib/deals/etapas.ts`, `lib/deals/requisitos.ts`),
  las preguntas por etapa (`components/deals/pregunta-de-etapa.ts`), los ADR vigentes y
  [`docs/manual-gestion-comercial.md`](../manual-gestion-comercial.md). Si el manual y la pantalla no coinciden,
  manda la pantalla y se corrige el manual.
- **Son de Retia:** no se menciona de dónde se tomó el método.
- **Sin jerga técnica:** nada de números de ticket, ADR, tablas ni nombres de funciones dentro del manual.
- **Una página a la vez (5-oct):** cada `<section>` es una página que elige el hash; el índice lista las secciones
  principales y abre solo las páginas de la activa, con la ruta arriba y Anterior/Siguiente abajo. Una página nueva se
  agrega a su grupo en el script. Sin JS se ve todo. Frases completas con "tú": corto no es telegráfico.
- **Formato de artifact:** el archivo empieza por `<title>` y `<style>` (sin `<!doctype>`, `<html>`, `<head>` ni
  `<body>`: el artifact los pone al publicar), colores como tokens con modo claro y oscuro, y funciona a ancho
  de teléfono.
- **La sección "Lo que le falta al CRM"** se actualiza cuando se cierra un ticket que la toca (hoy: 078, el corte, 086, 147,
  144 y 145).
- **En la app:** el CRM sirve `operacion-comercial.html` en `/manual`, detrás del login, y Mi espacio lo enlaza con
  el botón "Manual de uso" (ticket 199). Editar el archivo y desplegar basta: no hay copia.
