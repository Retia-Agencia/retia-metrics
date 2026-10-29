# 0110: El creador y la pieza de contenido son datos; los estados tienen significado fijo

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media).
- **Confirma:** ADR 0012 (instancias en la base, tipos en el código), ADR 0026 (no se borra lo usado), ADR 0042
  (rastro), ADR 0043 (el programa es frontera).

## Contexto

La pieza de contenido une los dos componentes de media: se planea, se publica con su link y vuelve con sus leads.
Media define sus tipos y estados, pero el sistema tiene que saber qué es "publicada" para avisar y medir el
cumplimiento. Y algunos clientes del cockpit no tienen programa en el CRM: solo se les maneja el contenido.

## Decisión

1. **El creador es un catálogo** (`creadores`, molde de `lib/catalogo/`): nombre, slug, cuentas por red y un
   **programa opcional**. El "cliente" del cockpit es el creador (ADR 0111).
2. **Un creador sin programa tiene pipeline y no tiene ventas:** referentes, colecciones, guiones y piezas sí; link
   de captación, escalera e insights no, porque no hay embudo del que aprender. Si entra a un programa, se le asigna y
   mide desde ese día. Lo ve quien cumple `trabajaContenido` sin alcance limitado (ADR 0107).
3. **La pieza** (`piezas`) lleva programa (el de su creador, o nulo), creador, tipo, red, CTA, fecha de publicación
   **o** la marca de permanente, su código opaco y su `publicada_en`. El programa sigue siendo frontera: una pieza no
   cambia de programa.
4. **El link fijo del creador es una pieza permanente** del tipo que media use para su contenido propio: se gestiona
   desde Creadores y hay a lo sumo una activa por red más una activa sin red; las piezas normales siempre llevan fecha.
5. **Tipos y estados son filas que media edita; cada estado se ancla a un significado del código**, un tipo de pocos
   valores: `por_hacer`, `en_curso`, `publicada`, `descartada`. El código decide solo con el significado (avisos,
   cumplimiento "de 30, 25"); el nombre, el orden y cuántos estados hay por significado son de media. Es el molde de
   `formato_utm` del canal.
6. **Se construye por partes:** los pasos 1 a 3 crean la pieza mínima (lo que el link necesita y "ya publiqué").
   Los estados configurables, la plantilla de recurrencias, las tareas y el calendario esperan a que media describa su
   pipeline (`docs/media/propuesta.md` §7, preguntas 1 a 3). Mientras, `publicada_en` es el único estado.

## Por qué

Estados 100% libres dejaban al sistema sin saber qué es publicado (sin avisos ni cumplimiento); un enum contradecía
"los define media". La pieza permanente evita un segundo emparejamiento para el link fijo.

## Consecuencias

- Toda escritura de pieza deja rastro (`crearConRastro`); una pieza con leads se descarta, no se borra.
- Ningún slug de creador ni nombre de estado aparece en `lib/`, `app/` ni `components/` (`tests/contrato-extension.test.ts`).
