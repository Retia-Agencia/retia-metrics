---
id: 259
etapa: hub
serves: "ADR 0089 puntos 2 y 4 (la segunda excepción a \"nada es público\")"
depends: [258, 265]
status: todo
---

# 259 — El endpoint de máquina del semáforo

## Objetivo

Que Juanito pueda pedirle al CRM, con un secreto, que sincronice el día en curso de Meta y le devuelva el semáforo ya
calculado, sin ver nunca un dato de una persona.

## Alcance

- **Dentro:** una ruta (`app/api/...`, el nombre lo fija el ticket) que acepta un `POST` con el secreto en una cabecera,
  comparado en tiempo constante. Sin secreto o con uno malo: 401 sin cuerpo útil. El secreto vive en Vercel y en el
  `.env` de Juanito (regla de secretos de `AGENTS.md`); nunca en el repo ni en un chat.
- **Dentro:** al llamarla, corre `sincronizarDiaEnCurso()` (245; no le pega a Meta si la última foto es reciente) y
  devuelve el semáforo (258) del momento, en JSON validado con zod: programa, campaña, color, gasto, moneda, agendas,
  costo, umbral, comparación contra ayer a la misma hora, días seguidos en rojo, nota de calidad del dato, la hora de
  la última sincronización y el tipo de corrida (de día o de cierre). **Ningún nombre, correo, teléfono ni id de lead.**
- **Dentro:** un test de contrato que recorre la respuesta y falla si aparece un campo fuera de la lista blanca.
- **Dentro:** `AGENTS.md`: la restricción "nada de la app es público" nombra esta segunda excepción, y una fila nueva
  en Contratos ("Qué sale por el endpoint del semáforo").
- **Dentro:** el cron diario de Vercel que cierra el día (re-lee siete días, 120) se verifica dentro del límite de
  Hobby (R3).
- **Fuera:** el mensaje y los horarios (260).

## Done cuando

- [ ] Sin secreto, 401 y la base no se mueve; con secreto, el semáforo, con test que invoca el handler real.
- [ ] El test de la lista blanca muerde en los dos sentidos (un campo de más lo rompe).
- [ ] Dos llamadas seguidas hacen una sola lectura de Meta, con test.

---

## Enmienda 14-oct (Mani, tras la primera sincronización real del 120)

- **El Hub también dispara la sincronización al abrirse**, además de este endpoint: si la última corrida de
  `pauta_sincronizaciones` tiene más de 1 hora, la página muestra lo último y sincroniza de fondo con `after()` de
  Next (no espera ni carga al navegador). El candado del 120 evita dos corridas a la vez.
- **Corrida liviana durante el día:** solo los insights de hoy, y el árbol solo si tiene más de 24 h. La completa
  (7 días y el árbol) sigue siendo la del cron diario. Medido el 14-oct: la completa tarda 107 s con los tres
  programas; la liviana debería quedar en segundos (nota de cierre con lo medido).
- Done cuando, además: abrir el Hub con la última corrida vieja dispara una sola corrida liviana y la página no la
  espera, con test; con una corrida de hace menos de 1 hora, no dispara nada.

---

## Enmienda 15-oct (Mani, ADR 0089 enmendado): el endpoint responde "qué mandar ahora"

- **Depende además del 265** (la configuración del reporte por programa).
- La respuesta deja de ser "el semáforo de todos los programas": es **la lista de envíos que tocan en este instante**
  según la regla del 265 (programas encendidos con ese horario, en día hábil), cada uno con: el programa, el destino
  (id del grupo), si es de día o de cierre, y **solo las métricas encendidas** para ese programa, con su semáforo
  (258). Sin envíos que toquen: lista vacía, 200.
- Además devuelve **la configuración vigente** (destinos y horarios de cada programa encendido), para que Juanito
  guarde la última buena y pueda avisar si el CRM no responde (ADR 0089 enmendado, punto 4).
- La lista blanca del test de contrato agrega `destino`, `tipo` (día o cierre) y `metricas`; sigue sin nombres,
  correos, teléfonos ni ids de lead.
- Done cuando, además: a una hora sin envíos devuelve lista vacía; una métrica apagada no aparece; un programa
  apagado no aparece; con tests sobre el handler real.

---

## El contrato Juanito ↔ CRM (15-oct, Mani: "la conexión es lo más crucial de definir")

**La dirección:** Juanito llama al CRM; el CRM nunca llama al VPS. Una llamada HTTPS saliente desde el VPS a Vercel:
sin puertos abiertos ni IP fija. El grupo, las horas y las métricas viven en el CRM (265); en el `.env` de Juanito
solo la URL y el secreto.

**La pregunta**, cada hora en punto de un día hábil (6 a 19 h, Bogotá):

```
POST /api/semaforo/envios
x-semaforo-secreto: <secreto>          (comparado en tiempo constante; sin él o malo: 401, cuerpo vacío)
{}                                      (el instante lo pone el servidor; nunca lo manda Juanito)
```

