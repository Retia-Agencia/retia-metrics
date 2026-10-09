---
id: 224
etapa: O8
serves: "A-128; ADR 0082"
depends: [221]
status: todo
---

# 224 — El menú del closer: solo lo que puede abrir

## Por qué existe

Al closer le sobran Ajustes, Programa, Dashboard y Metas. Mani decidió cerrarlos en el servidor, no solo
esconderlos (ADR 0082, enmienda del ADR 0048).

## Alcance

- Una pregunta nueva en `lib/auth/roles.ts`, por capacidad (ADR 0025), p. ej. `veTableroDelPrograma(rol)`:
  gerente, developer y paid trafficker (que ya entra al Dashboard por `manejaPauta`) sí; closer no. Otra para la
  configuración (Ajustes y Programa): `esAdministrador` o la del paid trafficker en Ajustes, como hoy.
- `lib/nav.ts` arma el menú con esas preguntas; las páginas (`paginaConRol` / guardas de
  `app/(app)/p/[programa]/{dashboard,metas,programa}` y `app/(app)/ajustes`) responden 404 con las mismas.
- La lista detrás de cada cifra (`/p/[programa]/dashboard/lista`) cae con el Dashboard.
- El developer en vista closer ve lo del closer; en `todo`, todo.
- Revisar `rutaInicial` y cualquier link interno a esas rutas desde pantallas del closer (Mi espacio, ficha).

## Done cuando

- [ ] Closer: el menú no tiene Ajustes, Programa, Dashboard ni Metas.
- [ ] Forjadas desde la sesión de un closer, las cuatro rutas y la lista del dashboard responden 404 (test en
      `tests/paginas.test.ts` y recorrido).
- [ ] Gerente, paid trafficker y developer no pierden nada (tests por rol).
- [ ] Ningún link visible al closer apunta a una ruta cerrada.
