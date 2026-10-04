import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  destinoDeVolver,
  enlaceConVuelta,
  etiquetaDeOrigen,
  origenDeLaPagina,
  origenValido,
} from "@/lib/navegacion/volver";

describe("origenValido", () => {
  it("acepta una ruta interna con query y pagina", () => {
    expect(origenValido("/p/x/deals?estado=a&pagina=2")).toBe("/p/x/deals?estado=a&pagina=2");
  });

  it("acepta una ruta sin query", () => {
    expect(origenValido("/p/x/deals")).toBe("/p/x/deals");
  });

  it("rechaza una ruta protocol-relative (//host)", () => {
    expect(origenValido("//evil.com")).toBeNull();
  });

  it("rechaza el truco del backslash (/\\host)", () => {
    expect(origenValido("/\\evil.com")).toBeNull();
  });

  it("rechaza una URL con esquema", () => {
    expect(origenValido("https://x")).toBeNull();
    expect(origenValido("javascript:alert(1)")).toBeNull();
  });

  it("rechaza vacio y null", () => {
    expect(origenValido("")).toBeNull();
    expect(origenValido(null)).toBeNull();
    expect(origenValido(undefined)).toBeNull();
  });

  it("rechaza lo que no empieza por /", () => {
    expect(origenValido("deals")).toBeNull();
    expect(origenValido("p/x/deals")).toBeNull();
  });

  it("rechaza un salto de linea o espacio raro", () => {
    expect(origenValido("/p/x\n/deals")).toBeNull();
    expect(origenValido("/p/x /deals")).toBeNull();
    expect(origenValido("/p/x\t/deals")).toBeNull();
  });

  it("rechaza una ruta demasiado larga", () => {
    expect(origenValido("/" + "a".repeat(1500))).toBeNull();
  });
});

describe("enlaceConVuelta", () => {
  it("agrega ?desde cuando el href no tiene query", () => {
    expect(enlaceConVuelta("/p/x/deals/1", "/p/x/deals")).toBe(
      "/p/x/deals/1?desde=" + encodeURIComponent("/p/x/deals"),
    );
  });

  it("agrega &desde cuando el href ya tiene query", () => {
    expect(enlaceConVuelta("/p/x/deals/1?a=b", "/p/x/deals")).toBe(
      "/p/x/deals/1?a=b&desde=" + encodeURIComponent("/p/x/deals"),
    );
  });

  it("ignora un origen invalido y devuelve el href tal cual", () => {
    expect(enlaceConVuelta("/p/x/deals/1", "//evil.com")).toBe("/p/x/deals/1");
    expect(enlaceConVuelta("/p/x/deals/1?a=b", "https://x")).toBe("/p/x/deals/1?a=b");
    expect(enlaceConVuelta("/p/x/deals/1", "")).toBe("/p/x/deals/1");
  });

  it("reemplaza un desde previo del href", () => {
    expect(enlaceConVuelta("/p/x/deals/1?desde=%2Fviejo", "/p/x/deals")).toBe(
      "/p/x/deals/1?desde=" + encodeURIComponent("/p/x/deals"),
    );
    expect(enlaceConVuelta("/p/x/deals/1?a=b&desde=%2Fviejo", "/p/x/deals")).toBe(
      "/p/x/deals/1?a=b&desde=" + encodeURIComponent("/p/x/deals"),
    );
  });

  it("round-trip: lo que origenValido lee de la URL resultante es el origen original", () => {
    const origen = "/p/x/deals?estado=a&pagina=2";
    const enlace = enlaceConVuelta("/p/x/deals/1", origen);
    const query = new URLSearchParams(enlace.slice(enlace.indexOf("?") + 1));
    expect(origenValido(query.get("desde"))).toBe(origen);
  });
});

