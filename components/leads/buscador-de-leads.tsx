"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { buscarLeadsAccion } from "@/app/(app)/p/[programa]/leads/acciones";
import type { LeadEncontrado } from "@/lib/queries/leads";
import { Input } from "@/components/ui/input";

export function BuscadorDeLeads({ programaSlug }: { programaSlug: string }) {
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
    <div className="space-y-2">
      <form
        className="relative max-w-xl"
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
          className="pl-9"
        />
      </form>
      {corto && empezado ? <p className="text-xs text-muted-foreground">Escribe al menos 2 caracteres.</p> : null}
      {!corto && buscando ? <p className="text-xs text-muted-foreground">Buscando…</p> : null}
      {!corto && !buscando && error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!corto && !buscando && !error && resultados?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin resultados.</p>
      ) : null}
      {!corto && resultados && resultados.length > 0 ? (
        <ul className="max-w-xl divide-y rounded-lg border bg-card" aria-label="Leads encontrados">
          {resultados.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/p/${programaSlug}/leads/${lead.id}`}
                className="block min-w-0 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
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
  );
}
