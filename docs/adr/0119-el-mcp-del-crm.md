# 0119: El MCP del CRM: un servidor dentro de la app, cada persona como ella misma

- **Estado:** aceptado · 6-nov-2026 (Mani, grill del ticket 348). Se construye en los tickets 348 (fase 1), 383
  (fase 2: OAuth) y 384 (fase 2: escrituras).
- **Amplía:** la regla "nada de la app es público" de `AGENTS.md` con una excepción nombrada más, como el semáforo
  (ADR 0089) y los avisos (ADR 0114).
- **Confirma:** ADR 0115 N1 (un concepto, un módulo), ADR 0048 y 0094 (alcance), ADR 0025 (el developer no tiene
  restricciones), ADR 0028 y ticket 172 ("ver como" solo lee), ADR 0042 (toda escritura deja rastro), ADR 0117 (deshacer),
  contrato C-2 (las métricas son consultas sobre hechos).

## Contexto

En la daily del 28-oct se acordó darle vida al CRM en este orden: MCP, luego Juanito ampliado, luego IA interna. La IA
dentro del CRM se paga por API; con un MCP cada persona usa el Claude (o la IA) que ya paga y el CRM no paga inferencia.
Gerencia quiere consultar cifras ("¿cuántas ventas tuvo Fulano en tal programa?") y los closers quieren mover su pipeline
rápido.

