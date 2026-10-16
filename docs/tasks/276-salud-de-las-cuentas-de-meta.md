---
id: 276
etapa: pauta
serves: "Un error de pago o un bloqueo de una cuenta publicitaria de Meta se ve el mismo día, no cuando la pauta ya se cayó (Mani, 16-oct)"
depends: [119]
status: done
---

# 276 — La salud de las cuentas de Meta

## Por qué

Si una cuenta publicitaria se queda sin cobro o Meta la deshabilita, los anuncios paran y hoy nadie lo ve hasta que los
leads dejan de llegar. Mani pidió una alerta de error de pago.

## Lo que ya se midió (16-oct, solo lecturas con `META_SYSTEM_TOKEN`, Graph `v26.0`)

`GET /me/adaccounts?fields=name,account_status,disable_reason,currency,balance,amount_spent,spend_cap,is_prepay_account,funding_source_details`
responde 200 con `ads_read`, sin permisos extra:

- **`account_status`** es la señal: `1` activa · `2` deshabilitada · `3` sin liquidar (pago fallido o pendiente) ·
  `7` en revisión de riesgo · `8` liquidación pendiente · `9` periodo de gracia · `101` cerrada. Junto con
  **`disable_reason`** (0 = ninguna).
- **`spend_cap` contra `amount_spent`** (en centavos de la moneda de la cuenta) da cuánto le queda a una cuenta con
  tope; **`balance`** es lo facturado sin pagar; **`is_prepay_account`** marca las prepago.
- **`funding_source_details`** dice el tipo de medio de pago. El detalle de un cobro rechazado no aparece.
  `/{cuenta}/activities` existe y responde, pero falta confirmar si trae un evento de cobro fallido.
- Ese día las 4 cuentas que lista el token estaban activas (`1`, razón 0). La prepago (`567726836094755`, COP) llevaba
  ~79% de su tope.
- ⚠️ **`/me/adaccounts` devolvió 4 cuentas y AGENTS.md dice que el token ve 7.** Antes de construir hay que saber si
  las otras 3 se leen por el portafolio (`/{business}/owned_ad_accounts` o `client_ad_accounts`) o si el token perdió
  acceso. Si no, la alerta callaría justo sobre las cuentas que no ve.

## Qué (por decidir)

**Abierto: dónde vive la alerta.** Dos destinos, que no se excluyen:

- **Juanito (semáforo, ADR 0089):** un bloque "cuentas de Meta" en el envío del programa, con rojo si
  `account_status ≠ 1` o si una prepago o una cuenta con tope pasa un umbral de gasto. Es lo que avisa a tiempo.
- **Hub › Pauta:** el estado de cada cuenta del programa al lado de su gasto, con la misma regla. Es donde se mira el
  detalle.

En los dos casos la lectura vive en UN módulo de `lib/` (junto al cliente de Meta del 119/120) y los dos lo importan.
Los umbrales son datos del programa, no literales (C-1). La cuenta pertenece a un programa: nada cruza programas.

## Done cuando

Se define al decidir el destino. Mínimo: una cuenta con `account_status` distinto de `1` sale en rojo el mismo día, con
su estado en español, y una cuenta que el token no ve se avisa en vez de contar como sana.

## Fuera de alcance

Cambiar medios de pago o tocar campañas (el token es `ads_read`).

## Cerrado (16-oct, e4afa69, CI verde)

- **Destino: solo Juanito.** El Hub queda fuera (Mani, 16-oct). Cada envío termina con `💳 Cuentas de Meta: todas al día (n)`
  o lista cada cuenta con problema, y un problema quita el "Sin errores".
- **Las 4 contra 7 se resolvió leyendo cada cuenta por su id** (`act_<id>`), no listando `/me/adaccounts`: las 6 cuentas
  activas del CRM responden. Una cuenta que no se lee sale como "no se pudo leer en Meta", nunca como sana.
- **Regla** (`diagnosticoDeCuenta`, `lib/pauta/salud-cuentas.ts`): `account_status` 1 = al día; si no, el estado en español
  más la razón. Con estado 1, `amount_spent >= spend_cap` (tope > 0) es "llegó al tope de gasto": un hecho de Meta, sin
  umbral. Un aviso anticipado del tope (porcentaje) necesitaría un umbral por programa (C-1) y no se construyó.
- La vista previa de Programa › General no llama a Meta: ahí no sale la línea 💳.

