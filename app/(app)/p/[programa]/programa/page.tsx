import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador } from "@/lib/auth/roles";
import { programaDeLaFichaPorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import {
  fichaDelPrograma,
  faltaParaActivar,
  fuentesDelProgramaParaAdmin,
  type CohorteVista,
} from "@/lib/queries/ficha-programa";
import { fecha, num, usd } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion, type GrupoDePestanas } from "@/components/layout/pestanas";
import { CohortesAdmin } from "@/components/cohortes-admin";
import { FuentesAdmin } from "@/components/admin/fuentes-admin";
import { listarUsuarios, membresiasConCalendly } from "@/lib/catalogo/usuarios";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { trabajaLeads } from "@/lib/auth/roles";
import { PlataformasDelPrograma } from "./plataformas-del-programa";
import { ActivarPrograma, EditarPrograma } from "./editar-programa";
import { EquipoDelPrograma } from "./equipo-del-programa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ENLACE =
  "font-medium text-marca-texto underline-offset-2 outline-none transition-colors duration-150 hover:underline focus-visible:underline";

const TONO_DE_COHORTE = { activo: "exito", futuro: "info", cerrado: "neutro" } as const;
const NOMBRE_DE_ESTADO_COHORTE = { activo: "Activa", futuro: "Futura", cerrado: "Cerrada" } as const;

/**
 * La tab Programa (ticket 100, la tab Programs del ADR 0050): la ficha del programa elegido,
 * con todo lo que lo define sin entrar a Ajustes: cohortes, destinos (formulario y checkouts),
 * Calendly, fuentes de leads, comisión y equipo.
 *
 * Alcance (ADR 0048): un closer la ve solo en los programas donde tiene membresía activa; un
 * programa ajeno es 404, igual que uno que no existe. La ficha se LEE; quien administra
 * (`esAdministrador`: gerente o developer) edita las cohortes AQUÍ con el mismo
 * `CohortesAdmin` y las mismas acciones de Ajustes (A-10: las cohortes se encuentran desde el
 * programa). Las plataformas se vinculan aquí para todos los que ven la ficha; la reja de verdad
 * son sus acciones (`requireRole` y alcance del programa), no que el control aparezca.
 *
 * Ningún secreto llega aquí: la ficha dice SI hay token de Calendly y webhook conectado, nunca
 * cuál (ADR 0057); lo garantiza `programaPorId`, que pasa por el mismo `sinToken` del catálogo.
 */
