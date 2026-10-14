---
id: 235
etapa: dinero
serves: "Michael, 12-oct: subir la foto del comprobante en vez de generar un link de Drive (A-146) · absorbe el 035"
depends: [233]
status: todo
---

# 235 — El comprobante de un abono se puede subir como archivo

## Por qué existe

Hoy el comprobante de un abono es solo un link (`abonos.comprobante_url`). Para la closer eso es un paso extra: subir
la captura a Drive, compartirla y pegar el link. Michael pide poder poner la foto directo. Mani (12-oct): todo
centralizado, fácil de encontrar y **escalable**: la base no guarda los archivos.

**Absorbe el 035** (20-sep, *"links y/o fotos de comprobantes"*), que quedó abierto pidiendo dos análisis antes de
codear: cuánto crece el almacenamiento y quién ve el comprobante de un abono ajeno. Los dos están abajo (audit del
13-oct). El ADR 0017 punto 3 ya decidió el destino: **Supabase Storage, bucket privado, detrás de `lib/archivos/`,
URLs firmadas desde el servidor**; los recursos siguen siendo links.

## Audit (13-oct, Mani + Claude)

### 1. Lo medido en producción (solo lectura, ref `hfqmiyiuyqapdsbywrag`)

| Qué | Valor |
|---|---|
| Abonos | 30 (26 trasladados de Sheets, 4 de la app), todos de sep-oct; **0 con comprobante** |
| Ventas (deals en Ganado parcial o completo) | 30 → hoy ~1 abono por venta; los parciales van a sumar más |
| Peso de la base | 39 MB |
| Supabase Storage | sin buckets, 0 objetos |
| Plan | Supabase gratis (S1 sin decidir), Vercel Hobby |

**Volumen esperado** (supuesto, no medido: la historia del CRM tiene dos semanas). Tres programas, cohortes de 50 a 60
cupos cada ~6 semanas, 1,5 a 2 abonos por venta → **~200 comprobantes al mes; techo de diseño: 300.**

### 2. Crecimiento y costo (300 al mes)

| Escenario | Por archivo | Por mes | Por año | Plan gratis (1 GB) | Pro (100 GB incluidos) |
|---|---|---|---|---|---|
| Comprimido en el navegador (JPEG, lado largo ≤ 2.000 px) | ~250 kB | ~75 MB | ~0,9 GB | se llena en ~13 meses | ~100 años; costo cero extra |
| Sin comprimir (captura PNG o foto de celular) | 1 a 5 MB | ~900 MB | ~11 GB | **se llena en ~1 mes** | ~9 años; ~USD 0,021/GB después |

Egress (ver un comprobante): unos pocos MB al día; el gratis trae 5 GB/mes y Pro 250 GB. No es restricción.

**Conclusión:** la plata no es el problema en ningún escenario. La **compresión en el navegador es obligatoria**,
porque es lo que separa "cabe en el plan gratis un año" de "lo llena en un mes", y además borra el EXIF (GPS del
celular) de las fotos. Un PDF no se re-codifica: pasa tal cual con tope de tamaño.

### 3. Restricciones técnicas que deciden la forma

- **El archivo no puede pasar por nuestro servidor.** Vercel corta el cuerpo de una función en 4,5 MB y una server
  action en 1 MB por defecto. La subida va **del navegador directo a Storage** con una URL de subida firmada que
  emite el servidor después de la guarda (Supabase: válida 2 horas, de un solo destino).