**La respuesta** (200, validada con zod en el servidor y con lista blanca en el test de contrato):

```jsonc
{
  "generadoEn": "2026-10-16T11:00:04-05:00",
  "sincronizacion": { "estado": "ok" | "reciente" | "corriendo" | "error", "ultimaFoto": "<ISO>" | null },
  "envios": [                                   // lo que toca AHORA; vacía si no toca nada
    {
      "programa": "ComunicArte",                // nombre visible, nunca el id
      "destino": "1203630...@g.us",             // el grupo, tal cual lo dio /grupos
      "tipo": "dia" | "cierre",
      "hora": "11:00",
      "enlaceHub": "https://.../p/<slug>/hub?seccion=pauta",
      "metricas": [ /* MetricaSemaforo, solo las encendidas */ ]
    }
  ],
  "configuracion": [                            // lo vigente, para que Juanito guarde la última buena
    { "programa": "ComunicArte", "destino": "...@g.us", "horas": ["07:00","09:00","11:00"], "horaCierre": "18:00" }
  ]
}
```

**`MetricaSemaforo`** (la arma el 258; la misma forma la pinta Hub › Pauta):

```jsonc
{
  "metrica": "costo_por_agenda",
  "color": "exito" | "alerta" | "peligro" | "sin_dato",
  "motivo": null | "sin_cohorte" | "sin_umbral" | "sin_pauta" | "sin_referencia",
  "moneda": "COP",
  "gasto": 609860, "agendas": 1, "costo": 609860 | null,
  "umbral": { "meta": 70000, "aceptable": 93000 } | null,
  "porcentajeDelUmbral": 8.71 | null,          // costo ÷ meta
  "ayerALaMismaHora": { "dia": "2026-10-15", "gasto": 0, "agendas": 0, "costo": null } | null,
  "trayectoria": [ { "hora": "09:00", "gasto": 0, "agendas": 0, "costo": null } ],
  "diasSeguidosEnRojo": 0,
  "agendasMeta": 3 | null,                     // control de Meta, nunca el costo oficial
  "campanas": [],                              // v2 del 258; en la v1 siempre vacía
  "notas": [ { "tipo": "problema" | "info", "texto": "..." } ]
}
```

Ni nombres, ni correos, ni teléfonos, ni ids de lead. Si el CRM no responde (timeout, 5xx), Juanito usa la última
`configuracion` guardada: si a esa hora había envíos, avisa a esos destinos que no hay datos.

---

## Brief para Codex, listo para despachar (15-oct, sesión central)

Decidido en la sesión; quien lo retome lo despacha tal cual en un worktree dentro del repo (lee primero la sección del contrato).

