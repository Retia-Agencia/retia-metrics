---
id: 119
etapa: E6
serves: "ADR 0062 puntos 3 y 4 · docs/analytics.md PT-38"
depends: []
status: done
quien: Mani (14-oct)
---

# 119 — La conexión con Meta: un solo token y las cuentas de cada programa

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

---

## Enmienda 14-oct (audit del Hub, ADR 0087 punto 7, `docs/hub.md` §2.4)

La respuesta del 29-sep (una cuenta por programa, en COP, un token por portafolio) **ya no es cierta**:

- **Una sola conexión:** el portafolio **Agencia Retia Growth** (`1671066217989493`) con el usuario del sistema
  `retia-insights` (solo `ads_read`, caducidad Nunca). El token existe y vive hoy fuera del repo
  (`~/.config/retia/meta.env`); entra a la base solo por `guardarTokenMeta`, desde la pantalla, a mano.
- **N cuentas por programa, cada una con su moneda:** TI 1 (COP), Power Talk = Comunícate con Confianza 1 (COP),
  ComunicArte 4 que importan (2 COP, 2 USD; las confirmó Anderson el 13-oct), más `[CP] Milena Nas & Be` (USD), que se
  vincula inactiva (HQ-6), y una restringida por Meta que no se puede asignar. Moneda y zona horaria se leen de Meta; hoy las cuatro activas están en `America/Bogota`.
- **La API exige la versión:** `https://graph.facebook.com/v26.0/...` (sin versión, error #2635).
- **Dónde va la pantalla** (ADR 0077): la conexión, en Ajustes (no es de ningún objeto); las cuentas de un programa,
  en la tab Programa.
- **Un programa nuevo** con pauta (Memorable, los que vengan) se configura vinculando su cuenta: es una fila, sin
  código (contrato C-1 de `docs/hub.md`).

---

## Enmienda 14-oct (Mani): no hay token por portafolio

El usuario del sistema `retia-insights` vive en el portafolio de Retia, que es **socio** de los portafolios de los
clientes: con **un** token se leen todas sus cuentas. Verificado el 14-oct por API (solo lectura): el token ve las 7
cuentas de la tabla de `docs/hub.md` §2.4, todas en `America/Bogota`. Con `ads_read` la API no deja leer el dueño de
cada cuenta (`owner` y `business` piden `business_management`), y no hace falta.

Lo que cambia en el alcance:

- **Una sola conexión, no N.** `meta_conexiones` sigue siendo el lugar del token (reglas del ADR 0057), pero la base
  admite **una sola fila activa** (índice único parcial, ADR 0005), y `cuentas_publicitarias` **no** lleva FK a la
  conexión: la cuenta es de un programa y punto. `ponytail:` si algún día un cliente no comparte sus cuentas con el
  portafolio de Retia, se agrega la FK y una segunda conexión; hoy ese caso no existe.
- **Vincular una cuenta** es escogerla de la lista que devuelve el token (`/me/adaccounts`), no teclear un id: así no
  se puede vincular una cuenta que el token no ve.
- El resto del ticket (token que no vuelve en ninguna lectura, moneda y zona leídas de Meta, aviso si la zona no es
  Bogotá, 403 forjado) queda igual.