- **Los respaldos de Supabase NO incluyen los archivos** (docs de Supabase: *"Database backups do not include objects
  you store via the Storage API"*). Pagar Pro (S1) respalda la base, no los comprobantes. Un comprobante es
  evidencia de dinero: necesita su propio respaldo o una decisión explícita de aceptar el riesgo.
- **La base local (`db:local`) es Postgres en Docker, sin Storage**, y los tests corren en PGlite. Por eso
  `lib/archivos/` es una interfaz con adaptadores: Supabase (producción), memoria (tests) y disco (dev:local).
- **No hay SDK de Supabase instalado.** La API REST de Storage se llama con `fetch` (escalera: no se agrega
  dependencia hasta que el REST se vuelva incómodo; si pasa, `@supabase/storage-js` y nada más). Pide dos secretos
  de servidor nuevos: `SUPABASE_URL` y la llave secreta (`SUPABASE_SECRET_KEY`), en `.env.local` y Vercel, nunca
  `NEXT_PUBLIC_`. Verificar en la sesión de construcción que Storage responde con la Data API apagada.
- **Seguridad del contenido.** Lista blanca: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Nunca SVG ni
  HTML (ejecutan código). El tipo se confirma por los **bytes mágicos** al confirmar la subida, no por el
  `Content-Type` que manda el navegador. Los archivos se sirven desde el dominio de Supabase, nunca desde el de la app.

### 4. Diseño propuesto (por construir en este ticket)

**Datos.** Dos piezas, no una columna suelta:

- Tabla **`archivos`**: dueña de todo lo que es "un archivo en Storage", sin importar para qué sirve. `id`,
  `program_id` (frontera), `ruta` (única), `tipo_mime`, `bytes`, `sha256`, `estado` (`pendiente` | `listo`),
  `subido_por_user_id`, `created_at`, `confirmado_en`. Sin nombre original ni nada personal.
- **`abonos.comprobante_archivo_id`**: FK real a `archivos` (`restrict`), nula. `comprobante_url` se queda: un abono
  puede tener link, archivo, los dos o ninguno.

¿Por qué una tabla y no una columna `comprobante_ruta`? Porque el ciclo de vida del archivo (pendiente, huérfano,
respaldo, peso total, límites) es UNA pregunta que hoy sirve al comprobante y mañana a otro adjunto: si vive en la
tabla del abono, el segundo adjunto la copia. ¿Por qué FK en el dueño y no una tabla polimórfica
(`entidad_tipo` + `entidad_id`)? Porque la polimórfica no tiene FK y la integridad quedaría en el código.

**Ruta en el bucket:** `<program_id>/<AAAA-MM>/<archivo_id>.<ext>`. Ids opacos, ningún dato personal.

**Bucket `comprobantes`:** privado, `file_size_limit` 5 MB, `allowed_mime_types` la lista blanca. Sin políticas RLS:
nadie entra con la llave anónima; solo el servidor con la secreta.

**Flujo de subida (tres pasos, ninguno pasa el binario por Vercel):**

1. `pedirSubidaDeComprobante` (server action): guarda de ruta, programa visible, `puedeTrabajarDeal`, zod (tipo y
   tamaño declarados) → crea la fila `archivos` en `pendiente` → devuelve la URL de subida firmada.
2. El navegador comprime (imagen → JPEG) y sube directo a Storage.
3. `confirmarComprobante`: el servidor lee el objeto (tamaño real y bytes mágicos), lo marca `listo` y lo cuelga del
   abono con `editarConRastro` (queda en `change_log`). Al registrar un abono nuevo, el archivo se sube ANTES y
   `registrarAbono` recibe el `archivoId`, así el abono y su comprobante entran en la misma transacción.

**Ver un comprobante:** una ruta del servidor (`/p/[programa]/archivos/[id]`) que pasa la guarda del programa y la de
la ficha, y responde con redirección a una URL firmada de **60 segundos**. La URL firmada nunca se guarda.

**Una sola respuesta a "¿este abono tiene comprobante?":** `tieneComprobante` (link o archivo listo) en
`lib/deals/abono-sin-comprobante.ts`, que hoy pregunta solo `isNull(comprobante_url)`. La usan el aviso del kanban,
el Inbox y la ficha. Si se olvida una, el aviso "abono sin comprobante" sigue prendido con el archivo puesto, sin un
error.

**Lo que no se borra (ADR 0026):** anular el abono no toca el archivo; reemplazar el comprobante crea otro archivo y el
viejo queda (lo cita `change_log`). Solo se borra de Storage un `pendiente` que nunca se colgó de nada (barrido de los
de más de 24 h, una vez al día: cabe en el cron de Hobby).

**Tests:** contrato del adaptador (memoria y Supabase cumplen lo mismo); la guarda mordida forjando la petición (sin
sesión, otro programa, closer que no es dueño); tipo falso (un `.png` que es HTML) rechazado; guardián de que nadie
fuera de `lib/archivos/` llama a Storage; `tieneComprobante` en los tres lugares.

### 5. Cómo se expande sin rehacerlo

- **Otro adjunto** (contrato firmado, soporte de un descuento, documento del onboarding del 145): una FK nueva en su
  dueño (o una tabla puente si son varios) apuntando a `archivos`, y su política de límites en el código (los tipos
  viven en el código, ADR 0012). Storage, guarda, firma, respaldo y barrido ya existen.
- **Varios archivos por abono:** se pasa de la FK a una tabla puente `abono_archivos`; migración chica y sin perder
  nada.
- **Cambiar de proveedor** (Vercel Blob, R2, S3): un adaptador nuevo en `lib/archivos/` y copiar el bucket; nada
  fuera de ese módulo sabe dónde viven los bytes.
- **Si el volumen se multiplica por diez** (3.000 al mes): ~9 GB/año comprimidos; sigue dentro de Pro.

### 6. Decisiones (13-oct: Mani aceptó C-1 a C-5 como se recomiendan; quedan en el ADR 0085)

| # | Qué | Recomendación |
|---|---|---|
| C-1 | Quién ve el comprobante de un abono ajeno (la pregunta del 035 que el ADR 0048 no contesta: una cifra agregada no es la foto del pago de una persona) | Quien puede abrir la ficha del deal (membresía del programa); el paid trafficker no |
| C-2 | Uno o varios archivos por abono | Uno, más el link; la puente cuando alguien lo pida |
| C-3 | Retención | Para siempre, como el lead (a ~1 GB/año no hay presión) |
| C-4 | Respaldo de los archivos (Supabase no los respalda) | Script semanal que copia el bucket a una carpeta de Drive de Retia (`googleapis` ya está instalado); se cruza con S1 |
| C-5 | ¿Supabase Pro antes de prender esto? | No bloquea: comprimido cabe en el gratis ~1 año. Pero S1 sigue pendiente por la base |
| C-6 | Cómo mandan hoy el comprobante (foto, captura, PDF): pregunta B de `plan.md` §7 a los closers | Confirmar con Michael; el diseño soporta los tres |

El ADR 0085 recoge el modelo y enmienda el 0017 punto 3. **Se construye en cuatro tickets:** 238 (almacén, tabla,
bucket y la única migración) → 239 (subir y ver desde la ficha) y 241 (respaldo en Drive y barrido) en paralelo →
240 (subir al registrar el abono). C-6 no bloquea el 238. La estructura del respaldo vive en el 241.

## Done cuando

- [ ] Un closer registra un abono con una foto desde el celular, sin salir de la app.
- [ ] Un closer registra un abono pegando un link, como hoy. **No se rompió nada.**
- [ ] Un abono ya registrado recibe su comprobante como archivo desde la ficha (como hoy "Pegar comprobante").
- [ ] El archivo NO es accesible sin sesión ni desde otro programa. Probado forjando la petición, no mirando el botón.
- [ ] Un archivo que no es imagen o PDF (por sus bytes), o que pasa 5 MB, se rechaza en el servidor.
- [ ] El aviso "abono sin comprobante" se apaga con el archivo, en kanban, Inbox y ficha.
- [ ] El ADR nuevo dice explícitamente que los recursos siguen siendo links.

## Anotaciones

A-146.
