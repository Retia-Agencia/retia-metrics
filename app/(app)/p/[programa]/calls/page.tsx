import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { opcionesDeFicha } from "@/lib/queries/ficha-deal";
import {
  LLAMADAS_POR_PAGINA,
  filtroDeLlamadasDesdeUrl,
  llamadasDelPrograma,
  opcionesDeLlamadas,
  ORDENES_LLAMADAS,
  RESULTADOS,
} from "@/lib/queries/llamadas";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { LlamadasPrograma } from "@/components/deals/llamadas-programa";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import { FiltroFecha } from "@/components/filtros/filtro-fecha";
import { Button } from "@/components/ui/button";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { FiltroSelectUrl } from "@/components/filtros/filtro-select-url";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const filtro = await filtroDeLlamadasDesdeUrl(db, programa.id, alcance, query);
  const [llamadas, opciones, opcionesFicha, cohortesSinOrdenar] = await Promise.all([
    llamadasDelPrograma(db, programa.id, alcance, filtro),
    opcionesDeLlamadas(db, programa.id),
    opcionesDeFicha(db, programa.id, null, null),
    listarCohortes(db, programa.id),
  ]);
  const cohortes = cohortesSinOrdenar.sort((a, b) =>
    (b.fechaInicioVentas ?? "").localeCompare(a.fechaInicioVentas ?? ""),
  );
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
  const parametrosGrain = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (clave === "pagina") continue;
    if (Array.isArray(valor)) valor.forEach((item) => parametrosGrain.append(clave, item));
    else if (valor) parametrosGrain.set(clave, valor);
  }
  const queryGrain = parametrosGrain.toString();
  const hrefGrain = `/p/${programa.slug}/calls/grain.csv${queryGrain ? `?${queryGrain}` : ""}`;

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
    {
      tipo: "select",
      nombre: "cohorte",
      etiqueta: "Cohorte",
      todos: "Todas las cohortes",
      opciones: cohortes.map((cohorte) => ({
        value: cohorte.id,
        label: `${cohorte.codigo}${cohorte.estado === "activo" ? " (activa)" : ""}`,
      })),
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
            clavesCompuestas={["fecha", "desde", "hasta", "q"]}
            compuestosPopover={
              <div className="space-y-2">
                <FiltroSelectUrl
                  nombre="fecha"
                  etiqueta="Fecha por"
                  valor={filtro.fecha}
                  porDefecto="llamada"
                  opciones={[
                    { value: "llamada", label: "Llamada" },
                    { value: "agenda", label: "Agendada" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FiltroFecha nombre="desde" etiqueta="Desde" />
                  <FiltroFecha nombre="hasta" etiqueta="Hasta" />
                </div>
              </div>
            }
            compuestoActivo={Boolean(filtro.fecha !== "llamada" || filtro.desde || filtro.hasta)}
            orden={
              <ControlDeOrden
                nombre="orden"
                valor={filtro.orden}
                opciones={ORDENES_LLAMADAS.map((o) => ({ value: o.value, label: o.label }))}
              />
            }
            acciones={
              <Button
                nativeButton={false}
                render={<a href={hrefGrain} download />}
                variant="outline"
                size="sm"
              >
                Descargar Grain (CSV)
              </Button>
            }
          />
        </div>

        <LlamadasPrograma
          llamadas={llamadasDeLaPagina}
          programaSlug={programa.slug}
          motivosReagenda={opcionesFicha.motivos}
          puedeTrabajar={trabajaLeads({ rol, operaComoCloser: session.user.operaComoCloser }) || esAdministrador(rol)}
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
