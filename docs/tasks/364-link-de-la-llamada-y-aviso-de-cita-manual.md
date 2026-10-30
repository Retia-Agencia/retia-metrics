---
id: 364
etapa: crm
serves: "Pregunta de Mani, 30-oct, al cerrar el arreglo del arrastre a Re-agenda · ADR 0057 (Calendly) · A-137"
depends: []
status: todo
---

# 364 — El link de la llamada a un clic, y el aviso cuando la cita es manual

## Por qué (leído en el código, 30-oct; sin probar en pantalla)

Quien trabaja un deal necesita entrar a la llamada, y hoy el link no está donde se trabaja:

1. **El link vive solo en la ficha, el detalle de la llamada, la lista de llamadas y los Inbox** ("Link de la cita",
   `ficha-llamadas.tsx:90`, `detalle-de-llamada.tsx:150`, `llamadas-programa.tsx:112`, `inbox-llamadas-de-hoy.tsx:90`,
   `inbox-llamadas-sueltas.tsx:98`). **La tarjeta del Kanban no lo muestra**: hay que abrir la ficha. `TarjetaDeal.llamada`
   (`lib/queries/kanban.ts`) ya trae la cita activa, pero sin el link.
2. **Una cita de Calendly guarda el link sola** (`joinUrl`, `lib/deals/llamadas.ts:129`); una **cita manual** ("Poner una
   hora fuera de Calendly", `components/calendly/selector-de-hora.tsx`) pide un link obligatorio que escribe quien
   agenda. El CRM no crea la reunión ni invita al lead: **nadie avisa que esa cita la tiene que crear y comunicar quien
   agenda.** El único texto es "Esta hora no queda bloqueada en Calendly: otro lead puede reservarla."
3. **Después no queda marca de que la cita fue manual**: la ficha muestra igual "Link de la cita" para las dos, y el
   texto del enlace no dice si es Meet, Zoom o Calendly. (El detalle sí muestra el origen y el host de Calendly.)

## Alcance

1. **Tarjeta del Kanban**: un acceso directo al link de la llamada activa (`deal.llamada`), solo si hay link. Se agrega
   `linkCalendly` a la proyección de `llamada` en `lib/queries/kanban.ts` y a `DealQueResponde.llamada`.
2. **Etiqueta "Cita manual"** (`Badge variant`, sin colores a mano, `docs/structure.md` §9) en la tarjeta, la ficha y el
   detalle cuando `calls.origen` no es `calendly`, con la ayuda "El lead no recibe invitación: avísale tú." La regla de
   "¿es manual?" vive en UN solo lugar (junto a `etiquetaDeOrigen`, `lib/deals/estado-de-llamada.ts`), no copiada.
3. **Formulario de hora manual**: el aviso dice que el CRM no crea la reunión ni invita al lead, y que quien agenda la
   crea y se la manda.
4. El texto del enlace dice el medio cuando se puede saber (Calendly, Meet, Zoom, otro) sin adivinar: si no se reconoce
   el dominio, "Link de la reunión".

## Fuera de alcance

- Que el CRM cree la reunión o envíe el correo al lead en la cita manual.
- Cambiar cómo se reserva en Calendly (`reservarCita`, `lib/calendly/escritura.ts`).
- Mostrar el link de Grain en la tarjeta.

## Done cuando

- [ ] La tarjeta del Kanban abre el link de la llamada activa en una pestaña nueva, y no muestra nada si no hay link.
- [ ] Una cita manual lleva "Cita manual" y su ayuda en tarjeta, ficha y detalle; una de Calendly no.
- [ ] El formulario de hora manual avisa que el lead no recibe invitación.
- [ ] Un test cubre la regla de "¿es manual?" y que la proyección de la tarjeta trae el link (caso con y sin link).
- [ ] `npm run build` (toca componentes cliente), typecheck y lint limpios; recorrido en navegador con `dev:local`.
- [ ] Tracker (`docs/tasks/README.md`) igual al `status:` de este archivo.
