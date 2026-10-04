---
id: 195
etapa: O6
serves: "docs/anotaciones.md A-99; A-06, A-86"
depends: [193]
status: todo
---

# 195 — Recursos: pantalla fija

Sesión **P3**, frente de pantallas de la ola O6. Arranca cuando el 193 esté en `main`. Sin migración.

## Por qué existe

**A-99 (Mani, 4-oct).** Recursos crece en scroll de página con cada recurso y cada link de pago. Tiene que ser
pantalla fija como el resto del CRM.

## Alcance

1. **Medir primero** en `dev:local` qué tiene la pantalla y qué crece (`components/resources/`): hoy son dos listas,
   los recursos (brochures, guiones) y los links de pago, con el buscador arriba.
2. **Aplicar la regla de §9** (185): dos listas con acciones propias son **dos pestañas** con `pestanas.tsx` del 193:
   "Recursos" (*Brochures, guiones y material del programa. Cópialos en un clic.*) y "Links de pago" (*Los links de
   cobro vigentes por programa y plataforma.*). El buscador queda fijo arriba y busca en la pestaña activa; si busca en
   las dos, cada pestaña muestra su conteo. Si al medir resulta que una sola lista basta, se dice en la nota de cierre
   y se deja en una.
3. **Pantalla fija**: el buscador y la barra fijos; el scroll en la lista. A 375 px vuelve el scroll de página (los
   closers lo usan en el teléfono, ticket 023).
4. Sin cambio de permisos: `esAdmin` y `programasEditables` siguen igual.

## Archivos

`app/(app)/recursos/page.tsx`, `components/resources/*` solo donde el reacomodo lo pida.

## Done cuando

- La página no crece con los recursos ni con los links desde `md`; el scroll vive en la lista.
- Typecheck, lint, `npm run build` (`components/resources/` tiene clientes).
- Recorrido en `dev:local` como closer y gerente, escritorio y 375 px, consola abierta: buscar, copiar, crear y editar
  un recurso, ver su historial, crear un link de pago.
