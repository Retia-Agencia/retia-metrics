import { describe, expect, it } from "vitest";
import { esAdministrador, etiquetaDeRol, manejaPauta, marcaOnboarding, puedeAcceder, esRolValido, puedeSerMiembro, puedeTocarMembresia, trabajaLeads, veEquipoComercial } from "@/lib/auth/roles";
import { VALOR_PROGRAMA_TODOS, navParaRol, programaDeRuta, rutaAlCambiarDePrograma, rutaInicial } from "@/lib/nav";
import { authConfig } from "@/lib/auth/config";

describe("trabajaLeads", () => {
  // Las tres preguntas de la familia son distintas y hay que poder contestarlas
  // distinto. Si alguien "simplifica" esta a `esAdministrador`, un gerente pasaria a
  // tener closer_id y membresias, y eso contradice el ADR 0003.
  it("el closer y el developer trabajan leads; el gerente no", () => {
    expect(trabajaLeads("closer")).toBe(true);
    expect(trabajaLeads("developer")).toBe(true);
    expect(trabajaLeads("gerente")).toBe(false);
  });

  it("sin rol no trabaja leads", () => {
    expect(trabajaLeads(null)).toBe(false);
    expect(trabajaLeads(undefined)).toBe(false);
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
    expect(trabajaLeads("paid_trafficker")).toBe(false);
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
    expect(trabajaLeads("customer_success")).toBe(false);
    expect(manejaPauta("customer_success")).toBe(false);
  });

  it("el rol customer_success es válido (está en ROLES)", () => {
    expect(esRolValido("customer_success")).toBe(true);
  });
});

describe("puedeSerMiembro (ticket 145)", () => {
  // Quién admite una membresía de programa: quien trabaja leads y el customer success.
  it("la cumplen closer, developer y customer_success; el gerente no (administra, no pertenece)", () => {
    expect(puedeSerMiembro("closer")).toBe(true);
    expect(puedeSerMiembro("developer")).toBe(true);
    expect(puedeSerMiembro("customer_success")).toBe(true);
    expect(puedeSerMiembro("gerente")).toBe(false);
    expect(puedeSerMiembro("paid_trafficker")).toBe(false);
    expect(puedeSerMiembro(null)).toBe(false);
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
  const rutasDe = (rol: Parameters<typeof navParaRol>[0], programa: string | null = PROGRAMA) =>
    navParaRol(rol, programa).map((i) => i.href);

  it("el closer no ve las rutas de administracion exclusivas de gerente", () => {
    // `/nerd-stats` es la unica ruta exclusiva que queda en la nav (ticket 025).
    expect(rutasDe("closer")).not.toContain("/nerd-stats");
    expect(rutasDe("closer")).toContain("/mi-espacio");
  });

  it("los tres roles ven /ajustes desde el 20-sep (enmienda del ticket 013)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/ajustes");
    }
  });

  it("los tres roles ven la tab Dashboard del programa elegido (ADR 0050)", () => {
    for (const rol of ["gerente", "closer", "developer"] as const) {
      expect(rutasDe(rol)).toContain("/p/programa-a/dashboard");
    }
  });

  it("la tab Dashboard apunta al programa que se le pasa, no a uno fijo", () => {
    expect(rutasDe("gerente", "programa-b")).toContain("/p/programa-b/dashboard");
    expect(rutasDe("gerente", "programa-b")).not.toContain("/p/programa-a/dashboard");
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
    expect(rutasDe("closer", null)).toContain("/ajustes");
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
    expect(rutaInicial("gerente", "programa-a")).toBe("/p/programa-a/dashboard");
    expect(rutaInicial("closer", "programa-a")).toBe("/mi-espacio");
  });

  it("un gerente sin programas activos aterriza en ajustes", () => {
    expect(rutaInicial("gerente", null)).toBe("/ajustes");
  });

  it("un closer siempre aterriza en Mi espacio, con o sin programas (ticket 172)", () => {
    expect(rutaInicial("closer", null)).toBe("/mi-espacio");
  });

  it("el developer ve la union de items: mi-espacio, dashboard, recursos y ajustes (ADR 0025)", () => {
    const rutas = rutasDe("developer");
    expect(rutas).toContain("/mi-espacio");
    expect(rutas).toContain("/p/programa-a/dashboard");
    expect(rutas).not.toContain("/productos");
    expect(rutas).toContain("/recursos");
    expect(rutas).toContain("/ajustes");
  });

  it("el gerente ve Mi espacio (ticket 179): su sección Por decidir, no las del closer", () => {
    expect(rutasDe("gerente")).toContain("/mi-espacio");
  });

  it("Nerd Stats es SOLO del developer: ni gerente ni closer lo ven (ticket 025)", () => {
    expect(rutasDe("developer")).toContain("/nerd-stats");
    expect(rutasDe("gerente")).not.toContain("/nerd-stats");
    expect(rutasDe("closer")).not.toContain("/nerd-stats");
  });

  it("el paid trafficker ve Mi espacio, el Dashboard y Ajustes (tickets 173, 179, 102): ni otras tabs, ni Recursos ni Mi día", () => {
    const rutas = rutasDe("paid_trafficker");
    expect(rutas).toEqual(["/mi-espacio", `/p/${PROGRAMA}/dashboard`, "/ajustes"]);
    expect(rutas).not.toContain("/mi-dia");
    expect(rutas).not.toContain("/recursos");
    expect(rutas.filter((r) => r.startsWith("/p/"))).toEqual([`/p/${PROGRAMA}/dashboard`]);
    // Sin programa visible no hay Dashboard.
    expect(rutasDe("paid_trafficker", null)).toEqual(["/mi-espacio", "/ajustes"]);
  });

  it("el paid trafficker aterriza en Mi espacio (ticket 179), ya no en Canales", () => {
    expect(rutaInicial("paid_trafficker", "programa-a")).toBe("/mi-espacio");
    expect(rutaInicial("paid_trafficker", null)).toBe("/mi-espacio");
  });

  it("el customer success ve SOLO Students del programa elegido (ticket 145): ni otras tabs, ni Mi espacio, ni Ajustes", () => {
    const rutas = rutasDe("customer_success");
    expect(rutas).toEqual([`/p/${PROGRAMA}/students`]);
    expect(rutas).not.toContain("/mi-espacio");
    expect(rutas).not.toContain("/ajustes");
    expect(rutas).not.toContain("/recursos");
    expect(rutas).not.toContain(`/p/${PROGRAMA}/dashboard`);
    expect(rutas).not.toContain(`/p/${PROGRAMA}/deals`);
    // Sin programa visible no tiene ninguna tab.
    expect(rutasDe("customer_success", null)).toEqual([]);
  });

  it("el customer success aterriza en los Students de su primer programa (ticket 145)", () => {
    expect(rutaInicial("customer_success", "programa-a")).toBe("/p/programa-a/students");
    // Sin programa visible va a Mi espacio, que para ese rol muestra el mensaje de "pídele a
    // gerencia un programa" (ticket 145): un destino dentro de la app, no el login.
    expect(rutaInicial("customer_success", null)).toBe("/mi-espacio");
  });

  it("el developer aterriza en el Dashboard del primer programa, como el gerente", () => {
    expect(rutaInicial("developer", "programa-a")).toBe("/p/programa-a/dashboard");
    // Sin programas activos, cae en ajustes: tiene acceso total de administracion.
    expect(rutaInicial("developer", null)).toBe("/ajustes");
  });
});

