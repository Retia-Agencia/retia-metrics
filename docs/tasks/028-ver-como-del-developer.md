---
id: 028
fase: F4
serves: "continuación del 024 (su 'Fuera: ver como'); enmienda al ADR 0025"
depends: [024]
status: todo
---

# 028 — "Ver como" del developer

## Objetivo
Un developer ve toda la app y además puede **cambiar de vista** para ver (y usar) la app
exactamente como la ve un gerente o un closer, sin cambiarse el rol en la base.

## Por qué ahora, y cuál es el problema de fondo

El 024 dejó esto explícitamente fuera ("Fuera: `ver como` gerente o closer (futuro)") y el
tracker lo tenía en Futuro. Mani lo pidió el 18-sep tras el recorrido visual.

Pero el selector es la mitad menos importante del ticket. **La pregunta "¿con qué rol pinto esta
pantalla?" hoy está contestada a mano en tres sitios, con tres expresiones distintas:**

```
/mi-dia    →  session.user.rol === "closer" ? "closer" : "gerente"
/recursos  →  session.user.rol === "gerente"
/productos →  su propia inversión
```

Eso es el ADR 0024 incumplido, y **es la causa de que el hueco de `/recursos` sobreviviera al
024**: se invirtieron dos de los tres y el tercero no avisó. Una cuarta pantalla habría agregado
una cuarta copia. Verificado en vivo el 18-sep: como developer, `/recursos` no muestra ni un
control de edición.

## Alcance

- **Dentro: `rolDeVista(session)` en `lib/auth/vista.ts`. Es LA definición** de con qué rol se
  proyecta. Ninguna página vuelve a comparar `session.user.rol` a mano. `/mi-dia`, `/recursos` y
  `/productos` pasan a importarla; `navParaRol` la recibe.
- **Dentro: la vista solo puede ESTRECHAR, nunca ensanchar.** Si el rol de la sesión no es
  `developer`, el valor de vista se ignora entero y `rolDeVista` devuelve el rol real. Por
  construcción no nace un segundo camino al privilegio.
- Dentro: tres vistas — `todo` (por defecto, la proyección más ancha de cada pantalla),
  `gerente`, `closer`.
- Dentro: la vista vive en una **cookie** (decisión de Mani, 18-sep), escrita por una server
  action y leída por `rolDeVista`. Un punto de lectura y uno de escritura.
- Dentro: el selector va en el menú de usuario, donde hoy dice "Desarrollo", y **se renderiza
  siempre, independiente de la vista activa**: es la única salida cuando la vista closer esconde
  Ajustes y Nerd Stats.
- Dentro: `actorDe(session)` en `app/(app)/mi-dia/acciones.ts` construye el actor con
  `rolDeVista`, no con `session.user.rol`. Con eso `crearPersonaManual` y `asignarResponsable`
  funcionan sin tocarse: un developer en vista closer **es** un closer para la capa de
  mutaciones, y en vista gerente vuelve a tener prohibido registrar (ADR 0003).
- Dentro: `esCloserValidoEnPrograma` filtra hoy `eq(users.rol, "closer")` contra la base, así que
  un developer no pasa ni con la vista puesta. Se relaja con una función nueva al lado de
  `esAccesoTotal` / `esAdministrador` (tercera pregunta de la misma familia:
  *"¿puede ser responsable de un lead?"*). **Nunca se escribe `"developer"` en la consulta**, o
  se rompe la regla de que la excepción vive en un solo lugar (ADR 0025).
- Dentro: ADR nuevo que enmienda el 0025, con las dos cosas que decide (ver abajo).
- Dentro: tests. El que falta y es el que importa: **un developer en vista closer no ve los
  controles de `/recursos`; en vista gerente sí**. Y el simétrico: un closer de verdad con una
  cookie de vista `gerente` sigue viendo lo de closer.
- **Fuera: anular un registro.** Es una carencia real (hoy no existe ni un `.delete(` en `lib/`,
  `app/` ni `scripts/`, y `calls` no tiene columna para desactivar), pero es otro ticket y toca
  cada consulta del embudo.
