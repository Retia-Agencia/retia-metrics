---
type: note
owner: "[[retia-ops]]"
updated: 2026-09-21
tags: [reunion, alejo, areas, utm, crm, stakeholders, media, pauta]
granola: 565ead50-5e66-4da8-b3d0-5ace54b4df05
---

> Copia cruda del second brain de Mani (`mani_vault/02 Projects/retia-ops/notebook/reunion-alejo-2026-09-21.md`),
> sin editar. Los `[[wikilinks]]` no resuelven aquí. Es la nota **reconciliada** de Mani (TL;DR,
> decisiones A-F, implicaciones); la captura cruda de Granola de la misma reunión ya vivía en el
> repo, en `docs/insumos/fleeting/2026-09-21-reunion-alejo-areas-y-utms.md` — esta es un nivel más
> procesada, no un duplicado.

# Reunión con Alejo Carvajal — 2026-09-21

**Primera reunión de stakeholder de la fase 1 del rol.** El objetivo declarado era saber con quién
hay que hablar. Salió eso y salió algo más grande: **la unidad con la que Retia se mira a sí misma
es el área, y el CRM no sabe qué es un área.**

⚠️ **No hay transcript.** El plan de Granola es gratuito y no los sirve. Lo que quedó son las
**notas privadas de Mani** (que además se cortan a mitad de frase) y el **resumen automático**. Eso
importa para leer esta nota: *lo que no está anotado no se sabe si se preguntó*.

---

## TL;DR

1. **Cuatro áreas:** Gerencial, Comercial, Pauta (Paid Traffickers), Media (Redes Sociales).
2. **Orden de reuniones dado por él: Comercial → Pauta → Media.** Él mete a Mani a los grupos de
   WhatsApp de cada una y da el contexto del rol.
3. **Cada área mide una cosa distinta**, y las tres operativas cuelgan del mismo dato: **el UTM**.
4. **El dolor de gerencia es "cantidad de leads por área"**, y para eso *"toca definir qué UTMs
   pertenecen a cada área"*. Ese mapeo hoy no existe en ningún lado.
5. 🩸 **Ese número, hecho con lo que hay hoy, mostraría Comercial en cero.** Un lead que trae un
   closer no deja rastro en ningún UTM. La pantalla no fallaría: mentiría.
6. **Pedido explícitamente NO prioritario:** un dashboard de videos editados/publicados por
   creador. *Primero ventas.*
7. **El enfoque del rol quedó dicho en una frase:** ayudar a los closers a no perder leads y a
   Retia a generar más ventas.

---

## Qué mide cada área

| Área | Quiénes | Qué mide | ¿El CRM ya lo contesta? |
|---|---|---|---|
| **Comercial** | los closers | close rate, show rate, estado del lead por etapa, transcripts de llamadas | Sí, salvo los transcripts |
| **Pauta** | paid traffickers (equipo externo) | todo por UTM: qué anuncios venden, por fecha y canal, inversión por pauta | Sí, tickets 066 y 067 |
| **Media** | [[Majo Duarte]], Alejo, Dani | **registros vs agendas por canal** (TikTok, IG, YouTube) | El modelo sí; **la vista no existe** |
| **Gerencial** | [[Daniel Tovar]], Alejo, Dani | rendimiento de áreas, % de cierre por closer, **leads por área** | ❌ el área no existe en el sistema |

**Registro ≠ agenda, y la distinción es de Media:** registro = todo el que llenó el Typeform;
agenda = lead calificado que quedó agendado. El ejemplo que puso Alejo es el que hay que poder
pintar: **TikTok trae muchos registros y pocas agendas.** O sea que el canal no se juzga por
volumen sino por **tasa de calificación**, que es un número que hoy nadie calcula.

Eso empata con [[glosario-metricas]] sin contradecirlo: es la misma lógica de *"el CPI nunca se lee
solo"*, un escalón más arriba en el embudo.

---

## Lo que cambia para el rol

**1. El área es una dimensión nueva y no estaba en el mapa.** [[mapa-retia]] tiene una tabla de
"quién opera qué" por **componente**; Alejo dio la versión que usa la empresa, que es por **área**,
y las dos no son iguales. Hay que reconciliarlas, no sustituir una por la otra: el componente es
cómo corre la data, el área es a quién se le atribuye.

**2. La prioridad #1 del rol —la atribución— acaba de ganar un segundo cliente.** Hasta hoy
[[atribucion-de-ventas]] existía porque [[Daniel Tovar]] no sabe si pierde plata con la pauta. Ahora
también existe porque Gerencial quiere saber qué área trae pipeline. **Es el mismo trabajo con dos
dueños**, y eso sube su prioridad sin agregar alcance.

