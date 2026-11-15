"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type Precarga = "navegacion" | "al-pasar" | "nunca";

/** El unico enlace interno del CRM: cada uso declara su politica de precarga. */
export function Enlace({ precarga, ...props }: ComponentProps<typeof Link> & { precarga: Precarga }) {
  const [activo, setActivo] = useState(false);
  const prefetch = precarga === "navegacion" ? null : precarga === "al-pasar" && activo ? null : false;

  return (
    <Link
      {...props}
      prefetch={prefetch}
      onMouseEnter={(evento) => {
        setActivo(true);
        props.onMouseEnter?.(evento);
      }}
      onFocus={(evento) => {
        setActivo(true);
        props.onFocus?.(evento);
      }}
    />
  );
}
