# 0045 — La Campana es una entidad, el patron UTM declara su nivel, y el emparejamiento es determinista

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, tras la reunion con Alejo Carvajal) ·
**Implementacion:** tickets 084, 089, 091 (dentro del 067) · **Aplica:** ADR 0012, ADR 0004, ADR 0043,
ADR 0044 · **Enmienda:** ADR 0039 punto 4 (el grano de `ad_spend`)

## El problema

Gerencia pidio *"ver si las inversiones se convierten en ventas"*, y Pauta mide **todo por UTM**. Para
contestarlo hay que dividir inversion entre leads. Y hoy **las dos mitades no se pueden cortar con la
misma llave**:

- El lead trae su origen en `submissions.utm_source / utm_medium / utm_campaign / utm_term /
  utm_content`.
- El costo vive en `ad_spend`, que **no tiene ni una columna UTM**: tiene `campana` y `creativo`,
  **texto libre**, cargados a mano.

🩸 **Son dos textos que nadie garantiza que coincidan.** Unirlos para calcular un CPL rebanado seria
comparar cadenas entre dos sistemas que no se hablan — letra por letra la herida del ADR 0030 (`Mani`
y `mani` como dos closers), ahora entre la hoja del paid trafficker y el Typeform. Y fallaria del modo
peor: **sin error, con el CPL de una campana saliendo con menos leads de los que tuvo y por lo tanto
mas caro**, o al reves.

## Decidimos

**1. La Campana es una entidad de catalogo, y `ad_spend` cuelga de ella.**

```
campanas   (id, program_id NOT NULL, nombre, plataforma, cohort_id?, activo)
ad_spend   (campana_id, fecha, inversion, moneda, ...)
```

Mani: *"al crear campanas deban tener uno o mas UTMs asociados, para tener metricas por campana y por
UTM."* Se descarto poner las cinco columnas UTM sueltas sobre `ad_spend`: el juego de UTM de una
campana **es estable y se reusa**, asi que escribirlo en cada fila de gasto diario lo repite cientos
de veces e invita al error de tecleo, que es la misma herida un nivel mas adentro.

**"Uno o mas" es la cardinalidad correcta:** una campana tiene varios conjuntos y varios creativos,
asi que una campana es **muchos patrones**, no uno.

Enmienda al **ADR 0039 punto 4**, que dejaba abierto el grano de `ad_spend`: el grano es
**campana + fecha**, y el indice `ad_spend_huella_idx` —que existia para deduplicar filas de una
hoja— deja de tener sentido como llave.

**2. Los patrones UTM son UNA tabla, no dos.** Lo que se habia llamado "clasificacion UTM → area" y
lo que necesita la campana **son la misma cosa**: *un patron UTM apunta a un dueno*. Partirlas haria
que la misma cadena la resuelvan **dos mecanismos que pueden discrepar**, que es el olor que este repo
prohibe desde el ADR 0024.

```
utm_patron (id, program_id?, nivel,
            utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content?,
            campana_id? XOR user_id? XOR area_id?,
            prioridad, activo)
```

**Un patron apunta a UN destino, y el area nunca se guarda cuando se puede derivar:** a una campana
(que sabe que es de Pauta), a un usuario (que sabe que es de Comercial, ADR 0044), o directamente a un
area cuando no hay ninguno de los dos — el caso del organico de Media, donde `instagram rosario` no
tiene campana ni dueno en `users`. Un `CHECK` garantiza que sea exactamente uno. Guardar el area
**ademas** del destino permitiria escribir la contradiccion *"patron de area Media apuntando a una
campana de Pauta"*.

`program_id` es **nullable**: `null` = aplica a todos (`facebook / cpc`), con valor = acotado a ese
programa. El emparejador solo considera patrones cuyo programa case con el del envio, asi que la
frontera del ADR 0043 se mantiene dura **y ademas hay menos candidatos que comparar**.

