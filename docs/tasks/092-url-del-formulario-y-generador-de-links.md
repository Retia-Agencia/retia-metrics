---
id: 092
etapa: E1b
serves: "ADR 0046 · plan v2 §12.12"
depends: [084]
status: todo
---

# 092 — La URL del formulario y el generador de links

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
