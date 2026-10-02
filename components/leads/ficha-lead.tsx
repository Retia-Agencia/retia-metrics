import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, fechaDeInstanteEnBogota, fechaHoraEnBogota, num } from "@/lib/format";
import { NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import type { DealDeLaFicha, EnvioDeLaFicha, FichaDeLead, ValorDeCampo } from "@/lib/queries/ficha-lead";
import { TONO_DE_ETAPA, TONO_DE_PENDIENTE } from "@/components/deals/etapa-tono";

/**
 * Las piezas de la ficha del Lead (ticket 073). Solo lectura y sin estado de cliente: lo unico
 * que se abre son las respuestas completas de cada envio, con `<details>` nativo (no hay contexto
 * de Base UI que pueda faltar). Sistema Tinta (docs/structure.md §9): tarjetas con sombra, tonos
 * por `<Badge variant>`, cifras en `cifra`, anulado tachado y sin tono.
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
          {ficha.calificacion ? <Badge variant="neutro">{ficha.calificacion}</Badge> : <Badge variant="alerta">Sin estado</Badge>}
          {ficha.leadQuality ? <Badge variant="secondary">{ficha.leadQuality}</Badge> : null}
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
                <span className="min-w-0 flex-1 break-words">{c.valor}</span>
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

function FilaDeal({ deal, slug }: { deal: DealDeLaFicha; slug: string }) {
  const anulado = deal.anulado !== null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <Link
          href={`/p/${slug}/deals/${deal.id}`}
          className={
            anulado
              ? "font-medium text-muted-foreground line-through underline-offset-2 outline-none hover:underline focus-visible:underline"
              : "font-medium text-marca-texto underline-offset-2 outline-none hover:underline focus-visible:underline"
          }
        >
          {deal.cohorteCodigo ?? "Sin cohorte"} · {deal.ownerNombre ?? "Sin dueño"}
        </Link>
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
    </li>
  );
}

export function FichaLeadDeals({ ficha, slug }: { ficha: FichaDeLead; slug: string }) {
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
          <Vacio>Este lead no tiene deals. Un deal se abre al llegar un envío calificado, o desde Deals con “Nuevo deal”.</Vacio>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Abiertos</h3>
              {abiertos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguno abierto.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {abiertos.map((d) => (
                    <FilaDeal key={d.id} deal={d} slug={slug} />
                  ))}
                </ul>
              )}
            </section>
            {otros.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Cerrados y anulados</h3>
                <ul className="divide-y divide-border">
                  {otros.map((d) => (
                    <FilaDeal key={d.id} deal={d} slug={slug} />
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
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            Envío <span className="cifra">#{envio.numero}</span>
          </span>
          {envio.esParcial ? <Badge variant="alerta">Parcial</Badge> : <Badge variant="neutro">Completo</Badge>}
          {envio.calificacion ? <Badge variant="secondary">{envio.calificacion}</Badge> : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {envio.fechaEsDeLlegada ? "Recibido " : ""}
          {fechaHoraEnBogota(envio.fecha)}
          {envio.esParcial && !envio.fechaEsDeLlegada ? " (fecha aproximada)" : ""}
        </span>
      </div>

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

      <details className="group">
        <summary className="cursor-pointer rounded-lg text-xs text-marca-texto underline-offset-2 outline-none transition-colors duration-150 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          Ver todas las respuestas (<span className="cifra">{num(conValor.length)}</span>)
        </summary>
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
      </details>
    </li>
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
