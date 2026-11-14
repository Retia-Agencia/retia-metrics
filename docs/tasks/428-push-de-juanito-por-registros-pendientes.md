---
id: 428
etapa: operacion
serves: "Mani, 13-nov (carril H de `docs/plan-reparto.md` §4): que Juanito avise a cada closer qué registros tiene pendientes · 071 · 128 · 390"
depends: [390]
status: todo
---

# 428 — Juanito avisa por WhatsApp los registros pendientes de cada closer

## Por qué

La vista de lo pendiente ya existe: la bandeja del closer (071), las alertas del deal (128) y, desde el 390, el recordatorio de citas
pasadas sin resultado con su conteo por closer. Falta el empuje: hoy el closer solo lo ve si abre el CRM, y la cobertura de resultados
solo sube si alguien se acuerda de marcar.

## Alcance (a confirmar antes de construir)

Un envío por closer, con lo que **ya calcula** la bandeja (`lib/queries/inbox.ts`, `porMarcarPorCloser` de
`lib/deals/resultados-de-llamada.ts`), entregado por Juanito con el mismo molde de las alertas técnicas (425/426: secreto en cabecera,
contrato `.strict()` en `lib/<dominio>/contrato.ts`, texto armado en el CRM y mandado tal cual, sin datos personales de leads si no hacen
falta). Cero cálculo nuevo; un concepto, un módulo (N1).

## Decisiones abiertas (no se asumen)

- **D-1.** ¿Qué cuenta como "registro pendiente" en el mensaje: solo citas pasadas sin resultado, o también deals sin siguiente paso y
  comprobantes por confirmar? (La cita suelta, decisión ya tomada en el 390.)
- **D-2.** ¿Cuándo y cuántas veces al día? ¿Silencio por closer (molde del silencio global del 426)?
- **D-3.** ¿Llega al WhatsApp personal del closer o a un grupo? Hoy el CRM guarda el WhatsApp del usuario (`agregarWhatsappDeUsuarioAccion`).
- **D-4.** ¿Se mide el efecto? Propuesta: citas pasadas sin resultado por semana antes y después, que es también la casilla abierta del 390.

## Done cuando

- [x] D-1 a D-4 respondidas (14-nov). Falta el ok de Mani al formato y a la lista de alertas de abajo.
- [ ] El contrato del endpoint con lista blanca y su test (molde `tests/semaforo-endpoint.test.ts`); 401 sin secreto.
- [ ] Un closer solo recibe lo suyo (el dueño sale del criterio de closer del registro); un test forjado con otro closer.
- [ ] Probado de punta a punta con Juanito, y con la regla de no repetir dentro de la ventana de silencio.
- [ ] Regla N8 y N9; tracker y `status:` coinciden.

## Decisiones (14-nov, Mani)
- **D-1: registro pendiente = cualquier cosa que no se haya hecho en los deals que vienen de etapas anteriores**, agrupada por deal y fácil de ver lo que le falta a cada uno (no una lista suelta de citas). Incluye las citas pasadas sin resultado, y lo que ya calcula la bandeja (071) y las alertas (128): siguiente paso, comprobante por confirmar, etc. Un deal por bloque, con lo que le falta.
- **D-2 y D-3 (Mani no lo tiene claro; propuesta provisional, falta su ok):** el aviso va **a cada closer, a su WhatsApp personal, cuando tenga algo pendiente** (si no tiene nada, no recibe nada). Propuesta: una vez al día hábil a una hora fija de Bogotá, y silencio por closer: no repetir el mismo bloque dentro de 24 h. Razón: un grupo expone a cada closer frente a los demás, y un aviso por evento se vuelve ruido.
- **D-4: sí se mide**, citas pasadas sin resultado por semana antes y después (es la casilla abierta del 390; la línea base está en ese ticket).
- Brief para Codex: `docs/agents/briefs-codex-14-nov.md`, B-5. Necesita una migración (tabla de avisos enviados) que genera la sesión principal.

## Especificación propuesta (14-nov; D-2 y D-3 con el ok de Mani, formato y alertas por confirmar)
**Cuándo:** dos avisos por día hábil a cada closer, a su WhatsApp personal, **solo si tiene algo**: **8:00 a.m.** (todo lo acumulado, agrupado por deal) y **6:00 p.m.** (solo lo de hoy: citas de hoy sin resultado y llamadas de hoy sin Grain, para marcarlas el mismo día). Fines de semana, nada (solo hábiles, regla de Retia). Silencio por closer: el mismo bloque no se manda dos veces en la misma ventana.
**Qué alertas entran** (cada una ya la calcula la bandeja, `lib/queries/inbox.ts`; cero cálculo nuevo), **agrupadas por deal, con lo que le falta a cada uno**:
1. Cita pasada sin resultado (solo de los últimos 7 días; ver el hallazgo).
2. Llamada hecha sin link de Grain.
3. Re-agenda pendiente (la llamada no se hizo y hay que volver a agendar).
4. Seguimiento, compromiso de pago o cartera con la fecha vencida.
5. Comprobante de abono por confirmar.
6. Deal asignado todavía sin abrir.
**Qué NO entra:** "Hoy" (es agenda, no pendiente), seguimientos que aún no vencen, cambios de Calendly, duplicados y próxima cohorte (informativos o con su propia pantalla).
**Formato (nombre completo del lead, solo al dueño; sin correo ni teléfono):**
```
Andrea, te faltan 6 registros en 4 deals:

1) Camilo Moreno · Tactical · Agendado
   • Cita del lun 10-nov sin resultado (hace 4 días)
   • Llamada hecha sin link de Grain
2) Silvia Velázquez · Comunicarte · Seguimiento
   • Seguimiento vencido desde el 12-nov
3) …
(y 2 deals más en el CRM)

Además: 380 citas de hace más de 7 días siguen sin resultado.
Márcalas aquí: <enlace a Mi espacio con el filtro Sin resultado>
```
El de las 6:00 p.m.: "Andrea, hoy tuviste 6 citas y 4 siguen sin resultado: Camilo Moreno (10:00), … Márcalas aquí: <enlace>". Tope de 8 deals por mensaje, más urgente primero (la fecha más vieja), y "lleva N días" cuando pasa de 3.
**Hallazgos de producción (14-nov) que condicionan esto:**
- **Hay un atraso enorme:** Andrea tiene 416 deals con una cita pasada sin resultado y Maru 330 (en los últimos 3 días, 27 y 22). Un aviso que los liste todos no sirve: por eso solo se listan los de 7 días y el resto es **una línea con el conteo**. Limpiar ese atraso (marcarlo en bloque o declararlo cerrado) es una decisión aparte de Mani.
- **Ninguno de los 15 usuarios activos tiene WhatsApp cargado** (`usuarios_whatsapp`): antes de probar con Juanito hay que cargar el número de cada closer (`agregarWhatsappDeUsuarioAccion`).
