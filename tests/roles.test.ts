import { describe, expect, it } from "vitest";
import { administraGlobal, editaObjetivo, esAdministrador, etiquetaDeRol, leePrograma, manejaPauta, manejaPautaGlobal, marcaOnboarding, puedeAcceder, esRolValido, puedeSerMiembro, puedeTocarMembresia, trabajaLeads, trabajaContenido, puedeConfigurarOperaComoCloser, tieneAlcanceConfigurable, veDetalleTecnico, veEquipoComercial, veTableroDelPrograma, configuraPrograma, type Rol } from "@/lib/auth/roles";
import { VALOR_PROGRAMA_TODOS, navParaRol, programaDeRuta, queryHaciaElHub, rutaAlCambiarDePrograma, rutaInicial } from "@/lib/nav";
import { authConfig } from "@/lib/auth/config";

const sujeto = (rol: Rol | null | undefined, operaComoCloser = false) => ({ rol, operaComoCloser });

describe("administraGlobal (ADR 0094, ticket 273)", () => {
  it("solo el gerente sin límite y el developer administran globalmente", () => {
    for (const alcanceLimitado of [false, true]) {
      expect(administraGlobal({ rol: "developer", alcanceLimitado })).toBe(true);
      expect(administraGlobal({ rol: "closer", alcanceLimitado })).toBe(false);
      expect(administraGlobal({ rol: "customer_success", alcanceLimitado })).toBe(false);
    }
    expect(administraGlobal({ rol: "gerente", alcanceLimitado: false })).toBe(true);
    expect(administraGlobal({ rol: "gerente", alcanceLimitado: true })).toBe(false);
    expect(administraGlobal({ rol: "paid_trafficker", alcanceLimitado: false })).toBe(false);
    expect(administraGlobal({ rol: "paid_trafficker", alcanceLimitado: true })).toBe(false);
  });
});

describe("manejaPautaGlobal (ADR 0094, ticket 273)", () => {
  it("conserva Canales y Meta para pauta sin límite, nunca con alcance limitado", () => {
    expect(manejaPautaGlobal({ rol: "paid_trafficker", alcanceLimitado: false })).toBe(true);
    expect(manejaPautaGlobal({ rol: "paid_trafficker", alcanceLimitado: true })).toBe(false);
    expect(manejaPautaGlobal({ rol: "gerente", alcanceLimitado: false })).toBe(true);
    expect(manejaPautaGlobal({ rol: "gerente", alcanceLimitado: true })).toBe(false);
    expect(manejaPautaGlobal({ rol: "developer", alcanceLimitado: true })).toBe(true);
  });
});

describe("trabajaLeads", () => {
  // Las tres preguntas de la familia son distintas y hay que poder contestarlas
  // distinto. Si alguien "simplifica" esta a `esAdministrador`, un gerente pasaria a
  // tener closer_id y membresias, y eso contradice el ADR 0003.
  it("responde la tabla de verdad para cada rol y valor de la capacidad", () => {
    for (const operaComoCloser of [false, true]) {
      expect(trabajaLeads(sujeto("closer", operaComoCloser))).toBe(true);
      expect(trabajaLeads(sujeto("developer", operaComoCloser))).toBe(true);
      expect(trabajaLeads(sujeto("gerente", operaComoCloser))).toBe(operaComoCloser);
      expect(trabajaLeads(sujeto("paid_trafficker", operaComoCloser))).toBe(operaComoCloser);
      expect(trabajaLeads(sujeto("customer_success", operaComoCloser))).toBe(operaComoCloser);
      expect(trabajaLeads(sujeto(null, operaComoCloser))).toBe(false);
      expect(trabajaLeads(sujeto(undefined, operaComoCloser))).toBe(false);
    }
  });
});

describe("veDetalleTecnico", () => {
  it("solo el developer ve columnas y valores internos", () => {
    expect(veDetalleTecnico("developer")).toBe(true);
    expect(veDetalleTecnico("gerente")).toBe(false);
    expect(veDetalleTecnico("closer")).toBe(false);
    expect(veDetalleTecnico("paid_trafficker")).toBe(false);
    expect(veDetalleTecnico("customer_success")).toBe(false);
    expect(veDetalleTecnico(null)).toBe(false);
  });
});

