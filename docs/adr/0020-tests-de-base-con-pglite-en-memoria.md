# 0020 — Los tests que necesitan base corren contra PGlite en memoria

**Fecha:** 2026-09-16

Hasta el ticket 010 ningun test tocaba la base: se probaba logica pura (`plan-sync`, `dedup`) y
las paginas con la consulta mockeada. El molde de catalogo (ticket 011) no se puede probar asi:
lo que importa de el vive en Postgres (el indice unico del nombre, que nunca se borre una fila,
las filas de `change_log`). Lo mismo va a pasar con productos, abonos y el registro de llamadas
(tickets 012, 017, 018, 002, 019).

Opciones que se pesaron (decision de Mani, 16 de septiembre):

| Opcion | Por que no / por que si |
|---|---|
| Nucleo puro + repositorio falso | Cero dependencias, pero las restricciones reales de la base solo se prueban contra un falso que puede mentir |
| Rama `dev` de Neon | Base real, pero necesita red y `DATABASE_URL` en cada corrida, migraciones aplicadas antes, y es lenta y fragil |
| **PGlite en memoria** | **Elegida.** Postgres real compilado a WASM, sin red. Cada test levanta una base limpia y le aplica todas las migraciones de `drizzle/` |

**Decidimos usar `@electric-sql/pglite` como dependencia de desarrollo.** Cumple el ADR 0006: se
instala junto con el primer codigo que la usa (ticket 011).

## Consecuencias

- `tests/helpers/base-de-prueba.ts` crea la base y aplica las migraciones. De paso, cada corrida
  de `npm test` prueba que las migraciones aplican en un Postgres real antes de llevarlas a Neon.
- El codigo que escribe en la base **recibe la base por parametro**, con la de la app por
  defecto. Asi la app no cambia y los tests pasan la de PGlite.
- `drizzle-orm/neon-http` no tiene transacciones interactivas pero si `batch`; PGlite tiene
  transacciones pero no `batch`. Las escrituras que deben ir juntas pasan por un helper
  (`ejecutarJuntas`) que usa lo que el driver tenga. Los ids se generan en codigo para que la
  fila y su `change_log` quepan en el mismo lote.
- PGlite no es Neon: el comportamiento propio del driver HTTP (timeouts, errores de red) no se
  prueba aqui. Si un bug depende de eso, se reproduce contra la rama `dev`.
