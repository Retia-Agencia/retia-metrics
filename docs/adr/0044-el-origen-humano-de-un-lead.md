# 0044 — El origen humano de un Lead: un enlace, una llave, y el CPL deja de preguntar por `entrada`

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, tras la reunion con Alejo Carvajal) ·
**Implementacion:** tickets 085, 086 · **Aplica:** ADR 0043, ADR 0045 ·
**Enmienda:** ADR 0021 (la regla del CPL), ADR 0037 (la repite)

## El problema

🩸 **Un lead que trae un closer es invisible.** El UTM de hoy solo describe pauta, asi que la metrica
que pidio Gerencia —*"cantidad de leads por area"*— mostraria **Comercial en cero** y un gerente
concluiria que los closers no aportan pipeline. La pantalla no fallaria: mentiria.

Y el dato **no esta mal guardado: no existe**. *"Este lead lo trajo Maru"* no esta escrito en ninguna
parte, asi que no hay backfill posible. Por eso la decision tiene ventana: cuesta un campo mientras
la ingesta se escribe (ticket 048) y cuesta un dato irrecuperable despues.

Mani: *"el origen debe aceptar que un lead llega por humano tambien, por closers directamente."*

## Decidimos

**1. El closer NO teclea un UTM. Tiene un enlace, y el enlace escribe el UTM por el.**

```
https://<form del programa>?utm_source=closer&utm_medium=referido&utm_campaign=<closer>
```

Se descarto que el closer escribiera su propio `utm_source` al dar de alta, por tres razones que ya
estan escritas en este repo:

- 🩸 **Volveria el ADR 0030 por la puerta de atras.** `Maru`, `maru`, `closer maru` y `Maru Marquez`
  serian **cuatro closers** en el reporte. Y el ticket 066 dice explicitamente *"Fuera: normalizar
  los UTM"*, asi que ese campo **no tiene quien lo defienda**.
- **Ensuciaria el campo que sirve para reconciliar con Meta.** El `utm_*` es texto copiado de una
  fuente externa (ADR 0004); un valor inventado dentro del CRM se mezcla con `facebook`, `instagram`
  y `tiktok` en toda consulta de pauta.
- **Seria texto donde hay una llave disponible.** El closer ya es una fila de `users`.

**Lo que gana el enlace:** cero trabajo manual (entra por el sync, por la fuente activa del programa,
sin tocar el ADR 0039); **el lead trae sus respuestas del formulario** —presupuesto, urgencia,
experiencia—, que es lo que el closer necesita para trabajar el deal y lo que un alta manual **no
tiene**; y nadie teclea, asi que no hay ortografia que defender. **No es un mecanismo nuevo:** es el
que Media ya usa — `instagram rosario` e `instagram milena`, los `utm_source` reales de ComunicArte,
son literalmente un UTM que nombra a una persona.

**2. El enlace es por closer Y programa, y es DERIVADO: no se guarda.** Es la URL de la fuente del
programa mas los parametros del closer. Como hay una sola fuente activa por programa (ADR 0039), un
enlace por closer y programa es lo unico que se puede construir. Se calcula y se muestra con un boton
Copiar. Misma regla que la comision del ADR 0024 (*"calculada, nunca guardada"*): un enlace guardado y
la fuente cambiada son dos verdades.

**3. `leads.traido_por_user_id`, FK real a `users`, nunca texto.** La escribe **la funcion de ingesta
del ticket 048 y nadie mas** —los dos caminos pasan por ahi—, y **el primero que la escribe gana**: si
Maru lo trajo y tres meses despues el mismo correo reaplica por una campana de Meta, el lead sigue
siendo de Maru. La atribucion de quien trajo a una persona se paga una vez. Mismo criterio con el que
el dedup ya conserva la fecha mas antigua.

**4. El alta manual sobrevive como respaldo y NO genera envio.** Ya existe (`leads.entrada = 'crm'`,
ADR 0021, **0 filas** el 21-sep) y se queda, porque el enlace falla en la vida real: el lead llego por
WhatsApp, por un evento, por un amigo. Ahi el closer lo crea y se elige de un selector.

