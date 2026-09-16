---
id: 011
fase: F0
serves: "ADR 0012 — el molde; reemplaza el ticket 001"
depends: [008]
status: done
---

# 011 — El molde de catálogo, estrenado con plataformas de pago

## Objetivo
Existe una forma única de crear, editar, listar y desactivar cualquier entidad configurable, y
la primera entidad que la usa es `plataformas_pago`.

## Alcance
- Dentro: tabla `plataformas_pago` (`id`, `nombre` único, `activo`, `createdAt`) y su migración
  con semilla: PayPal, MercadoPago, Zelle, DollarApp, Bancolombia, Global66, Hotmart.
- Dentro: `lib/catalogo/molde.ts` con una función que, dada una tabla de Drizzle y un esquema
  zod, devuelve `listar`, `crear`, `editar`, `desactivar`. Las escrituras registran en
  `change_log` (`tabla`, `registroId`, `etiqueta`, `campo`, valores, `origen="app"`). Si hace
  falta saber quién cambió, agregar `change_log.userId` (nullable) en esta misma migración.
- Dentro: `lib/catalogo/plataformas.ts` que usa el molde.
- Dentro: tests del molde: crea, edita (registra solo los campos que cambiaron), desactiva (no
  borra), rechaza input inválido con `ZodError`, rechaza nombre duplicado con error claro.
- Fuera: la pantalla (013).

## Done cuando
- [x] Ninguna función del molde hace `DELETE`.
- [x] El molde no conoce ninguna entidad concreta (genérico sobre tabla + esquema).
- [x] La migración se genera pero **no se aplica** contra Neon sin Mani.