describe("manejaPauta (ADR 0052, ticket 173)", () => {
  // La cuarta pregunta de la familia: la cumplen paid trafficker, gerente y developer.
  it("el paid trafficker, el gerente y el developer manejan pauta; el closer no", () => {
    expect(manejaPauta("paid_trafficker")).toBe(true);
    expect(manejaPauta("gerente")).toBe(true);
    expect(manejaPauta("developer")).toBe(true);
    expect(manejaPauta("closer")).toBe(false);
  });

  it("sin rol no maneja pauta", () => {
    expect(manejaPauta(null)).toBe(false);
    expect(manejaPauta(undefined)).toBe(false);
  });

  // El paid trafficker maneja pauta pero NO administra la app ni trabaja leads: no
  // registra, no es dueño de un deal y no toca usuarios ni motivos (ADR 0052).
  it("el paid trafficker no administra ni trabaja leads", () => {
    expect(esAdministrador("paid_trafficker")).toBe(false);
    expect(trabajaLeads(sujeto("paid_trafficker"))).toBe(false);
  });

  it("el rol paid_trafficker es válido (está en ROLES)", () => {
    expect(esRolValido("paid_trafficker")).toBe(true);
  });
});

describe("veEquipoComercial (ticket 102)", () => {
  // La quinta pregunta: quién ve el trabajo de los closers en el Dashboard. El paid trafficker
  // entra al Dashboard pero no la cumple; el developer sí (ADR 0025).
  it("gerente, closer y developer ven el equipo comercial; el paid trafficker no", () => {
    expect(veEquipoComercial("gerente")).toBe(true);
    expect(veEquipoComercial("closer")).toBe(true);
    expect(veEquipoComercial("developer")).toBe(true);
    expect(veEquipoComercial("paid_trafficker")).toBe(false);
    expect(veEquipoComercial(null)).toBe(false);
  });
});

describe("veTableroDelPrograma (ticket 224)", () => {
  // El tablero del programa (Dashboard, su lista y Metas) lo ven gerente, developer y paid
  // trafficker; el closer y el customer success, no (ADR 0082, enmienda del ADR 0048).
  it("gerente, developer y paid trafficker ven el tablero; el closer y el customer success no", () => {
    expect(veTableroDelPrograma("gerente")).toBe(true);
    expect(veTableroDelPrograma("developer")).toBe(true);
    expect(veTableroDelPrograma("paid_trafficker")).toBe(true);
    expect(veTableroDelPrograma("closer")).toBe(false);
    expect(veTableroDelPrograma("customer_success")).toBe(false);
    expect(veTableroDelPrograma(null)).toBe(false);
  });

  // Es su propia pregunta, distinta de `veEquipoComercial`: un closer ve el equipo pero NO el
  // tablero, y un paid trafficker ve el tablero pero NO el equipo.
  it("se distingue de veEquipoComercial en el closer y el paid trafficker", () => {
    expect(veEquipoComercial("closer")).toBe(true);
    expect(veTableroDelPrograma("closer")).toBe(false);
    expect(veEquipoComercial("paid_trafficker")).toBe(false);
    expect(veTableroDelPrograma("paid_trafficker")).toBe(true);
  });
});

describe("configuraPrograma (ticket 224)", () => {
  // La ficha del programa la configura quien administra la app; el closer, que antes la leia,
  // ya no (ADR 0082).
  it("la cumplen gerente y developer; no el closer ni el paid trafficker", () => {
    expect(configuraPrograma("gerente")).toBe(true);
    expect(configuraPrograma("developer")).toBe(true);
    expect(configuraPrograma("closer")).toBe(false);
    expect(configuraPrograma("paid_trafficker")).toBe(false);
    expect(configuraPrograma(null)).toBe(false);
  });

  // Es exactamente la pregunta de administrar la app, con nombre propio para los llamadores.
  it("coincide con esAdministrador en todos los roles", () => {
    for (const rol of ["gerente", "closer", "developer", "paid_trafficker", "customer_success"] as const) {
      expect(configuraPrograma(rol)).toBe(esAdministrador(rol));
    }
  });
});

