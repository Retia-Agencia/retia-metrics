---
id: 100
etapa: E6
serves: "ADR 0050 · ADR 0051 (destinos) · propuesta 24-sep §3.5"
depends: [097, 101]
status: done
---

# 100 — La tab Programs: la ficha del programa

## Objetivo

Un lugar donde ver todo lo que define un programa, sin entrar a Ajustes: cohortes, destinos
(formulario y checkouts), Calendly, fuente de leads, tasa de comisión y el equipo con sus membresías.

## Alcance

- **Dentro:** la ficha; el gerente edita, el closer lee los suyos (ADR 0048).
- **Dentro:** los **destinos** del programa (URL del formulario y URL de checkout), que alimentan el
  builder (ADR 0051).
- **Dentro:** la tasa de comisión del programa (hoy no existe como columna: 80/697 y 100/1.500).
- **Fuera:** lo que ya vive en `/ajustes/programas` se reutiliza; no se duplica la edición.

## Done cuando

- [x] Un closer ve la ficha de sus programas y no la de otros.
- [~] Un programa sin URL de formulario lo dice (hecho), y el builder no genera links rotos (queda en el 092, ver cierre).

## Kiro

Sí, con revisión visual.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- La ficha del programa es un buen lugar para configurar sus estados de llegada (117), sus objetivos por cohorte (122), sus cuentas publicitarias de Meta (119) y sus `valores_calificados` (123).

---

## Anotaciones de UI (30-sep, Mani)

Este ticket recoge de [`docs/anotaciones.md`](../anotaciones.md): A-10 (las cohortes se encuentran desde el programa, no dos niveles adentro de Ajustes). El texto vive allá.

---

## Cierre 2026-10-02 (rama `ticket-100`, sin migración)

**Estado: `review`** — código y tests listos; falta el recorrido visual (sesión principal) para pasar a `done`.

**Qué se construyó**

- La tab **Programa** (`/p/[programa]/programa`, `app/(app)/p/[programa]/programa/page.tsx`), en
  `lib/nav.ts` (`TABS_DE_PROGRAMA` y la nav, icono `Layers`): cambiar de programa desde la ficha se queda
  en la ficha. La etiqueta es "Programa" (singular: es la ficha del programa elegido, no una lista).
- La ficha: KPI (ticket de referencia, comisión %, cohorte activa, días hábiles para estancado), Destinos
  (URL del formulario y checkouts = links de pago vigentes de `/recursos`), Calendly (token y webhook como
  sí/no, nunca el valor), Cohortes, Fuentes de leads (activa/inactiva/rota) y Equipo (membresías activas
  con su cuenta de Calendly del programa).
- Lectura en `lib/queries/ficha-programa.ts` (`fichaDelPrograma`), que compone los módulos dueños de cada
  pregunta: `programaPorId` (nuevo en `lib/catalogo/programas.ts`, pasa por el mismo `sinToken`),
  `listarCohortes`, `listarFuentes` (sin secreto), `enlacesDePagoVigentes` y `membresiasConCalendly`
  (ahora acepta `programId` opcional; su único otro lector, `/ajustes/usuarios`, no cambia).
- **Alcance (ADR 0048):** `programaVisiblePorSlug`; un programa ajeno es 404. **Edición:** quien administra
  (`esAdministrador`) edita las cohortes ahí mismo con el **mismo** `CohortesAdmin` y las mismas acciones
  de Ajustes (A-10); para lo demás (programa, fuentes, equipo) hay enlaces a Ajustes. No se duplicó
  ninguna edición ni se agregó ninguna acción. El closer lee.
- `aCohorteVista` (mapeo de cohorte a la vista) se movió a `lib/queries/ficha-programa.ts` y lo usa también
  `/ajustes/programas/[slug]`.

**"Un programa sin URL de formulario lo dice":** sí, en Destinos (`avisoDelFormulario`). **"El builder no
genera links rotos":** no aplica aquí. El builder no existe todavía (092), y el ADR 0068 movió el destino
a la fuente principal (`sources.url_publica`, con migración): esa mitad queda en el 092 como "sin principal
no genera links". Cuando el 092 cierre, la ficha debería leer el destino de la fuente principal en vez de
`programs.form_url`.

**Tests:** `tests/ficha-programa.test.ts` (12): la ficha solo trae lo del programa y ningún secreto (token,
clave de firma, secreto HMAC); closer sin membresía → 404; closer con membresía lee sin editor ni enlaces a
Ajustes; gerente y developer ven el editor; **forjado** de `crearCohorteAccion` y `editarProgramaAccion`
desde un closer con membresía → rechazado, la base y `change_log` sin moverse; la tab en la nav.

**Pendiente / fuera:** estados de llegada (117), objetivos (122), cuentas de Meta (119) y
`valores_calificados` (123) de la enmienda del 29-sep se agregan a la ficha cuando existan sus tickets.

**Recorrido visual (2-oct, sesión principal, base local):** como closer, la ficha es de solo lectura (sin botones
ni enlaces a Ajustes; tokens fuera); como developer, "Nueva cohorte" y "Editar" abren en línea con los datos de C1, y
"Administrar" lleva a Fuentes y Usuarios. Consola sin errores. Probado en escritorio; 390 px no se pidió.
