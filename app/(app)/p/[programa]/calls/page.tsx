import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { opcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  LLAMADAS_POR_PAGINA,
  llamadasDelPrograma,
  opcionesDeLlamadas,
  ORDENES_LLAMADAS,
  ORDEN_LLAMADAS_POR_DEFECTO,
  type FiltroLlamadas,
  type OrdenLlamadas,
} from "@/lib/queries/llamadas";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { LlamadasPrograma } from "@/components/deals/llamadas-programa";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import { FiltroFecha } from "@/components/filtros/filtro-fecha";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const RESULTADOS = [
  ["agendada", "Agendada"],
  ["show", "Show"],
  ["no_show", "No show"],
  ["cancelada", "Cancelada"],
  ["reagendada", "Reagendada"],
  ["compromiso_pago", "Compromiso de pago"],
  ["cerrada", "Cerrada"],
  ["perdida", "Perdida"],
] as const;

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CallsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const alcance = await alcanceDeDeals(session);
  const query = await searchParams;
  const pagina = Math.max(0, Number.parseInt(uno(query.pagina) ?? "0", 10) || 0);
  const resultado = uno(query.resultado);
  // El orden sale de la URL (`?orden=`), validado con zod contra las opciones; cualquier
  // valor desconocido cae al de por defecto (el de siempre, "Llamada: más reciente").
  const ordenValues = ORDENES_LLAMADAS.map((o) => o.value) as [OrdenLlamadas, ...OrdenLlamadas[]];
  const orden: OrdenLlamadas = z
    .enum(ordenValues)
    .catch(ORDEN_LLAMADAS_POR_DEFECTO)
    .parse(uno(query.orden));
  // La búsqueda: `leadsQueCasan` devuelve `null` con texto corto (no filtra) o el conjunto
  // de leads del programa que casan. El programa es frontera: la consulta ya recibe su id.
  const textoBusqueda = uno(query.q) ?? "";
  const leadsCasan = await leadsQueCasan(db, programa.id, textoBusqueda);
  const filtro: FiltroLlamadas = {
    closerUserId: alcance.tipo === "todos" ? uno(query.closer) || null : null,
    resultado: RESULTADOS.some(([value]) => value === resultado)
      ? (resultado as FiltroLlamadas["resultado"])
      : null,
    desde: uno(query.desde) || null,
    hasta: uno(query.hasta) || null,
    leadsCasan,
    orden,
  };
  const [llamadas, opciones, opcionesFicha] = await Promise.all([
    llamadasDelPrograma(db, programa.id, alcance, filtro),
    opcionesDeLlamadas(db, programa.id),
    opcionesDeFicha(db, programa.id, null, null),
  ]);
  const paginas = Math.max(1, Math.ceil(llamadas.length / LLAMADAS_POR_PAGINA));
  const llamadasDeLaPagina = llamadas.slice(
    pagina * LLAMADAS_POR_PAGINA,
    (pagina + 1) * LLAMADAS_POR_PAGINA,
  );
  const conPagina = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, valor] of Object.entries(query)) {
      if (k === "pagina") continue;
      if (Array.isArray(valor)) valor.forEach((v) => u.append(k, v));
      else if (valor) u.set(k, valor);
    }
    if (p > 0) u.set("pagina", String(p));
    const s = u.toString();
    return `/p/${programa.slug}/calls${s ? `?${s}` : ""}`;
  };

  // Los filtros declarados de Calls (ticket 202): Closer (solo cuando la sesión ve a
  // todos) y Resultado van a la vista; Desde/Hasta son un rango compuesto en el popover.
  // La visibilidad de Closer sale de lo que ya decide la página (`alcance`), no de un
  // `rol === "..."` a mano.
  const filtrosCalls: FiltroDeclarado[] = [
    ...(alcance.tipo === "todos"
      ? [
          {
            tipo: "select" as const,
            nombre: "closer",
            etiqueta: "Closer",
            opciones: opciones.closers.map((closer) => ({ value: closer.id, label: closer.nombre })),
          },
        ]
      : []),
    {
      tipo: "select",
      nombre: "resultado",
      etiqueta: "Resultado",
      opciones: RESULTADOS.map(([value, label]) => ({ value, label })),
    },
  ];

  return (
    <PageShell titulo={programa.nombre} descripcion="Calls" fija>
      <PantallaFija>
        <div className="shrink-0">
          <BarraDeLista
            total={llamadas.length}
            sustantivo={{ singular: "llamada", plural: "llamadas" }}
            filtros={filtrosCalls}
            buscador={<BuscadorUrl />}
            clavesCompuestas={["desde", "hasta", "q"]}
            compuestosPopover={
              <div className="grid grid-cols-2 gap-2">
                <FiltroFecha nombre="desde" etiqueta="Desde" />
                <FiltroFecha nombre="hasta" etiqueta="Hasta" />
              </div>
            }
            compuestoActivo={Boolean(filtro.desde || filtro.hasta)}
            orden={
              <ControlDeOrden
                nombre="orden"
                valor={orden}
                opciones={ORDENES_LLAMADAS.map((o) => ({ value: o.value, label: o.label }))}
              />
            }
          />
        </div>

        <LlamadasPrograma
          llamadas={llamadasDeLaPagina}
          programaSlug={programa.slug}
          motivosReagenda={opcionesFicha.motivos}
          puedeTrabajar={trabajaLeads(rol) || esAdministrador(rol)}
          origen={origenDeLaPagina(`/p/${programa.slug}/calls`, query)}
          paginacion={{
            pagina,
            paginas,
            anteriorHref: pagina > 0 ? conPagina(pagina - 1) : null,
            siguienteHref: pagina + 1 < paginas ? conPagina(pagina + 1) : null,
          }}
        />
      </PantallaFija>
    </PageShell>
  );
}