describe("leePrograma y editaObjetivo (ticket 266)", () => {
  it("la ficha la leen gerente, developer y paid trafficker", () => {
    expect(leePrograma("gerente")).toBe(true);
    expect(leePrograma("developer")).toBe(true);
    expect(leePrograma("paid_trafficker")).toBe(true);
    expect(leePrograma("closer")).toBe(false);
    expect(leePrograma("customer_success")).toBe(false);
  });

  it("quien administra edita todo y pauta solo sus métricas", () => {
    for (const rol of ["gerente", "developer"] as const) {
      expect(editaObjetivo(rol, true)).toBe(true);
      expect(editaObjetivo(rol, false)).toBe(true);
    }
    expect(editaObjetivo("paid_trafficker", true)).toBe(true);
    expect(editaObjetivo("paid_trafficker", false)).toBe(false);
    for (const rol of ["closer", "customer_success"] as const) {
      expect(editaObjetivo(rol, true)).toBe(false);
      expect(editaObjetivo(rol, false)).toBe(false);
    }
  });
});

describe("marcaOnboarding (ticket 145)", () => {
  // La sexta pregunta de la familia: quién marca/desmarca el onboarding de un estudiante.
  // La cumplen customer success, closer, gerente y developer; nadie más.
  it("la cumplen customer_success, closer, gerente y developer", () => {
    expect(marcaOnboarding("customer_success")).toBe(true);
    expect(marcaOnboarding("closer")).toBe(true);
    expect(marcaOnboarding("gerente")).toBe(true);
    expect(marcaOnboarding("developer")).toBe(true);
  });

  it("el paid trafficker no la cumple", () => {
    expect(marcaOnboarding("paid_trafficker")).toBe(false);
  });

  it("sin rol no marca onboarding", () => {
    expect(marcaOnboarding(null)).toBe(false);
    expect(marcaOnboarding(undefined)).toBe(false);
  });

  // El customer success marca onboarding pero NO administra ni trabaja leads ni maneja
  // pauta: es la combinación que lo aísla en nav, en la ruta inicial y en el predicado de
  // permiso sin escribir el literal del rol (ADR 0025).
  it("el customer success marca onboarding pero no administra, no trabaja leads ni maneja pauta", () => {
    expect(esAdministrador("customer_success")).toBe(false);
    expect(trabajaLeads(sujeto("customer_success"))).toBe(false);
    expect(manejaPauta("customer_success")).toBe(false);
  });

  it("el rol customer_success es válido (está en ROLES)", () => {
    expect(esRolValido("customer_success")).toBe(true);
  });
});

describe("puedeSerMiembro (ticket 145)", () => {
  // Quién admite una membresía de programa: quien trabaja leads y el customer success.
  const sin = (rol: Rol | null) => ({ rol, operaComoCloser: false });
  it("la cumplen closer, developer y customer_success; el gerente no (administra, no pertenece)", () => {
    expect(puedeSerMiembro(sin("closer"))).toBe(true);
    expect(puedeSerMiembro(sin("developer"))).toBe(true);
    expect(puedeSerMiembro(sin("customer_success"))).toBe(true);
    expect(puedeSerMiembro(sin("gerente"))).toBe(false);
    expect(puedeSerMiembro(sin("paid_trafficker"))).toBe(false);
    expect(puedeSerMiembro(sin(null))).toBe(false);
  });

  it("el gerente que opera como closer sí puede ser miembro (ticket 236): sin membresía no sería dueño", () => {
    expect(puedeSerMiembro({ rol: "gerente", operaComoCloser: true })).toBe(true);
    expect(puedeSerMiembro({ rol: null, operaComoCloser: true })).toBe(false);
  });
});

describe("etiquetaDeRol (ticket 177)", () => {
  it("nombra cada rol para la interfaz y los mensajes de permiso", () => {
    expect(etiquetaDeRol("gerente")).toBe("Gerencia comercial");
    expect(etiquetaDeRol("closer")).toBe("Closer");
    expect(etiquetaDeRol("developer")).toBe("Desarrollo");
    expect(etiquetaDeRol("paid_trafficker")).toBe("Paid Trafficker");
    expect(etiquetaDeRol("customer_success")).toBe("Customer Success");
  });
});

