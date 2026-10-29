---
id: 316
etapa: media
serves: "ADR 0110 · propuesta.md §4.4 (la pieza une los dos componentes)"
depends: [315]
status: done
---

# 316 — El catálogo de creadores y la pieza mínima

## Por qué

Sin pieza no hay link por pieza ni forma de saber qué contenido trajo un lead. En los pasos 1 a 3 solo se construye lo
que el link necesita (ADR 0110 punto 6).

## Alcance

- Migración: `creadores` (molde de `lib/catalogo/`: nombre, slug único, cuentas por red, `program_id` **nulo
  permitido**, `activo`) y `piezas` (programa nulo si el creador no tiene, creador, tipo, red, CTA, `fecha_publicacion`
  o `permanente`, `codigo` opaco único, `publicada_en`, anulación con quién y por qué). CHECK: o fecha o permanente.
  Índice único parcial: una permanente activa por creador y red.
- Tipos de pieza como catálogo editable (`tipos_pieza`), sin significado todavía (los estados con significado son el 333).
- `lib/catalogo/creadores.ts` y `lib/media/piezas.ts`: crear, editar, marcar "ya publiqué", descartar. Toda escritura
  por `crearConRastro`/`editarConRastro`. El código lo genera el servidor, corto y sin datos personales.
- Una pieza no cambia de programa; un creador sin programa no tiene link (422 con mensaje claro).

## Done cuando

- Tests del molde: rastro siempre, `borrarSiNoSeUso` (una pieza con leads se descarta, no se borra), frontera.
- `tests/contrato-extension.test.ts` verde (ningún slug de creador en el código).
- Pantalla mínima en la vista de media (321) o, si 321 no está, en `/media/creadores` con guarda `trabajaContenido`.
