# 0046 — El CRM genera los links de captacion, y por eso el estandar de UTM deja de ser opcional

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani) · **Implementacion:** tickets 092, 084, 086 ·
**Aplica:** ADR 0017, ADR 0033, ADR 0042 ·
**Enmienda:** ADR 0044 punto 2 (le faltaba un prerequisito), ADR 0045 puntos 1 y 4

## El problema, y el agujero que destapo

Mani: *"el CRM debe tener la capacidad de crear nuevas campanas, conjuntos y anuncios para generar
links para cada programa. Para esto, al crear el programa se le debe asignar el link de su forms, su
calendly y demas info necesaria."*

🩸 **Lo primero que hay que reconocer: el ADR 0044 tiene un prerequisito que no existe.** Ahi se
escribio que el enlace de captacion de un closer es *"la URL de la fuente del programa mas los
parametros del closer"*. Verificado contra el esquema el 21-sep:

| Dato | ¿Existe? | Donde |
|---|---|---|
| Calendly del programa | ✅ | `programs.calendly_url` |
| Pagina de venta | ✅ | `programs.web_url` |
| **URL publica del formulario** | ❌ | **en ninguna parte** |
| Donde caen las respuestas | ✅ | `sources.sheet_id` + `sources.tab` |

`grep -rn "typeform|formUrl|form_url"` sobre `lib/`, `app/` y el esquema devuelve **cero**. **El CRM
sabe donde CAEN las respuestas, no donde la gente LLENA.** Sin eso, el enlace del ADR 0044 no se puede
calcular: el diseno era correcto y le faltaba el dato.

## Decidimos

**1. `programs` gana la URL publica del formulario.** Es el dato del que cuelga todo lo demas, y va en
el programa y no en `sources` porque el formulario es del programa: la fuente dice de que hoja se lee,
no a que link apunta la pauta.

**2. El CRM es el REGISTRO y el GENERADOR de los links, no el administrador de Meta.**

```
campanas (id, program_id NOT NULL, nombre, plataforma, cohort_id?, activo)
piezas   (id, campana_id NOT NULL, padre_id?, nivel, nombre, activo)
```

`piezas` es el arbol de **conjuntos y anuncios** bajo una campana: `padre_id` nulo = conjunto, con
padre = anuncio. Es una tabla y no dos porque un conjunto y un anuncio son **lo mismo con distinta
profundidad** —un nombre en un arbol—, mientras que la campana si es otra cosa: tiene plataforma,
cohorte y presupuesto.

**El link es DERIVADO, nunca guardado:** `programs.form_url` mas los UTM que salen de caminar el arbol
hacia arriba. Misma regla que la comision del ADR 0024 y que el enlace del closer: **un link guardado
y el formulario cambiado son dos verdades.** Se muestra con un boton Copiar.

**3. 🎯 Crear una pieza escribe su patron UTM en la MISMA operacion.** Y esta es la razon de fondo de
todo el ADR, no un detalle de implementacion.

Con macros de Meta hay **dos actos independientes que tienen que coincidir**: alguien configura
`{{ad.name}}` en Meta, y alguien mas escribe el patron que va a reconocer ese texto. **Si divergen, el
lead cae en `(sin clasificar)` o —peor— casa con el patron equivocado.**

Con el link generado hay **un solo acto**: crear el anuncio produce el link Y el patron que lo
reconoce, de la misma fila. **No pueden discrepar por construccion.** Es exactamente el molde del
ADR 0042 (`crearConRastro`: la escritura y su `change_log` en la misma operacion) y de la regla
general del repo: si dos lugares tienen que dar la misma respuesta, la respuesta vive en un modulo.

**4. Y por eso el estandar de UTM deja de depender de que alguien lo recuerde.** El ADR 0045 punto 4
decia, con razon, que *"el CRM no puede imponerlo: se configura en Meta"*. **Con el link generado, si
puede**: el trafficker no escribe parametros, **pega un link que ya los trae correctos**. El
incumplimiento pasa de *detectable* a *imposible* por el camino normal.

⚠️ **Enmienda al ADR 0045 punto 4**, que sigue vigente para lo que el CRM no genera: lo organico de
Media, el historico, y cualquier link que alguien arme a mano.

**5. 🩸 `ad_spend` cuelga de la PIEZA, no de la campana.** Correccion al ADR 0045 punto 1.

Meta reporta gasto **por anuncio**. Si el gasto cuelga de la campana y los leads se atribuyen al
anuncio, **las dos mitades del CPL vuelven a cortarse a distinto nivel** — que es literalmente el
problema que el ADR 0045 existia para resolver, ahora un escalon mas abajo y por dentro.

El gasto se captura **al nivel mas fino que se tenga**, y la **regla del cero** decide que se muestra:
si solo se cargo a nivel campana, el CPL por anuncio **no se muestra, dice "sin desglose"**. Nunca se
reparte el gasto de la campana entre sus anuncios: un prorrateo inventado se ve igual que un dato.

## Lo que NO entra

- **Crear campanas en Meta por API.** El CRM registra y genera links; no administra Meta. Si algun dia
  entra, entra por la misma funcion que ya genera el link.
