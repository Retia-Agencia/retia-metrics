import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * El humo de la UI (ADR 0083, ticket 075).
 *
 * Lo que ningún test de Vitest ve: Base UI lanza en tiempo de ejecución, no en compilación, y lo
 * que rompe son las INTERACCIONES (un `DropdownMenuLabel` fuera de su grupo tumbó la página entera
 * al abrir el menú, con 543 tests en verde). Este recorrido entra con cada rol de la base local,
 * visita cada pantalla, abre todo lo que se abre (menús, selects, diálogos, popovers, plegables) y
 * falla si la consola o la página registran un error, o si una pantalla responde 5xx.
 *
 * Hace clic en todo, pero toda petición que no sea GET se aborta en la red: ninguna server action
 * ni formulario llega al servidor. Lo que una página escribe AL RENDERIZAR un GET sí ocurre (abrir
 * la ficha de un deal propio lo marca visto); por eso corre solo contra `npm run dev:local`, la
 * base de Docker. Cierra con Escape y sigue. `npm run test:humo`.
 *
 * Un rol que la base no tiene FALLA, no se salta (un verde sin haber entrado miente): re-siembra
 * con `npm run db:local`, o elige roles con `HUMO_ROLES=developer,closer`.
 */

type Hallazgo = { ruta: string; accion: string; error: string };

/** Los correos que siembra `scripts/seed-local.ts`. */
const TODOS_LOS_ROLES = [
  { rol: "developer", correo: process.env.HUMO_CORREO_DEV ?? "dev@retia.local" },
  { rol: "gerente", correo: "gerente@retia.local" },
  { rol: "closer", correo: "carlos.closer@retia.local" },
  { rol: "paid_trafficker", correo: "pauta@retia.local" },
] as const;

const ROLES_ELEGIDOS = process.env.HUMO_ROLES?.split(",").map((r) => r.trim()).filter(Boolean);
const ROLES = TODOS_LOS_ROLES.filter((r) => !ROLES_ELEGIDOS || ROLES_ELEGIDOS.includes(r.rol));

/** Menos pantallas probadas que esto es un recorrido que no ocurrió (sesión perdida, rutas renombradas). */
const MINIMO_DE_PANTALLAS = 3;

/** Pantallas que no cuelgan de un programa. Las del programa se descubren después del login. */
const RUTAS_GLOBALES = [
  "/",
  "/mi-espacio",
  "/mi-dia",
  "/dashboard",
  "/perfil",
  "/recursos",
  "/nerd-stats",
  "/nerd-stats/bitacora",
  "/ajustes",
  "/ajustes/usuarios",
  "/ajustes/canales",
  "/ajustes/catalogos",
  "/ajustes/areas",
  "/ajustes/salud",
  "/ajustes/migracion",
];

const TABS_DE_PROGRAMA = ["", "/inbox", "/deals", "/leads", "/calls", "/students", "/dashboard", "/metas", "/programa"];

/**
 * Todo lo que se puede abrir: los disparadores de Base UI (`aria-haspopup`, `aria-expanded`, combobox),
 * los plegables y CUALQUIER botón, porque muchos diálogos del CRM se montan con estado desde un
 * `onClick` y no lo anuncian. Hacer clic en un botón que envía es seguro: `cortarEscrituras` aborta
 * en la red toda petición que no sea GET, así que ninguna server action llega al servidor.
 */
const SELECTOR_DE_APERTURA = ["button", "[role=combobox]", "summary"].join(", ");

/** Dentro de un diálogo recién abierto: lo que abre algo más (selects, menús), un nivel. */
const SELECTOR_DENTRO_DE_DIALOGO = "[role=dialog] button[aria-haspopup], [role=dialog] [role=combobox]";

/** Botones que no se tocan aunque la escritura esté cortada. */
const NO_TOCAR = /cerrar sesi[oó]n|salir|copiar/i;

/**
 * Lo que deja una server action abortada a propósito. En la consola solo se perdona si el recurso
 * que falló es uno que el humo abortó (`abortadas`); en la página, solo en la acción que abortó algo.
 */
const RECURSO_ABORTADO = /Failed to load resource: net::ERR_FAILED/i;
const ACCION_ABORTADA = /Failed to fetch|fetch failed|NetworkError|An unexpected response was received/i;

