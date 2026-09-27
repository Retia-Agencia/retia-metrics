# 0017 — Los recursos son links; el comprobante de un abono puede ser una foto

**Fecha:** 2026-09-16 · **Reescrito:** 2026-09-27 (consolida la enmienda del 20-sep y el ADR 0047) ·
**Estado:** aceptado

El equipo necesita encontrar rápido brochures, links de pago, páginas web, guiones y el link del RUT.
Hoy se pierden en los grupos de WhatsApp.

## Decidimos

**1. Los recursos y los enlaces de pago son URLs**, validadas por zod (solo `https://`), no archivos
subidos. Los archivos ya viven en Drive y el equipo los actualiza ahí: duplicarlos crea dos versiones
que se desincronizan.

**2. Un recurso tiene marca de vigente e historial.** Cambiar el brochure crea una fila nueva y deja
la anterior como no vigente; no la sobrescribe. `vigente` dice cuál es la versión de hoy; `activo` es
el borrado suave del molde (ADR 0012), y son dos cosas distintas.

**3. La excepción es el comprobante de un abono: puede ser un link o una foto** (Mani, 20-sep:
*"todo CRM debe poder tener archivos; lo básico son los comprobantes de cada venta"*). La foto va a
Supabase Storage, en un bucket privado, **detrás de una interfaz propia** (`lib/archivos/`) y con URLs
firmadas desde el servidor (ADR 0047). Entra con el ticket 035, no antes (ADR 0006).

## Consecuencia

Un comprobante pesa 1 a 5 MB: veinte fotos pesan más que toda la base de hoy. Por eso van en Storage y
no en la base.
