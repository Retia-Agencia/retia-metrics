---
id: 092
etapa: E1b
serves: "ADR 0046 · plan v2 §12.12"
depends: [101]
status: en curso
---

# 092 — La URL del formulario y el generador de links

> **29-sep (Mani, tras la reunión con Pauta):** Pauta ya define y estandariza sus UTM. El generador se
> **integra con la forma en que ya lo hacen**, no la reemplaza: el alcance se reescribe en la sesión que
> mapea esa reunión, antes de construir. Choca en parte con el ADR 0051 ("el link sale del CRM").

## Objetivo

Que el CRM sea el **registro** de las campanas de cada programa y el **generador** de sus links de
captacion.

⚠️ **Encogio el 21-sep** (ADR 0045 enmienda 2, ADR 0046 enmienda): sin `utm_term` ni `utm_content` no
hay conjuntos ni anuncios, asi que **no hay arbol**. Una campana tiene **un** juego de UTM y **un**
link.

## 🩸 El prerequisito que no existe

Verificado contra el esquema el 21-sep: `programs` tiene `calendly_url` y `web_url`, pero **la URL
publica del formulario no esta en ninguna parte**. `sources` guarda `sheet_id` y `tab`, o sea **donde
CAEN las respuestas, no donde la gente LLENA**.

Sin ese dato **no se puede calcular ningun link**, ni el de este ticket ni el del closer (ticket 086).

## Alcance

- **Dentro:** `programs.form_url`.
- **Dentro:** el generador de links, **UN modulo** compartido con el enlace del closer del 086:
  `form_url` + los tres UTM de la campana. **Derivado, nunca guardado.**
- **Dentro:** crear una campana **escribe su `utm_patron` en la MISMA operacion** (molde de
  `crearConRastro`, ADR 0042). **Este es el punto entero del ticket.**
- **Fuera:** conjuntos, anuncios y cualquier arbol. No existen (ADR 0045 enmienda 2).
- **Fuera:** crear campanas en Meta por API. El CRM registra y genera, no administra Meta.
- **Fuera:** meter estos links en `/recursos`. **Otro dominio** (ADR 0046, ADR 0033).

## Las reglas que no se rompen

- **El link es derivado.** Un link guardado y el formulario cambiado son dos verdades (ADR 0024).
- **Una sola funcion genera los dos tipos de link** —el del anuncio y el del closer—. Dos copias de
  "URL mas parametros" es el olor.
- **El CRM no sabe si una campana se pauso en Meta.** La pantalla dice *"sin leads desde tal fecha"*,
  **no** *"pausada"*: no se infiere el estado.

## Done cuando

- [ ] Un programa sin `form_url` **no deja generar links** y lo dice, en vez de producir una URL rota.
- [ ] Crear una campana produce su link **y** su patron, y un test verifica que **el patron reconoce
      el link que el generador acaba de producir**. Ese test es el corazon del ticket.
- [ ] Cambiar `form_url` cambia **todos** los links, sin migrar nada.
- [ ] El generador es **uno solo**: `grep` confirma que el 086 lo importa y no lo reimplementa.

## Kiro

Parcial. El arbol y el generador si, con revision. **La migracion la genera y aplica la sesion
principal.** El test del punto 2 del "Done cuando" se disena en la sesion principal: es el que prueba
que las dos mitades no pueden discrepar.

---

## Enmienda 2026-09-24 (ADR 0051 y ADR 0052): el builder v1

Replica el builder de 30X, adaptado:

| Sección | Qué es |
|---|---|
| Destino | catálogo por programa: la URL del formulario **y las URL de checkout** (`programs.form_url` pasa a ser uno de los destinos) |
| Origen | el **Canal** (ticket 101): fija `utm_source` y `utm_medium` y muestra el área |
| Campaña | el catálogo de Campañas del programa |
| Opcional | `utm_content` (según el canal) y `utm_term`, con "usar fecha de hoy" |
| URL final | se calcula y se copia; no se guarda |

- Reglas de forma: minúsculas, `snake_case`, sin tildes ni espacios; el builder sanitiza.
- Lo usan el gerente y el **Paid Trafficker** (ticket 102). El closer no usa el builder: ve "Mi link".
- Fuera de v1: URL libre y el acortador con analítica de clics.
- Checkouts: el link se genera ya; que la venta vuelva sola al CRM es una integración posterior.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- **El builder queda solo para lo que Meta no genera:** orgánico (bio, stories, linktree, manychat) y el link del closer (086). La pauta de Meta usa sus macros (ADR 0062) y sus campañas se reflejan por API (120); el CRM no las crea.
- 🔴 La convención de UTM del orgánico la definen Pauta y Media (PQ6). Referencia de 30X: `instagram / reel`, content = código del post.
- El builder vive en la tab Campañas (125). Los destinos (formulario y checkouts) siguen.