/** Hasta cuántos botones distintos por pantalla (el Kanban repite los mismos en cada tarjeta). */
const TOPE_POR_PANTALLA = 80;

/** Ruido del entorno de desarrollo que no es un error de la app. */
const RUIDO = [/favicon/i, /Download the React DevTools/i, /\[HMR\]/, /\[Fast Refresh\]/];

type Sumidero = { actual: string; accion: string; cortes: number; abortadas: Set<string> };

function escucharErrores(page: Page, sumidero: Sumidero, hallazgos: Hallazgo[]) {
  page.on("pageerror", (err) => {
    if (sumidero.cortes > 0 && ACCION_ABORTADA.test(err.message)) return;
    hallazgos.push({ ruta: sumidero.actual, accion: sumidero.accion, error: `pageerror: ${err.message}` });
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const texto = msg.text();
    if (RUIDO.some((r) => r.test(texto))) return;
    if (RECURSO_ABORTADO.test(texto) && sumidero.abortadas.has(msg.location().url)) return;
    hallazgos.push({ ruta: sumidero.actual, accion: sumidero.accion, error: `console: ${texto.slice(0, 400)}` });
  });
}

/** Desde aquí, ninguna petición que no sea GET sale del navegador: el humo abre, nunca escribe. */
async function cortarEscrituras(page: Page, sumidero: Sumidero) {
  await page.route("**/*", (ruta) => {
    if (ruta.request().method() === "GET") return ruta.continue();
    sumidero.cortes++;
    sumidero.abortadas.add(ruta.request().url());
    return ruta.abort("failed");
  });
}

/** Entra con el login local. Devuelve `false` si la base no tiene ese usuario (AccessDenied). */
async function entrar(page: Page, correo: string): Promise<boolean> {
  await page.goto("/login");
  const campo = page.locator("#email-local");
  await expect(campo, "el login local no está: ¿corre `npm run dev:local`?").toBeVisible();
  await campo.fill(correo);
  await page.locator("form", { has: campo }).locator("button[type=submit]").click();
  const denegado = page.getByText("AccessDenied").or(page.getByText("no está autorizado"));
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
    denegado.first().waitFor({ timeout: 60_000 }),
  ]);
  return !new URL(page.url()).pathname.startsWith("/login");
}

