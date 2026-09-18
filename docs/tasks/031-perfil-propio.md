---
id: 031
fase: F4
serves: "spec §5 criterio 5 (precondición operativa); enmienda al ADR 0011"
depends: [028]
status: todo
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

## ⚠️ La decisión que hay que tomar antes de codear, y no es cosmética

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

- [ ] La decisión de arriba está tomada y escrita (aquí o en un ADR).
- [ ] Un developer sin `closerId` puede cargárselo sin entrar a `/ajustes/usuarios`.
- [ ] Un closer NO puede atribuirse un `closerId` que no le corresponde (test negativo).
- [ ] El cambio aparece en `change_log`.
- [ ] `/ajustes/usuarios` sigue funcionando igual para administrar a terceros.

## Notas

Depende del 028 porque comparte el menú de usuario y porque `rolDeVista` tiene que existir
antes de decidir dónde vive el selector.