⚠️ Ese lead **no tiene envio, y eso no es una preferencia: la base no deja lo contrario.** Verificado
contra el esquema: `submissions.source_id` es `notNull`, y una `source` nueva de tipo "alta manual"
la rechazaria `sources_una_activa_por_programa_idx`, que solo admite una fuente activa por programa
(ADR 0039). El ADR 0037 ya lo tenia previsto por el otro lado: admite *"deal manual"* como entrada a
Pendiente Setteo y a Compromiso Verbal sin pasar por un `estado` de hoja.

**5. El lead traido NO se auto-asigna como owner.** Mani: *"los closers definen eso; supongo que deben
revisar bien el UTM."* Se descarta la excepcion que se habia propuesto y el ADR 0021 queda intacto:
*"sin responsable es un estado valido"*, sin reparto automatico.

🎯 **Y la segunda mitad de la frase es un requisito de pantalla, no una suposicion.** Si el closer
tiene que *"revisar bien el UTM"* para decidir si reclama un lead, **el origen tiene que estar a la
vista en Unclaimed y Pendiente Setteo**: el area, los UTM y quien lo trajo si se sabe. Hoy el ticket
070 no muestra nada de eso, y **sin ese cambio la regla de este punto no se puede cumplir**.

**6. 🩸 El CPL deja de preguntar por `entrada`. Enmienda al ADR 0021 y al ADR 0037.**

El ADR 0021 dice —y el comentario de `lib/db/schema.ts` lo repite— que *"el CPL usa solo las del
formulario, porque la pauta solo paga esas"*. Esa regla se apoya en `entrada`, que tiene dos valores:
`formulario` y `crm`.

**Con el enlace del closer, un lead de Comercial entra por el formulario.** Desde ese momento
`entrada = 'formulario'` **deja de significar "lo pago la pauta"**, y el CPL empezaria a dividir la
inversion de Meta entre leads que Meta no trajo: **el costo por lead saldria mas barato de lo que es y
una campana mala se veria aceptable.** Sin lanzar un error.

**El denominador del CPL pasa a preguntar por la clasificacion del UTM: cuenta los leads cuyo patron
resuelve al area Pauta** (ADR 0045). Queda mejor que antes, porque tampoco estaba contando bien los
organicos de Media, que tambien entran por el formulario y tampoco los paga la pauta.

⚠️ **Esta enmienda va en el mismo movimiento que la clasificacion, nunca despues.** Separadas, la
pantalla del CPL y la clasificacion darian cifras distintas sobre lo mismo, que es la herida del
ADR 0024.

## Consecuencias

- `leads` gana una columna; `submissions` no cambia.
- La ingesta (ticket 048) es el **unico** escritor del origen.
- El ticket 070 gana el origen a la vista, o el punto 5 es inaplicable.
- `entrada` sobrevive, pero **deja de ser la llave del CPL**: pasa a decir solo por donde entro.

## Lo que queda abierto

🟡 **Para Alejo, no para el codigo:** ¿un lead que trae un closer cuenta distinto para su comision o
su meta que uno que le asignaron? Es de negocio y hoy no tiene respuesta.

---

## ⚠️ Enmienda 2026-09-21 (ADR 0046): al punto 2 le faltaba un prerequisito

El punto 2 dice que el enlace de captacion es *"la URL de la fuente del programa mas los parametros
del closer"*. **Esa URL no existe en el esquema.** Verificado: `programs` tiene `calendly_url` y
`web_url`; `sources` tiene `sheet_id` y `tab`, o sea **donde CAEN las respuestas, no donde la gente
LLENA**. `grep` de `typeform|formUrl|form_url` sobre `lib/`, `app/` y el esquema: **cero**.

El diseno era correcto y le faltaba el dato. Lo agrega el **ADR 0046**: `programs.form_url`, mas **un
solo generador** de links compartido con el arbol de campana (ticket 092). Este ADR no cambia de
forma; gana una dependencia.

---

## ⚠️ Enmienda 2026-09-24 (ADR 0051): el closer va en `utm_content`, con un código

El punto 1 ponía el closer en `utm_campaign`, que según el estándar es la campaña. Queda así:
`utm_source=closer`, `utm_medium=referido`, `utm_campaign=<campaña de referidos del programa>`,
`utm_content=<código opaco del closer>`. El código lo genera el CRM, nunca es el nombre, y el
formulario ya captura `utm_content`: cero cambios en Typeform. El resto de este ADR sigue intacto.
