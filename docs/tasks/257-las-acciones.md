---
id: 257
etapa: hub
serves: "ADR 0090 puntos 1 a 3 · docs/hub.md H-7 · la sección \"Planes de acción\" del reporte diario"
depends: [252]
status: todo
---

# 257 — Las acciones: los planes de acción viven en el CRM

## Objetivo

Que quien entra al Hub pueda registrar qué se decidió hacer, con dueño, estado y la cifra que lo justifica, y que Hoy
muestre las acciones abiertas como lo hacía el reporte diario.

## Alcance

- **Dentro:** migración (sesión principal): `acciones` (programa, qué, dueño, estado: abierta, en curso, hecha o
  descartada; fecha límite opcional; la cifra que la justifica como texto y su enlace al Hub; origen: manual o
  semáforo, con la referencia del rojo; notas de evidencia; quién y cuándo). Crear y editar deja rastro en
  `change_log` (ADR 0042: el molde de `lib/crm/rastro.ts` crece a esta tabla).
- **Dentro:** la pregunta de permiso en `lib/auth/roles.ts`: la cumplen quienes entran al Hub del programa (gerente,
  developer y paid trafficker; ADR 0090 punto 2). Ningún `rol === "..."`.
- **Dentro:** en Hoy, "Planes de acción": las abiertas y en curso, con dueño, estado, días desde que se crearon y su
  cifra; crear, cambiar estado y anotar evidencia desde ahí. Las hechas y descartadas del periodo, plegadas.
- **Dentro:** "Crear una acción" desde cualquier cifra del Hub, que llena el enlace solo.
- **Fuera:** el lazo con el semáforo (261) y responder desde WhatsApp (radar).

## Done cuando

- [ ] Una acción se crea, cambia de estado y queda en `change_log`, con test.
- [ ] Un closer que forja la acción de crear recibe 403 y la base no se mueve; una acción de otro programa no se ve
  (frontera, con test).
- [ ] Recorrido en escritorio y 375 px con clic en todo lo que se abre.
