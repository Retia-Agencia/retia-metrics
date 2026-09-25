---
id: 094
etapa: E6
serves: "ADR 0048 punto 1 · propuesta 24-sep §3.1"
depends: []
status: todo
---

# 094 — Un closer ve solo sus programas: una función de alcance y todas las rutas la usan

## Objetivo

Que la pregunta *"¿qué programas ve esta sesión?"* tenga una sola respuesta, y que el dashboard, las
listas, las fichas y el selector de programa la usen. **No depende de nada**: puede ir antes de E6.

## Lo que hay hoy (verificado el 24-sep)

- `buscarPersonas` (`lib/queries/personas.ts`) **ya** limita al closer a sus membresías activas.
- `/programas/[slug]` deja entrar a un closer a **cualquier** programa activo (ADR 0009 original).
- `historialDePersona` no filtra por membresía, a propósito, porque se entraba desde ese dashboard.

## Alcance

- **Dentro:** una función en `lib/auth/` (junto a `esAccesoTotal`, `esAdministrador`, `trabajaLeads`)
  que devuelve los programas visibles: closer = membresías activas; gerente y developer = todos.
- **Dentro:** la guarda de toda ruta con programa, las consultas de lectura y el selector de programa
  (ticket 097) la importan. `buscarPersonas` deja su join propio y la usa.
- **Dentro:** un programa ajeno responde 404, igual que uno inexistente: no se filtra qué slugs existen.
- **Fuera:** qué puede ESCRIBIR un closer en un programa. Eso ya lo contesta `exigirAccesoAlPrograma`.

## Done cuando

- [ ] Un closer de un solo programa no ve el otro en el selector, en el dashboard, en las listas ni en
      una ficha abierta por id.
- [ ] **Probado forjando la petición**, no mirando que el ítem no aparezca: se pide la ruta del
      programa ajeno con la sesión del closer y se espera 404.
- [ ] Un guardián falla si una consulta de lectura filtra por membresía por su cuenta en vez de usar
      la función (mordido en los dos sentidos).
- [ ] Gerente y developer siguen viendo todo.

## Kiro

Sí, con revisión de permisos.