**3. El significado de cada campo UTM se ESTANDARIZA, y es igual para todos los programas.**

Mani: *"toca definir que significa cada campo `utm_...`; no se puede significar cosas distintas para
cada programa, eso rompe la estandarizacion que queremos hacer."*

El punto de partida, medido contra los consolidados C2 que entrego Michael:

| | ComunicArte | Tactical Investor |
|---|---|---|
| `utm_campaign` | campana | campana |
| `utm_content` | **anuncio** | **conjunto** |
| `utm_term` | — | **anuncio** |

**`utm_content` significa "anuncio" en un programa y "conjunto" en el otro.** Cualquier codigo que
escriba `utm_content = el anuncio` esta **bien en un programa y mal en el otro, sin lanzar un error**.

**El estandar queda asi:**

| Campo | Que lleva | Macro de Meta |
|---|---|---|
| `utm_source` | la plataforma u origen | `facebook`, `instagram`, `tiktok`, `closer` |
| `utm_medium` | el tipo de trafico | `cpc`, `organico`, `referido`, `stories` |
| `utm_campaign` | **la campana** | `{{campaign.name}}` |
| `utm_content` | **el conjunto de anuncios** | `{{adset.name}}` |
| `utm_term` | **el anuncio** | `{{ad.name}}` |

Se eligio esa asignacion y no la contraria porque **es la que ya usa Tactical Investor**, el programa
con mas volumen (2.690 de 4.823 leads) y el unico con los tres niveles poblados. Cambiar el que ya
esta bien para acomodar al que le falta un nivel seria trabajo de mas y riesgo de mas.

**4. El patron declara el NIVEL al que apunta, y por eso el codigo nunca pregunta que significa un
campo.**

```
nivel: pgEnum("nivel_utm", ["campana", "conjunto", "anuncio"])
```

Es `pgEnum` y no catalogo por la regla del ADR 0012 leida al derecho: **el codigo decide con el**
(agrupa el desglose por nivel), igual que `deals.etapa`. Los tres niveles son los de Meta, no los
inventa Retia.

Un patron de nivel `anuncio` del historico de Tactical empareja por `utm_term`; uno del historico de
ComunicArte, por `utm_content`. **El codigo pregunta *"¿que patrones de nivel anuncio casan con este
envio?"*, nunca *"¿que significa `utm_content`?"*.** Asi el historico se clasifica bien **sin
reescribir el crudo y sin un `if programa`**.

⚠️ **Lo que el estandar NO arregla, y hay que decirlo:**

- **El CRM no puede imponerlo: se configura en Meta.** Las macros las escribe el paid trafficker al
  armar la campana. **Es una accion de Ops, no un ticket de codigo**, y va al playbook de paid
  traffickers antes que a este repo.
- **Rige hacia adelante.** Los 4.823 leads que ya estan en `production` traen la convencion vieja, y
  `submissions.utm_*` **no se reescribe**: es texto copiado de la fuente y el ADR 0004 manda que se
  guarde como llego. Reescribirlo para que "cuadre" borraria la evidencia de lo que paso.

**5. 🩸 El emparejamiento tiene que ser DETERMINISTA.** Si un envio casa con dos patrones de campanas
distintas, **ese lead se cuenta en las dos y el CPL de ambas sale mal. Sin un solo error.**

No es hipotetico: el **ADR 0031** documenta que colgar una corrida de sync de `fuentes[0]` —una
consulta **sin `ORDER BY`**— atribuia cada corrida a uno de los dos formularios **de forma no
determinista**, o sea que corridas identicas quedaban registradas distinto. La misma trampa, un nivel
mas arriba y con dinero encima.

Tres reglas, ninguna opcional:

1. **Un envio resuelve a lo sumo UNA campana.** No "la primera que aparezca".
2. **Gana el patron mas especifico**, medido como cantidad de campos UTM no nulos. Uno de tres campos
   le gana a uno de dos **siempre**, sin importar el orden de la consulta.
