# 0085: Los archivos viven en Storage y la base solo los referencia

- **Estado:** aceptado, 13-oct-2026 (Mani). Se construye en los tickets 238 a 241 (salen del 235).
- **Enmienda:** ADR 0017 punto 3 (el comprobante puede ser una foto). Lo concreta; **los recursos y los enlaces de
  pago siguen siendo links** (puntos 1 y 2 del 0017, sin cambios).

## Contexto

Michael pidió subir la foto del comprobante en vez de pegar un link de Drive (A-146). El 0017 ya había dicho "Supabase
Storage, bucket privado, detrás de `lib/archivos/`, URLs firmadas". El audit del 235 (13-oct) midió y encontró tres
cosas que deciden la forma: una foto sin comprimir llena el plan gratis en un mes; Vercel corta el cuerpo en 4,5 MB, así
que el archivo no puede pasar por la función; y **los respaldos de Supabase no incluyen los archivos de Storage**.

## Decisión

1. **Una tabla `archivos`** es dueña de todo lo que es un archivo en Storage (ruta, tipo, bytes, sha256, estado
   `pendiente`/`listo`, quién y cuándo, programa). El dueño de negocio apunta a ella con una **FK real**
   (`abonos.comprobante_archivo_id`). Nada de tablas polimórficas (`entidad_tipo` + `entidad_id`): sin FK, la
   integridad quedaría en el código. Un adjunto nuevo es otra FK (o una tabla puente si son varios).
2. **`lib/archivos/` es el único que habla con Storage**, con adaptadores: Supabase (REST con `fetch`, sin SDK),
   memoria (tests) y disco (`dev:local`). Cambiar de proveedor es un adaptador nuevo.
3. **La subida va del navegador directo a Storage** con una URL firmada que emite el servidor después de la guarda
   (programa visible + `puedeTrabajarDeal`). Luego el servidor confirma leyendo el objeto: tamaño real y **bytes
   mágicos**. Lista blanca: JPEG, PNG, WebP y PDF, máximo 5 MB. Las imágenes se comprimen en el navegador (JPEG, lado
   largo ≤ 2.000 px), lo que además borra el EXIF.
4. **Ver un archivo es una ruta del CRM** que pasa la guarda y redirige a una URL firmada de 60 segundos. La URL
   firmada nunca se guarda. La ruta en el bucket es `<program_id>/<AAAA-MM>/<archivo_id>.<ext>`: ids opacos.
5. **Quién ve el comprobante:** quien puede abrir la ficha del deal (membresía del programa, ADR 0048); el paid
   trafficker no (C-1).
6. **Uno por abono**, además del link (C-2). Si hace falta más, tabla puente `abono_archivos`.
7. **Se guarda para siempre** (C-3), y **no se borra lo que se usó** (ADR 0026): anular el abono no toca el archivo y
   reemplazarlo deja el anterior. Solo se borra un `pendiente` que nunca se colgó de nada, a las 24 h.
8. **Respaldo propio** (C-4): una copia a Google Drive de Retia, que es un **espejo derivado** del CRM, nunca una
   fuente. La estructura de carpetas y nombres se define en el ticket 241.
9. **No espera a Supabase Pro** (C-5): comprimido cabe en el plan gratis cerca de un año. S1 sigue abierta por la base.
10. **"¿Este abono tiene comprobante?" tiene una sola respuesta**, `tieneComprobante` (link o archivo listo), que usan
    el kanban, el Inbox y la ficha.

## Consecuencias

- Dos secretos de servidor nuevos: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (nunca `NEXT_PUBLIC_`).
- Un cron diario (cabe en Hobby) para el respaldo y el barrido de pendientes.
- PGlite no ve Storage: los tests prueban contra el adaptador de memoria y un test de contrato obliga a los dos a
  comportarse igual.
