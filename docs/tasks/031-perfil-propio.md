---
id: 031
fase: F4
serves: "spec §5 criterio 5 (precondición operativa); enmienda al ADR 0011"
depends: [028]
status: done
---

# 031 — Perfil propio: el closerId se carga sin pasar por /ajustes/usuarios

## Objetivo
Una persona con acceso total puede cargarse su propio `closerId` desde su perfil en el
dashboard, sin depender de que otro se lo cargue desde `/ajustes/usuarios`.

## Por qué, y de dónde salió

Pedido de Mani el 18-sep, mientras se preparaba la primera llamada real en `production`:
*"lo de que un dev necesita closer id se debería poder asignar desde la configuración del
perfil en el dash"*.

El caso concreto que lo destapó: `production` tiene a Mani como `developer` con
`closer_id = null` y **cero membresías**. `exigirCloserIdCargado` responde 400 seco
("Tu cuenta no tiene closerId cargado") y no hay forma de avanzar sin ir a otra pantalla.
Hoy el único camino es `/ajustes/usuarios`, que es la pantalla de administrar A OTROS.
**Cargarse cosas a uno mismo y administrar a terceros son dos preguntas distintas** y hoy
comparten una sola pantalla.

## ✅ La decisión, CERRADA por Mani el 18-sep: opción 1

**`closerId` no es una preferencia: es la llave que ata un usuario a su historia.** El
comparativo entre closers agrupa `calls` / `sales` / `abonos` por `closer_id`, y esos valores
vienen de la columna "Closer" de las hojas. `Andrea` tiene 317 llamadas históricas.

Si un closer pudiera editar su propio `closerId`, **podría atribuirse la historia de otro
escribiendo `Andrea` en un campo de texto.** No habría error, no habría cifra rara: el
dashboard simplemente mostraría otra cosa. Es exactamente la forma de falla que este repo ya
conoce (el centinela del año 1, la subconsulta correlacionada del 025).

Las opciones, sin elegir por Mani:

1. **Solo lo edita quien tiene acceso total** (`esAdministrador`). Un closer ve su `closerId`
   en su perfil pero en modo lectura. Resuelve el caso que originó el pedido y no abre el
   agujero. Es lo más conservador.
2. **Cualquiera lo edita, pero solo si está vacío.** Un `closerId` ya cargado no se cambia
   desde el perfil. Barato, pero el primer valor sigue siendo libre.
3. **Cualquiera lo edita libremente.** Descartada salvo argumento nuevo: es la que permite
   el robo de historia descrito arriba.

**Sea cual sea, la respuesta vive en `lib/auth/roles.ts` junto a `esAccesoTotal` /
`esAdministrador` / `trabajaLeads`, no en el archivo de la pantalla** (ADR 0025). Y nunca se
escribe el literal `"developer"` en la guarda.

### Veredicto: **opción 1 — solo lo edita quien tiene acceso total (`esAdministrador`)**

Un closer ve su `closerId` en el perfil, en modo lectura, con la indicación de a quién pedírselo.

Por qué esta y no la 2 (*"cualquiera, pero solo si está vacío"*):

1. **La 2 guarda el caso barato y deja abierto el caro.** El momento de riesgo no es cambiar un
   `closerId` ya cargado: es el PRIMERO. Una cuenta recién creada con el campo vacío es
   exactamente la situación de quien quisiera escribir `Andrea` y heredar sus 317 llamadas.
   Poner la reja después de ese momento es ponerla donde no pasa nada.
2. **La 2 mezcla autorización con estado de la fila.** "¿Puede este actor hacer esto?" pasaría a
   depender de si una columna está en `null`, no de una capacidad. Eso obliga a un predicado
   nuevo cuya verdad cambia con los datos, y es justo lo que el ADR 0025 empuja a no hacer.
3. **La 1 no necesita nada nuevo.** `esAdministrador` ya existe en `lib/auth/roles.ts` y ya
   significa "gerente o developer". Cero predicados, cero literales.
4. **Resuelve el caso que originó el pedido.** Mani es `developer`, o sea `esAdministrador`: se
   carga su propio `closerId` desde el perfil sin pasar por la pantalla de administrar a otros.
5. **No cuesta operación.** Hay 3 usuarios en `production` y el alta de un closer ya pasa por
   alguien que administra. Nadie queda esperando.

**Ojo con el alcance real de este ticket: NO es el bloqueo para registrar la primera llamada.**
Medido en `production` el 18-sep: el usuario de Mani es `developer` con `closer_id = null`, y
como `developer` cumple `esAdministrador`, **ya puede cargárselo hoy desde `/ajustes/usuarios`**.
Este ticket es ergonomía (no pasar por la pantalla de administrar a terceros), no un desbloqueo.

## Alcance

- Dentro: una pantalla de perfil propio (`/perfil` o equivalente) donde se ve y, según la
  decisión de arriba, se edita el `closerId` propio.