**3. Se confirma la extensión que Mani ya había escrito solo.** [[mi-enfoque-del-rol]] dice desde el
19-sep: *"UTMs de todo, no solo de campañas — hoy un lead que trae un closer es invisible"*. Esta
reunión es **la primera evidencia externa** de que hace falta, y le pone fecha: si no entra antes
de que se escriba la ingesta nueva del CRM, después no se puede reconstruir, porque el dato nunca
se escribió en ninguna parte.

**4. El orden Comercial → Pauta → Media es también el orden de construir.** No hay que reordenar
nada: coincide con las etapas del plan del CRM. Lo único que falta es la vista de Media, que no
tiene ticket.

---

## Lo que se decidió el mismo día

Las tres decisiones abiertas se cerraron esa tarde, y tres preguntas más de Mani afinaron el diseño.

| # | Decisión | Forma |
|---|---|---|
| A | **El área entra al CRM** y agrupa leads **y** deals según origen | Catálogo, y el área **se deriva** del origen: no se guarda |
| B | **El origen acepta que un lead llegue por humano** | Un **enlace de captación** por closer y programa; el closer **nunca teclea un UTM** |
| C | **A los closers se les enseña el CRM completo**, de punta a punta | Sobre el **modelo**, no sobre la app: la UI que corre es la del MVP, que es el modelo que se reemplaza |
| D | **El programa es frontera, no filtro** | Se midió la alternativa: solo **5 correos de 4.818** están en los dos programas. No se normaliza |
| E | **El significado de cada campo UTM se estandariza** | Igual para todos los programas. Es una acción de **Ops en Meta**, no del CRM |
| F | **La campaña es una entidad** dueña de sus patrones UTM | El gasto cuelga de ella; es lo que permite cortar costo y leads con la misma llave |

Quedaron **tres ADR** (0043, 0044, 0045), **nueve tickets** (083 a 091) y una etapa nueva, **E1b**.
Dos decisiones de Mani corrigieron lo que se había propuesto: el lead traído **no se auto-asigna**, y
el significado del UTM **se estandariza en vez de tratarse como dato de cada campaña** — *"eso rompe
la estandarización que queremos hacer"*.

🩸 **El hallazgo que salió de la pregunta E:** `utm_content` significa **anuncio** en ComunicArte y
**conjunto** en Tactical. Medido contra los consolidados C2. El estándar quedó en [[estandares]] y
[[glosario-metricas]]; ver [[2026-09-21-el-estandar-de-utm-y-la-campana-como-entidad]] y
[[2026-09-21-el-area-agrupa-y-el-programa-es-frontera]].

## Implicaciones sobre el CRM

Viven en el repo, no acá, para que el que tome el ticket las lea:

> `retia-metrics/docs/plan-crm-v2.md` **§12 — Enmienda del 21-sep: la reunión con Alejo**
> Insumo crudo: `docs/insumos/fleeting/2026-09-21-reunion-alejo-areas-y-utms.md`

Resumen: **la mitad de lo que pidió ya estaba construido o planeado**, y lo demás quedó escrito
como tres ADR y nueve tickets. ⚠️ **Sigue en pie que hoy no hay prototipo del modelo nuevo** —la UI
que corre es la del MVP— así que la reunión con Comercial se hace **sobre el modelo, no sobre la
app**.

---

## Lo que NO entra

- **Dashboard de videos por creador.** Él mismo lo marcó como no prioritario. Y no es de
  retia-metrics: pertenece a [[herramienta-de-contenido-retia]]. Meter contenido en el CRM comercial
  rompería la frontera de dominio del repo.
- **Análisis de transcripts de llamadas.** El link de Grain sí vive en el CRM (es lo que marca que
  la llamada sucedió). Analizarlos es **sales enablement**, el sombrero que el
  [[consolidado-rol-devops-2026-09-21]] ya advirtió que *"se come la semana sin pedir permiso"*.

---

## Acciones

| Quién | Qué | Estado |
|---|---|---|
| [[Alejo Carvajal]] | Agregar a Mani a los grupos de WhatsApp de las 4 áreas y dar contexto | pendiente de él |
| Mani | Reunión con **Comercial** (closers) — decidir antes qué se les enseña | siguiente |
| Mani | Reunión con **Pauta**, luego **Media** | después |
| Mani | Decidir A/B/C del plan del CRM | ✅ hecho el 21-sep, más D, E y F |
| Mani | Pedirle a Alejo los **success floors** y el mapeo **UTM → área** | 🔴 |
| Mani | Llevar el **estándar de UTM** a la reunión con **Pauta**: hay que reconfigurar Meta y el CRM no puede hacerlo | 🔴 |

---

## Related
[[retia-ops]] · [[Alejo Carvajal]] · [[consolidado-rol-devops-2026-09-21]] · [[mi-enfoque-del-rol]] ·
[[mapa-retia]] · [[preguntas-abiertas]] · [[atribucion-de-ventas]] · [[glosario-metricas]] ·
[[estandares]] · [[retia]] · [[crm-retia-modelo-hubspot-scaffold]] · [[herramienta-de-contenido-retia]]
