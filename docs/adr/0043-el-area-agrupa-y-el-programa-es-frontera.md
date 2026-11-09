# 0043 — El Área agrupa leads y deals por origen; el Programa es una frontera, no un filtro, y la garantiza la base

- **Enmendado por el ADR 0125 (9-nov):** la frontera deja de vivir solo en el tipo de la consulta y en el código: las FK compuestas `(id, program_id)` impiden en la base un hijo de otro programa, y `programs` ya no borra en cascada hacia leads, deals, llamadas, abonos, cohortes ni fuentes.

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (consolida la enmienda del ADR 0048) · **Estado:**
aceptado

Retia se organiza en cuatro áreas: **Gerencial, Comercial, Pauta** (paid traffickers) y **Media**
(redes). El dolor que declaró Gerencia (Alejo, 21-sep) es *"rendimiento de las áreas · cantidad de
leads por área"*, y el sistema no conocía las áreas.

## Decidimos

**1. El Área es catálogo** (molde del ADR 0012) y agrupa leads y deals según su origen. No es enum
porque el código no decide según cuál área sea: solo agrupa.

**2. Área NO es rol.** El rol dice qué puede hacer una sesión (`lib/auth/roles.ts`); el área dice a
quién se le atribuye un lead. Fundirlas daría "el gerente no vende, entonces no es de nadie" y dejaría
al developer sin área.

**3. El área de un lead no se guarda: se deriva** del Canal de su envío (ADR 0051). Guardarla sería
una segunda copia de lo que el canal ya dice (ADR 0024).

**4. 🔒 El programa es una frontera, no un filtro.** Mani, 21-sep: *"los leads de un programa NO se
cruzan con los de otro; el programa es parte de la PK de Leads. De nada sirve combinar métricas de
programas."* Ya lo hacen cumplir los índices de la base: `leads_programa_email_idx`,
`lead_contactos_valor_idx`, `deals_uno_abierto_por_lead_y_programa_idx`, `calls_huella_idx`,
`ad_spend_huella_idx`, `productos_programa_nombre_idx`, `cohorts_programa_codigo_idx`. Al construir no
basta con no ofrecer el cruce en la pantalla: **el tipo de la consulta no debe admitirlo.**

**La única excepción es la del ADR 0048:** la vista "todos los programas" del Dashboard suma
magnitudes sumables en la misma unidad (conteos, caja en USD, gasto). Tasas, metas, CPL, ROAS y
comisión van siempre por programa.

**5. La llave del Lead no se normaliza a una "persona" global. Se midió antes de descartarlo:** el
21-sep, de 4.823 leads solo 5 correos estaban en los dos programas (7-nov, auditoría 385 F2-07: hoy son 49, y la decisión se sostiene: son dos leads, y el único cruce es el aviso `otrosProgramasDelCorreo`). Y aunque fueran más, una persona
global reabre la identidad a escala de empresa (un merge equivocado dañaría los dos programas) y
construye justo la columna por la que un `join` cruzaría la frontera.

**6. La visibilidad cruzada es una proyección, no una tabla:** `otrosProgramasDelCorreo` (ticket 091)
muestra en la ficha del Lead, como aviso, que ese correo también está en otro programa. Ninguna
métrica la usa.