- Fuera: migración. La cookie no es esquema y el `closerId` del developer se carga desde
  `/ajustes/usuarios`, que ya existe (015).

## Decisión abierta que hay que cerrar antes de codear

**¿La vista estrecha también la GUARDA, o solo la proyección?**

- Solo proyección: un developer en vista closer sigue entrando a `/ajustes`. Entonces no es una
  vista, es una etiqueta.
- También la guarda: la simulación es fiel, y es segura porque estrechar nunca otorga privilegio.
  La salida es el selector del menú de usuario, que no depende de la vista.

**DECIDIDO el 18-sep (Mani lo pidió, la sesión lo argumentó): la vista estrecha también la
guarda.** Tres razones: estrechar nunca otorga (si el rol de sesión no es `developer` el valor de
vista se ignora entero, así que el único efecto posible es que un developer PIERDA acceso); si solo
estrechara la proyección no sería una vista sino una etiqueta, porque el developer seguiría viendo
Ajustes y Nerd Stats en el nav; y hay salida, porque el selector no depende de la vista.

**Recomendación original, que es la que se aceptó:** Cambia la frase central del ADR 0025 ("el
developer pasa toda guarda"), así que la enmienda tiene que decirlo explícito: *pasa toda guarda
con la vista en `todo`, que es el valor por defecto.*

## Adelantado por el ticket 029 (18-sep)

Dos piezas de este ticket ya están en `main`, porque el 029 se topó con ellas:

- **`trabajaLeads(rol)` en `lib/auth/roles.ts`**, la tercera pregunta de la familia que este
  ticket pedía ("¿puede ser responsable de un lead?"). La cumplen closer y developer, no el
  gerente. Con test en `tests/roles.test.ts`.
- **`/ajustes/usuarios` ya deja cargarle el `closer_id` y las membresías a un developer.**
  Preguntaba `rol === "closer"` a mano, así que **este ticket daba por hecho algo que no existía**:
  su criterio "con el closerId cargado" era imposible desde la app. Encontrado al intentar
  registrar una llamada como developer en el recorrido del 18-sep.

Lo que sigue pendiente es el corazón del ticket: `rolDeVista(session)`, la cookie, el selector en
el menú de usuario, y que `/mi-dia`, `/recursos` y `/productos` dejen de comparar `session.user.rol`
a mano. Y `esCloserValidoEnPrograma` en `lib/mutations/personas.ts`, que sigue filtrando
`eq(users.rol, "closer")` contra la base: ahí es donde `trabajaLeads` todavía no se usa.

## Done cuando

- [ ] `rolDeVista` es la única función que contesta con qué rol se proyecta; ninguna página
      compara `session.user.rol` a mano. Un test lo guarda (como el guardián de slugs del 009).
- [ ] Como developer en vista `gerente`, `/recursos` muestra los controles de edición.
- [ ] Como developer en vista `closer`, `/mi-dia` deja buscar, crear persona, tomarla y registrar
      llamada y abono de punta a punta (con el `closerId` cargado **y membresía activa en el
      programa**: el buscador se filtra por membresía, no por rol — verificado el 18-sep, un
      developer con membresías sí encuentra personas).
- [ ] Como developer en vista `gerente`, `/mi-dia` vuelve a negar el registro (ADR 0003).
- [ ] Un gerente o un closer con la cookie de vista puesta a mano no cambian de proyección.
- [ ] El selector se ve siempre, incluso en la vista que esconde Ajustes y Nerd Stats.
- [ ] Ningún test existente de disjunción gerente/closer cambia de resultado.

## Notas

**Las escrituras del developer son decisión explícita de Mani (18-sep).** Se le carga su propio
`closerId` y, en vista closer, hace lo que hace un closer. El comparativo entre closers se arma
desde `calls`/`sales`/`abonos` agrupando por `closer_id`, **no** desde `users`: verificado en
`embudoPorCloser`. Un developer sin actividad no produce grupo y no aparece en el dashboard.

⚠️ **La contracara, verificada el 18-sep:** una llamada registrada no se puede anular. Así que las
pruebas del developer van en `dev`. Una llamada de prueba en `production` lo mete en el
comparativo entre closers de forma permanente.