describe("puedeTocarMembresia", () => {
  it("permite al dueño, a quien administra y al developer; rechaza a otro closer", () => {
    expect(puedeTocarMembresia("closer", "dueño", "dueño")).toBe(true);
    expect(puedeTocarMembresia("gerente", "admin", "dueño")).toBe(true);
    expect(puedeTocarMembresia("closer", "otro", "dueño")).toBe(false);
    expect(puedeTocarMembresia("developer", "dev", "dueño")).toBe(true);
  });
});

describe("puedeAcceder", () => {
  it("deja pasar al rol permitido", () => {
    expect(puedeAcceder("gerente", ["gerente"])).toBe(true);
    expect(puedeAcceder("closer", ["closer"])).toBe(true);
  });

  it("no hay herencia: gerente NO es closer con extras", () => {
    expect(puedeAcceder("closer", ["gerente"])).toBe(false);
    expect(puedeAcceder("gerente", ["closer"])).toBe(false);
  });

  it("el developer es la unica excepcion a la disjuncion: pasa toda ruta (ADR 0025)", () => {
    // Rutas exclusivas de gerente, exclusivas de closer y compartidas: en todas pasa.
    expect(puedeAcceder("developer", ["gerente"])).toBe(true);
    expect(puedeAcceder("developer", ["closer"])).toBe(true);
    expect(puedeAcceder("developer", ["gerente", "closer"])).toBe(true);
    // Aun sin permitidos declarados, un developer entra (acceso total).
    expect(puedeAcceder("developer", [])).toBe(true);
  });

  it("el paid trafficker no pasa una guarda de gerente o closer (102: ve todos los programas, la reja es el rol)", () => {
    expect(puedeAcceder("paid_trafficker", ["gerente", "closer"])).toBe(false);
    expect(puedeAcceder("paid_trafficker", ["gerente"])).toBe(false);
    expect(puedeAcceder("paid_trafficker", ["closer"])).toBe(false);
  });

  it("sin rol no pasa nada", () => {
    expect(puedeAcceder(undefined, ["gerente", "closer"])).toBe(false);
    expect(puedeAcceder(null, ["closer"])).toBe(false);
  });

  it("valida el rol que viene del token", () => {
    expect(esRolValido("gerente")).toBe(true);
    expect(esRolValido("developer")).toBe(true);
    expect(esRolValido("admin")).toBe(false);
    expect(esRolValido(undefined)).toBe(false);
  });
});

