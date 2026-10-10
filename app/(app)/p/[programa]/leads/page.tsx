import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutList, Table2 } from "lucide-react";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import {
  CALIDADES_DE_LEAD,
  CAMPOS_DE_FECHA_DE_LEAD,
  DUPLICADOS_POR_PAGINA,
  LEADS_POR_PAGINA,
  leadsDelPrograma,
  posiblesDuplicadosDelPrograma,
  preguntasDisponiblesDelPrograma,
  respuestasDelUltimoEnvio,
  type FiltroLeads,
} from "@/lib/queries/leads";
import { fecha, fechaDeInstanteEnBogota, hoyEnBogota, num } from "@/lib/format";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { filtroDeFechaDeLaUrl } from "@/lib/periodo";
import { FiltroFechaLista } from "@/components/filtro-fecha-lista";
import { CLAVES_DE_FECHA_LISTA } from "@/components/filtro-fecha-lista";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { OPCIONES_DE_ORDEN, type FiltroDeclarado } from "@/components/filtros/declaracion";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas } from "@/components/layout/pestanas";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Card, CardContent } from "@/components/ui/card";
import { PosiblesDuplicados } from "@/components/leads/posibles-duplicados";
import { BuscadorDeLeads } from "@/components/leads/buscador-de-leads";
import { ListaLeads, type FilaLeadVista } from "@/components/leads/lista-leads";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Las opciones del filtro de calidad (ADR 0069): lo que manda el formulario y la cubeta vacía. */
const CALIDADES = [
  { valor: "high", etiqueta: "High" },
  { valor: "mid", etiqueta: "Mid" },
  { valor: "low", etiqueta: "Low" },
  { valor: "sin_calidad", etiqueta: "Sin calidad" },
] as const satisfies readonly { valor: (typeof CALIDADES_DE_LEAD)[number]; etiqueta: string }[];

/** Las fechas que filtra la base de leads (ticket 141). */
const CAMPOS = [
  { valor: "creado", etiqueta: "Creado" },
  { valor: "ultimo_envio", etiqueta: "Último envío" },
] as const satisfies readonly { valor: (typeof CAMPOS_DE_FECHA_DE_LEAD)[number]; etiqueta: string }[];

const ordenSchema = z.object({
  campo: z.enum(["actividad", "creado", "nombre"]),
  sentido: z.enum(["asc", "desc"]),
});

/**
 * La tab Leads (ticket 072, ADR 0050): la base del programa, sobre todo lo que existe y todavía no
 * es una oportunidad. Filtros por hecho (deal, calidad, abandonó el formulario, posible duplicado,
 * fechas) y la lista de posibles duplicados con confirmar o separar.
 *
 * Los filtros y la vista viajan en la URL; el texto de búsqueda no, porque puede contener datos
 * personales (AGENTS.md). El alcance es el de Deals (ADR 0048).
 */
