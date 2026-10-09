---
id: 221
etapa: O8
serves: "A-125; ADR 0082 punto 3"
depends: []
status: done
---

# 221 — Mi espacio en tres pestañas: Info, Notificaciones y Métricas

## Por qué existe

Mani, 9-oct: Mi espacio se reorganiza. Info se queda con el perfil, Métricas con las métricas, y Notificaciones
es el hub nuevo (222).

## Alcance

- `lib/mi-espacio/secciones.ts`: **Info** (todos los roles que tienen Mi espacio: perfil, foto, rol, enlaces de
  captación y la **cuenta de Calendly de cada programa**), **Notificaciones** (reemplaza "Necesita atención",
  `trabajaLeads`) y **Métricas** ("Mis métricas"). El gerente conserva Por decidir y el paid trafficker Canales,
  después de Info.
- **Calendly en Info**: la acción ya existe (`app/(app)/perfil/acciones.ts`, ADR 0074). Comprobar que todo lo que
  el closer hace hoy en Programa → Equipo (elegir su cuenta por programa) se puede hacer desde Info, porque el
  224 le cierra Programa.
- La pestaña por defecto del closer es Notificaciones; `?tab=atencion` viejo redirige a `?tab=notificaciones`.
- En este ticket Notificaciones muestra lo de hoy (el contenido de `tab-atencion.tsx`), el 222 lo rehace.

## Done cuando

- [ ] Closer: Info · Notificaciones · Métricas. Gerente: Info · Por decidir. Paid trafficker: Info · Canales.
      Developer en `todo`: la unión, como hoy.
- [ ] El closer elige su cuenta de Calendly desde Info, por programa (recorrido).
- [ ] `?tab=atencion` lleva a Notificaciones; una `?tab=` forjada cae en la de por defecto.
- [ ] Tests de `secciones.ts` por rol.
