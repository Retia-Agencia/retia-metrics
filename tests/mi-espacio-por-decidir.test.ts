import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rediseño de "Por decidir" (ADR 0077, espejo del 183): la sección del gerente deja de
 * duplicar las pestañas dedicadas. En vez de las listas (`InboxSinDueno`,
 * `InboxLlamadasSueltas`, `HostsSinCuenta`) muestra CONTADORES con enlace al Inbox del
 * programa, y Webhook Health como UN semáforo que enlaza a `/ajustes/salud` —no el detalle
 * por fuente—. Un conteo en cero se silencia (sin enlace).
 *
 * `TabPorDecidir` es un componente de servidor que lee la base por los módulos del Inbox;
 * aquí se mockean esas lecturas y se invoca el componente real, inspeccionando el árbol de
 * elementos (entorno `node`, sin DOM), igual que `mi-espacio.test.ts`.
 */

vi.mock("@/lib/db", () => ({ db: {} }));

const seccionesSinDueno = vi.fn();
vi.mock("@/lib/queries/inbox-sin-dueno", () => ({ seccionesSinDueno }));

const llamadasSueltasDelPrograma = vi.fn();
const llamadasSinCloserDelPrograma = vi.fn();
vi.mock("@/lib/queries/inbox", () => ({ llamadasSueltasDelPrograma, llamadasSinCloserDelPrograma }));

const saludDeFuentes = vi.fn();
vi.mock("@/lib/queries/salud-fuentes", () => ({ saludDeFuentes, HORAS_SIN_CALIDAD: 24 }));

const PROG = "p-a";
const SLUG = "programa-a";

/** Texto plano del árbol de un elemento de React, concatenado. */
function textoDelArbol(nodo: unknown): string {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDelArbol).join(" ");
  if (typeof nodo === "object" && "props" in (nodo as Record<string, unknown>)) {
    const props = (nodo as { props?: { children?: unknown } }).props;
    return textoDelArbol(props?.children);
  }
  return "";
}

/** Todos los `href` del árbol (los `Link` de next son funciones con `props.href`). */
function hrefsDelArbol(nodo: unknown, acc: string[] = []): string[] {
  if (nodo == null || typeof nodo === "boolean") return acc;
  if (Array.isArray(nodo)) {
    for (const n of nodo) hrefsDelArbol(n, acc);
    return acc;
  }
  if (typeof nodo !== "object") return acc;
  const el = nodo as { props?: { href?: unknown; children?: unknown } };
  if (typeof el.props?.href === "string") acc.push(el.props.href);
  hrefsDelArbol(el.props?.children, acc);
  return acc;
}

/** ¿Aparece en el árbol un componente cuyo `type` se llama `nombre`? */
function tieneComponente(nodo: unknown, nombre: string): boolean {
  if (nodo == null || typeof nodo === "boolean") return false;
  if (Array.isArray(nodo)) return nodo.some((n) => tieneComponente(n, nombre));
  if (typeof nodo !== "object") return false;
  const el = nodo as { type?: unknown; props?: { children?: unknown } };
  const type = el.type;
  if (typeof type === "function") {
    const fn = type as { name?: string; displayName?: string };
    if (fn.name === nombre || fn.displayName === nombre) return true;
  }
  return tieneComponente(el.props?.children, nombre);
}

async function render() {
  const { TabPorDecidir } = await import("@/components/mi-espacio/tab-por-decidir");
  return (TabPorDecidir as (p: { programId: string; slug: string }) => Promise<unknown>)({
    programId: PROG,
    slug: SLUG,
  });
}

function conConteos(opciones: {
  unclaimed?: number;
  setteo?: number;
  sueltas?: number;
  sinCloser?: number;
  salud?: Array<{ programId: string; marcada: boolean; estado: string }>;
}) {
  const n = (x: number) => Array.from({ length: x }, (_, i) => ({ dealId: `d-${i}` }));
  seccionesSinDueno.mockResolvedValue({
    unclaimed: n(opciones.unclaimed ?? 0),
    pendienteSetteo: n(opciones.setteo ?? 0),
  });
  llamadasSueltasDelPrograma.mockResolvedValue(n(opciones.sueltas ?? 0));
  llamadasSinCloserDelPrograma.mockResolvedValue(n(opciones.sinCloser ?? 0));
  saludDeFuentes.mockResolvedValue(opciones.salud ?? []);
}