---

## Enmienda 2026-10-01 (ADR 0068, A11 cerrada): el destino del formulario sale de la fuente

- **Dentro, en vez de `programs.form_url`:** `sources.url_publica` y `sources.principal`, con el índice único
  parcial `(program_id) WHERE principal` y el CHECK `NOT principal OR (activo AND url_publica IS NOT NULL)`.
  La pantalla de fuentes los edita.
- El generador usa la principal por defecto y deja escoger otra fuente activa del programa. "Un programa sin
  `form_url` no deja generar links" pasa a ser "sin principal".
- `programs.form_url` se retira en dos pasos (ADR 0068 punto 5): el valor de hoy se copia a la fuente que Mani
  diga, y la columna y su parte del CHECK de la 0031 se quitan con el código ya desplegado sin ellas.

---

## Avance 2026-10-02 (Alejo + Claude): paso 1 del ADR 0068 en código, falta aplicar la 0060

- **Migración `0060_fuente-principal`** (aditiva, con `lock_timeout`): `sources.url_publica`, `sources.principal`,
  `sources_una_principal_por_programa_idx` (único parcial) y el CHECK `sources_principal_repartible`. No marca ninguna
  principal: cuál es la de cada programa la decide Mani desde `/ajustes/fuentes`.
- **Catálogo (`lib/catalogo/fuentes.ts`):** `urlPublica` en el esquema (https; vacío la quita; omitida se conserva).
  `marcarFuentePrincipal` es el único escritor de `principal`: bloquea las fuentes del programa, cambia la principal y
  deja el rastro de las dos filas en la misma transacción. Rejas (422, sin tocar la fila): desactivar la principal,
  dejarla sin URL y **mover una fuente de programa** (ADR 0043, vale para toda fuente).
- **Generador (`lib/atribucion/link-de-captacion.ts`):** `generarLink` (sanea campaña, content y term; source y medium
  salen del Canal tal cual; borra todo `utm_*` del destino), `destinosDelPrograma` y `destinoDeCaptacion` (la
  principal por defecto u otra fuente activa del programa; sin principal no hay link, tampoco escogiendo otra).
- **Lectores:** la ficha del programa muestra la fuente principal en vez de `programs.form_url`; `/ajustes/fuentes`
  edita la URL y marca la principal.
- **Tests:** `tests/fuente-principal.test.ts` (índice y CHECK en la base, rastro, rejas, destino, cambiar la URL cambia
  el link) y `tests/link-de-captacion.test.ts` (**el emparejador reconoce el link que el generador produce**, para
  canal exacto, comodín y closer; guardián del generador único mordido en los dos sentidos).
- **Revisión:** Codex (cadenero) encontró 5 defectos, todos corregidos con test: destino escogido sin principal,
  `utm_id` heredado del destino, mudar la principal de programa, carrera en el rastro y un guardián evadible.

**Done cuando, estado:** punto 1 ✅ (sin principal, 422) · punto 2 ✅ (reescrito tras DP-25: ya no hay `utm_patron`;
el test lo hace `emparejar`) · punto 3 ✅ · punto 4: el generador es uno y el guardián lo vigila; que el 086 lo
importe se verifica cuando se construya el 086.

**Falta, en este orden:**
1. **Aplicar la 0060 (sesión principal de Mani, con su ok) ANTES de empujar el código:** drizzle pide las columnas
   por nombre, y el código en `main` sin la columna rompería toda lectura de `sources` en producción.
2. Push y checkpoint.
3. Mani marca la principal de cada programa (ComunicArte: ¿Typeform o Dapta?) y carga su URL.
4. **Paso 2 del ADR 0068** (otro commit, otra migración): `reactivarPrograma` exige principal en vez de `form_url`,
   se quitan `programs.form_url`, su campo en `/ajustes/programas` y su parte del CHECK de la 0031.
5. Fuera de este ticket: la pantalla del builder vive en la tab Campañas (125) y el enlace del closer en el 086;
   los dos llaman a `generarLink` sobre `destinoDeCaptacion`.
