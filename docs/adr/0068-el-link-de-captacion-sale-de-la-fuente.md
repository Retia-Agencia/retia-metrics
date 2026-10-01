# 0068 — El link de captación sale de la fuente, con una principal por programa

- **Estado:** aceptado · 1-oct-2026 (Mani, cierra A11 de `docs/plan.md` §7). **Enmienda** el ADR 0051 (de dónde
  sale el destino del generador) y cierra lo que el ADR 0064 dejó abierto. Se construye en el ticket 092.
- **Relacionadas:** ADR 0005 (las garantías viven en la base), ADR 0012 (instancias en la base), ADR 0024
  (derivado, nunca guardado), ADR 0043 (el programa es frontera), ADR 0055 (el webhook estándar), ADR 0064.

## Contexto

El generador de links (092) arma la URL sobre `programs.form_url`, que es una sola por programa, y la base exige
esa columna para activar un programa (CHECK `programs_activo_con_formulario_y_token`, migración 0031). Desde el ADR 0064 un programa puede tener varias
fuentes activas, y Mani lo fijó el 30-sep como **realidad permanente**, no solo como transición: ComunicArte
recibe hoy por Typeform y por Dapta. Con el link en el programa, el CRM reparte un formulario y recibe dos; el
segundo no se puede repartir ni medir desde el CRM, y el día del corte alguien tiene que acordarse de editar
`programs.form_url` a mano para que todos los links cambien de formulario.

## Decisión

1. **La URL pública del formulario vive en la fuente:** `sources.url_publica`. Es dónde la gente LLENA el
   formulario; la URL del webhook es dónde CAEN las respuestas. Son dos datos de la misma fila.
2. **Cada programa tiene a lo sumo una fuente principal**, garantizada en la base: índice único parcial
   `(program_id) WHERE principal` (ADR 0005). Y una principal **siempre** es repartible: CHECK
   `NOT principal OR (activo AND url_publica IS NOT NULL)`. Apagar la principal obliga a escoger otra antes.
3. **El generador usa la principal por defecto** y deja escoger otra fuente activa del mismo programa. El link
   sigue siendo derivado (ADR 0024): cambiar la principal cambia todos los links sin migrar nada.
4. **Un programa sin principal no genera links y lo dice**, en vez de producir una URL rota. Que un programa
   activo tenga principal no se puede expresar con un índice: lo verifica `reactivarPrograma` (la reja del 422) y la pantalla lo
   avisa.
5. **`programs.form_url` se retira en dos pasos.** Primero el código deja de leerla y su valor se copia a la
   fuente que corresponda (con el ok de Mani, porque cuál es la principal es una decisión de negocio, no un
   dato). Después una migración quita la columna y la parte del CHECK de la 0031 que la exige, ya con el código
   desplegado sin ella (`AGENTS.md`: drizzle pide las columnas por nombre).
6. **La atribución no cambia.** Los UTM se leen del envío sin importar por qué formulario entró, y el programa
   sale de la fuente de la URL (ADR 0055).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Dejar el link en el programa | Un solo link por programa: el segundo formulario activo no se reparte desde el CRM, y el corte es una edición manual que nadie recuerda |
| Un link por fuente sin principal | El closer y el builder tendrían que escoger formulario cada vez; un default evita que cada quien reparta uno distinto |
| La principal como columna en `programs` (FK a la fuente) | Funciona, pero deja la URL en una tabla y la marca en otra; el CHECK de "principal repartible" no se puede escribir entre dos tablas |

## Consecuencias

- El 092 suma `sources.url_publica`, `sources.principal`, el índice y el CHECK, y la pantalla de fuentes los
  edita. El 086 (enlace del closer) usa el mismo generador y hereda la principal.
- La guía de configurar un programa (`docs/operations.md` §2.1) cambia el paso del Forms Link: se pone en la
  fuente, no en el programa.
