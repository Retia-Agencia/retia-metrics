---
id: 086
etapa: E3
serves: "plan v2 §12.8 · ADR 0044 puntos 1 a 5"
depends: [048, 084, 092]
status: todo
---

# 086 — El origen humano del lead y el enlace de captacion del closer

## Objetivo

Que un lead traido por un closer deje rastro. Hoy **no lo deja**, y por eso "leads por area" mostraria
**Comercial en cero** sin lanzar un error.

## ⏳ Por que este ticket es de la etapa 3 y no de la 5

El dato lo escribe **la ingesta**, y la ingesta es el ticket 048. Escribirlo despues significa que los
leads que entren mientras tanto **no tienen origen y no se puede reconstruir**: *"este lead lo trajo
Maru"* no esta escrito en ninguna parte hoy. No es que este mal guardado — **no existe**.

## Alcance

- **Dentro:** `leads.traido_por_user_id`, **FK real a `users`**, nunca texto (ADR 0030).
- **Dentro:** la escribe **solo** la funcion de ingesta del 048, por los dos caminos, y **el primero
  que la escribe gana**: si Maru lo trajo y meses despues reaplica por Meta, sigue siendo de Maru.
- **Dentro:** el enlace de captacion, **por closer Y programa**, **calculado y no guardado** (ADR 0024:
  un enlace guardado y la fuente cambiada son dos verdades). Pantalla con boton Copiar.
  ⚠️ **Usa el generador del ticket 092, no reimplementa uno.** Y 092 es el que agrega
  `programs.form_url`, **sin el cual este enlace no se puede calcular**: el CRM sabe donde CAEN las
  respuestas (`sources.sheet_id`), no donde la gente LLENA.
- **Dentro:** el alta manual elige "traido por" de un **selector**, nunca escribiendo un nombre.
- **Fuera:** auto-asignar el owner del deal. **No se hace** (punto 5 del ADR 0044).
- **Fuera:** normalizar UTM (sigue fuera, ticket 066).

## Las reglas que no se rompen

- 🩸 **El closer NO teclea un UTM.** `Maru`, `maru`, `closer maru` y `Maru Marquez` serian cuatro
  closers en el reporte. El enlace lo genera el CRM, asi que nadie teclea.
- **El alta manual NO genera envio**, y no es una preferencia: `submissions.source_id` es `notNull` y
  una fuente "manual" activa la rechaza `sources_una_activa_por_programa_idx` (ADR 0039).

## Done cuando

- [ ] Un lead que entra por el enlace de un closer queda con `traido_por_user_id` poblado, con test.
- [ ] Un segundo envio del mismo correo por otra via **no pisa** el origen, con test.
- [ ] El enlace de un closer en dos programas da **dos URLs distintas**, y ninguna se guarda.
- [ ] Un alta manual queda con origen y **sin envio**, y el deal manual funciona (ADR 0037).
- [ ] `grep` confirma que ningun modulo fuera de la ingesta escribe `traido_por_user_id`.

## Kiro

Si, con revision. La regla de "el primero gana" es donde un bug es silencioso.
