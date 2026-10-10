---
id: 227
etapa: O8
serves: "A-134, A-135; decisión de Mani del 9-oct"
depends: []
status: done
---

# 227 — Cohorte por definir, y Cambiar cohorte arriba en la ficha

## Por qué existe

Mani (9-oct): el cambio de cohorte tiene que ser **muy evidente**. Hoy el botón vive dentro de Facturación y nadie
lo encuentra. Y para mandar a alguien a Próxima cohorte, la cohorte futura tiene que existir, pero Gerencia muchas
veces todavía no sabe cuándo abren las ventas ni cuándo arrancan las clases: hoy no la puede crear sin inventar fechas.

Son dos cosas distintas y se quedan separadas (Mani, 9-oct):
- **Cambiar cohorte**: mueve el deal **ya** a otra cohorte que vende hoy (o futura/activa si es student). Sube arriba.
- **Próxima cohorte**: el deal **espera** una cohorte futura. Sigue en Anotar.

## Alcance

**Base (lo hace la sesión principal, no el agente):**
- `cohorts.fecha_inicio_clases` y `cohorts.fecha_cierre_ventas` pasan a nullable. `fecha_inicio_ventas` ya lo es.
- CHECK nuevo `cohorts_definida_si_no_es_futura`: `estado = 'futuro' OR (fecha_inicio_clases IS NOT NULL AND
  fecha_cierre_ventas IS NOT NULL)`. Con el CHECK que ya existe (activa con inicio de ventas), una cohorte activa
  tiene las tres fechas. Precio y meta de cupos siguen obligatorios: el primer abono congela el ticket.

**Código:**
- `lib/catalogo/cohortes.ts`: el esquema acepta las dos fechas vacías (`""` → `null`) y el `superRefine` exige
  las tres fechas cuando el estado no es `futuro`, con un 400 claro antes de tocar la base. El 23514 del CHECK
  nuevo se traduce a su propio mensaje.
- `components/cohortes-admin.tsx`: las tres fechas opcionales al crear o editar una futura; la lista muestra
  **"Por definir"** donde falta una fecha.
- Los ~14 lectores de `fechaInicioClases` / `fechaCierreVentas` (`grep` en `lib/`, `app/`, `components/`) manejan
  el `null` sin inventar una fecha. Una cohorte sin fechas **no vende** (`cohortesVendiendo` ya la excluye por
  `isNotNull`; el cierre nulo tampoco debe casar), no entra a días hábiles, meta dinámica ni ventanas, y en
  pantallas se ve "Por definir". `fechaLimiteMaxima` sin inicio de clases no recorta.
- Próxima cohorte hacia una cohorte sin inicio de ventas: el deal **espera** y no se retoma solo hasta que esa fecha
  exista (`queLeFaltaTransicion` de `RET` ya lo trata como faltante; que quede con test). La ficha dice
  "Se retoma cuando se defina el inicio de ventas de <código>".
- **Cambiar cohorte arriba a la derecha**: el botón sale de `ficha-pago.tsx` y va a `ficha-acciones.tsx`, junto a
  Editar, con el mismo `DialogoCohorte` y la misma acción `cambiarCohorteAccion` (la reja de quién puede la sigue
  poniendo `cambiarCohorte` en el servidor; el botón se muestra a quien el servidor acepta). El aviso de
  "hoy venden dos cohortes: confirma en cuál queda" y el "Sin cohorte" de Facturación apuntan al botón de arriba.
- **Próxima cohorte en Anotar** (`dialogo-anotar.tsx`): si `opciones.cohortesDestino` está vacío, la opción sale
  desactivada con el texto *"No hay cohortes futuras. Gerencia la crea en Programa, aunque no tenga fechas."*

## Done cuando

- [ ] Se crea una cohorte futura sin ninguna de las tres fechas; activarla sin ellas da 400 (zod) y, forzado, el
  CHECK la rechaza (test con PGlite, el choque real, no un error fabricado).
- [ ] Una cohorte sin fechas no aparece en `cohortesVendiendo` ni rompe dashboard, metas, cartera ni alertas
  (tests de los lectores tocados).
- [ ] Un deal en Próxima cohorte hacia una cohorte sin inicio de ventas no se retoma con un contacto; al definir
  la fecha y registrar un contacto posterior, sí (test).
- [ ] "Cambiar cohorte" está arriba junto a Editar y ya no en Facturación; Próxima cohorte sale desactivada sin
  futuras. `npm run build` limpio (toca componentes cliente).
- [ ] El manual (`docs/manuales/operacion-comercial.html`, sección Cohortes) dice dónde está el botón y que una
  cohorte puede quedar por definir.
