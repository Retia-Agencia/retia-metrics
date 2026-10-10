import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { studentsDelPrograma, type FiltroStudents, ORDENES_STUDENTS, ORDEN_STUDENTS_POR_DEFECTO, type OrdenStudents } from "@/lib/queries/estudiantes";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import { totalesDeStudents } from "@/lib/queries/estudiantes-totales";
import { fecha, fechaDeInstanteEnBogota, monto, num, saldoLegible } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { OnboardingCelda } from "@/components/deals/onboarding-celda";
import { puedeMarcarOnboarding } from "@/lib/deals/permiso";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * La tab Students (ticket 099): reemplaza las pestañas `Estudiantes <cohorte>` de las hojas.
 * Un estudiante es un deal vigente en Ganado Pago Parcial o Ganado Pagado Completo (ticket 063); la cohorte define la
 * lista (Mani, 24-sep), y por defecto se ve la activa.
 *
 * Solo muestra y filtra: el onboarding se marca y la cohorte se cambia en la ficha del deal,
 * donde ya viven esas acciones con su reja (dueño o administrador). El alcance es el de Deals
 * (ADR 0048): un programa fuera del alcance de la sesión es 404.
 *
 * El customer success (ticket 145) entra aquí —y SOLO aquí— con las mismas columnas que ve un
 * closer, en los programas donde tiene membresía activa. Su única acción es marcar/desmarcar el
 * onboarding desde la celda (`OnboardingCelda`), que el servidor concede por `marcaOnboarding`;
 * las demás acciones de la ficha del deal le siguen cerradas, y para él las celdas no enlazan a
 * la ficha (que rechaza su rol): van como texto plano.
 */
