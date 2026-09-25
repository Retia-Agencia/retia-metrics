# 0043 — El Area agrupa leads y deals; el Programa es una frontera, no un filtro

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, tras la reunion con Alejo Carvajal) ·
**Implementacion:** tickets 083, 084 · **Aplica:** ADR 0012, ADR 0005, ADR 0023, ADR 0035

## El problema

Retia se organiza en cuatro areas —Gerencial, Comercial, Pauta (paid traffickers) y Media (redes)— y
el dolor que declaro Gerencia es *"rendimiento de las areas · cantidad de leads por area"*.

`grep -rin "area|gerencial|paid traffick"` sobre `docs/` devolvia **cero**. El sistema conoce
programas, cohortes, closers, productos y roles. **No conocia areas.**

🩸 Y el numero pedido, calculado sobre el modelo de hoy, **mentiria**: un lead que trae un closer no
deja rastro en ningun UTM, asi que Comercial leeria **cero** y un gerente concluiria que los closers
no aportan pipeline. Sin lanzar un error. Eso lo resuelve el ADR 0044; este ADR resuelve donde vive
el area y hasta donde llega.

## Decidimos

**1. El Area es catalogo, y agrupa leads Y deals.** Textual de Mani: *"Area va dentro como una nueva
manera de agrupar leads y deals segun origen."* Sigue el molde de `lib/catalogo/` (ADR 0012): tabla
con `activo`, un esquema zod, pantalla con guard, `change_log` en cada cambio, y `borrarSiNoSeUso`.
Es catalogo y no `pgEnum` porque **el codigo no decide segun cual area sea**: solo agrupa.

**2. Area NO es rol, y son dos modulos.**

| | Rol | Area |
|---|---|---|
| Contesta | *"¿que puede hacer esta sesion?"* | *"¿a quien se le atribuye este lead?"* |
| Vive en | `lib/auth/roles.ts` | catalogo + `utm_patron` |
| Se usa para | guardas y permisos | agrupar y reportar |

Fundirlas repite el bug que `AGENTS.md` ya bautizo: *"cuando una variable de permiso se llame como un
rol, sospecha"*. Un `rol === "closer"` usado para decir "esto es de Comercial" dejaria al developer
afuera **y ademas seria falso**: el gerente no vende y sigue siendo de Gerencial.

**3. El area de un lead no se guarda: se DERIVA de su origen.** Un area escrita en `leads` seria una
segunda copia de lo que el patron UTM ya dice, y dos lugares con la misma respuesta es lo que este
repo prohibe desde el ADR 0024. La cadena es: envio → `utm_patron` → destino (campana / usuario /
area) → area. Detalle en el ADR 0045.

**4. 🔒 El PROGRAMA es una frontera, no un filtro.** Textual de Mani: *"los leads de un programa NO se
cruzan con los de otro; el programa es parte de la PK de Leads. Siempre siempre se debe tener esto en
cuenta: de nada sirve combinar metricas de programas."*

Ya estaba enforzado en la base y no estaba escrito como regla. Los indices que lo garantizan:
`leads_programa_email_idx`, `lead_contactos_valor_idx`, `deals_uno_abierto_por_lead_y_programa_idx`,
`calls_huella_idx`, `ad_spend_huella_idx`, `productos_programa_nombre_idx`,
`cohorts_programa_codigo_idx`. Y `lead_contactos.program_id` esta **denormalizado a proposito** para
poder hacerlo.

**La consecuencia que hay que respetar al construir:** no basta con no ofrecer el cruce en la
interfaz. **El tipo de la consulta no debe admitirlo**, igual que el comparativo entre closers del
ADR 0023, que *"no se puede acotar ni queriendo, porque el tipo de la consulta no lo admite"*.

**5. La llave de `leads` sigue siendo `(program_id, email_normalizado)`. Se evaluo normalizarla y se
descarto MIDIENDO.** La alternativa era el split Party/Contact: una tabla `personas` con el correo
unico, y el lead como *"persona en un programa"*.

