---
id: 293
etapa: corte
serves: "Daily Tech 21-oct (Michael: caso de Andre, corte 2027); decisión de Mani del 21-oct"
depends: [231]
status: todo
---

# 293 — Próxima corte sin que la corte exista: la bandeja "Esperando corte"

## Por qué existe

Daily Tech del 21-oct: Andre tenía un lead interesado en la corte de 2027 y no pudo marcarlo. Próxima cohorte
solo ofrece cohortes `futuro` (`lib/deals/anotar.ts`, rechazo 409 "solo admite una cohorte futura") y en
producción Comunicarte y Tactical no tienen ninguna (medido el 21-oct: solo C3 activa en cada uno). El diálogo
dice "No hay cohortes futuras. Gerencia la crea en Programa" (`components/deals/dialogo-anotar.tsx:113`).

Mani (21-oct): **no quiere que haya que crear la corte para poder mandar a alguien a la próxima corte.** El deal
cae en una bandeja con una **nota de texto libre, obligatoria**, que dice a qué corte quiere entrar ("2027",
"la de enero"). Cuando la corte ya exista, de esa bandeja se sacan los deals hacia ella.

Lo que ya existe y se reutiliza: el pendiente `proxima_cohorte` (`pendienteDealEnum`, ADR 0070), la columna
`deals.cohorte_destino_id`, el grupo "Leads que quieren entrar en la próxima cohorte" de Mi espacio
(`lib/mi-espacio/notificaciones.ts`) y la escritura única `cambiarCohorteDelDeal` (231). No hace falta una etapa
nueva: Próxima cohorte ya es un Pendiente, no una etapa (ADR 0070), y una etapa más obligaría a tocar el embudo.

## Qué se construye

**Base (la sesión principal, no el agente):**
- `deals.cohorte_destino_texto text` (nullable), con `SET lock_timeout = '5s'` (tabla caliente).
- CHECK: si `pendiente = 'proxima_cohorte'` y `cohorte_destino_id IS NULL`, entonces `cohorte_destino_texto`
  no es nulo ni vacío. Antes de crearlo, contar en producción los deals que ya tienen ese pendiente.

**Código:**
- Anotar › Próxima cohorte ofrece dos caminos en el mismo diálogo:
  1. Una cohorte `futuro` ya creada: igual que hoy (231), el deal se muda en el acto.
  2. **"La corte todavía no existe"**: un campo de texto obligatorio ("¿A qué corte quiere entrar?"). Pone el
     pendiente `proxima_cohorte` con `cohorte_destino_texto`, sin `cohorte_destino_id` y sin cambiar
     `cohort_id`. Nota del sistema en el log ("Esperando corte: 2027") y rastro (`editarConRastro`).
  Sin cohortes futuras, el camino 2 es el único y el diálogo deja de decir "Gerencia la crea".
- **La bandeja "Esperando corte"** por programa: los deals con ese pendiente y sin destino, con su texto, el
  dueño y la fecha en que se anotó. Vive donde se crea la cohorte (Programa › Cohortes), porque es el momento en
  que alguien la necesita: al crear o activar una cohorte, la pantalla muestra "N deals esperan corte" y deja
  elegir cuáles pasan a la nueva. Pasar usa `cambiarCohorteDelDeal` (una sola respuesta a "cambiar la cohorte de
  un deal"), limpia el pendiente y el texto, y deja nota y rastro por deal. Escritura por lotes en una
  transacción.
- El grupo de Mi espacio sigue mostrando al closer sus deals en espera, con el texto.
- Un deal en espera se sale de ella como cualquier pendiente (ADR 0070 punto 7): otro pendiente, un movimiento
  hacia adelante o Cierre perdido. Al salir se limpia el texto.

## Decisiones que confirma Mani antes de construir

- **D-1. ¿En qué cohorte cuenta el deal mientras espera?** Propuesta: en la de origen (`cohort_id` no cambia),
  como decía el ADR 0070 punto 8 antes del 231. Razón: no hay cohorte destino a la que contarlo, e inventarle
  una sería un número falso en las métricas de la cohorte. Consecuencia: la conversión de C3 lo sigue viendo
  hasta que pase a la nueva.
- **D-2. ¿Quién saca los deals de la bandeja?** Propuesta: quien administra el programa (`esAdministrador`) al
  crear la cohorte, y también el dueño del deal desde su ficha. Razón: quien crea la corte es quien sabe cuándo
  abre, y el closer no debería esperar a nadie para mover su propio deal.
- **D-3. ¿El texto se lee para emparejar solo?** Propuesta: no. Es texto libre que escribe una persona; usarlo
  para decidir a qué cohorte va sería adivinar (el mismo error que el ADR 0030 con los nombres de closer). Se
  muestra al lado para que quien pasa los deals decida.

## Done cuando

- [ ] Test: sin cohortes futuras, Próxima cohorte con texto pone el pendiente, guarda el texto, no cambia
      `cohort_id`, deja nota y `change_log`; sin texto (o solo espacios) se rechaza con 400.
- [ ] Test: el CHECK de la base rechaza el pendiente sin destino y sin texto (con el índice real, no un error
      fabricado).
- [ ] Test: pasar N deals de la bandeja a una cohorte nueva los muda por `cambiarCohorteDelDeal` en una
      transacción, limpia pendiente y texto, y un deal de otro programa se rechaza.
- [ ] Test: las métricas de la cohorte de origen cuentan el deal mientras espera y dejan de contarlo al pasar.
- [ ] Con cohorte futura creada, el camino de hoy (231) sigue igual: sus tests en verde.
- [ ] `npm run build` (toca componentes cliente) y recorrido en base local: closer anota "2027", gerente crea
      C4 y la pantalla muestra el deal en espera y lo pasa; clic en todo lo que se abre y consola limpia.
- [ ] `docs/structure.md` §3 (PC) y `docs/overview.md` §11 (vocabulario: "Esperando corte") actualizados.