export default async function StudentsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer", "customer_success");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  // ¿La fila abre la ficha del deal? La ficha es de quien trabaja leads o administra; el
  // customer success NO entra ahí (la ficha rechaza su rol), así que para él las celdas se
  // pintan como texto plano, nunca como enlaces a una pantalla que lo rechazaría. Por
  // capacidad (ADR 0025), nunca `rol === "..."`.
  const abreFicha = trabajaLeads(rol) || esAdministrador(rol);

  const query = await searchParams;
  const cohortes = (await listarCohortes(db, programa.id)).sort((a, b) =>
    (b.fechaInicioVentas ?? "").localeCompare(a.fechaInicioVentas ?? ""),
  );
  const activa = cohortes.find((c) => c.estado === "activo") ?? null;
  const cohortePedida = uno(query.cohorte);
  // Una cohorte que no es de este programa no filtra nada raro: vuelve a la de por defecto.
  const cohorte =
    cohortePedida === "todas" ? null : (cohortes.find((c) => c.id === cohortePedida) ?? activa);
  const onboardedPedido = uno(query.onboarding);
  // El orden sale de la URL (`?orden=`); un valor desconocido cae al de por defecto.
  const ordenPedido = uno(query.orden);
  const orden: OrdenStudents = ORDENES_STUDENTS.some((o) => o.value === ordenPedido)
    ? (ordenPedido as OrdenStudents)
    : ORDEN_STUDENTS_POR_DEFECTO;
  // La búsqueda: `leadsQueCasan` devuelve `null` con texto corto (no filtra) o el conjunto
  // de leads del programa que casan. El programa es frontera: la consulta ya recibe su id.
  const leadsCasan = await leadsQueCasan(db, programa.id, uno(query.q) ?? "");
  const filtro: FiltroStudents = {
    cohortId: cohorte?.id ?? null,
    onboarded: onboardedPedido === "si" || onboardedPedido === "no" ? onboardedPedido : null,
    leadsCasan,
    orden,
  };
  const filas = await studentsDelPrograma(db, programa.id, filtro);
  const totales = totalesDeStudents(filas);

  // El origen de ESTA lista para los enlaces al detalle (ticket 174).
  const origen = origenDeLaPagina(`/p/${programa.slug}/students`, query);

  const completos = filas.filter((f) => f.etapa === "ganado_completo").length;
  const sinOnboarding = filas.filter((f) => f.onboardedAt == null).length;
  const vencidos = filas.filter((f) => f.vencido != null).length;
  // Los filtros declarados de Students (ticket 202): Cohorte a la vista, Onboarding en el
  // popover. El resumen (completos, sin onboarding, cartera vencida) va a la línea de
  // estado cuando no hay filtros activos.
  const filtrosStudents: FiltroDeclarado[] = [
    {
      tipo: "select",
      nombre: "cohorte",
      etiqueta: "Cohorte",
      todos: "Todas las cohortes",
      valorTodos: "todas",
      porDefecto: activa
        ? { valor: activa.id, etiqueta: `${activa.codigo} (activa)`, valorTodos: "todas" }
        : undefined,
      opciones: cohortes.map((c) => ({ value: c.id, label: `${c.codigo}${c.estado === "activo" ? " (activa)" : ""}` })),
    },
    {
      tipo: "select",
      nombre: "onboarding",
      etiqueta: "Onboarding",
      opciones: [
        { value: "no", label: "Sin onboarding" },
        { value: "si", label: "Con onboarding" },
      ],
    },
  ];
  const resumen = (
    <>
      <span>Completos <span className="cifra font-semibold text-foreground">{num(completos)}</span></span>
      <span>Sin onboarding <span className="cifra font-semibold text-foreground">{num(sinOnboarding)}</span></span>
      <span>En cartera vencida <span className="cifra font-semibold text-foreground">{num(vencidos)}</span></span>
    </>
  );
  return (
    <PageShell titulo={programa.nombre} descripcion="Students" fija>
      <PantallaFija>
        <div className="shrink-0">
          <BarraDeLista
            total={filas.length}
            sustantivo={{ singular: "estudiante", plural: "estudiantes" }}
            filtros={filtrosStudents}
            buscador={<BuscadorUrl />}
            clavesCompuestas={["q"]}
            orden={
              <ControlDeOrden
                nombre="orden"
                valor={orden}
                opciones={ORDENES_STUDENTS.map((o) => ({ value: o.value, label: o.label }))}
              />
            }
            resumen={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">{resumen}</span>}
          />
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="shrink-0">
            <CardTitle className="text-base">
              {cohorte ? `Cohorte ${cohorte.codigo}` : "Todas las cohortes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            {filas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {cohortes.length === 0
                  ? "Este programa no tiene cohortes todavía. Créalas en Ajustes → Programas y cohortes."
                  : "No hay estudiantes con estos filtros. Un deal aparece aquí cuando entra en Ganado Pago Parcial o Ganado Pagado Completo."}
              </p>
            ) : (
              <table className="min-w-[72rem] w-full border-collapse whitespace-nowrap text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-1.5 font-medium">Nombre</th>
                    <th className="px-2 py-1.5 font-medium">Etapa</th>
                    {!cohorte ? <th className="px-2 py-1.5 font-medium">Cohorte</th> : null}
                    <th className="px-2 py-1.5 font-medium">Onboarding</th>
                    <th className="px-2 py-1.5 font-medium">Closer</th>
                    <th className="px-2 py-1.5 font-medium">Saldo</th>
                    <th className="px-2 py-1.5 font-medium">Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                {filas.map((f) => {
                  const saldo = saldoLegible(
                    f.saldo?.saldo ?? null,
                    f.saldo?.moneda ?? "USD",
                    f.saldo?.sinSaldoPorque,
                  );
                  const href = enlaceConVuelta(`/p/${programa.slug}/deals/${f.dealId}`, origen);
                  return (
                    <tr key={f.dealId} className={abreFicha ? "cursor-pointer border-b hover:bg-muted/50" : "border-b hover:bg-muted/50"}>
                      <td>
                        <CeldaDeal abreFicha={abreFicha} href={href} extra="font-medium text-marca-texto" title={f.email} enfocable>
                          {f.nombre ?? f.email}
                        </CeldaDeal>
                      </td>
                      <td>
                        <CeldaDeal abreFicha={abreFicha} href={href}>
                          <Badge variant={TONO_DE_ETAPA[f.etapa]}>{NOMBRE_DE_ETAPA[f.etapa]}</Badge>
                        </CeldaDeal>
                      </td>
                      {!cohorte ? (
                        <td>
                          <CeldaDeal abreFicha={abreFicha} href={href}>{f.codigoCohorte ?? "Sin cohorte"}</CeldaDeal>
                        </td>
                      ) : null}
                      {/* Onboarding: el toggle es la ÚNICA acción del customer success (ticket
                          145). La página proyecta por fila el mismo permiso del servidor. No va
                          dentro del Link: tiene sus propios botones. */}
                      <td className="px-2 py-1.5">
                        <OnboardingCelda
                          dealId={f.dealId}
                          fechaOnboarding={f.onboardedAt ? fecha(fechaDeInstanteEnBogota(f.onboardedAt)) : null}
                          puedeMarcar={puedeMarcarOnboarding(
                            { userId: session.user.id, rol },
                            { ownerUserId: f.ownerUserId },
                            true,
                          )}
                        />
                      </td>
                      <td>
                        <CeldaDeal abreFicha={abreFicha} href={href}>{f.ownerNombre ?? (f.ownerUserId ? "Closer sin nombre" : "Sin dueño")}</CeldaDeal>
                      </td>
                      <td>
                        {/* Sin valor vendido el saldo es texto, no una cifra: con `cifra` se lee como un número roto (A-17). */}
                        <CeldaDeal
                          abreFicha={abreFicha}
                          href={href}
                          extra={f.saldo?.saldo != null ? "cifra" : "text-muted-foreground"}
                          title={saldo.etiqueta}
                        >
                          {saldo.valor}
                        </CeldaDeal>
                      </td>
                      <td title={f.acuerdoPago ?? undefined}>
                        <CeldaDeal abreFicha={abreFicha} href={href}>
                          {f.vencido ? (
                            <Badge variant="peligro">
                              Vencida el <span className="cifra">{fecha(f.vencido.fechaLimite)}</span> · <span className="cifra">{num(f.vencido.diasDeAtraso)}</span> días
                            </Badge>
                          ) : f.fechaLimitePago && f.etapa !== "ganado_completo" ? (
                            <span className="text-xs text-muted-foreground">
                              Límite <span className="cifra">{fecha(f.fechaLimitePago)}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </CeldaDeal>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </CardContent>
          {filas.length > 0 ? (
            <CardFooter className="sticky bottom-0 z-10 shrink-0 flex-col items-stretch gap-1 bg-card text-xs text-muted-foreground">
              {totales.porMoneda.map((total) => (
                <div key={total.moneda} className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1">
                  <span>
                    Recaudado{" "}
                    <span className="cifra font-semibold text-foreground">
                      {monto(total.recaudado, total.moneda)}
                    </span>
                  </span>
                  <span>
                    Por cobrar{" "}
                    <span className="cifra font-semibold text-foreground">
                      {monto(total.porCobrar, total.moneda)}
                    </span>
                  </span>
                </div>
              ))}
              {totales.sinValorVendido > 0 ? (
                <p className="text-right text-muted-foreground">
                  <span className="cifra">{num(totales.sinValorVendido)}</span> sin valor vendido
                </p>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
      </PantallaFija>
    </PageShell>
  );
}

/**
 * Una celda de la fila de un estudiante: abre la ficha del deal con un `Link` cuando el rol la
 * ve (`abreFicha`), o pinta el mismo contenido como texto plano cuando no (el customer success,
 * a quien la ficha rechaza). Un enlace a una pantalla que redirige al usuario fuera sería una
 * trampa; por eso la decisión del rol se toma una vez, en el servidor, y la celda sólo la aplica.
 */
function CeldaDeal({
  abreFicha,
  href,
  children,
  extra = "",
  title,
  enfocable = false,
}: {
  abreFicha: boolean;
  /** La celda del nombre es el enlace que recibe el foco del teclado; las demás no (una parada por fila). */
  enfocable?: boolean;
  href: string;
  children: ReactNode;
  extra?: string;
  title?: string;
}) {
  const clase = `block px-2 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${extra}`.trim();
  if (abreFicha) {
    return (
      <Link href={href} tabIndex={enfocable ? undefined : -1} className={clase} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <div className={clase} title={title}>
      {children}
    </div>
  );
}
