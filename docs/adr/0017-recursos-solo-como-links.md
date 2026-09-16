# 0017 — Los recursos y comprobantes se guardan como links, no como archivos subidos

**Fecha:** 2026-09-16

El equipo necesita encontrar rapido brochures, links de pago, paginas web, guiones y el link del
RUT para facturas. Hoy se pierden en los grupos de WhatsApp ("me regalan el link de donde se sube
el RUT, que se me perdio"). `docs/design.md` habia recomendado Vercel Blob para subir
comprobantes.

**Decidimos guardar solo links** (decision de Mani, 16 de septiembre): los recursos y los
comprobantes de pago son URLs (Drive, PayPal, la web del programa).

- Los archivos ya viven en Drive y el equipo ya los actualiza ahi ("ya se actualizo en el
  drive"). Duplicarlos en otro almacenamiento crea dos versiones que se desincronizan.
- No agrega infraestructura, ni costos, ni una superficie nueva de subida de archivos que asegurar.

## Consecuencias

- Tablas `recursos` y `enlaces_pago` con URL validada por zod (solo `https://`).
- `abonos.comprobanteUrl` es un link opcional, no un archivo.
- Un recurso tiene marca de **vigente** e historial: cambiar el brochure crea una fila nueva y
  desactiva la anterior, no la sobrescribe.
- Si mas adelante hace falta subir archivos, se abre un ADR nuevo; este queda `superseded`.
