---
id: 180
etapa: O3
serves: "Recorrido de la sesión central de la parte 3 (3-oct, noche) sobre 174, 177 y 178"
depends: [174, 177, 178]
status: todo
---

# 180 — Pulido de la parte 3: el Grain a la vista después de Show, y tres textos

Sesión **S13**, ola O3. Sin migración. Chico: cabe en una sesión corta. Puede ir junto con el 179 si es la misma
sesión (los archivos no se cruzan, salvo que los dos toquen la ficha: no lo hacen).

## Lo que encontró el recorrido

1. **Después de "Show" el campo de Grain desaparece.** La llamada deja de ser "activa" y pasa a "Llamadas anteriores",
   que está colapsada: el closer tiene que adivinar que debe desplegarla para pegar el transcript, justo después de
   marcar Show (que es cuando lo tiene). Y la alerta amarilla "La llamada no tiene el link de Grain" no dice dónde
   pegarlo. Arreglo: la última llamada con Show y sin Grain se muestra fuera del colapsable con su campo de Grain
   (o la alerta lleva un botón que abre ese campo). `components/deals/ficha/ficha-llamadas.tsx`, `ficha-alertas.tsx`.
2. **"← Leads · filtrados" cuando solo se cambió a la vista Tabla.** `vista=tabla` no es un filtro; la etiqueta dice
   "filtrados" con cualquier query. `etiquetaDeOrigen` en `lib/navegacion/volver.ts`: ignorar `vista` (y la página)
   al decidir si hay filtro. Test en `tests/volver.test.ts`.
3. **"Nueva fuente" arranca con Tipo = "Hoja de Google".** El sync de Sheets se retiró el 28-sep; las fuentes nuevas
   son webhook. El tipo por defecto pasa a webhook (`components/fuentes-admin.tsx`).
4. **Botón muerto "Elige una opción"** en `components/deals/responder-pregunta.tsx:323` (lo avisó el 177; es el mismo
   caso que se quitó del diálogo Resultado).

## Done cuando

- Marcar Show deja el campo de Grain visible sin desplegar nada; pegarlo quita la alerta.
- Los tres textos/defaults, vistos en `dev:local`, escritorio y 375 px, consola limpia.
- Typecheck, lint, tests tocados y `npm run build`.
