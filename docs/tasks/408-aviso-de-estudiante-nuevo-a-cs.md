---
id: 408
etapa: hub
serves: "Pedido de Daniel Tovar en Ventas Francisco (9-nov) · ADR 0089 (patrón de Juanito) · ADR 0128 (por escribir)"
depends: [259]
status: todo
---

# 408 — Aviso de estudiante nuevo a Customer Success

## Por qué

CS de cada programa se entera de un estudiante nuevo revisando el CRM a diario (Michael, 9-nov). Daniel pidió que Juanito
les avise por WhatsApp apenas pase, con nombre, celular y correo, para arrancar el onboarding lo antes posible.
Mani lo confirmó: cada vez que un deal entra a **Abonado o Completo por primera vez**.

## Decisiones (Mani, 9-nov)

- **Destino: números individuales**, no un grupo. Los destinatarios son los usuarios `customer_success` con membresía
  ACTIVA del programa del deal. Si no hay ninguno, el aviso queda pendiente y visible (nunca se descarta en silencio).
- **Dónde vive el número:** `users.telefono_whatsapp` (nullable, solo dígitos con indicativo, un CHECK de forma). Es de
  la persona, no del programa. Se edita en Ajustes › Usuarios por quien administra usuarios (ADR 0118), con `change_log`
  por el molde. Un CS sin número no recibe y la pantalla lo dice.

## Alcance

**CRM**
1. **Migración aditiva** (la genera y aplica la sesión principal): `users.telefono_whatsapp`; tabla
   `avisos_estudiante_nuevo` (`deal_id` único, `program_id`, `creado_en`, y por destinatario `user_id`, `enviado_en`
   nulo hasta que Juanito confirme). Unicidad por `deal_id` = "primera vez" lo garantiza un índice (ADR 0005), no el código.
2. **Disparo:** dentro de `moverEtapa()` (único camino de `deals.etapa`), en la MISMA transacción, al entrar a
   Abonado o Completo. Insert idempotente (`ON CONFLICT DO NOTHING`). Un deal que sale y vuelve no repite. Un deal
   anulado (ADR 0038) no avisa; si se anula después, el aviso ya enviado queda como historia.
3. **Entrega:** `POST /api/semaforo/estudiantes-nuevos` con `x-semaforo-secreto` (tiempo constante, 401 sin cuerpo).
   Devuelve los avisos pendientes por destinatario con el texto armado en una función pura
   (`lib/reporte-whatsapp/estudiante-nuevo.ts`). Un segundo `POST .../confirmar` marca `enviado_en` por id. Si Juanito
   cae, el aviso se reintenta; el reintento es idempotente.
4. **Texto:** nombre, celular, correo, programa, producto, etapa (parcial o completo), monto abonado con su moneda y
   enlace al deal. Solo viaja al CS de ese programa (frontera de programa).
5. **Contrato:** este endpoint SÍ lleva datos personales, a diferencia del semáforo. Esquema zod `.strict()` propio,
   lista blanca explícita; `AGENTS.md` nombra la excepción (fila de Contratos y restricción "nada es público") y su guardián.
6. **Docs (N8):** `operations.md` (cómo se configura el número de un CS), `overview.md` §11 si hay término nuevo, ADR 0128.

**Juanito** (`30X/repos/Juanito`, `src/scheduler/`): job que consulta cada minuto, envía a cada número y confirma.
PR, merge y despliegue en el VPS ANTES de empujar el CRM. Mismo `RETIA_SEMAFORO_SECRETO`.

## Fuera

Grupos de WhatsApp, avisos a closers, reintentos con cola externa, plantillas por programa.

## Done cuando

- [ ] Test: primer paso a Abonado crea el aviso; el segundo paso (o abono posterior) no; Completo directo también avisa; anulado no.
- [ ] Test: solo CS con membresía activa del programa del deal reciben; otro programa, inactivo o sin número, no.
- [ ] Test de contrato: la respuesta recorre la lista blanca y falla con una llave fuera de ella; sin secreto, 401.
- [ ] Test: confirmar es idempotente; sin confirmar, el aviso reaparece.
- [ ] Juanito desplegado y verificado con un deal de prueba en base local antes del push.
- [ ] Typecheck, lint, `npm run build` limpios. Tracker de `docs/tasks/README.md` actualizado.
