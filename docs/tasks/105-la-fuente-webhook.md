---
id: 105
etapa: E3
serves: "ADR 0055 puntos 1 y 2 · plan §4.3a"
depends: [048]
status: todo
---

# 105 — La fuente webhook: un formulario es una fila

## Objetivo

Que un formulario nuevo se dé de alta desde la app (ADR 0012) con todo lo que el webhook necesita para
recibirlo, sin tocar código.

## Alcance

- **Migración (sesión principal):** `tipo_fuente` gana `webhook`. `sources` guarda el **proveedor**
  (`typeform` por ahora; enum, porque el código elige el adaptador con él) y el **secreto** HMAC de la
  fuente. El mapeo de preguntas (cuál es el correo, el teléfono, el nombre) reusa `mapeo_columnas`.
- **La URL es derivada, nunca guardada** (ADR 0024): `/api/webhooks/formularios/<id de la fuente>`, con
  el id opaco. La pantalla de la fuente la muestra para copiarla en Typeform.
- **El secreto:** se genera al crear la fuente y se muestra una sola vez; se puede rotar. Nunca aparece
  en `change_log` ni en un log (el rastro dice "secreto rotado", sin el valor).
- Alta y edición por el molde de `lib/catalogo/` (validación zod, `change_log`, borrar solo si no se usó).
- Sigue el índice de una fuente activa por programa (ADR 0039).

## Done cuando

- [ ] Crear una fuente webhook desde la app deja la fila, su rastro y una URL que se puede copiar.
- [ ] El secreto no aparece en `change_log` ni en la respuesta de una lectura posterior.
- [ ] Un closer no puede crear ni ver el secreto de una fuente (forjando la server action, no solo
      mirando la pantalla).
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí el código y los tests, con revisión. La migración la escribe y aplica la sesión principal.