describe("navegacion por rol", () => {
  // La nav recibe el programa ELEGIDO como dato (sale de la URL o del primero visible),
  // no los conoce de antemano: slugs inventados, nunca los reales.
  const PROGRAMA = "programa-a";
  const rutasDe = (rol: Rol, programa: string | null = PROGRAMA, operaComoCloser = false) =>
    navParaRol(sujeto(rol, operaComoCloser), programa).map((i) => i.href);

  it("el closer no ve las rutas de administracion exclusivas de gerente", () => {
    // `/nerd-stats` es la unica ruta exclusiva que queda en la nav (ticket 025).
    expect(rutasDe("closer")).not.toContain("/nerd-stats");
    expect(rutasDe("closer")).toContain("/mi-espacio");
  });

  it("el closer ya no ve Ajustes, Dashboard, Metas ni Programa (ticket 224, ADR 0082)", () => {
    const rutas = rutasDe("closer");
    expect(rutas).not.toContain("/ajustes");
    expect(rutas).not.toContain("/p/programa-a/hub");
    expect(rutas).not.toContain("/p/programa-a/metas");
    expect(rutas).not.toContain("/p/programa-a/programa");
    // Lo que SÍ conserva: su trabajo diario y los recursos.
    expect(rutas).toContain("/mi-espacio");
    expect(rutas).toContain("/p/programa-a/leads");
    expect(rutas).toContain("/p/programa-a/deals");
    expect(rutas).toContain("/recursos");
  });

  it("gerente y developer ven Ajustes; el closer no (ticket 224, ADR 0082)", () => {
    for (const rol of ["gerente", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/ajustes");
    }
    expect(rutasDe("closer")).not.toContain("/ajustes");
  });

  it("gerente y paid trafficker limitados no ven Ajustes; el developer nunca se limita", () => {
    expect(navParaRol(sujeto("gerente"), PROGRAMA, true).map((i) => i.href)).not.toContain("/ajustes");
    expect(navParaRol(sujeto("paid_trafficker"), PROGRAMA, true).map((i) => i.href)).not.toContain("/ajustes");
    expect(navParaRol(sujeto("developer"), PROGRAMA, true).map((i) => i.href)).toContain("/ajustes");
  });

  it("gerente y developer ven la tab Dashboard; el closer no (ticket 224, ADR 0082)", () => {
    for (const rol of ["gerente", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/hub");
    }
    expect(rutasDe("closer")).not.toContain("/p/programa-a/hub");
  });

  it("gerente, developer y paid trafficker ven Programa; el closer no (ticket 266)", () => {
    for (const rol of ["gerente", "developer", "paid_trafficker"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/programa");
    }
    expect(rutasDe("closer")).not.toContain("/p/programa-a/programa");
  });

  it("la tab Dashboard apunta al programa que se le pasa, no a uno fijo", () => {
    expect(rutasDe("gerente", "programa-b")).toContain("/p/programa-b/hub");
    expect(rutasDe("gerente", "programa-b")).not.toContain("/p/programa-a/hub");
  });

  it("los roles operativos ven la tab Calls del programa elegido (ticket 098)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/calls");
    }
  });

  it("los roles operativos ven la tab Leads del programa elegido (ticket 072)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/leads");
    }
  });

  it("los roles operativos ven la tab Students del programa elegido (ticket 099)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/students");
    }
  });

  it("sin programa visible no hay tabs de programa", () => {
    expect(rutasDe("closer", null).some((r) => r.startsWith("/p/"))).toBe(false);
    // El closer ya no ve Ajustes (ticket 224); su respaldo sin programa es Mi espacio.
    expect(rutasDe("closer", null)).toContain("/mi-espacio");
    expect(rutasDe("closer", null)).not.toContain("/ajustes");
  });

  it("la barra ya no lleva un item por programa (ADR 0050)", () => {
    expect(rutasDe("gerente").some((r) => r.startsWith("/programas/"))).toBe(false);
  });

  it("la navegación ya no contiene la pantalla Personas", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).not.toContain("/personas");
    }
  });

  it("ambos roles ven /recursos y ya no /documentos (ticket 023)", () => {
    for (const rol of ["gerente", "closer"] as const) {
      expect(rutasDe(rol)).toContain("/recursos");
      expect(rutasDe(rol)).not.toContain("/documentos");
    }
  });

  it("el gerente aterriza en el Dashboard del primer programa; el closer en Mi espacio (ticket 172)", () => {
    expect(rutaInicial(sujeto("gerente"), "programa-a")).toBe("/p/programa-a/hub");
    expect(rutaInicial(sujeto("closer"), "programa-a")).toBe("/mi-espacio");
  });

  it("un gerente sin programas activos aterriza en ajustes", () => {
    expect(rutaInicial(sujeto("gerente"), null)).toBe("/ajustes");
  });

  it("un closer siempre aterriza en Mi espacio, con o sin programas (ticket 172)", () => {
    expect(rutaInicial(sujeto("closer"), null)).toBe("/mi-espacio");
  });

  it("el developer ve la union de items: mi-espacio, dashboard, recursos y ajustes (ADR 0025)", () => {
    const rutas = rutasDe("developer");
    expect(rutas).toContain("/mi-espacio");
    expect(rutas).toContain("/p/programa-a/hub");
    expect(rutas).not.toContain("/productos");
    expect(rutas).toContain("/recursos");
    expect(rutas).toContain("/ajustes");
  });

  it("el gerente ve Mi espacio (ticket 179): su sección Por decidir, no las del closer", () => {
    expect(rutasDe("gerente")).toContain("/mi-espacio");
  });

  it("el gerente con capacidad conserva su navegación administrativa y Mi espacio de closer", () => {
    const rutas = rutasDe("gerente", PROGRAMA, true);
    expect(rutas).toContain("/mi-espacio");
    expect(rutas).toContain("/ajustes");
    expect(rutas).toContain(`/p/${PROGRAMA}/hub`);
    expect(navParaRol(sujeto("gerente", true), PROGRAMA).find((i) => i.href === "/mi-espacio")?.roles).toEqual(["closer"]);
    expect(rutaInicial(sujeto("gerente", true), PROGRAMA)).toBe(`/p/${PROGRAMA}/hub`);
  });

  it("Nerd Stats es SOLO del developer: ni gerente ni closer lo ven (ticket 025)", () => {
    expect(rutasDe("developer")).toContain("/nerd-stats");
    expect(rutasDe("gerente")).not.toContain("/nerd-stats");
    expect(rutasDe("closer")).not.toContain("/nerd-stats");
  });

  it("el paid trafficker ve Mi espacio, Hub y Programa: ni Ajustes (Canales pasó a Hub › Origen, 248), ni Recursos ni Mi día", () => {
    const rutas = rutasDe("paid_trafficker");
    expect(rutas).toEqual(["/mi-espacio", `/p/${PROGRAMA}/hub`, `/p/${PROGRAMA}/programa`]);
    expect(rutas).not.toContain("/mi-dia");
    expect(rutas).not.toContain("/recursos");
    expect(rutas.filter((r) => r.startsWith("/p/"))).toEqual([`/p/${PROGRAMA}/hub`, `/p/${PROGRAMA}/programa`]);
    // Sin programa visible no hay Dashboard.
    expect(rutasDe("paid_trafficker", null)).toEqual(["/mi-espacio"]);
  });

  it("el paid trafficker aterriza en Mi espacio (ticket 179), ya no en Canales", () => {
    expect(rutaInicial(sujeto("paid_trafficker"), "programa-a")).toBe("/mi-espacio");
    expect(rutaInicial(sujeto("paid_trafficker"), null)).toBe("/mi-espacio");
  });

  it("el customer success ve SOLO Students del programa elegido (ticket 145): ni otras tabs, ni Mi espacio, ni Ajustes", () => {
    const rutas = rutasDe("customer_success");
    expect(rutas).toEqual([`/p/${PROGRAMA}/students`]);
    expect(rutas).not.toContain("/mi-espacio");
    expect(rutas).not.toContain("/ajustes");
    expect(rutas).not.toContain("/recursos");
    expect(rutas).not.toContain(`/p/${PROGRAMA}/hub`);
    expect(rutas).not.toContain(`/p/${PROGRAMA}/deals`);
    // Sin programa visible no tiene ninguna tab.
    expect(rutasDe("customer_success", null)).toEqual([]);
  });

  it("el customer success aterriza en los Students de su primer programa (ticket 145)", () => {
    expect(rutaInicial(sujeto("customer_success"), "programa-a")).toBe("/p/programa-a/students");
    // Sin programa visible va a Mi espacio, que para ese rol muestra el mensaje de "pídele a
    // gerencia un programa" (ticket 145): un destino dentro de la app, no el login.
    expect(rutaInicial(sujeto("customer_success"), null)).toBe("/mi-espacio");
  });

  it("el developer aterriza en el Dashboard del primer programa, como el gerente", () => {
    expect(rutaInicial(sujeto("developer"), "programa-a")).toBe("/p/programa-a/hub");
    // Sin programas activos, cae en ajustes: tiene acceso total de administracion.
    expect(rutaInicial(sujeto("developer"), null)).toBe("/ajustes");
  });
});

