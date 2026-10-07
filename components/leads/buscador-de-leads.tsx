"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { buscarLeadsAccion } from "@/app/(app)/p/[programa]/leads/acciones";
import type { LeadEncontrado } from "@/lib/queries/leads";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import { Input } from "@/components/ui/input";

export function BuscadorDeLeads({ programaSlug, origen }: { programaSlug: string; origen: string }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<LeadEncontrado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, empezarBusqueda] = useTransition();
  const ultimaBusqueda = useRef(0);
  // Busca unos 400 ms despues de la ultima tecla, o ya con Enter.
  const temporizador = useRef<number | undefined>(undefined);

  function buscar(textoBuscado: string) {
    const consulta = textoBuscado.trim();
    if (consulta.length < 2) {
      ultimaBusqueda.current += 1;
      setResultados(null);
      setError(null);
      return;
    }

    const numero = ++ultimaBusqueda.current;
    empezarBusqueda(async () => {
      const resultado = await buscarLeadsAccion({ programaSlug, texto: consulta });
      if (numero !== ultimaBusqueda.current) return;
      if (!resultado.ok) {
        setError(resultado.error);
        setResultados([]);
        return;
      }
      setError(null);
      setResultados(resultado.leads);
    });
  }

  const corto = texto.trim().length < 2;
  const empezado = texto.trim().length > 0;

  return (
    <div className="relative">
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          window.clearTimeout(temporizador.current);
          buscar(texto);
        }}
      >
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={(event) => {
            const valor = event.target.value;
            setTexto(valor);
            window.clearTimeout(temporizador.current);
            temporizador.current = window.setTimeout(() => buscar(valor), 400);
          }}
          placeholder="Buscar por nombre, correo o teléfono"
          aria-label="Buscar leads"
          autoComplete="off"
          className="h-8 pl-9"
        />
      </form>
      {/* Los resultados FLOTAN sobre la lista en vez de empujarla (ticket 202): un
          panel absoluto con `shadow-flotante`, no un bloque que corre la zona con
          scroll hacia abajo. Solo aparece cuando hay algo que decir. */}
      {empezado ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-w-xl rounded-lg border bg-card p-2 shadow-flotante">
          {corto ? (
            <p className="px-1 text-xs text-muted-foreground">Escribe al menos 2 caracteres.</p>
          ) : buscando ? (
            <p className="px-1 text-xs text-muted-foreground">Buscando…</p>
          ) : error ? (
            <p className="px-1 text-sm text-destructive">{error}</p>
          ) : resultados?.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">Sin resultados.</p>
          ) : resultados && resultados.length > 0 ? (
            <ul className="max-h-80 divide-y overflow-auto" aria-label="Leads encontrados">
              {resultados.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={enlaceConVuelta(`/p/${programaSlug}/leads/${lead.id}`, origen)}
                    className="block min-w-0 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="block truncate font-medium">{lead.nombre ?? lead.emailNormalizado}</span>
                    <span className="block truncate text-xs text-muted-foreground">{lead.emailNormalizado}</span>
                    {lead.telefono ? <span className="cifra block text-xs text-muted-foreground">{lead.telefono}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
