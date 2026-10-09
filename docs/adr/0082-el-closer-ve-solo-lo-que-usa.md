# 0082: El closer abre solo lo que usa

- **Estado:** aceptado, 9-oct-2026 (Mani, grill tras la reunión del 9-oct). Se construye en el ticket 224.
- **Enmienda:** ADR 0048 (la política "todos ven todo": el closer deja de ver el Dashboard y las Metas del
  programa) y la nota del 20-sep en `lib/nav.ts` (Ajustes para los tres roles).
- **Confirma:** ADR 0025 (el developer pasa toda guarda; el rol de vista solo estrecha), ADR 0003 (el rol se
  enforza en el servidor), ADR 0077 (cada dato vive en la pantalla de su objeto).

## Contexto

El closer veía once entradas en el menú, cuatro sin uso para su trabajo: Ajustes (solo plataformas de pago, que
el ticket 212 ya deja crear al registrar el abono), Programa (lo lee y no edita), Dashboard y Metas (sus cifras ya
están en Mi espacio → Métricas). Mani: que al closer *"solo le salgan las pantallas que realmente va a usar"*.

## Decisión

1. **Menú = lo que puede abrir.** Al closer se le quitan Ajustes, Programa, Dashboard y Metas, y esas rutas le
   responden 404 también forjadas. No es esconder: es cerrar el acceso.
2. **La pregunta vive en `lib/auth/roles.ts`**, por capacidad y nunca por el literal del rol. El gerente y el
   developer conservan todo; el developer en vista closer ve lo del closer (la vista solo estrecha).
3. **Lo que el closer hacía en esas pantallas se muda antes de cerrarlas:** la cuenta de Calendly a Mi espacio →
   Info; las plataformas al registro del abono (212, hecho).
4. **El comparativo entre closers y la caja del programa dejan de ser visibles para el closer.** Su contribución
   la ve en Mi espacio → Métricas. El "todos ven todo" del ADR 0048 queda para gerente y developer.

## Consecuencias

- Una pantalla nueva para el closer entra al menú solo si su ruta lo deja entrar, y al revés.
- Si Gerencia quiere que los closers vuelvan a ver el tablero del programa, se reabre este ADR, no se agrega un
  link suelto.
