---
id: 315
etapa: media
serves: "ADR 0107 · docs/media/propuesta.md §2 (media tiene su propia vista)"
depends: []
status: todo
---

# 315 — El rol `media` y la pregunta `trabajaContenido`

## Por qué

Media entra al CRM con su vista y solo ve lo suyo (ADR 0107). Sin el rol, la única forma de darle acceso es como
gerente, que le abre todo lo comercial.

## Alcance

- Migración (turno en la cola): `media` en el `pgEnum` `rol`.
- `lib/auth/roles.ts`: `media` en `ROLES` y en `ETIQUETA_ROL` ("Media"); `trabajaContenido` (media, gerente, y el
  developer por `esAccesoTotal`); `tieneAlcanceConfigurable` incluye `media`. La pregunta de alcance (`lib/auth/alcance.ts`)
  le da a `media` lo mismo que a un gerente con o sin filas.
- `media` no cumple ninguna otra pregunta: verificarlo en cada una con test.
- Ajustes › Usuarios permite crear un usuario `media` y cargarle alcance.
- Seed de la base local con un usuario `media`, para el humo (ADR 0083).

## Done cuando

- `tests/roles.test.ts`: la tabla de verdad de las preguntas incluye `media` en las dos direcciones.
- `tests/paginas.test.ts`: `media` recibe 403/404 en Leads, Deals, Calls, Inbox, Students, Hub, Ajustes, forzando la URL.
- `rol === "media"` no aparece escrito a mano fuera de `lib/auth/roles.ts`.
- Typecheck, lint y los tests del cambio en verde; la suite la valida el checkpoint.
