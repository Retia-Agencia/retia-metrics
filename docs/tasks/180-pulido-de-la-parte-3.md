---
id: 180
etapa: O3
serves: "Recorrido de la sesión central de la parte 3 (3-oct, noche) sobre 174, 177 y 178"
depends: [174, 177, 178]
status: done
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

## Estado (3-oct, S13)

Código listo, sin empujar: los cuatro puntos hechos (`ficha-llamadas.tsx`: la última llamada con Show y sin Grain sale
del colapsable con su campo; `volver.ts`: `vista` ya no cuenta como filtro, test agregado; `fuentes-admin.tsx`: Tipo
por defecto webhook; `responder-pregunta.tsx`: botón muerto quitado). Typecheck, lint, `tests/volver.test.ts` (27) y
`npm run build` limpios. **Falta el recorrido en `dev:local`** (escritorio y 375 px, consola, pegar Grain y ver que la
alerta se apaga): había un `next-server` ajeno en :3000 sobre esta carpeta y no se tocó.

## Recorrido (3-oct, sesión central)

En `dev:local`, escritorio y 375 px, consola sin errores, sin scroll horizontal:

1. Como closer: Resultado → Show en un clic; la llamada queda fuera del colapsable con su campo de Grain (dos deals,
   uno en cada ancho). Pegado el link: "Grain guardado.", la alerta "La llamada no tiene el link de Grain" se apaga y la
   llamada pasa a "Llamadas anteriores".
2. Leads en vista Tabla → ficha del lead: "← Leads" (sin "filtrados") y vuelve a `?vista=tabla`.
3. Como gerente, tab Programa → Nueva fuente: Tipo arranca en "Webhook de formulario".
4. Kanban: soltar un deal Potencial en En gestión abre el diálogo con "Registrar contacto", "Registrar intento" y
   "Cancelar", sin el botón muerto.

Visto de paso, sin arreglar (chico, para un ticket futuro si Mani quiere): el campo de Grain guarda al pegar o al salir,
no con Enter; su ayuda ("Al pegarlo, la llamada queda como show…") sobra cuando la llamada ya es Show; y la llamada
del seed queda "Sin closer" aunque la marcó el dueño del deal.
