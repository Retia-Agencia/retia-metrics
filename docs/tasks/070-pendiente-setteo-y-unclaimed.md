---
id: 070
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-2 · insumo §6, ADR 0021 (enmendado por el 0037)"
depends: [069]
status: done
---

# 070 — Pendiente Setteo para reclamar, y Unclaimed

## Objetivo

Las dos listas por las que un deal consigue dueno. **El reclamo reemplaza a la rotacion ciega del
script.**

- **Pendiente Setteo**: tabla de deals sin owner en etapa 1, donde el closer **reclama**.
- **Unclaimed**: los **Agendados sin owner**, que es el caso urgente (ya hay una llamada agendada
  y nadie la esta mirando).

## Alcance

- **Dentro:** las dos listas, el boton de reclamar y la reasignacion por un gerente.
- **Dentro:** al reclamar un Agendado, el closer **completa la Call**: link de Calendly y fecha
  (ticket 057).
- **Dentro:** ordenar por **antiguedad**: en Unclaimed, lo viejo es lo que duele.
- **Dentro:** el rastro de quien reclamo y cuando (ADR 0042).
- **Fuera:** reparto automatico. **No existe** y no se echa de menos: "sin owner" es un estado
  valido (ADR 0021).

## La reja, en el servidor

Reclamar y reasignar son **permisos**, y esconder el boton no es seguridad. Reasignar es de quien
administra; reclamar, de quien `trabajaLeads` (**closer y developer, no el gerente**, ADR 0003 y
0025). ⚠️ **Nada de `rol === "closer"` escrito a mano**: eso es justo lo que dejo al developer
afuera el 18-sep.

## Done cuando

- [ ] Un closer reclama y queda como owner, con rastro.
- [ ] Un gerente reasigna; un closer no puede reasignar el deal de otro.
- [ ] **La regla se probo forjando la peticion**, no mirando que el boton no aparezca: se captura
      el `Next-Action` desde la vista que si puede y se invoca desde la que no. Se espera 403 y
      **la base sin moverse**.
- [ ] Un `id` de owner metido en el cuerpo se ignora: el objetivo sale de la sesion.

## Kiro

Si, con revision visual y de permisos.

---

## ⚠️ Ampliacion 2026-09-21 (ADR 0044 punto 5): el ORIGEN va a la vista

Mani decidio que **un lead traido por un closer NO se auto-asigna**: *"los closers definen eso;
supongo que deben revisar bien el UTM."*

🎯 **La segunda mitad de esa frase es un requisito de esta pantalla, no una suposicion.** Si el closer
tiene que revisar el UTM para decidir si reclama un lead, **el origen tiene que estar a la vista aca**:

- el **area** a la que resuelve el envio (via el emparejador, ticket 085),
- los **UTM** tal como llegaron,
- **quien lo trajo**, si `traido_por_user_id` esta poblado (ticket 086).

**Sin esto, la regla del ADR 0044 punto 5 es imposible de cumplir** y el closer reclama a ciegas.
Un envio que cae en `(sin clasificar)` se muestra asi, no en blanco.

---

## Enmienda 2026-09-24 (ADR 0050): Pendiente Setteo y Unclaimed son secciones del Inbox

Este ticket deja de ser una pantalla propia: sus dos listas son las secciones "sin dueño" del Inbox
(ticket 071). Con Calendly (ADR 0049), un Agendado cuyo host es un closer registrado **ya nace con
dueño**; Unclaimed queda para los Agendados cuyo host no está registrado. Todo lo demás de este ticket
(la reja del reclamo, el origen a la vista) sigue igual.

## ✅ Decisión 2026-09-24/29 (Mani): el Setteo viene ordenado por el score del formulario

- **Reparto:** el primero que ve el lead lo toma. El turno fijo de la hoja está desactualizado y se
  retira. Reclamar desde el Inbox es exactamente lo que hacen hoy.
- **Prioridad:** el formulario calcula el score con su propia lógica por programa; el CRM no interpreta
  ingreso, moneda, periodo ni bandas, y no agrega lógica de cálculo que tendría que variar por programa.
- **Contrato:** el formulario manda `score`; el adaptador de Alejo lo lee mediante la llave `puntaje`
  del mapeo de la fuente y el CRM lo copia a `submissions.puntaje` y `leads.puntaje`. El Setteo
  ordena score descendente, luego envío más reciente; sin score va al final por recencia.
- **Pendiente operativo:** configurar la variable de score en ambos Typeform. Sin ella, el Setteo
  funciona por recencia y marca esos leads como "sin score".

## ✅ Implementación 2026-09-29 (Mani)

El CRM ya recibe y persiste, sin recalcular, los valores configurables `leadQuality` y `leadValue`
que llegan como variables de Typeform. Se promueven a `submissions` y `leads` (migración 0041), se
muestran como tags en las tarjetas de Deals y se pueden filtrar con opciones derivadas de los valores
existentes por programa. No hay enums ni valores hardcodeados: una etiqueta nueva aparece
automáticamente. La configuración de las dos fuentes Typeform y el recorrido visual exacto a 390 px
siguen siendo pendientes operativos.


---

## Enmienda 2026-09-28 (plan de reparto §3, ok de Mani)

Se quita el 085: el closer ve el origen con los UTM tal como llegaron (ADR 0044); la etiqueta de área se enciende sola cuando exista el 085.

---

## ✅ Decisión 2026-09-29 (Mani): el orden del Setteo lo da un SCORE que calcula el formulario

*"Sería más fácil solo leer el campo de score; falta es configurarlo bien en los forms."* Es la misma
regla de A8 (28-sep, *"el CRM no calcula NADA"*): el Estado ya llega calculado, y el puntaje también.

- **Typeform calcula el score** con su variable de puntaje (lógica por respuesta: el ingreso y lo que
  quieran sumar), y la manda en el payload como variable, igual que `estado`. Cada programa pone sus
  propios pesos en SU formulario: el CRM no tiene que acomodar escalas distintas entre programas.
- **El CRM solo lo lee:** una llave del mapeo de la fuente nombra la variable (molde de `estadoHoja`,
  ADR 0012; nunca un nombre fijo en el código) y el valor entra a `submissions.puntaje` y al resumen
  `leads.puntaje`, que ya existen y hoy van nulos (T4). Un valor que no es número entra nulo, no se
  adivina.
- **Orden de la sección:** score de mayor a menor; a igual score, el envío más reciente primero. **Sin
  score** (los trasladados de Sheets y todo lo que llegue antes de configurar el formulario) va DESPUÉS,
  por recencia, marcado "sin score": no se le inventa uno.
- 🩸 Medido el 29-sep (solo lectura): ComunicArte tiene dos escalas de ingreso en su historia (641
  respuestas con la de Tactical). Con el score del formulario eso deja de ser problema del CRM: lo viejo
  no trae score y se ordena por recencia.
- **Pendiente (Mani):** configurar la variable de score en los dos Typeform. Sin eso el Setteo funciona
  igual, ordenado solo por recencia.
- Descartado: bandas de ingreso configuradas en el CRM (`programs.bandas_ingreso`). Era el CRM
  calificando, contra A8.
