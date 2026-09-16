---
id: 001
fase: F1
serves: "spec §6 Datos — plataforma de pago"
depends: []
status: reemplazado
---

# 001 — (Reemplazado) Migración: plataformaPago como enum en sales

**Reemplazado por el ticket 011 el 16-sep-2026.** La idea original era un `pgEnum` de 6 valores
(MercadoPago, PayPal, Bancolombia, Global66, Hotmart, Otro). Choca con ADR 0012: la plataforma de
pago es una instancia (el equipo ya usa Zelle y DollarApp, y Addi viene en camino), así que vive
en el catálogo `plataformas_pago`, no en un enum.

Se deja el archivo para que las referencias viejas a "ticket 001" no queden colgando.
