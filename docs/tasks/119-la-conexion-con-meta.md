---
id: 119
etapa: E6
serves: "ADR 0062 puntos 3 y 4 · docs/analytics.md PT-38"
depends: []
status: todo
---

# 119 — La conexión con Meta: un token por portafolio y las cuentas de cada programa

## Objetivo

Que el CRM pueda leer la pauta de Meta de cada programa sin que nadie toque Vercel.

## Alcance

- **Dentro:** migración (sesión principal): `meta_conexiones` (nombre del portafolio, token, `activo`) y
  `cuentas_publicitarias` (id `act_...`, `program_id`, conexión, moneda, zona horaria, `activo`). Un
  programa puede tener varias cuentas; una cuenta es de **un** programa (frontera, ADR 0043).
- **Dentro:** el token sigue las reglas del ADR 0057: lo escribe **una** función (`guardarTokenMeta`), se
  muestra una vez, nunca pasa por el molde ni por `change_log`, y ninguna lectura lo devuelve. Un test lo
  muerde, como `tests/fuentes-webhook.test.ts`. Es la cuarta excepción nombrada de `AGENTS.md`.
- **Dentro:** al guardar un token se prueba contra la API de Meta (lista las cuentas que ve) y al vincular
  una cuenta se leen su moneda y su zona horaria. 🩸 Si la zona horaria no es `America/Bogota`, la pantalla
  lo dice: el gasto por día quedaría corrido (regla dura de fechas).
- **Dentro:** pantalla para quien administra (y el trafficker cuando exista `manejaPauta`, 102).
- **Fuera:** leer el gasto (120).

## Por verificar con Pauta

PQ1 de `docs/analytics.md`: si hay una cuenta por programa o una compartida, y la moneda y la zona de cada
una. Si una cuenta sirve a dos programas, hace falta asignar cada campaña a su programa: se decide antes de
construir, no se adivina por el nombre.

## Done cuando

- [ ] Un token se guarda, se prueba y nunca vuelve en una lectura, con test mordido.
- [ ] Una cuenta vinculada muestra su moneda y su zona horaria reales.
- [ ] Un closer que forja la acción recibe 403 y la base no se mueve.

## Kiro

Sí para el código y los tests, con revisión de permisos. La migración, la sesión principal.


---

## Respuesta de Mani, 29-sep

- Una cuenta publicitaria por programa, en COP y zona Bogotá; un token por portafolio (varias conexiones). La relación cuenta → programa es 1 a 1 por ahora; no hace falta asignar campañas a mano.
