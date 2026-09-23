---
id: 050
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-3 · ADR 0035, ADR 0005, insumo §2.2"
depends: [048]
status: todo
---

# 050 — Identidad del Lead: el correo manda, el telefono une **y marca**

## Objetivo

Decidir, para cada Envio, a que Lead pertenece. Es el punto del sync donde un bug **no lanza
ningun error** y mezcla dos personas para siempre.

## Las reglas (ADR 0035)

1. **Mismo correo, mismo programa → el mismo Lead.** Sin preguntar. Es la llave unica del ADR 0005.
2. **Telefono igual y correo distinto → se suma al Lead existente, MARCADO** como "unido por
   telefono", con aviso en la tarjeta. Los deals siguen funcionando normal mientras este marcado.
3. Un gerente **separa** (el envio vuelve a ser un Lead propio con su historial) o **deja unido**
   (la marca se quita y queda **quien lo confirmo**).
4. **Otro programa → otro Lead.** No hay cruce (insumo §1.7).

🩸 **Por que la marca y no la fusion:** 37 telefonos de Tactical tienen mas de un correo, y parte
son personas distintas con numero compartido. **Fusionar no se puede deshacer mirando los datos**;
no fusionar se nota. Cuando los dos errores son asimetricos, se elige el reversible.

## Alcance

- **Dentro:** `lib/leads/identidad.ts` (o el modulo que corresponda) como **la unica** respuesta a
  "¿de quien es este envio?", con su guardian si aparece un segundo lugar que la conteste.
- **Dentro:** `lead_contactos` se llena desde aqui: cada correo y telefono con **el envio del que
  llego** y su orden.
- **Dentro:** la lista de "posibles duplicados" para el gerente (los datos; la pantalla es de la
  etapa 6).
- **Fuera:** normalizar el telefono a un formato internacional. Se guarda en digitos y se compara
  en digitos; inventar un normalizador de telefonos colombianos es un ADR aparte.

## La trampa heredada

El dedup conserva la fecha mas antigua, y por eso **una sola fila envenenada le borraba la fecha
real a quien si la tenia**. Cualquier regla nueva de union hereda ese riesgo: al unir dos envios,
**preguntarse siempre que campo gana y por que**, y probarlo con las fechas.

## Done cuando

- [ ] Mismo correo une; correo distinto con telefono igual une **marcado**; otro programa no une.
- [ ] Separar deja dos Leads con sus envios intactos; confirmar deja **quien confirmo**.
- [ ] Un test sobre los 37 casos reales de Tactical (o una muestra fiel) no fusiona ninguno a
      ciegas.
- [ ] `tests/dedup.test.ts` sigue verde, incluida la parte del centinela.

## Kiro

Si, **con revision cercana**: es donde un bug es mas silencioso.

## Avance 22-sep (status sigue `todo`)

- ✅ **La decisión, pura y determinista:** `resolverIdentidad(envios, conocidos)` en
  `lib/ingesta/identidad.ts`. Reglas implementadas:
  - el correo manda;
  - un teléfono conocido con un correo distinto **une y marca**, y el correo entra sin confirmar;
  - si correo y teléfono apuntan a leads distintos, gana el correo y queda un posible duplicado;
  - sin correo y sin teléfono conocido no hay lead.
- ✅ **El orden no cambia el resultado:** lo decide la posición en la hoja, y hay test. Lo que
  llega por webhook va al final, ordenado por token.
- ✅ También devuelve los `contactosNuevos` (con el token del envío del que llegaron, principal y
  confirmado) y los `posiblesDuplicados` para el gerente.
- 📌 **Para quien lo cablee:** `lead_contactos` está vacía en `production`. Hay que pasar como
  `conocidos` también el correo y el teléfono que hoy viven en `leads`; si no, todo lead existente
  parecería nuevo.
- ⏳ **Falta:**
  - escribir contactos y asignaciones (con el 049);
  - "separar" y "confirmar", guardando **quién** confirmó (sigue abierto dónde, schema.ts:401);
  - el test sobre los 37 casos reales de Tactical: hoy es una muestra fabricada (una familia con
    un número).
