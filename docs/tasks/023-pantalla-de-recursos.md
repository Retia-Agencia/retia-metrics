---
id: 023
fase: F3
serves: "spec §5 criterio 6"
depends: [022]
status: done
---

# 023 — Pantalla de Recursos

## Objetivo
Cualquier usuario encuentra el brochure o el link de pago vigente en segundos y lo copia en un
clic; un gerente los administra.

## Alcance
- Dentro: `/recursos` reemplaza a `/documentos` (redirección permanente) y el ítem del sidebar
  pasa a llamarse "Recursos".
- Dentro: filtro por programa (incluye "Todos") y búsqueda por título; enlaces de pago agrupados
  por programa y producto, con monto, moneda y plataforma visibles.
- Dentro: botón copiar y abrir; historial desplegable de versiones anteriores.
- Dentro: crear, reemplazar y desactivar, solo gerente (supuesto en `docs/spec.md` §7).
- Fuera: subir archivos (ADR 0017).

## Done cuando
- [x] Un closer ve y copia; no ve botones de edición y la acción de servidor lo rechaza.
- [~] En celular se usa sin scroll horizontal (los closers trabajan desde el teléfono).

## Notas de cierre (17-sep)

**El filtro VA en la URL (`?programa=&q=`), al contrario que el buscador de `/mi-dia`.** La
diferencia es deliberada: en `/mi-dia` lo que se teclea es el nombre o el correo de un lead, un dato
personal que `AGENTS.md` prohíbe en query strings; el título de un brochure no lo es. Aquí gana que
el filtro sea compartible y recargable (ADR 0023). El programa viaja por **slug**, no por uuid.

**Leer lo pueden los dos roles; escribir solo el gerente.** No es como `/productos`, donde el ADR
0016 abrió la edición al closer: ese ADR es específico de productos. Las seis acciones de escritura
pasan por `requireRole("gerente")` y hay test de que un closer recibe `ok:false` en las seis, no solo
de que no ve el botón.

## Enmienda (19-sep): el closer también crea recursos y enlaces de pago

Decisión de Mani (19-sep): los closers pueden crear, reemplazar y desactivar **recursos y enlaces de
pago**, con el molde del ADR 0016 (el de productos): quien ADMINISTRA (gerente o developer) entra a
cualquier programa; un closer solo a los programas donde tiene una membresía ACTIVA. Las seis
acciones pasan de `requireRole("gerente")` a `requireRole("gerente","closer")` **más** la regla de
datos por programa, que ahora vive en un módulo compartido: `lib/catalogo/acceso-programa.ts`
(`exigirAccesoAlPrograma`), extraído de `lib/catalogo/productos.ts` para que productos, recursos y
enlaces de pago respondan la MISMA pregunta desde un solo lugar (regla de `AGENTS.md`). El mensaje de
403 se parametriza: "un programa donde no vendes" no aplica igual a un brochure.

**Asimetría del recurso global (declarada por Mani, con un supuesto que dejamos escrito):** un closer
**NO** puede crear un recurso global (`programId` nulo), porque afecta a programas donde no vende.
Supuesto que aplicamos: un closer **tampoco** puede EDITAR ni DESACTIVAR ni REEMPLAZAR un recurso
global existente — lo que no puede crear tampoco lo puede cambiar (mismo 403). Solo quien administra
(`esAdministrador`: gerente o developer, ADR 0025) toca lo global. El enlace de pago siempre tiene
programa (columna `NOT NULL`), así que no le aplica la asimetría del global.

La pantalla proyecta por ítem: un closer ve los controles de edición de los recursos/enlaces de sus
programas y no los de los globales ni los de otros programas; la prop dejó de ser un único
`puedeEditar` y pasó a `esAdmin` + `programasEditables`. La barrera real sigue siendo de servidor
(ADR 0003): cada server action re-exige rol y acceso por programa. Tests en
`tests/acciones-recursos.test.ts`, `tests/recursos.test.ts` y `tests/enlaces-pago.test.ts`.

**Un recurso global (`programId` nulo) aparece con cualquier filtro de programa**, porque sirve para
todos. Hay test.

**El criterio de celular queda a medias, marcado `[~]`.** El marcado se construyó mobile-first (sin
tablas, sin anchos fijos, URLs con `break-all`) y se verificó por inspección del código, pero
**nadie lo ha abierto en un teléfono**. Un test no ve un layout roto. Pendiente de revisión visual.