3. **Un empate es un ERROR que la app muestra, no una eleccion silenciosa.** Dos patrones igual de
   especificos que casan el mismo envio son una configuracion mal hecha, y la respuesta correcta es
   que alguien la arregle. La garantia vive en un **indice unico sobre la combinacion de campos del
   patron** dentro del programa, **no en el codigo** (ADR 0005).

**6. Lo que no casa cae en `(sin clasificar)` y SE VE, con su conteo.** Mismo criterio que
`(sin atribucion)` del ticket 066: un cubo invisible crece hasta que alguien se da cuenta un semestre
despues. Aca hace doble trabajo: ademas de atrapar canales nuevos, **atrapa campanas mal configuradas
en Meta**, que es lo unico que el CRM puede hacer contra el punto 4.

**7. Una division solo se muestra si el numerador Y el denominador existen en esa rebanada.**

"CPL por area" al pie de la letra **miente**: Media organica y Comercial tienen inversion **cero**, asi
que su CPL daria **$0** y la tabla mostraria a las dos ganandole a Pauta por goleada. La conclusion
obvia —mover el presupuesto a organico— seria un artefacto de dividir por un costo que no existe.

Si falta una de las dos mitades, la celda dice **"sin pauta"**, no `$0`. El precedente esta escrito en
el ticket 067: *"una cohorte sin pauta cargada se ve vacia, no se rellena con ceros: un cero parece un
dato"*. Esto solo lo extiende a la rebanada.

**Lo que si sale, partido en dos:** **dentro de Pauta**, el costo se rebana por campana, conjunto,
anuncio, canal, fecha o cohorte, y ahi viven CPL, CPI, CAC y ROAS. **Entre areas**, la comparacion no
es de costo sino de **aporte y calidad**: cuantos leads trae cada una, que tasa de calificacion tienen
y cuantos cierran.

## Consecuencias

- `campanas`, `utm_patron` y el `pgEnum` `nivel_utm` son nuevos. `ad_spend` cambia de grano.
- El emparejamiento vive en **un modulo** con su guardian, como `moverEtapa()` y `vigente()`.
- El playbook de paid traffickers gana el estandar de UTM **antes** que el repo.
- El desglose por anuncio es confiable **desde la fecha en que Meta se reconfigure**, y la pantalla lo
  dice en vez de fingir que el historico cumple.

## Alternativas descartadas

| Alternativa | Por que no |
|---|---|
| Cinco columnas UTM sobre `ad_spend` | Repite el juego de UTM en cada fila diaria e invita al error de tecleo |
| Dos tablas: clasificacion por area y patrones de campana | Dos mecanismos resolviendo la misma cadena, pueden discrepar (ADR 0024) |
| El significado del campo UTM como dato de la campana | Acomodarse al desorden. Mani pidio estandarizar, que es el mandato del rol de Ops |
| Reescribir `submissions.utm_*` del historico | Rompe el ADR 0004 y borra la evidencia de lo que paso |
| Emparejar con "la primera que case" | Es el `fuentes[0]` del ADR 0031, ahora con dinero encima |

---

## ⚠️ Enmienda 2026-09-21 (ADR 0046): dos correcciones

**1. El punto 4 decia que el CRM no puede imponer el estandar de UTM. Con el link generado, si
puede.** Si el trafficker **pega un link que el CRM ya armo** en vez de escribir parametros, el
incumplimiento pasa de *detectable* a *imposible por el camino normal*. El punto 4 sigue vigente para
lo que el CRM **no** genera: lo organico de Media, el historico, y cualquier link armado a mano.

**Y la razon de fondo es mas grande que el estandar:** con macros hay **dos actos independientes que
tienen que coincidir** (configurar Meta, escribir el patron). Con el link generado hay **uno solo**:
crear el anuncio produce el link **y** el patron que lo reconoce. **No pueden discrepar por
construccion.**

