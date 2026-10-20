---
id: 281
etapa: pauta
serves: "Cada venta de un programa le llega a Meta como Purchase con su valor, una sola vez por deal, para que la pauta optimice por ventas (Michael y Anderson, 19-oct; ADR 0097)"
depends: [278]
status: todo
---

# 281 — La venta vuelve a Meta (API de Conversiones)

## Por qué

Michael (19-oct, llamada): *"el CRM pueda devolverle a Meta el evento de conversión con el valor de cada venta y de
dónde vino"*, prioridad por encima del resto de la lista de Anderson. Hoy Meta solo ve el `Lead` del pixel del
formulario. Decisiones en el ADR 0097.

## Requisitos de operación (antes de encender un programa)

1. **Acceso al portafolio cliente.** Alguien con acceso total en el portafolio entra a Configuración del negocio ›
   Usuarios › Personas › Agregar, pone el correo de Mani con acceso total (o acceso parcial con la opción avanzada
   Desarrollador) y le asigna el **dataset** con control total. Uno por portafolio: ComunicArte, Tactical (Vieira) y
   Comunícate con Confianza (Powertalk, portafolio nuevo).
2. **El token.** Events Manager › el dataset › Configuración › API de Conversiones › Generar token (Meta crea la app y
   el usuario del sistema; sin App Review). Se pega en Programa › Integraciones › Meta CAPI con el id del dataset.
   Nunca pasa por el chat ni por un archivo.
3. **La autorización de datos** de cada formulario cubre compartir con plataformas publicitarias (Ley 1581). Se revisa
   el texto una vez por programa; si no lo cubre, se ajusta el formulario. No bloquea construir.
4. **Prueba:** "Probar" en Integraciones manda un `Purchase` con `test_event_code` y se ve en Events Manager › Probar
   eventos. Solo después se enciende el interruptor.

## Alcance

- **Integración `meta_capi`**: el 278 ya está en producción sin ella. El 281 agrega el valor `meta_capi` al enum
  `integraciones.tipo` (migración, la aplica la sesión principal) y su entrada en `INTEGRACIONES`: secreto `token`,
  config `dataset_id` y `encendido`; `probar()` manda un evento de prueba. Dónde: `tipoIntegracionEnum` en
  `lib/db/schema.ts` (la migración es la siguiente libre después de la 0095 del 280), la entrada en
  `lib/integraciones/registro.ts`, el secreto solo por un lector de `lib/integraciones/`, y el guardián
  `tests/integraciones-guardian.test.ts` cubre `lib/meta-capi/`. La pestaña la pinta sola.
- **Tabla `eventos_meta`** (la bandeja de salida): deal, programa, evento (`purchase` hoy), `event_id`, `event_time`,
  valor y moneda, estado (`pendiente`, `enviado`, `fallido`, `vencido`, `omitido`), intentos, último error,
  `enviado_en`, y la marca de anulado después del envío. Índice único `(deal_id, evento)`: una sola vez por deal.
- **El disparo vive en `moverEtapa`**: cuando un deal entra por primera vez a Abonado o a Completo, en la misma
  transacción se inserta la fila (`on conflict do nothing`). Cortesía, valor 0 o programa apagado → `omitido` con la
  razón, para que se vea por qué no salió.
- **El envío:** un cron (cada 5 min; pg_cron o Vercel, el que ya use el repo) toma las pendientes, arma el payload y
  hace `POST /{dataset_id}/events` con el token del programa. Lote por programa. Reintento con espera creciente; al
  pasar 7 días desde `event_time`, `vencido`. Un evento viejo nunca entra en un lote con otros (Meta rechaza el lote
  entero).
- **El payload:** `event_name: Purchase`, `event_id` = id del deal, `action_source: system_generated`, `custom_data`
  `{ value: valor_vendido_usd, currency: "USD" }`, `user_data` con `em`, `ph`, `fn`, `ln`, `country` y `external_id`
  (id del lead) en SHA-256 normalizado, y `fbc` cuando el envío de origen traiga `fbclid` (282). Una sola función pura
  `payloadDeVenta(deal, lead, envio)` en `lib/meta-capi/`.
- **Pantalla:** en Programa › Integraciones › Meta CAPI, el interruptor, la última prueba, y los conteos de los últimos
  7 días (enviados, fallidos, vencidos, omitidos) con la lista detrás. Ningún secreto llega al cliente.
- **Fuera:** `Schedule` y Atendido (283), carga hacia atrás de ventas viejas (imposible después de 7 días), corregir
  en Meta lo anulado.

## Tests

- `payloadDeVenta`: normalización y hash de cada campo (correo en minúsculas sin espacios, teléfono con indicativo y
  solo dígitos), `fbc` con el formato `fb.1.<ms>.<fbclid>`, nada personal sin hash.
- El disparo: Abonado y luego Completo deja **una** fila; Completo directo deja una; cortesía y programa apagado dejan
  `omitido`; un deal anulado antes del envío no se manda; después del envío queda marcado.
- El envío: con un fetch falso, éxito, error de Meta, reintento, vencido a los 7 días, un programa nunca usa el token
  de otro.
- Guardián: solo `lib/meta-capi/` habla con `graph.facebook.com/.../events` y lee el secreto `meta_capi`.

## Done cuando

Un programa encendido manda el `Purchase` de una venta real, aparece en Events Manager con su valor y una calidad de
coincidencia visible, y un segundo movimiento del mismo deal no manda otro.


## Enmienda 20-oct (ADR 0099)

El `fbc` depende de que el `fbclid` sobreviva la landing y el formulario (ADR 0099). La pantalla de Meta CAPI muestra, junto a los conteos, cuántas ventas enviadas llevaron `fbc`: es la cobertura que dice si el arreglo de las landings funcionó.
