---
id: 409
etapa: mi-espacio
serves: "A-175 (Michael, 9-nov) · ADR 0119 (MCP del CRM) · ticket 383"
depends: [383]
status: done
---

# 409 — Conectar la IA desde Mi espacio, con la dirección y los pasos a la vista

## Por qué

Michael (gerente) no encontró cómo crear la «key» del MCP. No hay key: la conexión es por OAuth con la cuenta de Google
(ticket 383, todos los roles). Pero la tarjeta «Conexiones de IA» de Mi espacio dice «agrega la dirección del CRM» y **no
muestra la dirección**: quien no es técnico no sabe qué pegar ni dónde. Anotación A-175.

## Alcance

1. La tarjeta muestra la **dirección del MCP** (`<origen del CRM>/api/mcp`) con un botón de copiar, a la vista cuando todavía
   no hay conexiones y plegada («Conectar otra IA») cuando ya hay.
2. Pasos cortos por herramienta, en pestañas o un selector (**Claude** y **ChatGPT**): dónde se agrega un conector
   personalizado, qué pegar y que aparecerá el inicio de sesión con Google. Sin jerga (N5: nada de OAuth, scopes ni «bearer»).
3. La dirección **se deriva, no se escribe**: sale del mismo módulo que ya conoce el origen público del CRM
   (`lib/oauth/origen.ts`, `lib/mcp/enlaces.ts` o `lib/mcp/recurso-protegido.ts`: lee cuál es la fuente única y reutilízala; no
   copies un literal ni una variable de entorno nueva). Se calcula en el servidor y llega a la tarjeta por props: un archivo
   cliente no importa valores de `lib/` que carguen la base (AGENTS.md, frontera cliente/servidor).
4. Tras conectar, la tarjeta lo muestra en «Conexiones» (ya existe) sin recargar a mano si el flujo lo permite; si no, el
   texto dice que aparecerá aquí.
5. Todo rol ve lo mismo (todos pueden conectar); el developer conserva además su creación de tokens personales.

## Fuera

La creación de tokens personales (`puedeCrearTokenPersonal`), los permisos por rol del MCP y las herramientas.

## Done cuando

- [x] Un gerente sin conexiones ve la dirección con «Copiar» y los pasos de Claude y ChatGPT; el botón copia el valor exacto.
- [x] La dirección sale de la fuente única del origen del CRM, con test (en producción y en local da la URL correcta).
- [x] Recorrido a mano en la base local el 9-nov (gerente, 375 px, oscuro): sin conexiones muestra dirección y pasos de Claude y ChatGPT; con una conexión, «Conectar otra IA» plegado que abre; Copiar escribe en el portapapeles; consola limpia; `npm run build`. **No recorrido:** closer, developer y modo claro (el componente no depende del rol).
- [x] Regla N8 (ADR 0115): `docs/mcp.md` y el vocabulario de `overview.md` §11 al día si cambian; A-175 marcada como hecha.
