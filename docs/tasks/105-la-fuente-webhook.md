---
id: 105
etapa: E3
serves: "ADR 0055 puntos 1 y 2 · plan §4.3a"
depends: [048]
status: en curso
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

## Cómo se cierra la forja (28-sep)

El modo automático de Claude Code bloquea que el agente invoque `rotarSecretoFuenteAccion` aunque se
espere un 403 (lo clasifica como escritura sobre secretos), y el permiso dado por chat no lo cambia. La
corre Mani, con la app local (`npm run dev`, que escribe en producción: por eso el blanco es la fuente
`google_sheet` inactiva "Formulario actual", que no es el webhook vivo):

1. Entrar como developer y poner la vista en **closer** (selector "Ver como").
2. En la consola del navegador, sobre cualquier página de la app:

```js
const accion = async (id, args) => (await (await fetch(location.pathname, { method: "POST",
  headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", "Accept": "text/x-component" },
  body: JSON.stringify(args) })).text()).split("\n").filter((l) => l.startsWith("1:")).join("\n");
console.log("rotar:", await accion("40ad0b1c8c0e942b280881a79dacb7656c409d6a8e", ["1d0bbca3-2b2b-4ce9-8736-699613808764"]));
console.log("crear:", await accion("4023f2a433e0a0e3629df33a00dd42794ae11f4744", [{ programId: "fb076a4d-ed63-43f0-929e-6f05ccaa28ec", nombre: "forja-105", tipo: "webhook", proveedor: "typeform" }]));
```

3. Se espera `ok:false` con un error de permiso en las dos, y la base quieta:
   5 fuentes, `secreto_webhook` nulo en "Formulario actual" y `change_log` sin filas nuevas de `sources`
   (línea base del 28-sep: 5 fuentes, 177 filas en `change_log`). Los ids de acción salen del bundle de
   `/ajustes/fuentes` en dev; si no responden, se vuelven a sacar de ahí.

## Kiro

Sí el código y los tests, con revisión. La migración la escribe y aplica la sesión principal.
