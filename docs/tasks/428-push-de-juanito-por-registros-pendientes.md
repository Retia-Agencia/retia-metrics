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

- [ ] D-1 y D-4 respondidas; D-2 y D-3 provisionales (14-nov), falta el ok de Mani a la propuesta.
- [ ] El contrato del endpoint con lista blanca y su test (molde `tests/semaforo-endpoint.test.ts`); 401 sin secreto.
- [ ] Un closer solo recibe lo suyo (el dueño sale del criterio de closer del registro); un test forjado con otro closer.
- [ ] Probado de punta a punta con Juanito, y con la regla de no repetir dentro de la ventana de silencio.
- [ ] Regla N8 y N9; tracker y `status:` coinciden.

## Decisiones (14-nov, Mani)
- **D-1: registro pendiente = cualquier cosa que no se haya hecho en los deals que vienen de etapas anteriores**, agrupada por deal y fácil de ver lo que le falta a cada uno (no una lista suelta de citas). Incluye las citas pasadas sin resultado, y lo que ya calcula la bandeja (071) y las alertas (128): siguiente paso, comprobante por confirmar, etc. Un deal por bloque, con lo que le falta.
- **D-2 y D-3 (Mani no lo tiene claro; propuesta provisional, falta su ok):** el aviso va **a cada closer, a su WhatsApp personal, cuando tenga algo pendiente** (si no tiene nada, no recibe nada). Propuesta: una vez al día hábil a una hora fija de Bogotá, y silencio por closer: no repetir el mismo bloque dentro de 24 h. Razón: un grupo expone a cada closer frente a los demás, y un aviso por evento se vuelve ruido.
- **D-4: sí se mide**, citas pasadas sin resultado por semana antes y después (es la casilla abierta del 390; la línea base está en ese ticket).
- Brief para Codex: `docs/agents/briefs-codex-14-nov.md`, B-5. Necesita una migración (tabla de avisos enviados) que genera la sesión principal.