```text
Goal: ticket 259 (docs/tasks/259-el-endpoint-de-maquina-del-semaforo.md, with both enmiendas and the section "El contrato Juanito ↔ CRM"). Juanito hace POST cada hora hábil; el CRM responde qué mandar ahora, ya calculado, sin un solo dato de persona.

Decisions (already made, do not revisit):
1. Ruta `app/api/semaforo/envios/route.ts`, `export const runtime = "nodejs"`, solo `POST`. Agrégala a las excepciones de `proxy.ts` (junto a `/api/cron/`), exacta: `pathname === "/api/semaforo/envios"`.
2. Autenticación: cabecera `x-semaforo-secreto` contra `process.env.SEMAFORO_SECRETO`. Compara con `crypto.timingSafeEqual` sobre los SHA-256 de ambos (así las longitudes son iguales). Sin variable de entorno, sin cabecera o distinta: `new Response(null, { status: 401 })`, sin tocar la base ni Meta.
3. Contrato en `lib/reporte-whatsapp/contrato.ts`: esquemas zod `.strict()` de la respuesta tal cual el contrato del ticket 259, con DOS ajustes ya decididos: `sincronizacion` puede ser `null` (no tocaba ningún envío, así que no se le pega a Meta), y cada envío lleva `error: string | null` (si el semáforo de ese programa revienta, `metricas: []` y `error: "No se pudo calcular el semáforo de este programa."`; los demás envíos siguen). El esquema de la métrica reutiliza el tipo `MetricaSemaforo` de lib/semaforo/semaforo.ts (el zod debe coincidir con él; si no compila contra el tipo, STOP y reporta). El handler valida su respuesta con este esquema antes de devolverla.
4. Flujo del handler, con `ahora = new Date()`:
   a. Lee las configuraciones activas: agrega en `lib/catalogo/reportes-whatsapp.ts` (existe, del 265) `reportesActivos(db)` que devuelve programa (id, nombre, slug) + destino + horas + horaCierre + metricas de las filas `activo = true` de programas activos.
   b. `queTocaAhora(ahora, reportes)` de `lib/reporte-whatsapp/que-toca.ts` (existe, del 265).
   c. Si hay envíos: `sincronizarDiaEnCurso(db, { token, ahora, disparadaPor: "endpoint" })` (lib/pauta/dia-en-curso.ts) con `token = await tokenActivoMeta(db)` (lib/catalogo/meta.ts); si leer el token lanza, `sincronizacion = { estado: "error", ultimaFoto: <última foto o null> }` y sigue (el semáforo sale con lo último y su nota lo dice). Mapea el resultado al contrato: `ok`/`reciente`/`corriendo`/`error` y `ultimaFoto` = la `tomada_en` más reciente de `fotos_pauta` (consulta aparte, después de sincronizar). Sin envíos: `sincronizacion = null` y NO se sincroniza.
   d. Por envío: para cada métrica encendida (hoy solo `costo_por_agenda`) `semaforoDelPrograma(db, { programId, ahora, tipo })` en try/catch por envío. `programa` = nombre visible; `enlaceHub` = `new URL(request.url).origin + rutaDePrograma(slug, "hub") + "?seccion=pauta"` (lib/nav.ts).
   e. `configuracion` = todas las activas, con horas como "HH:00" y horaCierre "HH:00" o null.
   f. `generadoEn` en ISO con offset de Bogotá (`-05:00`), con el helper que ya exista en lib/format.ts; si no existe uno que dé ISO con offset, STOP y reporta.
5. Hub (enmienda 14-oct): en `SeccionPauta` de app/(app)/p/[programa]/hub/page.tsx, si la última fila de `pauta_sincronizaciones` (cualquier `disparada_por`) empezó hace más de 1 hora o no hay ninguna, se lanza `sincronizarDiaEnCurso(..., disparadaPor: "hub")` con `after()` de `next/server` (no se espera; los errores se registran con console.error y no rompen la página). La decisión vive en una función pura `debeSincronizarDesdeElHub(ultimoInicio: Date | null, ahora: Date): boolean` en `lib/pauta/dia-en-curso.ts`, con test. Lee `node_modules/next/dist/docs/` sobre `after` antes de usarlo (rg -l "after" node_modules/next/dist/docs | head).
6. Ningún nombre de persona, correo, teléfono, id de lead/deal/call ni id de grupo fuera de `destino`. El test de contrato recorre la respuesta recursivamente y falla si aparece una llave fuera de la lista blanca.
Read map (only this; rg before reading; max ~150 lines per read):
- docs/tasks/259-el-endpoint-de-maquina-del-semaforo.md (rg -n "Enmienda|El contrato" and read those sections)
- app/api/cron/pauta/route.ts (molde de ruta de máquina), proxy.ts:1-70
- lib/semaforo/semaforo.ts:1-60 (tipos), lib/reporte-whatsapp/que-toca.ts, lib/catalogo/reportes-whatsapp.ts
- lib/pauta/dia-en-curso.ts:1-60, lib/catalogo/meta.ts (rg -n "export async function tokenActivoMeta" -A15)
- lib/nav.ts:55-75, lib/format.ts:120-175
- app/(app)/p/[programa]/hub/page.tsx:290-350
- tests/cron-pauta.test.ts (molde de test de ruta con vi.mock de "@/lib/db") and tests/webhook-matriz.test.ts:1-70
Constraints: AGENTS.md rules (no need to read it): dates in Bogotá; the secret never logged nor returned; tests use `crearBaseReutilizable()`/`vaciar()`/`cerrar`; `vi.setSystemTime` for the instant; mock Meta with a stubbed global `fetch` that counts calls to graph.facebook.com. No new deps. Typed, no dead code, Spanish names without accents.
Reading budget: max ~20 tool calls; if you need more, stop and report.
If a decision comes up that is not listed above: STOP, do not choose, report the question.
Done when (write tests to pass; you cannot run them):
- tests/semaforo-endpoint.test.ts invoking the real `POST`: sin secreto → 401, cuerpo vacío, ninguna fila nueva en pauta_sincronizaciones ni llamada a fetch; secreto malo → 401; con secreto un martes 11:00 Bogotá con un programa encendido a las 11 → 1 envío con su destino, tipo "dia" y la métrica; a las 12:00 → `envios: []`, `sincronizacion: null` y cero llamadas a Meta; un programa apagado o con la métrica apagada no aparece; dos programas → dos envíos; dos llamadas seguidas → una sola lectura de Meta (la segunda sale "reciente"); un semáforo que lanza en un programa no tumba el otro (vi.spyOn).
- Test de lista blanca que muerde en los dos sentidos (una llave de más en un objeto armado a mano lo rompe; la respuesta real pasa).
- Test de `debeSincronizarDesdeElHub`: null → true; hace 61 min → true; hace 59 min → false.
- `npm run typecheck` and `npm run lint` clean if you can run them.
Out of scope: Juanito (260), AGENTS.md and docs (la sesión los escribe), schema/migrations, vercel.json, git commit.
```