Consulta de solo lectura contra `production` (rama `br-withered-mud-b4cvvg80`, verificada por
`neon.branch_id` y no por el nombre de la variable) el 21-sep:

```
filas en leads .................. 4.823
correos distintos ............... 4.818
correos en MAS DE UN programa ....... 5      ← 0,1 %
por programa: tactical-investor 2.690 · comunicarte 2.133
```

**Cinco personas de 4.823.** Y aunque fueran quinientas, tres costos no dependen del volumen:

- 🩸 **Reabre la identidad a escala de empresa.** Hoy la llave del dedup es `(program_id, email)`, asi
  que un merge equivocado hace dano **dentro de un programa**. Con `personas` la llave pasa a ser el
  correo global, y con ella la regla del telefono del ADR 0035 —*"un telefono que aparecio con un
  correo distinto entra sin confirmar y un gerente decide"*— empieza a cruzar programas. El radio de
  explosion de una fusion mala pasa de un programa a toda Retia.
- **Construye justamente el puente que el punto 4 quiere que no exista.** Un `persona_id` compartido
  es, literalmente, la columna por la que un `join` cruza la frontera.
- **Una junta en cada consulta, y un segundo corte encima del primero:** la etapa 1 acaba de cerrar
  con la migracion 0020 y la ingesta (ticket 048) esta por escribirse.

**Lo que hay ya es la forma normalizada de este dominio.** El Lead no es una persona: es *"una
persona en un programa"*, y el programa es parte de su identidad, no un atributo suyo. Repetir el
correo en dos filas **no es desnormalizacion: son dos hechos distintos**. Es la misma redundancia
declarada que el comentario del esquema ya justifica para `lead_contactos.program_id`.

**6. La visibilidad cruzada se da con una PROYECCION, no con una tabla.** El objetivo de fondo de
Alejo era *"sin perder NADA de visibilidad"*. Para eso basta
`otrosProgramasDelCorreo(email, programaActual)` en `lib/queries/`: un `select` sobre `leads`, que ya
tiene el correo normalizado. Sale en la ficha del Lead **como aviso** y **ninguna metrica la usa**.
Es la regla que `AGENTS.md` ya tiene escrita: *la proyeccion es del llamador, el predicado es del
modulo*.

## Consecuencias

- Dos tablas nuevas de catalogo, `areas`, y la de patrones del ADR 0045.
- Toda consulta de reporte recibe el programa y **ninguna lo puede omitir**.
- `AGENTS.md` gana la restriccion no-negociable del punto 4.
- La pregunta *"¿es la misma persona?"* tiene **una sola casa** y ninguna metrica la puede atravesar.

## Alternativas descartadas

| Alternativa | Por que no |
|---|---|
| El area como `pgEnum` | El codigo no decide con ella. Seria un despliegue para agregar un area (ADR 0012) |
| El area guardada en `leads` | Segunda copia de lo que el patron ya dice (ADR 0024) |
| El area derivada del rol del usuario | El gerente no vende y sigue siendo de Gerencial. Y dejaria al developer sin area |
| Tabla `personas` (split Party/Contact) | Medido: 5 filas de 4.823. Punto 5 |
| El area vive fuera del CRM, en el reporte de Ops | El dato con el que se clasifica (el UTM) ya vive aqui; una clasificacion de afuera se desincroniza el dia que aparezca un `utm_source` nuevo, o sea todas las semanas |

---

## ⚠️ Enmienda 2026-09-24 (ADR 0048): el punto 4 se abre SOLO para sumas en la misma unidad

La frontera se conserva para la identidad del lead, para las listas (siempre de un programa) y para
las tasas. El Dashboard puede mostrar "todos los programas", y ahí **solo suma magnitudes sumables en
la misma unidad**: conteos, caja en USD, gasto de pauta. Tasas, meta, meta dinámica, CPL, ROAS y
comisión van por programa, lado a lado. La garantía sigue en el tipo de la consulta.