export default async function LeadsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const q = await searchParams;
  const deal = uno(q.deal);
  const calidad = CALIDADES_DE_LEAD.find((c) => c === uno(q.calidad)) ?? null;
  const filtroDeFecha = filtroDeFechaDeLaUrl(q, CAMPOS_DE_FECHA_DE_LEAD, hoyEnBogota());
  const ordenLeido = ordenSchema.safeParse({ campo: uno(q.orden), sentido: uno(q.sentido) });
  const orden = ordenLeido.success ? ordenLeido.data : { campo: "actividad", sentido: "desc" } as const;
  const pagina = Math.max(0, Number.parseInt(uno(q.pagina) ?? "0", 10) || 0);
  const paginaDup = Math.max(0, Number.parseInt(uno(q.pdup) ?? "0", 10) || 0);
  const vista = uno(q.vista) === "tabla" ? "tabla" : "tarjetas";
  const seccion = uno(q.seccion) === "duplicados" ? "duplicados" : "leads";
  const filtro: FiltroLeads = {
    deal: deal === "con" || deal === "sin" ? deal : null,
    calidad,
    abandono: uno(q.abandono) === "1",
    duplicado: uno(q.duplicado) === "1",
    fecha: filtroDeFecha ? { campo: filtroDeFecha.campo, rango: filtroDeFecha.periodo.a } : null,
    orden,
    pagina,
  };
  // El closer ve solo los duplicados de SUS deals (186); quien administra, los del programa.
  const administra = esAdministrador(rol);
  const [{ total, filas }, duplicados, preguntasFormulario] = await Promise.all([
    leadsDelPrograma(db, programa.id, filtro),
    posiblesDuplicadosDelPrograma(db, programa.id, {
      duenoUserId: administra ? undefined : session.user.id,
      pagina: paginaDup,
    }),
    preguntasDisponiblesDelPrograma(db, programa.id),
  ]);
  // Las respuestas del último envío, SOLO para los leads de esta página (ticket 209).
  const respuestasPorLead = Object.fromEntries(
    await respuestasDelUltimoEnvio(db, programa.id, filas.map((f) => f.id)),
  );

  const paginas = Math.max(1, Math.ceil(total / LEADS_POR_PAGINA));
  const paginasDup = Math.max(1, Math.ceil(duplicados.total / DUPLICADOS_POR_PAGINA));
  // El origen de ESTA lista (con sus filtros y pagina): lo heredan los enlaces al detalle,
  // para que "Volver" devuelva a la lista tal como estaba (ticket 174).
  const origen = origenDeLaPagina(`/p/${programa.slug}/leads`, q);
  const urlCon = (cambios: Record<string, string | null>) => {
    const u = new URLSearchParams();
    for (const [k, valor] of Object.entries(q)) {
      if (k in cambios) continue;
      if (Array.isArray(valor)) valor.forEach((v) => u.append(k, v));
      else if (valor) u.set(k, valor);
    }
    for (const [k, valor] of Object.entries(cambios)) if (valor) u.set(k, valor);
    const s = u.toString();
    return `/p/${programa.slug}/leads${s ? `?${s}` : ""}`;
  };
  const conPagina = (p: number) => {
    return urlCon({ pagina: p > 0 ? String(p) : null });
  };
  // Las filas, ya resueltas para la isla cliente (ticket 209): el nombre de etapa y las fechas se
  // formatean aquí porque `NOMBRE_DE_ETAPA` vive en un módulo que carga `lib/db` y no puede entrar
  // al bundle del cliente (AGENTS.md).
  const filasVista: FilaLeadVista[] = filas.map((f) => ({
    id: f.id,
    href: enlaceConVuelta(`/p/${programa.slug}/leads/${f.id}`, origen),
    nombre: f.nombre,
    email: f.email,
    telefono: f.telefono,
    leadQuality: f.leadQuality,
    leadValue: f.leadValue,
    tieneDeal: f.tieneDeal,
    soloParciales: f.soloParciales,
    correosSinConfirmar: f.correosSinConfirmar,
    etapaNombre: f.etapa ? NOMBRE_DE_ETAPA[f.etapa] : null,
    canal: f.canal,
    fechaTexto: f.fechaUltimaAplicacion ? fecha(fechaDeInstanteEnBogota(f.fechaUltimaAplicacion)) : null,
    aplicacionesTexto: num(f.numAplicaciones),
    numAplicaciones: f.numAplicaciones,
  }));
  // Los filtros declarados de Leads (ticket 202): el Deal va a la vista; Calidad,
  // Abandonó y Posible duplicado al popover "Filtros · n". La fecha es un compuesto
  // (campo + periodo) que la barra ubica a la vista. Los nombres de los parámetros NO
  // cambian (regla 5): un enlace viejo con `?deal=con&calidad=high` sigue filtrando.
  const filtrosLeads: FiltroDeclarado[] = [
    {
      tipo: "select",
      nombre: "deal",
      etiqueta: "Deal",
      opciones: [
        { value: "sin", label: "Sin deal" },
        { value: "con", label: "Con deal" },
      ],
    },
    {
      tipo: "select",
      nombre: "calidad",
      etiqueta: "Calidad",
      todos: "Todas",
      opciones: CALIDADES.map((c) => ({ value: c.valor, label: c.etiqueta })),
    },
    {
      tipo: "select",
      nombre: "abandono",
      etiqueta: "Abandonó el formulario",
      todos: "No",
      opciones: [{ value: "1", label: "Sí" }],
    },
    {
      tipo: "select",
      nombre: "duplicado",
      etiqueta: "Posible duplicado",
      todos: "No",
      opciones: [{ value: "1", label: "Sí" }],
    },
  ];
  const vistaToggle = (
    <div className="inline-flex rounded-full border bg-muted p-0.5 text-xs" role="group" aria-label="Vista de leads">
      <Link
        href={urlCon({ vista: null, pagina: null })}
        aria-current={vista === "tarjetas" ? "page" : undefined}
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${vista === "tarjetas" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
      >
        <LayoutList aria-hidden className="size-3.5" /> Tarjetas
      </Link>
      <Link
        href={urlCon({ vista: "tabla", pagina: null })}
        aria-current={vista === "tabla" ? "page" : undefined}
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${vista === "tabla" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
      >
        <Table2 aria-hidden className="size-3.5" /> Tabla
      </Link>
    </div>
  );
  return (
    <PageShell titulo={programa.nombre} descripcion="Leads" fija>
      <PantallaFija>
        <div className="shrink-0">
          <BarraDeLista
            total={total}
            sustantivo={{ singular: "lead", plural: "leads" }}
            filtros={filtrosLeads}
            buscador={<BuscadorDeLeads programaSlug={programa.slug} origen={origen} />}
            compuestosPopover={<FiltroFechaLista campos={CAMPOS} filtro={filtroDeFecha} />}
            clavesCompuestas={CLAVES_DE_FECHA_LISTA}
            compuestoActivo={filtroDeFecha != null}
            orden={
              <ControlDeOrden
                nombre="orden"
                sentido="sentido"
                valor={`${orden.campo}:${orden.sentido}`}
                opciones={OPCIONES_DE_ORDEN}
              />
            }
            acciones={seccion === "leads" ? vistaToggle : null}
          />
        </div>

        <Pestanas
          activa={seccion}
          etiqueta="Sección de leads"
          grupos={[{
            pestanas: [
              {
                id: "leads",
                etiqueta: "Leads",
                total,
                descripcion: "Todas las personas que llegaron por el formulario o se crearon a mano.",
                href: urlCon({ seccion: null, pagina: null, pdup: null }),
              },
              {
                id: "duplicados",
                etiqueta: "Posibles duplicados",
                total: duplicados.total,
                descripcion: "Personas que podrían ser la misma. Confirma si lo son o sepáralas.",
                href: urlCon({ seccion: "duplicados", pagina: null, pdup: null }),
              },
            ],
          }]}
        />

        {seccion === "leads" ? (
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <div className={clasesDeZonaConScroll("overflow-x-auto")}>
                <ListaLeads
                  vista={vista}
                  filas={filasVista}
                  preguntas={preguntasFormulario}
                  respuestasPorLead={respuestasPorLead}
                  userId={session.user.id}
                  programId={programa.id}
                />
              </div>
              {paginas > 1 ? (
                <nav className="flex shrink-0 items-center justify-between pt-3 text-sm" aria-label="Páginas">
                {pagina > 0 ? (
                  <Link href={conPagina(pagina - 1)} className="text-marca-texto underline-offset-2 hover:underline">
                    Anterior
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  Página <span className="cifra">{num(pagina + 1)}</span> de <span className="cifra">{num(paginas)}</span>
                </span>
                {pagina + 1 < paginas ? (
                  <Link href={conPagina(pagina + 1)} className="text-marca-texto underline-offset-2 hover:underline">
                    Siguiente
                  </Link>
                ) : (
                  <span />
                )}
                </nav>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className={clasesDeZonaConScroll()}>
            <PosiblesDuplicados
          filas={duplicados.filas.map((d) => ({
            contactoId: d.contactoId,
            leadId: d.leadId,
            nombreLead: d.nombreLead,
            correoPrincipal: d.correoPrincipal,
            correoSinConfirmar: d.correoSinConfirmar,
            telefonoEnComun: d.telefonoEnComun,
            puedeGestionar: administra || d.duenoUserId === session.user.id,
          }))}
          total={duplicados.total}
          slug={programa.slug}
          origen={origen}
          paginacion={{
            pagina: paginaDup,
            paginas: paginasDup,
            anteriorHref: paginaDup > 0 ? urlCon({ pdup: paginaDup > 1 ? String(paginaDup - 1) : null }) : null,
            siguienteHref: paginaDup + 1 < paginasDup ? urlCon({ pdup: String(paginaDup + 1) }) : null,
          }}
            />
          </div>
        )}
      </PantallaFija>
    </PageShell>
  );
}