describe("el programa en la URL (ticket 097)", () => {
  it("lee el programa de una ruta /p/<slug>/..., y nada de las demas", () => {
    expect(programaDeRuta("/p/programa-a/hub")).toBe("programa-a");
    expect(programaDeRuta("/p/programa-a")).toBe("programa-a");
    expect(programaDeRuta("/p")).toBeNull();
    expect(programaDeRuta("/ajustes/canales/programa-a")).toBeNull();
    expect(programaDeRuta("/programas/programa-a")).toBeNull();
  });

  it("cambiar de programa mantiene la tab y cambia la URL", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/hub", "programa-b")).toBe(
      "/p/programa-b/hub",
    );
  });

  it("mantiene la subpestaña elegida y suelta los filtros del programa anterior", () => {
    expect(
      rutaAlCambiarDePrograma(
        "/p/programa-a/hub",
        "programa-b",
        new URLSearchParams("seccion=dinero&closer=anterior&periodo=mes"),
      ),
    ).toBe("/p/programa-b/hub?seccion=dinero");
    expect(
      rutaAlCambiarDePrograma(
        "/p/programa-a/inbox",
        "programa-b",
        new URLSearchParams("seccion=sin-deal"),
      ),
    ).toBe("/p/programa-b/inbox?seccion=sin-deal");
    expect(
      rutaAlCambiarDePrograma(
        "/p/programa-a/programa",
        "programa-b",
        new URLSearchParams("seccion=equipo"),
      ),
    ).toBe("/p/programa-b/programa?seccion=equipo");
  });

  it("la opción Todos navega a la ruta superior y desde ella un programa abre su dashboard", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/hub", VALOR_PROGRAMA_TODOS)).toBe("/hub");
    expect(rutaAlCambiarDePrograma("/hub", "programa-b")).toBe("/p/programa-b/hub");
  });

  it("mantiene la subpestaña del dashboard al entrar y salir de Todos", () => {
    const query = new URLSearchParams("seccion=pauta&source=meta");
    expect(rutaAlCambiarDePrograma("/p/programa-a/hub", VALOR_PROGRAMA_TODOS, query)).toBe(
      "/hub?seccion=pauta",
    );
    expect(rutaAlCambiarDePrograma("/hub", "programa-b", query)).toBe(
      "/p/programa-b/hub?seccion=pauta",
    );
  });

  it("suelta lo que venga detras de la tab: un id es del programa anterior", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/hub/algo", "programa-b")).toBe(
      "/p/programa-b/hub",
    );
  });

  it("desde una ruta sin programa, o una tab que no existe, entra por la tab por defecto", () => {
    expect(rutaAlCambiarDePrograma("/ajustes", "programa-b")).toBe("/p/programa-b/hub");
    expect(rutaAlCambiarDePrograma("/p/programa-a/inventada", "programa-b")).toBe(
      "/p/programa-b/hub",
    );
  });
});

