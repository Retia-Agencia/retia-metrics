---
id: 083
etapa: E1b
serves: "plan v2 §12.2 · ADR 0043 punto 1"
depends: [042]
status: done
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

- [x] Las areas existen en **produccion** (Paid, Orgánico, Referidos; PQ7) y cada una tiene su fila en `change_log`. Gerencial no es area de origen y no se siembra.
- [x] Crear, editar y desactivar desde la pantalla, con guard de rol (pestaña "Áreas" de `/ajustes/catalogos`, por el registro).
- [x] Borrar sin referencias borra (test). Con referencias desactiva: el molde ya lo hace, pero hoy nadie apunta a un area; los dependientes se declaran con el 101 y el 121.
- [x] `grep` confirma que ningun archivo de `lib/auth/` cambio.

## Kiro

Si. Es el molde de catalogo, ya hay cuatro ejemplos en el repo.

---

## Nota 2026-09-24 (ADR 0051)

El área de un lead se deriva de su **Canal** (ticket 101), que es el catálogo de pares `utm_source +
utm_medium` con su área. El mapeo UTM → área que se le iba a pedir a Alejo **es** ese catálogo.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- 🔴 El nombre visible de cada área lo decide Gerencia (PQ7): Pauta la llama paid, orgánico y referidos. Las áreas son filas, así que no hay código de por medio.

- ✅ 29-sep (Mani): en pantalla las áreas se llaman **paid, orgánico y referidos**.

---

## Cierre 2026-09-30 (Mani)

Migracion **0045** (`areas`, con RLS e indice unico sobre `lower(nombre)`) aplicada en produccion con el ok
de Mani; `npm run cargar-areas` sembro las tres por el molde con `actorDelScript`. Implemento Codex; la
sesion principal agrego el RLS (lo cazo `tests/rls-en-todas-las-tablas.test.ts`) y el mock de
`tests/paginas.test.ts`. `tests/areas.test.ts`. Adelantado de E6 con el ok de Mani (no depende del 072).