describe("TabPorDecidir — agregado/urgente, no un registro (ADR 0077)", () => {
  beforeEach(() => {
    seccionesSinDueno.mockReset();
    llamadasSueltasDelPrograma.mockReset();
    llamadasSinCloserDelPrograma.mockReset();
    saludDeFuentes.mockReset();
  });

  it("NUNCA monta las listas dedicadas ni sus popups (InboxSinDueno/LlamadasSueltas/HostsSinCuenta)", async () => {
    conConteos({ unclaimed: 3, setteo: 2, sueltas: 1, sinCloser: 4 });
    const arbol = await render();
    expect(tieneComponente(arbol, "InboxSinDueno")).toBe(false);
    expect(tieneComponente(arbol, "InboxAgendadosSinDueno")).toBe(false);
    expect(tieneComponente(arbol, "InboxPorSettear")).toBe(false);
    expect(tieneComponente(arbol, "InboxLlamadasSueltas")).toBe(false);
    expect(tieneComponente(arbol, "HostsSinCuenta")).toBe(false);
    // Y ningún popup de Base UI: la causa del throw en runtime del gerente.
    expect(tieneComponente(arbol, "Select")).toBe(false);
    expect(tieneComponente(arbol, "Dialog")).toBe(false);
    expect(tieneComponente(arbol, "DialogoAsignar")).toBe(false);
    expect(tieneComponente(arbol, "Reasignar")).toBe(false);
  });

  it("muestra los contadores con enlace a la pestaña del Inbox del programa (frontera por slug)", async () => {
    conConteos({ unclaimed: 3, setteo: 2, sueltas: 1, sinCloser: 4 });
    const arbol = await render();
    const texto = textoDelArbol(arbol);
    const hrefs = hrefsDelArbol(arbol);

    expect(texto).toContain("3 agendados sin dueño");
    expect(texto).toContain("2 deals por settear");
    expect(texto).toContain("1 llamada suelta");
    expect(texto).toContain("4 hosts sin cuenta");

    expect(hrefs).toContain(`/p/${SLUG}/inbox?seccion=agendados-sin-dueno`);
    expect(hrefs).toContain(`/p/${SLUG}/inbox?seccion=por-settear`);
    expect(hrefs).toContain(`/p/${SLUG}/inbox?seccion=sin-deal`);
    expect(hrefs).toContain(`/p/${SLUG}/inbox`);
  });

  it("un contador en cero se silencia: sin enlace a esa pestaña", async () => {
    conConteos({ unclaimed: 0, setteo: 5, sueltas: 0, sinCloser: 0 });
    const arbol = await render();
    const texto = textoDelArbol(arbol);
    const hrefs = hrefsDelArbol(arbol);

    expect(texto).toContain("Sin agendados sin dueño");
    expect(texto).toContain("Sin llamadas sueltas");
    expect(texto).toContain("Sin hosts sin cuenta");
    expect(texto).toContain("5 deals por settear");

    // Los ceros no enlazan; solo el que tiene cuenta (por settear) y ningún otro de los suyos.
    expect(hrefs).not.toContain(`/p/${SLUG}/inbox?seccion=agendados-sin-dueno`);
    expect(hrefs).not.toContain(`/p/${SLUG}/inbox?seccion=sin-deal`);
    expect(hrefs).toContain(`/p/${SLUG}/inbox?seccion=por-settear`);
  });

  it("Webhook Health en VERDE: cero fuentes marcadas del programa → 'Webhooks al día', sin enlace a salud", async () => {
    conConteos({
      salud: [
        { programId: PROG, marcada: false, estado: "al_dia" },
        { programId: "otro", marcada: true, estado: "muerta" }, // otro programa: frontera, no cuenta
      ],
    });
    const arbol = await render();
    expect(textoDelArbol(arbol)).toContain("Webhooks al día");
    expect(hrefsDelArbol(arbol)).not.toContain(`/ajustes/salud?programa=${SLUG}`);
  });

  it("Webhook Health en ALARMA: fuentes marcadas del programa → conteo + enlace a Ajustes → Webhook Health", async () => {
    conConteos({
      salud: [
        { programId: PROG, marcada: true, estado: "sin_respuestas" },
        { programId: PROG, marcada: true, estado: "muerta" },
        { programId: PROG, marcada: false, estado: "al_dia" }, // sana: no cuenta
      ],
    });
    const arbol = await render();
    const texto = textoDelArbol(arbol);
    expect(texto).toContain("2 fuentes con alarma");
    expect(texto).not.toContain("Webhooks al día");
    expect(hrefsDelArbol(arbol)).toContain(`/ajustes/salud?programa=${SLUG}`);
  });

  it("una sola fuente marcada se dice en singular", async () => {
    conConteos({ salud: [{ programId: PROG, marcada: true, estado: "sin_respuestas" }] });
    expect(textoDelArbol(await render())).toContain("1 fuente con alarma");
  });
});