- **Los links de campana NO son recursos.** Un **recurso** (ADR 0017) es material que un closer le manda
  a **un lead**, elegido por un humano en un momento de la conversacion. Un link de campana es
  **infraestructura de captacion**: existe para pegarse en Meta o en una bio, y su razon de ser es ser
  rastreado. La prueba concreta: un closer buscando que mandarle a un lead **nunca** quiere ver
  *"anuncio 5 de la campana de junio"*, y un trafficker buscando su link **nunca** lo busca en
  `/recursos`. Son dos dominios y van dos pantallas (ADR 0033).
  **Lo que SI se comparte es el generador:** *"URL del formulario mas parametros UTM"* es **una sola
  funcion** que sirve al link del closer (ADR 0044) y al link del anuncio. El mecanismo en un modulo,
  las pantallas separadas.

## Consecuencias

- `programs` gana `form_url`; `campanas` y `piezas` son nuevas; `ad_spend` cuelga de `piezas`.
- El desglose por anuncio es confiable **desde que los links generados esten en Meta**, no antes.
- ⚠️ **El arbol del CRM puede divergir del de Meta y el CRM no lo sabe.** Si alguien pausa o borra un
  anuncio alla, aca sigue existiendo. Lo unico que el CRM puede decir es *"este anuncio no trae leads
  desde tal fecha"*, y **eso no distingue un anuncio pausado de uno caro**. Se dice asi en la pantalla;
  no se infiere el estado.
- ⚠️ **Un anuncio creado en Meta sin pasar por el CRM sale sin UTM correcto.** El proceso falla
  **visiblemente** (no hay link que copiar) en vez de silenciosamente (el UTM queda mal), que es la
  mejora real sobre las macros. Pero sigue dependiendo de que el trafficker use el CRM primero: **eso
  es playbook, no codigo.**

## Alternativas descartadas

| Alternativa | Por que no |
|---|---|
| Macros de Meta (`{{ad.name}}`) como unico camino | Dos actos independientes que tienen que coincidir. Sigue valiendo para lo que el CRM no genera |
| Los links dentro de `recursos` | Otro dominio: material para un lead vs infraestructura de captacion (ADR 0033) |
| Tres tablas (campana, conjunto, anuncio) | Un conjunto y un anuncio son lo mismo con distinta profundidad. La campana si es otra cosa |
| Guardar el link generado | Un link guardado y el formulario cambiado son dos verdades (ADR 0024) |
| `ad_spend` a nivel campana | Corta a distinto nivel que los leads: el problema que este ADR y el 0045 existen para evitar |
| Prorratear el gasto de la campana entre sus anuncios | Un numero inventado que se ve igual que un dato |

---

## Nota 2026-09-21 (Mani): los dos limites se cierran con un CUARTO ROL, y eso se decide aparte

Mani: *"eso se soluciona cuando los Paid Traffickers tengan su perfil y rol para entrar al CRM y
manejar todo el tema de creacion de pautas por programa."*

**Es correcto:** si el trafficker arma la pauta dentro del CRM, no hay dos arboles que diverjan ni
anuncios con links sin UTM. Los dos limites de la seccion *Consecuencias* dejan de existir.

⚠️ **Pero es un cuarto rol y toca la arquitectura de permisos.** Hoy `lib/auth/roles.ts` contesta tres
preguntas —`esAccesoTotal`, `esAdministrador`, `trabajaLeads`— y **un paid trafficker no cumple
ninguna**: no vende, no administra el CRM, no trabaja leads. Necesita una cuarta, `manejaPauta`, y
sigue mandando la regla del ADR 0025: **la pregunta nueva se agrega en `lib/auth/roles.ts`, nunca en
el archivo que la necesita**, y **nunca se escribe un `rol === "..."` a mano**.

**No bloquea nada:** hasta que exista, las campanas las carga un gerente. Queda escrito para que el
dia que haga falta no se improvise un `rol === "trafficker"` repartido por las pantallas, que es
exactamente el bug que el ADR 0025 existe para evitar.

---

## ⚠️ Enmienda 2026-09-21 (Mani): sin conjunto ni anuncio, el arbol se aplana

Con el estandar reducido a tres campos (ADR 0045, enmienda 2), **no hay niveles bajo la campana**.

- **`piezas` desaparece.** No hay conjuntos ni anuncios que registrar: una campana tiene **un** juego
  de UTM y **un** link. El punto 2 queda en `campanas` y nada mas.
- **El punto 5 se revierte:** `ad_spend` cuelga de la **campana**, porque no existe un nivel mas fino
  al que colgarlo. La razon de la correccion —que el gasto y los leads se cortaran a distinto nivel—
  desaparece con el nivel.
- **Lo que NO cambia, y es el corazon del ADR:** `programs.form_url`, el **generador unico** de links
  compartido con el enlace del closer, y que **crear una campana escriba su patron en la misma
  operacion**. Ese punto 3 sigue siendo la razon de ser de todo esto: un solo acto en vez de dos que
  tienen que coincidir.
- **El punto 4 tambien sobrevive:** el CRM sigue imponiendo el estandar por construccion, porque el
  trafficker pega un link que ya trae los tres UTM correctos.

**El ticket 092 encoge:** `programs.form_url` + el generador. Sin arbol, sin tabla nueva mas alla de
`campanas`.

---

## Enmienda 2026-09-24 (ADR 0051 y ADR 0052)

- **Punto 1:** `programs.form_url` pasa a ser **uno de los destinos** del programa. El builder genera
  links hacia el formulario y hacia las URL de checkout del programa.
- **La nota del cuarto rol queda decidida:** el Paid Trafficker entra en el builder v1 (ADR 0052).
- El builder v1 replica el de 30X: destino, canal (source y medium), campaña y los dos opcionales.
  Fuera de v1: URL libre y el acortador.