describe("el programa en la URL (ticket 097)", () => {
  it("lee el programa de una ruta /p/<slug>/..., y nada de las demas", () => {
    expect(programaDeRuta("/p/programa-a/dashboard")).toBe("programa-a");
    expect(programaDeRuta("/p/programa-a")).toBe("programa-a");
    expect(programaDeRuta("/p")).toBeNull();
    expect(programaDeRuta("/ajustes/canales/programa-a")).toBeNull();
    expect(programaDeRuta("/programas/programa-a")).toBeNull();
  });

  it("cambiar de programa mantiene la tab y cambia la URL", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/dashboard", "programa-b")).toBe(
      "/p/programa-b/dashboard",
    );
  });

  it("mantiene la subpestaña elegida y suelta los filtros del programa anterior", () => {
    expect(
      rutaAlCambiarDePrograma(
        "/p/programa-a/dashboard",
        "programa-b",
        new URLSearchParams("seccion=dinero&closer=anterior&periodo=mes"),
      ),
    ).toBe("/p/programa-b/dashboard?seccion=dinero");
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
    expect(rutaAlCambiarDePrograma("/p/programa-a/dashboard", VALOR_PROGRAMA_TODOS)).toBe("/dashboard");
    expect(rutaAlCambiarDePrograma("/dashboard", "programa-b")).toBe("/p/programa-b/dashboard");
  });

  it("mantiene la subpestaña del dashboard al entrar y salir de Todos", () => {
    const query = new URLSearchParams("seccion=pauta&source=meta");
    expect(rutaAlCambiarDePrograma("/p/programa-a/dashboard", VALOR_PROGRAMA_TODOS, query)).toBe(
      "/dashboard?seccion=pauta",
    );
    expect(rutaAlCambiarDePrograma("/dashboard", "programa-b", query)).toBe(
      "/p/programa-b/dashboard?seccion=pauta",
    );
  });

  it("suelta lo que venga detras de la tab: un id es del programa anterior", () => {
    expect(rutaAlCambiarDePrograma("/p/programa-a/dashboard/algo", "programa-b")).toBe(
      "/p/programa-b/dashboard",
    );
  });

  it("desde una ruta sin programa, o una tab que no existe, entra por la tab por defecto", () => {
    expect(rutaAlCambiarDePrograma("/ajustes", "programa-b")).toBe("/p/programa-b/dashboard");
    expect(rutaAlCambiarDePrograma("/p/programa-a/inventada", "programa-b")).toBe(
      "/p/programa-b/dashboard",
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
    ({ user: { id: "x", rol: "closer", closerId: null }, expires: "" }) as never;

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
    expect(navParaRol(null, null)).toEqual([]);
  });

  it("no hay destino dentro de la app: va al login", () => {
    expect(rutaInicial(null, null)).toBe("/login");
  });
});
