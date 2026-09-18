---
id: 032
fase: F4
serves: "ADR 0025 punto 5 (al developer no se le restringe nada); cierra un hueco del 028"
depends: [028]
status: todo
---

# 032 — La vista `todo` es MENOS capaz que la vista `closer`

## El sintoma, reproducido en el navegador el 18-sep

Como developer en vista **`todo`** (la de por defecto, la mas ancha), crear una persona en
`/mi-dia` falla con:

> No se pudo crear — **Registrar trabajo de venta es del closer.**

La MISMA accion, con los MISMOS datos, **funciona** en vista `closer`. Se probo seguido: falla en
`todo`, se cambia la vista, funciona.

## Por que es un bug y no una decision

**Porque invierte el modelo entero del 028.** La premisa del ticket y del ADR 0028 es que *la vista
solo puede ESTRECHAR*: `proyectarRol` lo garantiza para el ROL. Pero aca la proyeccion mas ancha
(`todo` → `developer`) resulta **estrictamente menos capaz** que una estrecha (`closer`). Si la
vista mas ancha no es un superconjunto de las estrechas, "estrechar" dejo de significar algo.

Y porque AGENTS.md lo dice sin matices (ADR 0025 punto 5):

> **todo `rol === "..."` escrito a mano que excluya al developer es un bug, no una decision.**

## La causa

`lib/mutations/personas.ts:236`:

```ts
if (actor.rol !== "closer") {
  throw new ErrorDeApp("Registrar trabajo de venta es del closer.", 403);
}
```

Una comparacion literal a mano. La pregunta que quiere hacer —*"¿este actor puede trabajar
leads?"*— ya tiene su funcion: **`trabajaLeads(rol)`** en `lib/auth/roles.ts`, que la cumplen el
closer y el developer y NO el gerente (que es justo lo que este `if` intenta proteger, ADR 0003).

## 🔴 Y lo que mas importa: el guardian del 028 lo EXIME a proposito

`tests/rol-de-vista-centralizado.test.ts` documenta que su forma A exige `.user` antes de `.rol`,
para no marcar `actor.rol === "closer"`, razonando que ese rol *"ya lo armo la accion con
`rolDeVista`, es un rol ya proyectado"*.

**Venir proyectado no lo hace inocuo.** Que el rol este proyectado dice de DONDE salio el valor;
no dice nada sobre si compararlo con un literal excluye al developer. Y excluirlo es exactamente
lo que la regla prohibe. **Este es el tercer punto ciego del mismo guardian en un dia** (los dos
anteriores: solo cazaba comparaciones literales, y no recorria `lib/`).

Arreglar solo la linea 236 deja el guardian igual de ciego para la proxima.

## Alcance

- Dentro: `crearPersonaManual` decide con `trabajaLeads(actor.rol)`, no con un literal.
- Dentro: **ampliar el guardian** para que una comparacion literal contra un rol sea violacion
  aunque la variable no sea `session.user.rol`, con excepciones NOMBRADAS. Revisar de paso
  `lib/mutations/personas.ts:169` (`if (actor.rol === "closer")` en `asignarResponsable`), que hoy
  parece defendible —aplica las restricciones PROPIAS del closer, o sea al developer le da mas, no
  menos— pero que quedaria mejor como predicado positivo.
- Dentro: que el guardian recorra tambien `scripts/`. Ver abajo.
- Dentro: un test que fije la propiedad que hoy se viola: **lo que se puede hacer en vista `closer`
  se tiene que poder hacer en vista `todo`.** Es la unica forma de que no vuelva.
- Fuera: cambiarle nada al gerente. Sigue sin poder registrar (ADR 0003).

## Hallazgo hermano, del mismo recorrido

`scripts/usuarios.ts:124-125` calcula la salvaguarda del ultimo administrador con
`u.rol === "gerente"`, pero AGENTS.md dice que esa salvaguarda es de **`esAdministrador`**, que
cumplen el gerente Y el developer. Una base con un gerente y un developer se niega a desactivar al
gerente aunque quede alguien que administra. Es conservador (no abre un hueco), pero contradice el
documento, y el guardian **no recorre `scripts/`**.

## Done cuando

- [ ] Como developer en vista `todo`, crear persona en `/mi-dia` funciona.
- [ ] El guardian falla ante `actor.rol === "closer"` salvo excepcion nombrada y justificada.
- [ ] El guardian recorre `scripts/`.
- [ ] `scripts/usuarios.ts` usa `esAdministrador` para la salvaguarda.
- [ ] Un test fija que vista `todo` ⊇ vista `closer` en lo que permite.
- [ ] Ningun test de disjuncion gerente/closer cambia de resultado.