async function descubrirProgramas(page: Page): Promise<string[]> {
  const slugs = new Set<string>();
  for (const ruta of ["/", "/mi-espacio", "/dashboard"]) {
    await page.goto(ruta);
    const hrefs = await page.locator("a[href^='/p/']").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      const m = /^\/p\/([^/?#]+)/.exec(href);
      if (m) slugs.add(m[1]);
    }
  }
  return [...slugs];
}

/** El primer enlace a una ficha (`/p/<slug>/<tab>/<id>`) que haya en la lista. */
async function primeraFicha(page: Page, slug: string, tab: "deals" | "leads"): Promise<string | null> {
  await page.goto(`/p/${slug}/${tab}`);
  const hrefs = await page
    .locator(`a[href^='/p/${slug}/${tab}/']`)
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  const ficha = hrefs.find((h) => new RegExp(`^/p/${slug}/${tab}/[0-9a-f-]{8,}`).test(h));
  return ficha ? ficha.split(/[?#]/)[0] : null;
}

async function nombreDe(objetivo: Locator, i: number): Promise<string> {
  // Sin texto ni aria-label, el índice: si no, todos se llamarían igual y solo se probaría el primero.
  const texto = (await objetivo.innerText({ timeout: 1_000 }).catch(() => "")) || (await objetivo.getAttribute("aria-label").catch(() => null)) || `sin nombre #${i}`;
  return texto.replace(/\s+/g, " ").trim().slice(0, 60);
}

async function cerrar(page: Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

async function abrirTodo(page: Page, ruta: string, sumidero: Sumidero) {
  const vistos = new Set<string>();
  const total = await page.locator(SELECTOR_DE_APERTURA).count();
  let abiertos = 0;
  for (let i = 0; i < total && vistos.size < TOPE_POR_PANTALLA; i++) {
    const objetivo = page.locator(SELECTOR_DE_APERTURA).nth(i);
    if (!(await objetivo.isVisible().catch(() => false))) continue;
    if (await objetivo.isDisabled().catch(() => false)) continue;
    const nombre = await nombreDe(objetivo, i);
    if (vistos.has(nombre) || NO_TOCAR.test(nombre)) continue;
    vistos.add(nombre);
    sumidero.accion = `abrir «${nombre}»`;
    sumidero.cortes = 0;
    try {
      await objetivo.click({ timeout: 3_000 });
      abiertos++;
      await page.waitForTimeout(400);
    } catch {
      // Tapado por otro elemento o fuera de pantalla: no es un error de la app.
    }
    if (new URL(page.url()).pathname !== ruta.split("?")[0]) {
      await page.goto(ruta);
      continue;
    }
    // Un diálogo recién abierto: se abre lo que tiene adentro (selects, menús), un solo nivel.
    const internos = await page.locator(SELECTOR_DENTRO_DE_DIALOGO).count();
    for (let j = 0; j < Math.min(internos, 10); j++) {
      const interno = page.locator(SELECTOR_DENTRO_DE_DIALOGO).nth(j);
      if (!(await interno.isVisible().catch(() => false))) continue;
      sumidero.accion = `abrir «${nombre}» › «${await nombreDe(interno, j)}»`;
      await interno.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(250);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
    }
    await cerrar(page);
  }
  return abiertos;
}

for (const { rol, correo } of ROLES) {
  test(`humo · ${rol}`, async ({ page }, info) => {
    const hallazgos: Hallazgo[] = [];
    const sumidero: Sumidero = { actual: "/login", accion: "entrar", cortes: 0, abortadas: new Set() };
    escucharErrores(page, sumidero, hallazgos);

    const adentro = await entrar(page, correo);
    expect(adentro, `la base local no tiene a ${correo}: re-siembra con npm run db:local o elige roles con HUMO_ROLES`).toBe(true);
    await cortarEscrituras(page, sumidero);

    sumidero.accion = "descubrir programas";
    const slugs = await descubrirProgramas(page);
    expect(slugs.length, `${rol} no ve ningún programa`).toBeGreaterThan(0);

    const rutas = [...RUTAS_GLOBALES];
    for (const slug of slugs) {
      for (const tab of TABS_DE_PROGRAMA) rutas.push(`/p/${slug}${tab}`);
      for (const tab of ["deals", "leads"] as const) {
        sumidero.accion = `buscar ficha de ${tab}`;
        const ficha = await primeraFicha(page, slug, tab);
        if (ficha) rutas.push(ficha);
      }
    }

    const resumen: string[] = [];
    let probadas = 0;
    for (const ruta of rutas) {
      sumidero.actual = ruta;
      sumidero.accion = "cargar";
      const respuesta = await page.goto(ruta);
      const estado = respuesta?.status() ?? 0;
      if (estado >= 500) hallazgos.push({ ruta, accion: "cargar", error: `HTTP ${estado}` });
      const final = new URL(page.url()).pathname;
      // Volver al login después de haber entrado es una sesión perdida: lo que sigue no se probaría.
      if (final.startsWith("/login")) hallazgos.push({ ruta, accion: "cargar", error: "la sesión se perdió (redirige a /login)" });
      if (estado >= 400 || final !== ruta) {
        resumen.push(`${ruta} → ${estado}${final !== ruta ? ` (redirige a ${final})` : ""}`);
        continue;
      }
      probadas++;
      const abiertos = await abrirTodo(page, ruta, sumidero);
      resumen.push(`${ruta} → ${estado} · ${abiertos} abiertos`);
    }

    await info.attach("recorrido", { body: resumen.join("\n"), contentType: "text/plain" });
    console.log(`\n[humo · ${rol} · ${info.project.name}]\n${resumen.join("\n")}`);
    if (hallazgos.length > 0) {
      console.log(`\n[humo · ${rol} · ${info.project.name}] ${hallazgos.length} hallazgos:`);
      for (const h of hallazgos) console.log(`  ${h.ruta} · ${h.accion} · ${h.error}`);
    }
    expect(hallazgos, "errores de consola o de página durante el recorrido").toEqual([]);
    expect(probadas, `${rol} probó muy pocas pantallas: ¿se perdió la sesión o cambiaron las rutas?`).toBeGreaterThanOrEqual(MINIMO_DE_PANTALLAS);
  });
}
