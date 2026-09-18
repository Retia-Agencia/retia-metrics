# 0025 — `developer` es la unica excepcion a la disjuncion de roles

**Fecha:** 2026-09-17 · **Estado:** aceptado (Mani, ticket 024) · **Amplia:** ADR 0003

El ADR 0003 dice que `gerente` y `closer` son conjuntos disjuntos, sin herencia: un endpoint de
gerente rechaza al closer y uno de closer rechaza al gerente. Esa regla es de negocio y sigue
viva.

Pero deja a quien construye la app sin forma de verla. Las pantallas exigen sesion de Google y
nada es publico (`AGENTS.md`), asi que para revisar `/mi-dia` hay que ser closer, para revisar
`/ajustes` hay que ser gerente, y **no hay un rol que las abra las dos**. Hasta hoy la unica
salida era cambiarse el rol en la base entre una revision y otra: se toca produccion para mirar
una pantalla, y queda un rastro de cambios de rol que no corresponden a nada del negocio.

## Decidimos

**1. Existe un tercer rol, `developer`, que pasa TODA guarda:** exclusiva de gerente, exclusiva de
closer o compartida. No es "gerente + closer": es una excepcion declarada, y es la unica.

**2. `gerente` y `closer` siguen disjuntos entre si.** El ADR 0003 no se debilita. Ningun test de
disjuncion cambia de resultado: un gerente sigue sin entrar a `/mi-dia` y un closer sigue sin
entrar a `/ajustes`.

**3. La excepcion vive en UN solo lugar: `esAccesoTotal`, dentro de `puedeAcceder`** (ADR 0024).
No se escribe `"developer"` en ningun `requireRole` ni en ningun `paginaConRol`. Quien decide por
rol pasa por `puedeAcceder`, asi que la regla se enforza sola en las rutas que ya existen y en las
que no existen todavia. Si la excepcion se hubiera repartido por las guardas, la ruta numero 40
que alguien escriba el mes que viene se olvidaria de ella y el rol quedaria roto en silencio.

**4. Una guarda que se pasa no es una pantalla que sirve.** Pasar la guarda solo abre la puerta;
lo que la pagina hace adentro sigue decidiendose por rol. `/mi-dia` y `/productos` proyectan sus
programas segun quien mira: el closer ve donde es miembro, y el developer ve la union de
programas activos, como el gerente. Con la proyeccion de closer, un developer (que no es miembro
de ningun programa) entraria a una pantalla vacia. **Cada pantalla que se agregue a una ruta
exclusiva de closer tiene que decidir esto explicitamente.**

**5. El developer es el DUEÑO: no se le restringe nada, en lo absoluto** (Mani, 18-sep, enmienda
al punto 4). El punto 4 decia que cada pantalla decide su proyeccion "explicitamente", y eso se
leyo como que cada pantalla podia decidir *cualquier cosa*, incluso dejarlo afuera. No. La
proyeccion existe para que una pantalla no le salga VACIA (darle la union en vez de la de un
closer sin membresias); nunca para darle menos de lo que puede hacer un gerente o un closer.

De ahi sale una regla operativa, y es la que hay que aplicar al revisar codigo:

> **Cualquier `rol === "..."` escrito a mano que excluya al developer es un bug, no una decision.**
> La respuesta vive en `lib/auth/roles.ts` y son tres preguntas con tres funciones: `esAccesoTotal`
> (¿pasa toda guarda?), `esAdministrador` (¿administra? gerente + developer), `trabajaLeads`
> (¿puede ser responsable y registrar? closer + developer). Si ninguna encaja, la respuesta nueva
> se agrega ahi, no en el archivo que la necesita.

Esto NO es solo de las guardas de ruta. El punto 3 cerro ese frente con `puedeAcceder`, y el
agujero que quedo fue el de las **reglas de datos**: funciones que preguntan "¿este actor puede
tocar esta fila?" y que viven en `lib/catalogo/` y `lib/mutations/`, lejos de `puedeAcceder`.
`exigirAccesoAlPrograma` en `lib/catalogo/productos.ts` preguntaba `actor.rol === "gerente"`, asi
que un developer caia al chequeo de membresia y recibia un **403 que ademas mentia**: "no puedes
gestionar productos de un programa donde no vendes", cuando el developer no vende en ninguno por
definicion. Se destapo el 18-sep cargando los productos reales de `production`, no en un test.

**Incumplimientos conocidos al 18-sep** (se dejan anotados en vez de fingir que la regla ya se
cumple entera): `app/(app)/recursos/page.tsx` decide `esGerente` con `rol === "gerente"`, asi que
al developer le esconde la creacion de recursos y enlaces. Cae dentro del ticket **028**, que
convierte "¿con que rol proyecto esta pantalla?" en `rolDeVista` y la contesta en un solo lugar.

**6. "Administrar" y "pasar toda guarda" son dos preguntas, no una.** `esAccesoTotal` la cumple
solo el developer; `esAdministrador` la cumplen el gerente y el developer. Hoy la salvaguarda del
ticket 015 usa la segunda: un administrador no puede desactivarse ni bajarse a `closer` a si
mismo, pero pasar de `gerente` a `developer` (o al reves) si se permite, porque no se pierde
administracion. Son dos funciones separadas aunque el developer responda que si a las dos
(AGENTS.md, enmienda al ADR 0024).

## Lo que queda fuera

**"Ver como" gerente o closer.** Un developer ve la union de la interfaz, no un simulador de la
experiencia de cada rol. Si algun dia hace falta probar exactamente lo que ve un closer sin serlo,
es otro ticket y otra decision.

## Consecuencias

- Un rol de la app deja de mapear uno a uno con una persona del negocio de Retia: `developer` es
  un rol de construccion. Se asigna a mano desde `/ajustes/usuarios` y hoy lo tiene una sola
  cuenta.
- Un developer ve la caja, la pauta y el comparativo entre closers. Eso ya no es una excepcion
  suya: el dashboard del CRM abre esos datos a todos los roles desde el ADR 0009.
- Es un rol con acceso total: **quien lo tenga puede hacer todo lo que la app permite**, y por eso
  no se reparte. La auditoria de quien lo tiene es la lista de `/ajustes/usuarios`.

El punto 5 lo cubre `tests/productos.test.ts` ("un developer sin membresias crea un producto en
cualquier programa"), escrito en rojo antes del arreglo. Es un test por caso, no un guardian: hoy
no hay nada que recorra el codigo buscando `rol === "..."` a mano, como si lo hay para la vigencia
(`tests/vigencia-centralizada.test.ts`). Mientras no lo haya, esta regla se sostiene en la revision.

Testeado en `tests/roles.test.ts`, `tests/guards.test.ts`, `tests/paginas.test.ts`,
`tests/usuarios.test.ts` y `tests/migracion-developer.test.ts`.
