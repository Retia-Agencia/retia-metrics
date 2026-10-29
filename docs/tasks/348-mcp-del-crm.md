---
id: 348
etapa: media
serves: "Daily del 28-oct (F5): darle vida al CRM, paso 1 · docs/media/mapa-mece.md §5 y §6"
depends: []
status: por-grill
---

# 348 — El MCP del CRM

**Por grill, sin alcance cerrado.** Acordado el 28-oct con Michael (F5): el orden para darle vida al CRM es **MCP,
después Juanito ampliado (340 a 346), después IA interna**. La IA dentro del CRM sale cara (API contra suscripción);
con un MCP cada persona consulta el CRM desde su propio Claude ("¿cuántas ventas tuvo Fulano de tal programa?").

## Lo que el grill tiene que decidir

- **Quién entra y como quién:** cada persona como ella misma, con su rol y el alcance de programas de la app
  (`lib/auth/alcance.ts`). Nunca un token compartido ni un rol propio del MCP.
- **Qué expone:** solo lectura al comienzo. Reusa las consultas de `lib/queries/` (contrato C-2), no SQL aparte; un
  closer no ve lo que la app no le muestra.
- **Privacidad:** qué datos de leads salen por esta puerta (ninguno personal más allá de lo que el rol ya ve en la app).
- **La puerta nueva:** "nada de la app es público" no la cubre. Pide ADR y excepción nombrada en `AGENTS.md`, como las
  del semáforo (ADR 0089) y los avisos (ADR 0114).
- **Autenticación y revocación:** cómo se emite, cuánto dura y cómo se quita a alguien (molde de `revalidarToken`).
- **Rastro:** si cada consulta deja registro.

## Done cuando

El grill produjo el ADR y este ticket se reescribió con alcance y "Done cuando" reales.
