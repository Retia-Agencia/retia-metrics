---
id: 235
etapa: dinero
serves: "Michael, 12-oct: subir la foto del comprobante en vez de generar un link de Drive (A-146)"
depends: [233]
status: todo
---

# 235 — El comprobante de un abono se puede subir como archivo

## Por qué existe

Hoy el comprobante de un abono es solo un link (`abonos.comprobante_url`). Para la closer eso es un paso extra: subir
la captura a Drive, compartirla y pegar el link. Michael pide poder poner la foto directo. Mani (12-oct): todo
centralizado, fácil de encontrar y **escalable**: la base no guarda los archivos.

## Para decidir en su propia sesión (no construir antes)

- Dónde viven los archivos: Supabase Storage (ya está la base ahí, bucket privado) o Vercel Blob privado. La base
  guarda solo la referencia (ruta, tipo, tamaño, quién y cuándo), nunca el binario.
- Acceso: nada público. URL firmada de corta vida, emitida por el servidor después de la guarda del programa (el
  programa es frontera). Ningún dato personal en la ruta del archivo.
- Límites: tipos (imagen, PDF), tamaño máximo, y si un abono tiene uno o varios comprobantes.
- Si el link sigue existiendo al lado del archivo (sí, para quien ya lo tiene en otro lado).
- Si sirve para otros adjuntos del deal más adelante (sin construirlo ahora: YAGNI).

## Anotaciones

A-146.
