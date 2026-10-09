---
id: 223
etapa: O8
serves: "A-127"
depends: [222]
status: review
---

# 223 — El número sin ver

## Por qué existe

Mani: *"un circulito con un número que muestre que hay cosas nuevas sin ver"*.

## Alcance

- Cuenta, para el closer y el programa elegido: novedades de Calendly no leídas + deals nuevos que el dueño no ha
  abierto + seguimientos y reagendas con fecha de hoy o ya vencidos. Sale de los predicados del 222
  (`lib/mi-espacio/notificaciones.ts`), nunca de una segunda consulta.
- Dónde sale: en la pestaña Notificaciones, en cada chip (su propio número) y en "Mi espacio" del menú lateral
  (`components/app-sidebar.tsx`), para verlo desde cualquier pantalla. El layout no se re-renderiza en navegación
  del cliente: el número se pide aparte y se refresca con `router.refresh()` tras Mover o Anotar.
- Badge del sistema Tinta, tono de acento; con 0 no sale nada; más de 99 dice "99+". Accesible (`aria-label`
  "N notificaciones sin ver").
- Deja de contar: lo leído al abrirlo o marcarlo visto; lo vencido al anotar o mover el deal.

## Done cuando

- [ ] El número del menú, el de la pestaña y la suma de los chips que cuentan coinciden (test).
- [ ] Anotar un seguimiento vencido lo baja en uno sin recargar.
- [ ] Recorrido en escritorio y 390 px (menú abierto).
