import type { EventoExtraido } from "./validators";
import type { Fonte } from "./fontes";

export function calcularConfianca(
  evento: EventoExtraido,
  fonte: Fonte
): "UNVERIFIED" | "PROJECTED" | "CONFIRMED" {
  if (fonte.peso >= 0.9 && evento.excerpt.length >= 20) {
    return "CONFIRMED";
  }
  if (fonte.peso >= 0.6) {
    return "PROJECTED";
  }
  return "UNVERIFIED";
}