- Dentro: el selector de vista del 028 vive en el menú de usuario. Si esta pantalla existe,
  decidir si el selector se queda ahí, se mueve, o aparece en los dos sitios. **No duplicar la
  fuente:** la vista la sigue contestando `rolDeVista` y nadie más.
- Dentro: el cambio queda en `change_log` como cualquier alta del catálogo (ADR 0012).
- Dentro: tests. El que importa es el negativo — **un closer no puede escribirse el `closerId`
  de otro**, cualquiera que sea la opción elegida.
- Fuera: editar membresías propias. Asignarse a un programa es distinto a nombrarse, y ahí sí
  vale la pena que lo haga un administrador.
- Fuera: cambiarse el rol. Nunca.

## Done cuando

- [x] La decisión de arriba está tomada y escrita (opción 1, arriba, 18-sep).
- [x] Un developer sin `closerId` puede cargárselo sin entrar a `/ajustes/usuarios` (`/perfil`).
- [x] Un closer NO puede atribuirse un `closerId` que no le corresponde (`tests/acciones-perfil.test.ts`, incluido el developer proyectado a vista `closer`).
- [x] El cambio aparece en `change_log` (la mutación reusa el molde, no hace `db.update` a mano).
- [x] `/ajustes/usuarios` sigue funcionando igual para administrar a terceros (sus tests siguen en verde).

## Notas

Depende del 028 porque comparte el menú de usuario y porque `rolDeVista` tiene que existir
antes de decidir dónde vive el selector.

## Estado al cerrar (18-sep)

Implementado por Kiro, revisado por la sesión principal. 556 tests, typecheck y lint limpios.

- `app/(app)/perfil/` (página + server action), `components/perfil-propio.tsx`.
- `lib/catalogo/usuarios.ts` suma `editarCloserIdPropio`, que **reusa el mismo molde**
  (`moldeUsuarios(db).editar`) en vez de duplicar el `db.update`: lee la fila, le pone el
  `closerId` nuevo encima, y el molde escribe una sola entrada en `change_log`. No se reusó
  `editarUsuario` tal cual porque exige el set completo de campos y su `superRefine` le pediría
  programas a un closer.
- La autorización vive en la server action (`esAdministrador(rolDeVista(session))`), no en el
  módulo de catálogo, igual que `requireRole` vive fuera del molde.
- El selector "ver como" **no se movió ni se duplicó**: sigue solo en el menú de usuario.

✅ **Recorrido en navegador HECHO** (18-sep, contra `dev`, con Mani logueado). No solo se cargó
la pantalla: se hizo clic en todo lo que abre, que es lo que rompe en Base UI.

- **El menú de usuario abre sin tumbar el layout** y sin un solo error en consola. Era el riesgo
  real: el bug de `MenuGroupContext is missing` del CIERRE 7 vivió días con 543 tests en verde.
  Se ve la cabecera, el grupo "Ver como" con sus tres radios, "Mi perfil" y "Cerrar sesión".
- **"Mi perfil" navega a `/perfil`** y la pantalla renderiza identidad (nombre, correo) + el
  `closer_id` con su explicación.
- **Escritura real:** `Mani` → `Mani Prueba` → toast *"closer_id actualizado"* → en la base quedó
  el valor nuevo y **exactamente UNA fila** en `change_log` (`campo: closerId`, `origen: app`, con
  el `userId` de quien lo hizo). El molde hizo lo que promete: solo registra la columna que cambió.
- **En vista `closer` el input desaparece** y queda texto plano con *"Solo un administrador puede
  cambiarlo. Pídeselo a tu gerente."*, y el nav pierde Nerd Stats y Ajustes.

🎯 **Y se probó lo que de verdad importa, que NO es que el input no se pinte.** Se capturó el id de
la server action interceptando `fetch` en la página, se cambió la vista a `closer`, y se invocó la
acción **a mano, saltándose la interfaz entera**, mandando `closerId: "Andrea"` (literalmente el
ataque que describe este ticket). El servidor respondió:

> `{"ok":false,"error":"Solo un administrador puede editar el closer_id. Pídeselo a tu gerente."}`

y la base no se movió. **Esconder el input no era la seguridad; la seguridad estaba en el servidor,
y ahora está medido en vez de supuesto.**

Segunda mitad de la propiedad, también forjada: se mandó el cuerpo con un `id` y un `userId`
ajenos metidos a mano. **Se ignoraron los dos** y la escritura cayó en la propia fila, porque el
esquema zod solo admite `closerId` y la acción pasa `session.user.id`. No hay camino para que el
objetivo venga del input.

Los tres cambios de prueba en `dev` quedaron revertidos (`closer_id` volvió a `Mani`); las 4 filas
de `change_log` que generaron se dejan porque son historia real de la base de pruebas.
