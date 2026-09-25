---
id: 083
etapa: E1b
serves: "plan v2 §12.2 · ADR 0043 punto 1"
depends: [042]
status: todo
---

# 083 — El catalogo de areas

## Objetivo

Que las cuatro areas de Retia —Gerencial, Comercial, Pauta, Media— existan como filas y se puedan
administrar desde la app.

## Alcance

- **Dentro:** tabla `areas` por el molde de `lib/catalogo/` (ADR 0012): `activo`, un solo esquema
  zod, pantalla con guard, `change_log` en cada cambio, y `borrarSiNoSeUso` (ADR 0026).
- **Dentro:** el seed de las cuatro, **por la funcion del catalogo y no por `db.insert`** (ADR 0029),
  con `actorDelScript()`.
- **Fuera:** agrupar leads o deals por area. Eso necesita el patron (ticket 084).
- **Fuera:** cualquier columna `area_id` sobre `leads` o `deals`. **El area se DERIVA del origen**
  (ADR 0043 punto 3); guardarla seria una segunda copia de lo que el patron ya dice.

## La regla que no se rompe

⚠️ **Area no es rol.** No se toca `lib/auth/`. La pregunta *"¿que puede hacer esta sesion?"* sigue
viviendo en `lib/auth/roles.ts` y este ticket no la roza. Un `rol === "closer"` usado para decir
"esto es de Comercial" es el bug que `AGENTS.md` ya bautizo.

`areas` es **global, sin `program_id`**: un area es la misma en los dos programas.

## Done cuando

- [ ] Las cuatro areas existen en `dev` y cada una tiene su fila en `change_log`.
- [ ] Crear, editar y desactivar desde la pantalla, con guard de rol.
- [ ] Borrar un area con referencias **desactiva** y dice cuantas tiene; sin referencias, borra.
- [ ] `grep` confirma que ningun archivo de `lib/auth/` cambio.

## Kiro

Si. Es el molde de catalogo, ya hay cuatro ejemplos en el repo.

---

## Nota 2026-09-24 (ADR 0051)

El área de un lead se deriva de su **Canal** (ticket 101), que es el catálogo de pares `utm_source +
utm_medium` con su área. El mapeo UTM → área que se le iba a pedir a Alejo **es** ese catálogo.