/**
 * S-03: el callback `session` traducia un token vaciado a rol "closer". La app
 * quedaba segura por el `id` vacio, no por el rol, y cualquier codigo futuro que
 * decidiera sobre `rol` sin mirar antes el `id` habria tratado a un token vaciado
 * como a un closer legitimo.
 */
describe("callback session", () => {
  const sesion = () =>
    ({ user: { id: "x", rol: "closer", operaComoCloser: false, closerId: null }, expires: "" }) as never;

  const llamar = (token: Record<string, unknown>) =>
    // El callback es sincrono y puro; el cast evita armar el union de parametros
    // completo de Auth.js, que no aporta nada a lo que se esta probando.
    (authConfig.callbacks.session as (p: never) => { user: { id: string; rol: string | null } })(
      { session: sesion(), token } as never,
    );

  it("un token vaciado deja el rol nulo, no closer", () => {
    const s = llamar({});
    expect(s.user.rol).toBeNull();
    expect(s.user.id).toBe("");
  });

  it("un rol que no esta en el enum tampoco degrada a closer", () => {
    const s = llamar({ usuarioId: "u1", rol: "admin" });
    expect(s.user.rol).toBeNull();
  });

  it("un token valido conserva su rol", () => {
    const s = llamar({ usuarioId: "u1", rol: "gerente" });
    expect(s.user.rol).toBe("gerente");
    expect(s.user.id).toBe("u1");
  });
});

describe("fallar cerrado sin rol", () => {
  it("no se muestra ningun item de navegacion", () => {
    expect(navParaRol(sujeto(null), null)).toEqual([]);
  });

  it("no hay destino dentro de la app: va al login", () => {
    expect(rutaInicial(sujeto(null), null)).toBe("/login");
  });
});

describe("el Hub reemplaza al Dashboard y a Metas (ticket 250, ADR 0086)", () => {
  it("el menú tiene una sola entrada Hub y ninguna de Dashboard ni Metas", () => {
    for (const rol of ["gerente", "developer", "paid_trafficker"] as const) {
      const items = navParaRol(sujeto(rol), "programa-a");
      expect(items.filter((i) => i.etiqueta === "Hub").map((i) => i.href)).toEqual(["/p/programa-a/hub"]);
      expect(items.some((i) => i.etiqueta === "Dashboard" || i.etiqueta === "Metas")).toBe(false);
    }
  });

  it("una query vieja conserva cada filtro y traduce la pestaña", () => {
    expect(queryHaciaElHub({})).toBe("");
    expect(queryHaciaElHub({ seccion: "pulso", rango: "mes" })).toBe("?seccion=hoy&rango=mes");
    expect(queryHaciaElHub({ seccion: "operacion" })).toBe("?seccion=comercial");
    expect(queryHaciaElHub({ seccion: "pauta", source: ["meta", "google"] })).toBe("?seccion=pauta&source=meta&source=google");
    expect(queryHaciaElHub({ mes: "2026-09", vacio: undefined }, "hoy")).toBe("?mes=2026-09&seccion=hoy");
  });
});

