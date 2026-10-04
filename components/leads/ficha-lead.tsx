import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, fechaDeInstanteEnBogota, fechaHoraEnBogota, num } from "@/lib/format";
import { NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import type { DealDeLaFicha, EnvioDeLaFicha, FichaDeLead, ValorDeCampo } from "@/lib/queries/ficha-lead";
import type { LeadEnOtroPrograma } from "@/lib/queries/otros-programas-del-correo";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import { TONO_DE_ETAPA, TONO_DE_PENDIENTE } from "@/components/deals/etapa-tono";
import { EnvioDesplegable } from "@/components/leads/envio-desplegable";

/**
 * Las piezas de la ficha del Lead (tickets 073 y 184). Solo lectura: cada envio delega su
 * apertura al desplegable accesible `EnvioDesplegable`. Sistema Tinta (docs/structure.md §9):
 * tarjetas con sombra, tonos por `<Badge variant>`, cifras en `cifra`, anulado tachado y sin tono.
 */

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="break-words text-sm">{children || "—"}</dd>
    </div>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Un valor de un campo. "No había" y "vacío" se escriben distinto: no son lo mismo. */
function Valor({ valor }: { valor: ValorDeCampo }) {
  if (valor.tipo === "no_habia") return <span className="text-xs italic text-muted-foreground">no había</span>;
  if (valor.tipo === "vacio") return <span className="text-xs italic text-muted-foreground">vacío</span>;
  return <span className="break-words">{valor.texto}</span>;
}

function dia(instante: Date | null): string | null {
  return instante ? fecha(fechaDeInstanteEnBogota(instante)) : null;
}

export function FichaLeadCabecera({ ficha }: { ficha: FichaDeLead }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutro">{ficha.entrada === "crm" ? "Alta manual" : "Formulario"}</Badge>
          {/* La variable `estado` ya no decide nada (ADR 0069 punto 5); lo que falta y miente es la
              calidad: sin ella, un completo nace en Registrado sin un error (117 fase 2). */}
          {ficha.leadQuality ? (
            <Badge variant="secondary">{ficha.leadQuality}</Badge>
          ) : ficha.entrada !== "crm" ? (
            <Badge variant="alerta">Sin calidad</Badge>
          ) : null}
          {ficha.leadValue ? <Badge variant="secondary">{ficha.leadValue}</Badge> : null}
          {ficha.unidoPorTelefono ? <Badge variant="info">Unido por teléfono</Badge> : null}
          {ficha.soloParciales ? <Badge variant="alerta">Abandonó el formulario</Badge> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
          <Dato etiqueta="Correo">{ficha.email}</Dato>
          <Dato etiqueta="Teléfono">{ficha.telefono}</Dato>
          <Dato etiqueta="Empresa · cargo">{[ficha.empresa, ficha.cargo].filter(Boolean).join(" · ")}</Dato>
          <Dato etiqueta="Ubicación">{[ficha.ciudad, ficha.pais].filter(Boolean).join(", ")}</Dato>
          <Dato etiqueta="Aplicaciones">
            <span className="cifra">{num(ficha.numAplicaciones)}</span>
          </Dato>
          <Dato etiqueta="Primera aplicación">{dia(ficha.fechaPrimeraAplicacion)}</Dato>
          <Dato etiqueta="Última aplicación">{dia(ficha.fechaUltimaAplicacion)}</Dato>
          <Dato etiqueta="En el CRM desde">{dia(ficha.creadoEn)}</Dato>
        </dl>
      </CardContent>
    </Card>
  );
}

export function FichaLeadContactos({ ficha }: { ficha: FichaDeLead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contactos</CardTitle>
      </CardHeader>
      <CardContent>
        {ficha.contactos.length === 0 ? (
          <Vacio>Este lead no tiene contactos registrados. Llegan con cada envío del formulario.</Vacio>
        ) : (
          <ul className="divide-y divide-border">
            {ficha.contactos.map((c) => (
              <li key={c.id} className="flex min-w-0 flex-wrap items-center gap-2 py-3 text-sm first:pt-0 last:pb-0">
                <span className="text-xs text-muted-foreground">{c.tipo === "correo" ? "Correo" : "Teléfono"}</span>
                <span className="min-w-48 flex-1 break-all">{c.valor}</span>
                {c.esPrincipal ? <Badge variant="neutro">Principal</Badge> : null}
                {!c.confirmado ? <Badge variant="alerta">Unido por teléfono · sin confirmar</Badge> : null}
                <span className="text-xs text-muted-foreground">
                  {c.agregadoAMano ? "Agregado a mano" : c.envioNumero ? `Llegó en el envío #${c.envioNumero}` : "De otro envío"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilaDeal({ deal, slug, origen }: { deal: DealDeLaFicha; slug: string; origen: string }) {
  const anulado = deal.anulado !== null;
  return (
    <li className="py-1 first:pt-0 last:pb-0">
      <Link
        href={enlaceConVuelta(`/p/${slug}/deals/${deal.id}`, origen)}
        className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-transparent p-3 text-sm outline-none transition-colors duration-150 hover:border-border hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="min-w-0 space-y-1">
          <p className={anulado ? "font-medium text-muted-foreground line-through" : "font-medium text-marca-texto"}>
            {deal.cohorteCodigo ?? "Sin cohorte"} · {deal.ownerNombre ?? "Sin dueño"}
          </p>
          <p className="text-xs text-muted-foreground">
            Abierto el {dia(deal.creadoEn)}
            {deal.envioNumero ? ` · desde el envío #${deal.envioNumero}` : ""}
          </p>
          {deal.anulado ? (
            <p className="text-xs text-muted-foreground">
              Anulado el {dia(deal.anulado.en)}: {deal.anulado.motivo}. No cuenta en ninguna métrica.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={anulado ? "neutro" : TONO_DE_ETAPA[deal.etapa]}>
            {NOMBRE_DE_ETAPA[deal.etapa]}
            {anulado ? " (anulado)" : ""}
          </Badge>
          {deal.pendiente && !anulado ? (
            <Badge variant={TONO_DE_PENDIENTE[deal.pendiente]}>{NOMBRE_DE_PENDIENTE[deal.pendiente]}</Badge>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function FichaLeadDeals({ ficha, slug, origen }: { ficha: FichaDeLead; slug: string; origen: string }) {
  const abiertos = ficha.deals.filter((d) => !d.anulado && !d.cerrado);
  const otros = ficha.deals.filter((d) => d.anulado || d.cerrado);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Deals · <span className="cifra">{num(ficha.deals.length)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ficha.deals.length === 0 ? (
          <Vacio>Este lead no tiene deals. Un deal se abre con cada envío del formulario, o desde Deals con “Nuevo deal”.</Vacio>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Abiertos</h3>
              {abiertos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguno abierto.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {abiertos.map((d) => (
                    <FilaDeal key={d.id} deal={d} slug={slug} origen={origen} />
                  ))}
                </ul>
              )}
            </section>
            {otros.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Cerrados y anulados</h3>
                <ul className="divide-y divide-border">
                  {otros.map((d) => (
                    <FilaDeal key={d.id} deal={d} slug={slug} origen={origen} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TarjetaEnvio({ envio }: { envio: EnvioDeLaFicha }) {
  const conValor = envio.campos.filter((c) => c.valor.tipo === "valor");
  return (
    <EnvioDesplegable cabecera={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            Envío <span className="cifra">#{envio.numero}</span>
          </span>
          {envio.esParcial ? <Badge variant="alerta">Parcial</Badge> : <Badge variant="neutro">Completo</Badge>}
          <span className="text-xs text-muted-foreground">{envio.fuente}</span>
          <Badge variant="secondary">{envio.canal}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {envio.fechaEsDeLlegada ? "Recibido " : ""}
          {fechaHoraEnBogota(envio.fecha)}
          {envio.esParcial && !envio.fechaEsDeLlegada ? " (fecha aproximada)" : ""}
        </span>
      </div>
    }>
      {envio.calificacion || envio.empezoComoParcial ? (
        <div className="flex flex-wrap items-center gap-2">
          {envio.calificacion ? <Badge variant="secondary">{envio.calificacion}</Badge> : null}
          {envio.empezoComoParcial ? (
            <span className="text-xs text-muted-foreground">
              Empezó como parcial el {fechaHoraEnBogota(envio.empezoComoParcial)}.
            </span>
          ) : null}
        </div>
      ) : null}

      {envio.cambios === null ? (
        <p className="text-xs text-muted-foreground">Primer envío: no hay con qué compararlo.</p>
      ) : envio.cambios.length === 0 ? (
        <p className="text-xs text-muted-foreground">Dijo lo mismo que en el envío #{envio.numero - 1}.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Cambió respecto al envío #{envio.numero - 1} (<span className="cifra">{num(envio.cambios.length)}</span>{" "}
            {envio.cambios.length === 1 ? "campo" : "campos"}):
          </p>
          <dl className="divide-y divide-border rounded-lg bg-muted/50 px-3">
            {envio.cambios.map((c) => (
              <div key={c.campo} className="grid gap-1 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-3">
                <dt className="break-words text-xs text-muted-foreground">{c.campo}</dt>
                <dd className="flex min-w-0 flex-wrap items-baseline gap-1.5">
                  <span className="text-muted-foreground">
                    <Valor valor={c.antes} />
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <span className="sr-only">ahora</span>
                  <Valor valor={c.despues} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Respuestas (<span className="cifra">{num(conValor.length)}</span>)
        </p>
        {conValor.length === 0 ? (
          <p className="pt-2 text-sm text-muted-foreground">Este envío llegó sin respuestas.</p>
        ) : (
          <dl className="mt-2 divide-y divide-border">
            {conValor.map((c) => (
              <div key={c.campo} className="min-w-0 py-2">
                <dt className="break-words text-xs text-muted-foreground">{c.campo}</dt>
                <dd className="text-sm">
                  <Valor valor={c.valor} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </EnvioDesplegable>
  );
}

export function FichaLeadEnvios({ ficha }: { ficha: FichaDeLead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Envíos del formulario · <span className="cifra">{num(ficha.envios.length)}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Del más reciente al primero, en el orden en que los hizo. Cada uno dice qué cambió respecto al anterior.
        </p>
      </CardHeader>
      <CardContent>
        {ficha.envios.length === 0 ? (
          <Vacio>
            {ficha.entrada === "crm"
              ? "Este lead se dio de alta a mano: no tiene envíos del formulario."
              : "Este lead no tiene envíos guardados."}
          </Vacio>
        ) : (
          <ul className="divide-y divide-border">
            {ficha.envios.map((e) => (
              <TarjetaEnvio key={e.id} envio={e} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * El aviso de "a esta persona ya la conocemos del otro programa" (ticket 091, ADR 0043 punto 6).
 * Es un aviso, no una cifra: no suma nada. De los programas que la sesion ve se muestra el nombre,
 * la etapa y el enlace; de los que no ve, solo que existen (ADR 0048: el alcance no se ensancha).
 */
export function AvisoOtrosProgramas({ visibles, ocultos }: { visibles: LeadEnOtroPrograma[]; ocultos: number }) {
  if (visibles.length === 0 && ocultos === 0) return null;
  return (
    <div className="space-y-2 rounded-xl bg-tono-info-suave p-4 text-sm text-tono-info" role="note">
      <p className="font-medium">Este correo también es lead de otro programa.</p>
      {visibles.length > 0 ? (
        <ul className="space-y-1.5">
          {visibles.map((o) => (
            <li key={o.leadId} className="flex flex-wrap items-center gap-2">
              <Link
                href={`/p/${o.programaSlug}/leads/${o.leadId}`}
                className="rounded-lg font-medium underline underline-offset-2 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {o.programaNombre}
              </Link>
              {o.deal ? (
                <Badge variant={TONO_DE_ETAPA[o.deal.etapa]}>{NOMBRE_DE_ETAPA[o.deal.etapa]}</Badge>
              ) : (
                <span className="text-xs">sin deal</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {ocultos > 0 ? (
        <p className="text-xs">
          {ocultos === 1 ? "Está en un programa" : `Está en ${num(ocultos)} programas`} que tu cuenta no ve.
        </p>
      ) : null}
      <p className="text-xs">Son leads distintos: cada programa lo trabaja y lo mide por su lado.</p>
    </div>
  );
}
