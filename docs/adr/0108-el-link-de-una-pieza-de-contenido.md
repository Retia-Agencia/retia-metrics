# 0108: El link de una pieza de contenido: medio `contenido` y código opaco

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media; cierra D4 de `docs/media/extraccion.md` §8).
- **Enmienda:** ADR 0051 punto 1 (qué lleva `utm_content` en Media) y ADR 0087 (el emparejador lee `utm_content`
  también en el medio `contenido`).
- **Confirma:** ADR 0087 (el área sale de la regla y no cambia), ADR 0068 (el link sale de la fuente principal),
  ADR 0024 (derivado, nunca guardado).

## Contexto

Para saber qué contenido vende, cada lead tiene que llegar con la pieza que lo trajo. Hoy el orgánico de media
llega con UTM escritas a mano (`instagram rosario / linktree`) y no hay forma de saber qué historia fue. La
recomendación vieja (D4) ponía el día en `utm_campaign` y emparejaba por texto: un renombre o un typo perdía la pieza
sin error.

## Decisión

1. **Todo link de contenido sale del generador del CRM** (`generarLink`, `lib/atribucion/link-de-captacion.ts`),
   sobre la fuente principal del programa de la pieza. Nadie arma uno a mano.
2. **Los parámetros:**

   | Parámetro | Valor |
   |---|---|
   | `utm_source` | la red de la pieza (`instagram`, `tiktok`...), dato de la pieza |
   | `utm_medium` | `contenido`, **constante del código** (`UTM_MEDIUM_CONTENIDO`, junto a `UTM_MEDIUM_REFERIDO`), porque el emparejador decide con ella |
   | `utm_campaign` | legible: `<tipo>_<creador>_<aaaammdd>` (o `<tipo>_<creador>` en una pieza permanente), armado con los slugs de los catálogos |
   | `utm_content` | el **código opaco de la pieza**; lo lee solo el emparejador, solo con `utm_medium=contenido` |

3. **El área no cambia:** con `utm_source` y `utm_medium`, la regla de `resolverCanal` ya da **Orgánico**. No hay
   área nueva ni se reclasifica nada hacia atrás; el Hub muestra el canal `Instagram` como hoy y la pieza es un
   detalle dentro de Orgánico.
4. **La pieza se empareja al leer, no se guarda en el envío:** `emparejar` recibe las piezas como dato (igual que el
   árbol de Meta) y resuelve código → pieza. Un código que no existe, o una pieza de otro programa, es un aviso
   visible (`pieza_desconocida`), nunca una asignación.
5. **El link fijo del creador es una pieza permanente** (ADR 0110): mismo emparejamiento, sin segundo tipo de código.

## Por qué

Es el molde del link del closer (ADR 0051 enmendado): legible para la persona, opaco para la máquina, un solo módulo
que interpreta `utm_content` según el medio. Un área nueva "Contenido" partía Orgánico y reclasificaba el histórico;
emparejar por texto en `utm_campaign` repetía el error del 21-sep.

## Consecuencias

- El guardián de `tests/atribucion-emparejador.test.ts` sigue igual: `utm_content` solo en `lib/atribucion/`.
- `tests/link-de-captacion.test.ts` gana el caso: el emparejador reconoce la pieza del link que el generador acaba de
  producir (tickets 317 y 318).
- Lo que el creador publique sin su link sigue llegando como Orgánico sin pieza: se detecta, no se impide.