**2. El punto 1 decia que `ad_spend` cuelga de la campana. Cuelga de la PIEZA.** Meta reporta gasto
por anuncio; si el gasto cuelga de la campana y los leads se atribuyen al anuncio, **las dos mitades
del CPL vuelven a cortarse a distinto nivel**, que es el problema que este ADR existe para resolver.
El gasto se captura al nivel mas fino que se tenga, y la **regla del cero** del punto 7 decide: si
solo hay gasto de campana, el CPL por anuncio dice **"sin desglose"**. **Nunca se prorratea.**

---

## ⚠️ Enmienda 2 · 2026-09-21 (Mani): el estandar se reduce a TRES campos

Textual: *"entonces UTM term y content no es necesario. Usemos los otros 3 que tienen mas sentido."*

**El estandar queda en tres:**

| Campo | Que lleva |
|---|---|
| `utm_source` | la plataforma u origen (`facebook`, `instagram`, `tiktok`, `closer`) |
| `utm_medium` | el tipo de trafico (`cpc`, `organico`, `referido`, `stories`) |
| `utm_campaign` | **la campana** |

**Lo que esto BORRA, que es la mayor parte de la maquinaria de este ADR:**

- **El `pgEnum` `nivel_utm` desaparece.** Con un solo nivel no hay nada que declarar: el punto 4 de
  este ADR entero deja de aplicar, y con el la regla *"el codigo nunca pregunta que significa
  `utm_content`"*, que existia para reconciliar dos convenciones.
- **`utm_patron` pierde `nivel`, `utm_term` y `utm_content`.** Queda con tres campos de patron.
- **La inconsistencia medida deja de importar.** `utm_content` era el anuncio en ComunicArte y el
  conjunto en Tactical; como **nadie lee ese campo**, el problema se disuelve en vez de resolverse.
  El hallazgo se conserva escrito porque explica por que el estandar se escribio, no porque haya que
  arreglarlo.
- **Se revierte la correccion del ADR 0046 punto 5:** `ad_spend` vuelve a colgar de la **campana**.
  Esa correccion existia porque Meta reporta por anuncio y el gasto se cortaba a distinto nivel que
  los leads; **sin nivel de anuncio, los dos lados cortan igual por campana** y la correccion sobra.
  La **regla del cero** del punto 7 sigue intacta y es lo unico que hacia falta.

**Lo que cuesta, dicho una sola vez:** *"que anuncio esta vendiendo"* —que Alejo nombro en la reunion
como metrica de Pauta— **deja de ser contestable**. No es un aplazamiento: es una salida de alcance.
A cambio se contesta a nivel **campana**, que es donde de verdad se decide mover presupuesto, y se
borran un enum, una tabla y una regla de reconciliacion.

📌 **Recomendacion sobre las dos columnas que ya existen:** `submissions.utm_term` y
`submissions.utm_content` **se quedan, vacias y sin leer**. Quitarlas cuesta una migracion sobre una
tabla que ya esta en `production`, y volver a ponerlas costaria otra; el dato sigue en la hoja si algun
dia se quiere. **Van marcadas en el comentario del esquema como deliberadamente no leidas**, para que
nadie las cablee creyendo que tapa un hueco.

---

## ⚠️ Enmienda 3 · 2026-09-24 (ADR 0051): tres se leen, dos se capturan

- `utm_content` y `utm_term` **vuelven a capturarse** siempre. No se leen en los reportes, con una
  excepción: `utm_content` se lee **solo en el canal Closer**, para saber quién trajo el lead, y lo lee
  un único módulo (el emparejador).
- El patrón se expresa en dos catálogos: el **Canal** (`utm_source` + `utm_medium`, con su área) y la
  **Campaña** (`utm_campaign`). Las reglas de este ADR siguen: emparejamiento determinista, el empate es
  un error visible, y las dos cubetas de huérfanos no se funden.
