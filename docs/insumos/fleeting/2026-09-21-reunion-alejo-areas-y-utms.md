---
type: fleeting
date: 2026-09-21
source: reunion con Alejo Carvajal (Granola 565ead50-5e66-4da8-b3d0-5ace54b4df05)
status: procesado · implicaciones reconciliadas en docs/plan-crm-v2.md §12
context: primer stakeholder de la fase 1 del rol de Ops. Alejo lleva DOS sombreros — Gerencial y Media
---

> Fleeting note. Insumo crudo, sin reconciliar. La verdad del alcance vive en `docs/spec.md`,
> los ADR y `docs/plan-crm-v2.md`; esto es el material del que salio.

> ⚠️ **NO hay transcript.** El plan de Granola de Mani es gratuito y no sirve transcripts
> (`Transcripts are only available to paid Granola tiers`). Lo de abajo son las **notas privadas
> de Mani** mas el **resumen generado por Granola**, no lo que se dijo palabra por palabra.
> Consecuencia practica: **lo que no aparece aqui no se sabe si se pregunto y no se anoto, o no se
> pregunto.** Ver `preguntas-abiertas.md` en el vault.

---

# Notas privadas de Mani (verbatim)

```
metricas de closers: close rate, show, etc...

metricas pautas: todo por UTMs

metricas media: agendas y cantidad de registros (metrica por UTM).

dolores de gerentes de Retia: rendimiento de las areas (cantidad de leads por area: ahi toca
definir que UTMs pertenecen a cada area).

Areas: Gerencial, Comercial, Media, Pauta (Paid Traffickers).

adicion al cockpit: manejan los videos editados, publicados, etc... por creador (despues de
```

*(la nota se corta ahi, literalmente)*

---

# Resumen de Granola

## Contexto: workflow de Mike

- Mike mostro su workflow: sheets de Tactical Investor, closers, registro de llamadas y paid
  traffickers.
- Sheets de paid traffickers: pautas y metricas por dia, inversion por pauta, UTMs.

## CRM y centralizacion de leads

- Objetivo: centralizar leads crudos que llegan por forms al CRM, manejar deals con etapas
  estandarizadas (al estilo HubSpot).
- Problema actual: todo manual en sheets, sin estandarizar, muchas pestanas, espacio para error
  humano. Claude reviso los sheets y encontro **leads perdidos y entradas duplicadas**.
- Las UTM llegan de por si al sheet desde los forms, base para sacar metricas por canal.
- Prioridad: **primero reunirse con closers, luego construir el dashboard.**

## Metricas por area

| Area | Que mide |
|---|---|
| **Comercial** (closers) | close rate, show rate, transcripts de llamadas, estado del lead por etapa |
| **Pauta** | metricas por UTM, que anuncios estan vendiendo, segmentacion por fecha y canal |
| **Media** | cantidad de registros vs agendas por canal (TikTok, Instagram, YouTube...) |
| **Gerencial** (Dani, Alejo) | rendimiento de areas, % de cierre por closer, cantidad de leads por area |

- **Registros = total que lleno el Typeform. Agendas = leads calificados.**
- Ejemplo dado: TikTok puede traer muchos registros y pocas agendas (baja calificacion).
- Gerencial: *"toca definir que UTMs pertenecen a cada area"*.

## Areas y stakeholders

- **4 areas:** Gerencial, Comercial, Pauta (Paid Traffickers), Media (Redes Sociales).
- **Orden de reuniones: primero Comercial, luego Pauta, luego Media.**
- Alejo agrega a Mani a los grupos de WhatsApp de cada area y da contexto.
- Enfoque del rol, en palabras de la reunion: **ayudar a los closers a no perder leads y a Retia a
  generar mas ventas.**

## Adicion al cockpit (explicitamente NO prioritario)

- Dashboard sencillo para "Manuel Arana" y "Rod": trackear videos **editados y publicados por
  creador**.
- Dicho para no olvidarlo. **Primero ventas.**
- ⚠️ *"Manuel Arana"* sin confirmar si es Mani u otra persona del equipo de contenido.

## Proximos pasos acordados

| Quien | Que |
|---|---|
| Mani | Reunirse con **Comercial** (closers): presentar prototipo del CRM, recoger dolores y flujo de leads |
| Mani | Luego **Pauta**, luego **Media**, en ese orden |
| Alejo | Agregar a Mani a los grupos de WhatsApp de cada area y dar contexto del rol |
