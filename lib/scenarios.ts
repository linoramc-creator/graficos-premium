import type { Scenario } from "./types";

/**
 * Presets institucionales. Los parámetros de salto están en log-retornos
 * diarios: jumpMean negativa = sesgo bajista; jumpStd alta = saltos extremos.
 *
 *  - base      : sin shocks, drift normal de mercado.
 *  - moderate  : "guerra comercial latente" — saltos pequeños y frecuentes.
 *  - severe    : "Cisne Negro" (p.ej. bloqueo de Taiwán) — saltos grandes
 *                y poco frecuentes pero devastadores.
 */
export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    key: "base",
    label: "Normalidad",
    probability: 0.65,
    jumpMean: 0,
    jumpStd: 0,
    jumpIntensity: 0,
    description:
      "Mercado funciona sin disrupciones. Sólo difusión gaussiana, sin saltos discretos."
  },
  {
    key: "moderate",
    label: "Stress Moderado · Aranceles / Tensiones",
    probability: 0.25,
    jumpMean: -0.01,
    jumpStd: 0.02,
    jumpIntensity: 6,
    description:
      "Guerra comercial latente: titulares, aranceles puntuales. Saltos pequeños y relativamente frecuentes."
  },
  {
    key: "severe",
    label: "Shock Severo · Guerra / Bloqueo",
    probability: 0.10,
    jumpMean: -0.06,
    jumpStd: 0.08,
    jumpIntensity: 1.5,
    description:
      "Evento Cisne Negro (ej. bloqueo de Taiwán). Saltos grandes, baja frecuencia, riesgo de cola izquierda."
  }
];
