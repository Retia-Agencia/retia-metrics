# 0028 — "Ver como": la vista estrecha la proyeccion Y la guarda

**Fecha:** 2026-09-18 · **Estado:** aceptado (Mani, ticket 028) · **Enmienda:** ADR 0025

El ADR 0025 dejo dos cosas escritas que este ADR toca:

1. Su frase central: **"el developer pasa TODA guarda"**, sin condicion.
2. En "Lo que queda fuera": **"'Ver como' gerente o closer... es otro ticket y otra decision."**

Ese ticket es el 028, y aca esta la decision.

## El problema de fondo (no es el selector)

El selector de "ver como" es la mitad menos importante. La pregunta **"¿con que rol pinto esta
pantalla?"** vivia contestada A MANO en tres sitios, con tres expresiones distintas:

```
/mi-dia    →  session.user.rol === "closer" ? "closer" : "gerente"
/recursos  →  esAdministrador(session.user.rol)
/productos →  su propia inversion de lo mismo
```

Eso es el ADR 0024 (una respuesta por pregunta) incumplido, y **fue la causa de que el hueco de
`/recursos` sobreviviera al ticket 024**: se invirtieron dos de las tres copias y la tercera no
aviso. Una cuarta pantalla habria agregado una cuarta copia. El sintoma se arreglo aparte
(la prop paso de `esGerente` a `puedeEditar`), pero la enfermedad —tres copias— seguia.

## Decidimos

**1. `rolDeVista(session)` en `lib/auth/vista.ts` es LA definicion de con que rol se proyecta y se
guarda una pantalla.** Ninguna pagina vuelve a comparar `session.user.rol` a mano: `/mi-dia`,
`/recursos` y `/productos` la importan, `navParaRol` recibe su resultado, y `actorDe` en
`/mi-dia/acciones.ts` construye el actor de las mutaciones con ella. Es la misma regla del ADR
0024: si dos lugares responden la misma pregunta, la respuesta vive en un modulo.

**2. La vista solo puede ESTRECHAR, nunca ensanchar.** `rolDeVista` mira primero el rol real: si
NO es developer (`esAccesoTotal` es `false`), el valor de la cookie se ignora entero y devuelve el
rol real. Por construccion no nace un segundo camino al privilegio. Un closer con una cookie
`vista=gerente` puesta a mano sigue siendo closer; el unico efecto posible de la vista es que un
developer PIERDA acceso, nunca que alguien gane. La disjuncion del ADR 0003 no se toca, y ningun
test de disjuncion cambia de resultado.

**3. Hay tres vistas, en una cookie:** `todo` (por defecto, la proyeccion mas ancha — el developer
se proyecta como si mismo y pasa toda guarda), `gerente` y `closer`. La cookie tiene un solo punto
de escritura (la server action `cambiarVista`, que exige `esAccesoTotal` en el servidor) y un solo
punto de lectura (`rolDeVista`). No es `httpOnly` porque no guarda ningun secreto y no otorga
privilegio por si sola (ver punto 2). El literal `"developer"` NO se escribe en la cookie ni en
ninguna consulta: `rolDeVista` decide con `esAccesoTotal`, no comparando el string (ADR 0025
punto 3).

**4. La vista estrecha tambien la GUARDA, no solo la proyeccion.** `requireRole` y `paginaConRol`
evaluan contra `rolDeVista`, no contra `session.user.rol`. Un developer en vista `closer` no entra
a `/ajustes`; en vista `gerente` vuelve a tener prohibido `/mi-dia` (ADR 0003). Tres razones, todas
de Mani el 18-sep:

- **Estrechar nunca otorga** (punto 2): el unico efecto es que un developer pierda acceso, asi que
  es seguro.
- **Si solo estrechara la proyeccion no seria una vista, seria una etiqueta:** el developer
  seguiria viendo Ajustes y Nerd Stats en el nav mientras "simula" ser closer.
- **Hay salida:** el selector del menu de usuario se renderiza SIEMPRE que el usuario sea developer
  (por rol real, no por vista), independiente de la vista activa. Es la unica salida cuando la
  vista `closer` esconde Ajustes y Nerd Stats.

**5. Enmienda explicita a la frase del ADR 0025:** el developer pasa toda guarda **con la vista en
`todo`, que es el valor por defecto**. Con la vista puesta en `gerente` o `closer`, pasa lo que
pasa ese rol. Sigue siendo el DUEÑO (ADR 0025 punto 5): puede volver a `todo` cuando quiera, y
nadie mas puede estrecharlo.

**6. Ser responsable de un lead se decide con `trabajaLeads`, no con `eq(users.rol, "closer")`.**
`esCloserValidoEnPrograma` (`lib/mutations/personas.ts`) filtraba el rol contra la base, asi que un
developer en vista `closer` no pasaba el chequeo de asignacion aunque la guarda lo dejara registrar.
Ahora lee la columna `rol` y decide en memoria con `trabajaLeads` (closer + developer), sin escribir
`"developer"` en la consulta: la excepcion sigue en un solo lugar (ADR 0025).

## Consecuencias

- Un developer prueba la app EXACTAMENTE como la ve un gerente o un closer, sin tocar su rol en la
  base (que era la unica salida antes del ADR 0025, y dejaba rastro de cambios de rol falsos).
- El guardian nuevo `tests/rol-de-vista-centralizado.test.ts` recorre `app/` y falla si una pagina
  compara `session.user.rol` a mano en vez de pasar por `rolDeVista` (mismo molde que el guardian
  de slugs del ticket 009 y el de vigencia del ADR 0026). Cierra el frente que el ADR 0025 punto 5
  dejo abierto: hasta hoy "ningun `rol === "..."` a mano" se sostenia solo en la revision.
- **⚠️ Las escrituras del developer en vista `closer` son reales y no se pueden anular** (hoy no
  existe borrado ni anulacion de una llamada, ADR 0026 pendiente). Una llamada de prueba en
  `production` mete al developer en el comparativo entre closers de forma permanente: **las pruebas
  del developer van en `dev`**.
- Sin migracion: la cookie no es esquema, y el `closerId` del developer se carga desde
  `/ajustes/usuarios`, que ya existe (ticket 015, adelantado por el 029).

## Lo que queda fuera

- **Anular un registro.** Es una carencia real y otro ticket (toca cada consulta del embudo).
- Persistir la vista por usuario en la base: una cookie por navegador alcanza para una herramienta
  de construccion de un solo dueño.
