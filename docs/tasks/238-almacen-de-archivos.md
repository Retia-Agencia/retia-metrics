---
id: 238
etapa: dinero
serves: "235 (A-146) · ADR 0085 puntos 1, 2, 3, 4 y 7"
depends: [235]
status: done
---

# 238 — El almacén de archivos: `lib/archivos/`, la tabla y el bucket

## Por qué existe

Es la base que usan 239, 240 y 241. No tiene pantalla: deja listo "subir, confirmar, leer y barrer un archivo" detrás
de una interfaz, probado contra el adaptador de memoria.

## Alcance

- **Migración (una sola para todo el 235, para ocupar la cola una vez):** tabla `archivos` (`id`, `program_id`, `ruta`
  única, `tipo_mime`, `bytes`, `sha256`, `estado` `pendiente`/`listo`, `subido_por_user_id`, `created_at`,
  `confirmado_en`, `drive_file_id`, `respaldado_en`), `abonos.comprobante_archivo_id` (FK `restrict`, nula). La
  generan, leen y aplican la sesión principal con el ok de Mani; Codex no corre `db:generate` ni `db:migrate`.
- **`lib/archivos/`:** el puerto (`urlDeSubida`, `leer`, `urlDeLectura`, `borrar`), dos adaptadores (Supabase por
  REST con `fetch`, sin SDK; memoria para tests) y las funciones de dominio `pedirSubida`, `confirmarArchivo` y
  `urlParaVer`. El adaptador de disco para `dev:local` pasa al 239, que es cuando hay una pantalla que lo use (necesita
  una ruta local que reciba la subida).
- **La regla de contenido en un solo lugar:** lista blanca (JPEG, PNG, WebP, PDF), máximo 5 MB, verificación por bytes
  mágicos.
- **Ruta en el bucket:** `<program_id>/<AAAA-MM>/<archivo_id>.<ext>`, sin datos personales.
- **Bucket `comprobantes`** privado, `file_size_limit` 5 MB, `allowed_mime_types` la lista blanca, sin políticas RLS.
  Lo crea un script desechable con el ok de Mani.
- **Secretos:** `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en `.env.local` y Vercel. Documentarlos en
  `docs/operations.md`. Verificar que Storage responde con la Data API apagada.

## Fuera

Pantallas (239, 240), el respaldo y el barrido (241).

## Done cuando

- [ ] Test de contrato: el adaptador de memoria y el de Supabase cumplen el mismo comportamiento (el de Supabase se
      salta sin secretos, como los tests contra Postgres real).
- [ ] Un PNG que en realidad es HTML, un SVG o un archivo de 6 MB se rechazan al confirmar.
- [ ] Guardián: nadie fuera de `lib/archivos/` llama a la API de Storage.
- [ ] La migración está aplicada en producción y el bucket existe, privado (una petición sin llave da 4xx).
