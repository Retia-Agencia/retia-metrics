# 0026 — Un registro se anula, no se borra; del catálogo se borra solo lo que nunca se usó

**Fecha:** 2026-09-18 · **Reescrito:** 2026-09-27 (la anulación pasa al modelo del deal, ADR 0037 y
0038) · **Estado:** aceptado

## El problema

En el recorrido del 18-sep apareció que no había forma de deshacer nada: ni un solo `.delete(` en la
app y ninguna columna para desactivar una llamada. **Un closer que se equivoca inventa un registro
que nadie puede quitar**, y ese registro cuenta en el embudo, en la caja y en el comparativo para
siempre. Mani, 18-sep: *"se debe poder anular un registro y borrar cosas desde la app"*.

## Decidimos

**1. Deals, llamadas y abonos se ANULAN, no se borran.** Llevan `anulado_en`, `anulado_por` y el
motivo. No es un booleano: cuando el dinero no cuadra la pregunta es quién lo anuló, cuándo y por
qué. Borrar de verdad tampoco sirve: se lleva la explicación de por qué la caja de ese día bajó.

**2. La anulación se propaga hacia abajo, en una sola escritura atómica.** Anular un deal anula sus
llamadas y sus abonos. Anular un abono no anula el deal (un pago mal tecleado no hace falsa la
oportunidad), **pero el motor recalcula la etapa**: si el deal estaba en Completo por ese abono, deja
de estarlo (transiciones A1 y A2).

**3. Lo anulado desaparece de TODA métrica, y eso lo garantiza un predicado y un guardián.** El
predicado "está vigente" vive en un solo lugar, `vigente(tabla)` en `lib/queries/vigente.ts`; la
consulta que quiere ver lo anulado lo dice con `incluyendoAnulados(tabla)`.
`tests/vigencia-centralizada.test.ts` recorre `lib/`, `app/`, `components/` y `scripts/` y falla si
una lectura de `calls`, `deals` o `abonos` no decide. **El riesgo no es escribir la anulación: es
olvidar una consulta**, porque una cifra inflada se ve creíble y no lanza ningún error.

**4. Lo anulado se ve tachado en la ficha.** *Fuera de las métricas, dentro del historial.*
Esconderlo ahí convertiría la anulación en un borrado con otro nombre.

**5. Quién anula:** el closer, lo que registró él mismo mientras la cohorte siga activa; el gerente,
cualquier registro. El motivo es obligatorio: es la mitad del valor de conservar la fila.

**6. Del catálogo se borra de verdad solo lo que nunca se usó.** Cero referencias: se borra, con
confirmación y fila en `change_log`. Una o más: se desactiva y la app dice cuántas tiene. Lo que no
puede pasar es que la app diga "borrado" habiendo desactivado. Lo hace `borrarSiNoSeUso` en
`lib/catalogo/molde.ts`, y `tests/catalogo.test.ts` exige que sea el único `.delete(` de
`lib/catalogo/` (salvo tablas puente nombradas, como `plataformas_programa`).

## Descartado

| Alternativa | Por qué no |
|---|---|
| Borrar los registros | La caja de un día cambia sin explicación rastreable |
| Un booleano `anulado` | Pierde quién y cuándo |
| Editar el registro en vez de anularlo | Reescribe la historia: el embudo del mes pasado cambiaría después de cerrado. Editar sí se puede, pero para corregir un dato (ADR 0042), no para desaparecer un hecho |
| Filtrar lo anulado a mano en cada consulta | Es la duplicación que el ADR 0024 prohíbe, con el mismo final |
