---
id: 310
etapa: hub
serves: "Mani, 24-oct (recorrido del Hub): configurar lo que se lee sin tener que buscar dónde · ADR 0077 (cada dato en la pantalla de su objeto)"
depends: []
status: done
---

# 310 — Desde cada meta del Hub, un atajo a donde se configura

## Por qué

Metas del mes (Hub, `components/metas/metas-del-mes.tsx`) muestra la meta del mes, la meta por cohorte y las cohortes
sin ventana de ventas, pero ninguna enlaza a donde se cambian: la meta del mes es un umbral (`meta_mes`,
`lib/catalogo/umbrales.ts`) y las metas de cohorte, los leads por día y la ventana de ventas viven en Programa › Ventas
(`/p/[programa]/programa?seccion=ventas`). Mani: "debería poder presionar alguna parte para ir a configurarlo de una vez
desde allí".

## Alcance

- **Dentro:** un enlace "Configurar" en cada tarjeta de Metas del mes y en las cifras de Hoy que muestran una meta
  (Cupos vendidos), que lleva a Programa › Ventas, a la parte exacta (ancla por umbral o por cohorte), con
  `enlaceConVuelta` para volver al Hub.
- **Dentro:** "Cohortes sin ventana de ventas" enlaza cada cohorte a su edición.
- **Dentro:** el enlace solo se pinta para quien puede editar esa fila (`esAdministrador`; la pregunta ya existe en
  `lib/auth/roles.ts`, no se escribe un rol a mano). En "todos los programas", un enlace por programa.
- **Fuera:** editar dentro del Hub. Un segundo formulario que escriba la misma meta serían dos escritores de la misma
  fila; la edición sigue siendo la de Programa, por el molde del catálogo y con su `change_log`.

## Done cuando

- [ ] Desde cada meta del Hub se llega en un clic al campo que la define, y "Volver" regresa al Hub con el mismo periodo.
- [ ] Un closer y un paid trafficker no ven el enlace.
- [ ] Recorrido con clic en todo lo que se abre, escritorio y 375 px, consola limpia.
