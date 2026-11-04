/** El subtítulo de contexto de una tarjeta (ticket 372): la frase la arma `contextoDeCifra`. */
export function ContextoDeCifra({ texto }: { texto: string }) {
  return <p className="cifra text-xs font-normal text-muted-foreground">{texto}</p>;
}
