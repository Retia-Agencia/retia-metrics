"use client";

import { useEffect } from "react";

/**
 * Traduce al espanol los mensajes de validacion NATIVOS del navegador.
 *
 * El problema: un `<input required>` vacio dispara "Please fill out this field." y un
 * `type="email"` mal escrito "Please include an '@'...". Ese texto lo pone el
 * navegador en SU idioma, no en el de la pagina, asi que `lang="es"` en el `<html>`
 * no lo cambia. La UI de este proyecto es en espanol (AGENTS.md) y esos globos son de
 * las pocas cosas que se leen en ingles.
 *
 * Por que un listener global y no la prop en cada input: hay 32 campos `required`
 * repartidos en 7 componentes, y cada uno nuevo habria que acordarse de decorarlo. Un
 * solo punto de montaje los cubre todos, incluidos los que se agreguen despues, y se
 * borra de un archivo el dia que sobre.
 *
 * Dos detalles que no son adorno:
 * - El listener va en fase de CAPTURA porque el evento `invalid` NO burbujea. Sin
 *   `capture: true` nunca llegaria a `document`.
 * - Hay que LIMPIAR el mensaje al escribir. `setCustomValidity` con texto deja el
 *   campo invalido para siempre: si no se vacia, un campo ya corregido sigue
 *   bloqueando el envio del formulario.
 */

/** El mensaje segun POR QUE fallo, no uno genrico para todo. */
function mensajeDe(campo: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const v = campo.validity;
  if (v.valueMissing) return "Completa este campo.";
  if (v.typeMismatch) {
    return campo.getAttribute("type") === "email"
      ? "Escribe un correo válido."
      : "El formato no es válido.";
  }
  if (v.patternMismatch) return "El formato no es válido.";
  if (v.tooShort || v.tooLong) return "La longitud no es válida.";
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch) return "El valor no es válido.";
  // Un estado que no conocemos: se deja el del navegador en vez de tapar con un
  // mensaje vago lo que el navegador si sabe explicar.
  return "";
}

function esCampo(t: EventTarget | null): t is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLSelectElement ||
    t instanceof HTMLTextAreaElement
  );
}

export function ValidacionEnEspanol() {
  useEffect(() => {
    const alFallar = (e: Event) => {
      if (!esCampo(e.target)) return;
      e.target.setCustomValidity(mensajeDe(e.target));
    };
    // Al escribir o elegir, se borra el mensaje: si no, el campo queda invalido aunque
    // ya este bien y el formulario no se deja enviar nunca.
    const alEscribir = (e: Event) => {
      if (!esCampo(e.target)) return;
      e.target.setCustomValidity("");
    };

    document.addEventListener("invalid", alFallar, true);
    document.addEventListener("input", alEscribir, true);
    document.addEventListener("change", alEscribir, true);
    return () => {
      document.removeEventListener("invalid", alFallar, true);
      document.removeEventListener("input", alEscribir, true);
      document.removeEventListener("change", alEscribir, true);
    };
  }, []);

  return null;
}
