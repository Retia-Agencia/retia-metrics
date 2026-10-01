---
id: 149
etapa: E9
serves: "comercial.md §7.0 QD-7 (Mani, 1-oct)"
depends: [075]
status: todo
---

# 149 — El manual de uso del CRM, por rol, enlazado dentro del CRM

## Objetivo

Que cada usuario sepa usar el CRM sin que nadie del equipo de desarrollo le cargue nada. Mani, 1-oct: la
configuración (programas, precios, cohortes, usuarios) **la hacen los usuarios según su rol**; lo que se
entrega al final es un manual completo, por rol, enlazado desde la app.

## Alcance

- **Dentro:** una sección por rol (closer, gerente, developer y los que existan al cierre de v1: Customer
  Success del 145, Paid Trafficker del 102): qué ve, qué hace en su día y cómo se configura lo que le toca
  (crear un programa con su precio, una cohorte, una fuente, un usuario).
- **Dentro:** publicado como Artifact y enlazado desde la app (menú de usuario o ayuda), visible para todos
  los roles con sesión. No expone cifras del negocio: solo explica la herramienta.
- **Dentro:** los pantallazos salen de la base local (`npm run db:local`), nunca de producción: no llevan
  datos de personas reales.
- **Fuera:** el manual de **gestión comercial** (cómo y cuándo se mueve un deal entre etapas, QD-8): ese lo
  escribe Alejo en NC1 y el 142 se construye encima. Este ticket lo cita, no lo repite.

## Done cuando

- [ ] Cada rol tiene su sección y un recorrido de su día.
- [ ] El enlace dentro del CRM abre el manual desde cualquier rol.
- [ ] Ninguna imagen trae datos de producción.

## Codex

No: es documentación. Lo escribe la sesión principal al cierre de v1, después del 075.