describe("media y trabajaContenido (ADR 0107, ticket 315)", () => {
  const TODOS: Rol[] = ["gerente", "closer", "developer", "paid_trafficker", "customer_success", "media"];

  it("trabajaContenido la cumplen media, gerente y developer; nadie más", () => {
    for (const rol of TODOS) {
      expect(trabajaContenido(rol)).toBe(rol === "media" || rol === "gerente" || rol === "developer");
    }
    expect(trabajaContenido(null)).toBe(false);
    expect(trabajaContenido(undefined)).toBe(false);
  });

  it("media no cumple ninguna otra pregunta", () => {
    expect(esRolValido("media")).toBe(true);
    expect(etiquetaDeRol("media")).toBe("Media");
    expect(trabajaLeads(sujeto("media"))).toBe(false);
    expect(puedeSerMiembro(sujeto("media"))).toBe(false);
    expect(esAdministrador("media")).toBe(false);
    expect(administraGlobal({ rol: "media", alcanceLimitado: false })).toBe(false);
    expect(administraGlobal({ rol: "media", alcanceLimitado: true })).toBe(false);
    expect(manejaPauta("media")).toBe(false);
    expect(manejaPautaGlobal({ rol: "media", alcanceLimitado: false })).toBe(false);
    expect(veEquipoComercial("media")).toBe(false);
    expect(veTableroDelPrograma("media")).toBe(false);
    expect(configuraPrograma("media")).toBe(false);
    expect(leePrograma("media")).toBe(false);
    expect(editaObjetivo("media", true)).toBe(false);
    expect(marcaOnboarding("media")).toBe(false);
    expect(veDetalleTecnico("media")).toBe(false);
  });

  it("media admite alcance configurable (ADR 0094) y solo entra donde se le permite", () => {
    expect(tieneAlcanceConfigurable("media")).toBe(true);
    expect(tieneAlcanceConfigurable("closer")).toBe(false);
    expect(puedeAcceder("media", ["gerente", "closer"])).toBe(false);
    expect(puedeAcceder("media", ["media"])).toBe(true);
    expect(puedeAcceder("developer", ["media"])).toBe(true);
  });

  it("media no puede sumar la capacidad de closer, ni siquiera por configuracion", () => {
    expect(puedeConfigurarOperaComoCloser("media")).toBe(false);
    expect(puedeConfigurarOperaComoCloser("gerente")).toBe(true);
    expect(trabajaLeads({ rol: "media", operaComoCloser: true })).toBe(false); // aunque el dato llegue en true
  });

  it("media aterriza en /media y su menu es solo esa pagina; gerente y developer no cambian", () => {
    expect(rutaInicial(sujeto("media"), "programa-a")).toBe("/media");
    expect(rutaInicial(sujeto("media"), null)).toBe("/media");
    expect(navParaRol(sujeto("media"), "programa-a").map((i) => i.href)).toEqual(["/media"]);
    expect(rutaInicial(sujeto("gerente"), "programa-a")).toBe("/p/programa-a/hub");
    // Quien trabaja contenido sin ser solo media (gerente, developer) tambien la tiene en su menu.
    expect(navParaRol(sujeto("gerente"), "programa-a").map((i) => i.href)).toContain("/media");
    expect(navParaRol(sujeto("developer"), "programa-a").map((i) => i.href)).toContain("/media");
    expect(navParaRol(sujeto("closer"), "programa-a").map((i) => i.href)).not.toContain("/media");
    expect(navParaRol(sujeto("paid_trafficker"), "programa-a").map((i) => i.href)).not.toContain("/media");
  });
});