describe("etiquetaDeOrigen", () => {
  it("etiqueta cada lista por su path", () => {
    expect(etiquetaDeOrigen("/p/x/deals")).toBe("Deals");
    expect(etiquetaDeOrigen("/p/x/leads")).toBe("Leads");
    expect(etiquetaDeOrigen("/p/x/students")).toBe("Students");
    expect(etiquetaDeOrigen("/calls")).toBe("Calls");
    expect(etiquetaDeOrigen("/inbox")).toBe("Inbox");
    expect(etiquetaDeOrigen("/mi-espacio")).toBe("Mi espacio");
    expect(etiquetaDeOrigen("/nerd-stats")).toBe("Nerd stats");
  });

  it("etiqueta las fichas", () => {
    expect(etiquetaDeOrigen("/p/x/deals/abc")).toBe("Deal");
    expect(etiquetaDeOrigen("/p/x/leads/abc")).toBe("Lead");
  });

  it("etiqueta el dashboard y su lista, con y sin programa", () => {
    expect(etiquetaDeOrigen("/dashboard")).toBe("Dashboard");
    expect(etiquetaDeOrigen("/dashboard/lista")).toBe("Dashboard · lista");
    expect(etiquetaDeOrigen("/p/x/dashboard")).toBe("Dashboard");
    expect(etiquetaDeOrigen("/p/x/dashboard/lista")).toBe("Dashboard · lista");
  });

  it("lo desconocido es Atras", () => {
    expect(etiquetaDeOrigen("/otra/cosa")).toBe("Atras");
  });

  it("agrega · filtrados cuando hay un filtro distinto de pagina", () => {
    expect(etiquetaDeOrigen("/calls?resultado=show")).toBe("Calls · filtrados");
    expect(etiquetaDeOrigen("/p/x/deals?canal=meta")).toBe("Deals · filtrados");
  });

  it("solo pagina NO cuenta como filtrado", () => {
    expect(etiquetaDeOrigen("/p/x/leads?pagina=2")).toBe("Leads");
  });

  it("la vista (tabla/kanban) NO cuenta como filtrado", () => {
    expect(etiquetaDeOrigen("/p/x/deals?vista=tabla")).toBe("Deals");
    expect(etiquetaDeOrigen("/p/x/deals?vista=tabla&pagina=2")).toBe("Deals");
    expect(etiquetaDeOrigen("/p/x/deals?vista=tabla&canal=meta")).toBe("Deals · filtrados");
  });

  it("la tab de Mi espacio NO cuenta como filtrado", () => {
    expect(etiquetaDeOrigen("/mi-espacio?tab=canales")).toBe("Mi espacio");
  });

  it("un filtro ademas de pagina SI cuenta como filtrado", () => {
    expect(etiquetaDeOrigen("/p/x/leads?pagina=2&calidad=high")).toBe("Leads · filtrados");
  });
});

describe("destinoDeVolver", () => {
  const porDefecto = { href: "/p/x/deals", etiqueta: "Deals" };

  it("usa el origen valido y su etiqueta", () => {
    expect(destinoDeVolver("/calls?resultado=show", porDefecto)).toEqual({
      href: "/calls?resultado=show",
      etiqueta: "Calls · filtrados",
    });
  });

  it("cae a por defecto con un origen invalido o ausente", () => {
    expect(destinoDeVolver("//evil.com", porDefecto)).toEqual(porDefecto);
    expect(destinoDeVolver(undefined, porDefecto)).toEqual(porDefecto);
    expect(destinoDeVolver(null, porDefecto)).toEqual(porDefecto);
  });
});

describe("origenDeLaPagina", () => {
  it("arma path+query, repite arrays y omite undefined", () => {
    expect(
      origenDeLaPagina("/p/x/leads", { calidad: "high", pagina: "2", vacio: undefined }),
    ).toBe("/p/x/leads?calidad=high&pagina=2");
    expect(origenDeLaPagina("/p/x/deals", { canal: ["a", "b"] })).toBe("/p/x/deals?canal=a&canal=b");
    expect(origenDeLaPagina("/p/x/inbox", {})).toBe("/p/x/inbox");
  });
});

describe("guardian: nadie concatena desde a mano", () => {
  // Recorre app/ y components/ y falla si encuentra `desde=` o `?desde` fuera de este modulo.
  const raiz = join(__dirname, "..");
  const permitido = join("lib", "navegacion", "volver.ts");

  function archivos(dir: string): string[] {
    const salida: string[] = [];
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) {
        if (nombre === "node_modules" || nombre === ".next") continue;
        salida.push(...archivos(ruta));
      } else if (/\.(ts|tsx)$/.test(nombre)) {
        salida.push(ruta);
      }
    }
    return salida;
  }

  it("no hay `desde=` ni `?desde` en app/ ni components/", () => {
    const sospechosos: string[] = [];
    for (const dir of [join(raiz, "app"), join(raiz, "components")]) {
      for (const ruta of archivos(dir)) {
        const texto = readFileSync(ruta, "utf8");
        if (texto.includes("desde=") || texto.includes("?desde")) {
          sospechosos.push(ruta.slice(raiz.length + 1));
        }
      }
    }
    expect(sospechosos, `Usa enlaceConVuelta en vez de concatenar: ${sospechosos.join(", ")}`).toEqual([]);
  });

  it("el unico lugar que arma `desde=` es lib/navegacion/volver.ts", () => {
    const texto = readFileSync(join(raiz, permitido), "utf8");
    expect(texto).toContain("desde=");
  });
});
