---
id: 099
etapa: E6
serves: "ADR 0050 · ADR 0037 (Student es vista) · propuesta 24-sep §3.2b"
depends: [060, 061, 097]
status: todo
---

# 099 — La tab Students: la lista de estudiantes por cohorte

## Objetivo

Reemplazar las pestañas `Estudiantes <cohorte>` de las hojas. **La cohorte es por programa y define la
lista de estudiantes**: un estudiante confirmado pertenece a una cohorte de un programa (Mani, 24-sep).

## Alcance

- **Dentro:** deals en Abonado o Completo, filtrados por cohorte (por defecto la activa), con saldo,
  cuotas pactadas, cartera vencida y `onboarded_at`.
- **Dentro:** el cambio de cohorte de un estudiante, con quién y por qué (el caso de los 12 de
  ComunicArte que pasaron de agosto a septiembre).
- **Por confirmar en la reunión:** si "estudiante confirmado" empieza en el primer abono o con el pago
  completo (hoy cuentan los dos); y si Students lleva un checklist de onboarding (accesos, factura,
  bonos) o se queda en `onboarded_at`.
- **Fuera:** la factura electrónica, los accesos y los bonos, salvo que la reunión los meta.

## Done cuando

- [ ] La lista por cohorte cuadra con los deals en Abonado o Completo de esa cohorte.
- [ ] Una cuota vencida se ve con su número y su fecha.
- [ ] Recorrido visual con la consola abierta.

## Kiro

Sí, con revisión visual.