export default async function FichaDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const visible = await programaDeLaFichaPorSlug(session.user.id, rol, slug);
  if (!visible) notFound();

  const ficha = await fichaDelPrograma(visible.id, db);
  if (!ficha) notFound();

  const administra = esAdministrador(rol);
  const query = await searchParams;
  const { programa, cohortes, checkouts, fuentes, equipo, plataformas, plataformasDisponibles } =
    ficha;
  const activa = cohortes.find((c) => c.estado === "activo") ?? null;
  const faltan = faltaParaActivar(programa);
  const programaParaEditar = {
    id: programa.id,
    slug: programa.slug,
    nombre: programa.nombre,
    ticketUsd: programa.ticketUsd,
    comisionPorcentaje: programa.comisionPorcentaje,
    webUrl: null,
    calendlyUrl: programa.calendlyUrl,
    formUrl: programa.formUrl,
    tieneTokenCalendly: programa.tieneTokenCalendly,
    webhookCalendlyConectado: programa.webhookCalendlyConectado,
    diasSinActividad: programa.diasSinActividad,
    activo: programa.activo,
  };

  const [fuentesAdmin, membresias, usuarios, cuentas] = administra
    ? await Promise.all([
        fuentesDelProgramaParaAdmin(programa.id, db),
        membresiasConCalendly(db, programa.id),
        listarUsuarios(db),
        cuentasPorPrograma(db, [programa.id]),
      ])
    : [null, [], [], {}];
  const miembros = new Set(membresias.map((m) => m.userId));
  const elegibles = usuarios
    .filter((usuario) => usuario.activo && trabajaLeads(usuario.rol) && !miembros.has(usuario.id))
    .map(({ id, nombre, email }) => ({ id, nombre, email }));
  const base = `/p/${programa.slug}/programa`;
  const grupos: GrupoDePestanas[] = [
    {
      pestanas: [
        {
          id: "general",
          etiqueta: "General",
          descripcion: "El estado del programa y a dónde llevan sus links.",
          href: urlConSeccion(base, query, "general"),
        },
        {
          id: "equipo",
          etiqueta: "Equipo",
          descripcion: "Quién trabaja este programa y con qué rol.",
          href: urlConSeccion(base, query, "equipo"),
        },
        {
          id: "captacion",
          etiqueta: "Captación",
          descripcion: "Por dónde entran los leads y las citas.",
          href: urlConSeccion(base, query, "captacion"),
        },
        {
          id: "ventas",
          etiqueta: "Ventas",
          descripcion: "Las cohortes que se venden y cómo se cobra.",
          href: urlConSeccion(base, query, "ventas"),
        },
      ],
    },
  ];
  const pestanas = grupos.flatMap((grupo) => grupo.pestanas);
  const seccion = pestanaActiva(uno(query.seccion), pestanas, "general");

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Programa"
      fija
      acciones={
        administra ? (
          <div className="flex items-center gap-2">
            {!programa.activo ? <Badge variant="neutro">Inactivo</Badge> : null}
            <EditarPrograma programa={programaParaEditar} />
          </div>
        ) : null
      }
    >
      <PantallaFija>
        <Pestanas grupos={grupos} activa={seccion} etiqueta="Sección del programa" />

        <div className={clasesDeZonaConScroll()}>
          {seccion === "general" ? (
            <div className="space-y-4">
              {!programa.activo && administra ? (
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-base">Le falta para activarse</CardTitle>
                    <ActivarPrograma id={programa.id} habilitado={faltan.length === 0} />
                  </CardHeader>
                  <CardContent>
                    {faltan.length === 0 ? (
                      <p className="text-sm text-muted-foreground">El programa está listo para activarse.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {faltan.map((item) => (
                          <li key={item.clave} className="flex items-center justify-between gap-3">
                            <span>{item.texto}</span>
                            {item.clave === "fuente_principal" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                nativeButton={false}
                                render={<Link href={urlConSeccion(base, query, "captacion")} />}
                              >
                                Ir a Formularios
                              </Button>
                            ) : (
                              <EditarPrograma programa={programaParaEditar} trigger="Editar" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi etiqueta="Ticket de referencia">
                  <p className="cifra text-2xl font-semibold">{usd(Number(programa.ticketUsd))}</p>
                </Kpi>
                <Kpi etiqueta="Comisión del closer">
                  {programa.comisionPorcentaje == null ? (
                    <Badge variant="alerta">Sin cargar</Badge>
                  ) : (
                    <p className="cifra text-2xl font-semibold">{num(Number(programa.comisionPorcentaje), 2)} %</p>
                  )}
                  <p className="text-xs text-muted-foreground">del valor vendido</p>
                </Kpi>
                <Kpi etiqueta="Cohorte activa">
                  {activa ? (
                    <p className="cifra text-2xl font-semibold">{activa.codigo}</p>
                  ) : (
                    <Badge variant="alerta">Ninguna</Badge>
                  )}
                </Kpi>
                <Kpi etiqueta="Estancado tras">
                  <p className="cifra text-2xl font-semibold">{num(programa.diasSinActividad)}</p>
                  <p className="text-xs text-muted-foreground">días hábiles sin actividad</p>
                </Kpi>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Destinos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Formulario{programa.formulario ? ` (fuente principal: ${programa.formulario.fuente})` : ""}
                    </p>
                    {programa.formulario ? (
                      <a
                        href={programa.formulario.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ENLACE} break-all`}
                      >
                        {programa.formulario.url}
                      </a>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="peligro">Sin fuente principal</Badge>
                        <p className="text-muted-foreground">
                          Ningún formulario está marcado como principal: es el que se usa para generar los links de captación (ADR 0068). Edita el formulario, pega su URL pública y márcalo como principal.
                        </p>
                        <Link href={urlConSeccion(base, query, "captacion")} className={ENLACE}>
                          Ir a Formularios
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {seccion === "equipo" ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">
                    Equipo <span className="cifra text-muted-foreground">· {num(equipo.length)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {administra ? (
                    <EquipoDelPrograma
                      programa={{ id: programa.id, nombre: programa.nombre }}
                      membresias={membresias}
                      elegibles={elegibles}
                      cuentas={cuentas}
                    />
                  ) : equipo.length === 0 ? (
                    <p className="text-muted-foreground">
                      Nadie tiene membresía activa en este programa. Quien administra la asigna en Equipo.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {equipo.map((m) => (
                        <li key={m.membresiaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.nombre}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          </div>
                          {m.calendlyEmail ? (
                            <span className="truncate text-xs text-muted-foreground">Calendly: {m.calendlyEmail}</span>
                          ) : (
                            <Badge variant="alerta">Sin cuenta de Calendly</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {seccion === "captacion" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {administra && fuentesAdmin ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Formularios</CardTitle>
                  </CardHeader>
                  <CardContent className="md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                    <FuentesAdmin programas={[fuentesAdmin]} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">Fuentes de leads</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                    {fuentes.length === 0 ? (
                      <p className="text-muted-foreground">
                        Este programa no tiene fuentes de leads: ningún formulario le está entregando envíos.
                        Quien administra la crea en Formularios.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {fuentes.map((f) => (
                          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{f.nombre}</p>
                              <p className="text-xs text-muted-foreground">{f.proveedor ?? f.tipo}</p>
                            </div>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {f.activo ? <Badge variant="exito">Activa</Badge> : <Badge variant="neutro">Inactiva</Badge>}
                              {f.activo && f.estado === "rota" ? <Badge variant="peligro">Rota</Badge> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calendly</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {programa.tieneTokenCalendly ? (
                      <Badge variant="exito">Token cargado</Badge>
                    ) : (
                      <Badge variant="peligro">Sin token</Badge>
                    )}
                    {programa.webhookCalendlyConectado ? (
                      <Badge variant="exito">Webhook conectado</Badge>
                    ) : (
                      <Badge variant="alerta">Webhook sin conectar</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {programa.tieneTokenCalendly
                      ? programa.webhookCalendlyConectado
                        ? "Las citas de Calendly llegan solas y se cuelgan del deal cuando no hay duda."
                        : "Hay token, pero el webhook no está conectado: las citas nuevas no llegan solas."
                      : "Sin token no se puede leer la fecha de una cita ni conectar el webhook."}
                  </p>
                  {programa.calendlyUrl ? (
                    <a href={programa.calendlyUrl} target="_blank" rel="noreferrer" className={`${ENLACE} break-all`}>
                      {programa.calendlyUrl}
                    </a>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    La cuenta de Calendly de cada closer en este programa está en Equipo.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {seccion === "ventas" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cohortes</CardTitle>
                </CardHeader>
                <CardContent className="md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                  {administra ? (
                    <CohortesAdmin
                      slug={programa.slug}
                      programId={programa.id}
                      ticketUsd={programa.ticketUsd}
                      cohortes={cohortes}
                    />
                  ) : (
                    <ListaDeCohortes cohortes={cohortes} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plataformas de pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <PlataformasDelPrograma
                    programId={programa.id}
                    plataformas={plataformas}
                    disponibles={plataformasDisponibles}
                    enlaces={checkouts.map((c) => ({
                      id: c.id,
                      url: c.url,
                      monto: c.monto,
                      moneda: c.moneda,
                      plataformaId: c.plataformaId,
                    }))}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </PantallaFija>
    </PageShell>
  );
}

function Kpi({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        {children}
      </CardContent>
    </Card>
  );
}

/** Las cohortes en solo lectura, para quien no administra. */
function ListaDeCohortes({ cohortes }: { cohortes: CohorteVista[] }) {
  if (cohortes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este programa todavía no tiene cohortes. Quien administra las crea aquí mismo.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border text-sm">
      {cohortes.map((c) => (
        <li key={c.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.codigo}</span>
              <Badge variant={TONO_DE_COHORTE[c.estado]}>{NOMBRE_DE_ESTADO_COHORTE[c.estado]}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              Ventas {c.fechaInicioVentas ? `del ${fecha(c.fechaInicioVentas)} ` : ""}al {fecha(c.fechaCierreVentas)} · clases
              desde el {fecha(c.fechaInicioClases)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta <span className="cifra text-foreground">{num(c.metaCupos)}</span> cupos
            {c.metaLeadsDia != null ? (
              <>
                {" "}· <span className="cifra text-foreground">{num(c.metaLeadsDia)}</span> leads por día
              </>
            ) : null}{" "}
            · precio <span className="cifra text-foreground">{usd(Number(c.precioUsd))}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
