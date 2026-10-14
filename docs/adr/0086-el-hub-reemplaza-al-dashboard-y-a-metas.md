# 0086: El Hub reemplaza al Dashboard y a Metas, y el periodo se compara "con" algo, sin A ni B

- **Estado:** aceptado, 14-oct-2026 (Mani, audit del Hub, `docs/hub.md` H-1, H-2 y H-12). Se construye en los
  tickets 250, 251 y 252.
- **Enmienda:** ADR 0050 (la tab Dashboard pasa a llamarse Hub), ADR 0067 punto 2 (cómo se presenta el selector
  de periodo; la regla de comparación no cambia), ADR 0082 (lo que el closer no abre ahora se llama Hub).
- **Confirma:** ADR 0067 puntos 1 y 3 a 6 (número y porcentaje, mismo día hábil, Bogotá, toda cifra abre su
  lista), ADR 0048 ("todos los programas" solo suma), ADR 0023 (la meta no se reparte entre closers), ADR 0052
  (lo que ve el paid trafficker).

## Contexto

El reporte diario de septiembre (cinco páginas armadas a mano por Michael, que sale del equipo) contestaba
cada noche si se iba a llegar a la meta y qué se hacía al otro día. El CRM ya tiene casi todas esas cifras, pero
repartidas entre las cuatro pestañas del Dashboard (Pulso, Operación, Dinero, Pauta) y una página Metas aparte.
Mani, 14-oct: el dashboard *"está súper desorganizado, súper difícil de entender"*, y el selector de periodo con
A y B no se entiende (*"B no lo entiendo bien"*).

## Decisión

1. **La tab Dashboard se llama Hub y absorbe la página Metas.** Su ruta sigue al nombre (`/p/[programa]/hub` y
   `/hub` para todos los programas) y las rutas viejas (`dashboard`, `metas`) redirigen, como se hizo con
   `/mi-dia`. "Hub" se escribe así en la interfaz y entra al vocabulario.
2. **Cinco pestañas, en este orden:** **Hoy** (¿vamos a llegar y qué hacemos hoy?), **Comercial** (dónde se
   traba el embudo y con quién), **Dinero**, **Pauta** (cuánto cuesta cada etapa y qué campaña vende) y
   **Origen** (de dónde vino cada lead y cómo cuenta cada UTM).
3. **Hoy es el reporte diario.** Una línea de contexto (día hábil de la semana, del mes y de la cohorte); día,
   semana, cohorte y mes con meta, real y cumplimiento; ritmo, proyección y lo que hace falta por día; la
   operación del día por programa y por closer; la caja del día; las banderas rojas; las acciones abiertas
   (ADR 0090). **Una cifra entra a Hoy solo si tiene una meta, un umbral o un dueño que actúe sobre ella**; lo
   demás vive en las otras pestañas o en la lista que la cifra abre.
4. **El selector es "Periodo" + "Comparar con", y en pantalla no aparece ninguna letra.** "Comparar con" ofrece:
   el mismo punto del periodo anterior (por defecto, la regla del ADR 0067 punto 3), la cohorte anterior al
   mismo día hábil, un rango que se elige o no comparar. La comparación se escribe en palabras al lado de cada
   cifra ("contra el mismo punto de septiembre"). Las llaves de la URL pueden seguir siendo las del 136.
5. **Quién entra no cambia:** gerente y developer todo, el paid trafficker sin el comparativo entre closers ni
   la comisión (ADR 0052), el closer no entra (ADR 0082).

## Consecuencias

- Pulso desaparece como pestaña: lo suyo (meta del mes, banderas, alertas) se reparte en Hoy.
- El PDF del 021 sigue congelado: Hoy y el resumen de las 18 h (ADR 0089) cubren el reporte de Michael.
- Ningún cálculo cambia por renombrar: las consultas siguen en `lib/queries/` (`docs/hub.md` §5).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Un Hub nuevo al lado del Dashboard | dos lugares para la misma cifra durante la transición |
| Solo cambiar el nombre | no arregla el desorden, que es lo que Mani reportó |
| Dejar A y B y explicarlo | la explicación es la señal de que el control no se entiende solo |
| Sin comparación por defecto | Gerencia pidió el contraste (GC-36); esconderlo lo vuelve opcional |