Se evaluaron cinco formas de conectar un MCP: envolver una API (no hay API REST y el plan dice "REST solo si aparece otro
cliente"), ir directo a la base (se salta las rejas y el rastro), envolver un CLI (solo sirve en la máquina de un dev),
un servidor aparte en Python (duplicaría la lógica de `lib/`, que es TypeScript, y rompe la N1) y que **la app misma sea
el servidor**. También se descartó, para gerencia, un skill con una API key de solo lectura: la key sería compartida (no
se le quita a una sola persona) y las "queries optimizadas" del skill serían una segunda definición de cada métrica, que
es el error medido el 30-oct (ROAS ×2,2 con la suite en verde).

Lo que pide cada cliente (verificado el 6-nov):

- **Claude Code** acepta un token fijo en un header o OAuth (code.claude.com/docs/en/mcp).
- **claude.ai** (web, Desktop, celular) da identidad por persona solo con OAuth; los headers fijos están en beta y sirven
  para una credencial compartida (claude.com/docs/connectors/custom). En un plan Team el Owner agrega el conector y cada
  miembro entra con su cuenta.
- **ChatGPT** exige OAuth 2.1 con PKCE y no acepta API keys (developers.openai.com/apps-sdk/build/auth).
- **La spec de MCP** pide OAuth 2.1 para servidores HTTP, con el servidor MCP como resource server, Protected Resource
  Metadata (RFC 9728) y, para registrar clientes, Client ID Metadata Documents (CIMD); el registro dinámico queda como
  obsoleto (modelcontextprotocol.io/specification/latest/basic/authorization).

## Decisión

1. **Un solo servidor MCP remoto, dentro de la app de Next**, en una ruta (`app/api/mcp/route.ts`) con `mcp-handler`
   2.x sobre `@modelcontextprotocol/server` 2.x. Se despliega con el mismo push y lee la misma base. Sirve a cualquier
   proveedor de IA: las herramientas reciben y devuelven texto o JSON, sin nada propio de un cliente. El skill, si se
   escribe, es un manual encima del MCP (qué herramienta para qué pregunta), nunca otro camino a los datos.

2. **Una herramienta es un adaptador delgado:** valida la entrada con zod, arma el actor y llama una función de `lib/`.
   Ninguna herramienta escribe SQL propio ni repite un predicado. Un guardián lo vigila, como los de vigencia y rastro.

3. **Cada persona entra como ella misma.** Un token pertenece a un usuario de `users`; el rol y el alcance salen de la
   base en cada llamada, igual que `revalidarToken`: desactivar a alguien o quitarle un programa surte efecto en la
   siguiente petición. Nunca un token compartido ni un rol propio del MCP.

4. **El permiso es el rol ∩ el scope del token.** El rol decide qué puede hacer la persona, con las mismas funciones de
   `lib/auth/roles.ts` y `lib/auth/alcance.ts`. El token lleva el scope `lectura` o `escritura` y decide si puede
   escribir. Hay dos rejas: al conectarse la persona solo ve las herramientas de su rol, y cada herramienta vuelve a
   pasar por las rejas de `lib/` (esconder una herramienta no es seguridad).

5. **Una sola tabla de tokens para las dos fases.** Se guarda el hash, el usuario, el scope, la creación, el último uso
   y la revocación; el valor se muestra una vez. En la fase 1 el token lo genera la persona a mano y **no vence**: se
   quita revocándolo. En la fase 2 lo emite el flujo OAuth: el acceso dura poco y el cliente lo renueva solo con el
   refresh token, así que nadie se desconecta mientras usa el MCP; solo vuelve a autorizar tras una inactividad larga o
   una revocación. El servidor MCP valida igual en los dos casos.

6. **El servidor de autorización es el propio CRM**, sobre el login de Google de Auth.js: autorización con PKCE,
   endpoint de token, metadatos de descubrimiento y CIMD (lo soportan Claude y ChatGPT). Un proveedor externo (WorkOS,
   Clerk) se descartó porque traería otra base de usuarios que sincronizar con `users`.

7. **"Ver como" existe para el developer y, como en la app, solo lee** (ADR 0028, ticket 172). Con su propio token el
   developer hace todo como él mismo; con una vista proyecta lo que vería otra persona y ninguna escritura queda a
   nombre de otro.

8. **Toda escritura se muestra antes y se confirma en el chat. Regla fundamental.** El servidor la impone en dos
   llamadas: *preparar* devuelve la vista previa (qué deal, qué campo, antes y después) y un código interno de un solo
   uso; *confirmar* aplica exactamente esa vista previa. El código lo intercambian el modelo y el servidor: la persona
   solo ve la vista previa y dice "sí", sin salir del agente. Si algo cambió entre los dos pasos (otro closer movió el
   deal), se rechaza y se vuelve a preparar. Se permiten lotes. La confirmación devuelve cómo deshacer (ADR 0117), y
   cada cambio va a `change_log` con el origen nuevo `mcp`.

9. **Datos personales: lo mismo que la app le muestra a ese rol**, en fichas y en listas. El MCP no abre nada que la
   pantalla no abra.

10. **Cualquier cuenta de IA puede conectarse** (Mani). Los datos que una persona ve por el MCP pasan por el proveedor
    de esa cuenta, con la política de ese plan.

11. **Topes blandos, nunca un cupo.** El límite real es el pool de conexiones a la base, no las peticiones. Un lote
    tiene un tope por llamada (50 para empezar) y al pasarlo el servidor responde "divídelo en tandas", no un error; las
    lecturas se paginan en el servidor (C-1); un techo alto por token (300 llamadas por minuto para empezar) frena solo
    un bucle desbocado y responde cuánto esperar. Sin cupo diario. Los números se ajustan con la bitácora.

12. **Cada llamada queda en una bitácora propia**: quién, herramienta, programa, resultado, duración y cliente. Los
    argumentos de texto libre no se guardan (pueden traer datos personales). Las escrituras además van a `change_log`.

13. **El programa sigue siendo frontera.** Toda herramienta de lista exige programa y lo resuelve con el alcance; un
    programa ajeno responde que no existe, como el 404 de las pantallas.

14. **Por fases:**
    - **Fase 1 (348):** token personal, solo developers, solo lectura, desde Claude Code. Herramientas: métricas con
      su lista (sobre `lib/queries/metricas-con-filas.ts`, la de "toda cifra abre su lista", que se apoya en los hechos
      de C-2) y el resumen del Hub, buscar lead y ficha, tablero de deals y bandeja (lo que era Mi día), pauta y origen.
    - **Fase 2 (383 y 384):** OAuth y CIMD; el Owner agrega un conector en claude.ai que heredan web, Desktop, celular y
      Claude Code; entran todos los roles, y luego las escrituras con la regla del punto 8.
    - **Fase 3:** ChatGPT y otros proveedores en la misma URL, sin construir nada nuevo; solo se prueba el flujo.

15. **Nunca por el MCP:** Ajustes, usuarios, secretos, fuentes y borrar. Anular (un deal, una llamada, un abono)
    queda fuera del primer alcance de escrituras (384): es una corrección rara que conviene hacer con la ficha delante.

## Consecuencias

- `POST /api/mcp` y los endpoints de OAuth son excepciones nombradas a "nada es público": sin token, 401 sin cuerpo,
  y el resto de la regla sigue igual.
- Las server actions deciden el rol con `requireRole`, que lee la cookie de Next. El MCP arma su sesión desde el token,
  y la lista de roles de cada herramienta sale de las funciones de `roles.ts`, nunca copiada a mano.
- `origen_cambio` suma el valor `mcp` (migración). La bitácora de llamadas y la tabla de tokens son tablas nuevas.
- Con "cualquier cuenta" (punto 10), un dato de lead puede terminar en una cuenta personal de IA. Es una decisión
  consciente; si cambia, se agrega una regla de qué clientes se aceptan, sin tocar las herramientas.
- La escala ya no es la de "5 usuarios concurrentes" de `AGENTS.md`: son tres programas con varios gerentes y closers.
  La bitácora es lo que permite medirlo antes de ajustar topes.
