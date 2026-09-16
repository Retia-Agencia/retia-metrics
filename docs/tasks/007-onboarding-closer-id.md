---
id: 007
fase: F1
serves: "spec §5 criterio 5; precondición de ADR 0011"
depends: [015]
status: todo
---

# 007 — Dar de alta a los closers reales

## Objetivo
Andrea, Maru y Jero (y cualquier closer activo) tienen cuenta con `closerId`, correo de Calendly
y sus programas asignados, cargados desde la pantalla del ticket 015.

## Alcance
- Dentro: confirmar con Michael la lista de closers activos, sus correos de Google y el texto
  exacto de su nombre en la BBDD; cargarlos desde `/ajustes/usuarios`.
- Dentro: dar de alta a los gerentes (`administrativa@retiagrowth.com`) y developers.
- Fuera: auto-registro (no existe, por regla).

## Done cuando
- [ ] Cada closer activo tiene `rol="closer"`, `closerId` no nulo y al menos un programa.
- [ ] `registrarLlamada` probado con una cuenta real de closer.

## Notas
Operación, no código. Juanito tiene su propio mapeo de closers de Calendly; cuando exista la
integración, lo leerá de aquí.
