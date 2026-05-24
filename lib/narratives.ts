export interface Narrative {
  what: string;
  geopolitical: string;
  keyLevel: string;
}

/**
 * Diccionario centralizado de narrativas. Cada gráfico/variable consume
 * estos textos a través del componente <NarrativeBlock />. Mantener el
 * tono accesible: nada de tecnicismos áridos.
 */
export const NARRATIVES = {
  riskFree: {
    what: "Es el refugio base del dinero: el bono del Tesoro de EEUU. Lo que tu dinero gana sin asumir riesgo.",
    geopolitical:
      "Si sube, el dinero huye de la bolsa hacia los bonos. Si baja durante una crisis, hay miedo profundo y la Fed compra deuda.",
    keyLevel: "Cualquier tasa por encima del 5% comprime las valoraciones. Por debajo del 2% es liquidez expansiva."
  },
  scenarioBase: {
    what: "Probabilidad de que el mundo siga funcionando como hoy: comercio abierto, sin guerras nuevas.",
    geopolitical:
      "Mientras esta probabilidad sea alta, los mercados pueden valorar fundamentales en lugar de titulares.",
    keyLevel: "Vigila si cae por debajo del 60%: el modelo te está diciendo que el entorno se está degradando."
  },
  scenarioModerate: {
    what: "Probabilidad de un escenario de guerra comercial latente: aranceles, sanciones, retórica dura.",
    geopolitical:
      "Sube cuando hay tensiones EEUU–China, Europa–Rusia o disputas tarifarias. No rompe el sistema, pero erosiona márgenes.",
    keyLevel: "Por encima del 30% el mercado empieza a exigir prima de riesgo por geopolítica."
  },
  scenarioSevere: {
    what: "Probabilidad de un evento Cisne Negro: bloqueo de Taiwán, guerra abierta entre grandes potencias, corte energético global.",
    geopolitical:
      "Es la cola izquierda: improbable, pero si ocurre rompe la cadena de suministro y disloca precios.",
    keyLevel: "Cualquier valor por encima del 10% ya implica cubrir cartera con oro, defensa o efectivo."
  },
  monteCarlo: {
    what: "Muestra el abanico de precios posibles de la acción dentro de un año tras 10.000 simulaciones.",
    geopolitical:
      "Si la cola izquierda se hace muy larga, el modelo está diciendo que el riesgo geopolítico configurado es extremo.",
    keyLevel: "Mira el percentil 5: si está más de un 30% por debajo del precio actual, exige descuento para comprar."
  },
  trajectories: {
    what: "Simula el día a día del mercado durante un año con 50 caminos representativos.",
    geopolitical:
      "Los cortes verticales hacia abajo son los impactos directos de los shocks políticos del escenario configurado.",
    keyLevel: "Cuantas más trayectorias terminen por encima del precio inicial, más asimetría favorable."
  },
  ratios: {
    what: "Sortino y Calmar miden si la acción te paga por el riesgo de pérdida real, no por la volatilidad general.",
    geopolitical:
      "En crisis, Sharpe puede engañar porque mete subidas y bajadas en el mismo saco. Sortino solo penaliza el dolor.",
    keyLevel: "Sortino > 2.0 y Calmar > 1.0 son la línea de calidad institucional."
  },
  underwater: {
    what: "Mide el dolor actual del inversor: cuánto ha caído la acción desde su máximo histórico.",
    geopolitical:
      "En guerras y recesiones el underwater se vuelve un valle largo y profundo. La velocidad de recuperación define la calidad del activo.",
    keyLevel: "Drawdowns mayores al 40% que tardan más de 24 meses en recuperarse son red flag."
  },
  refuge: {
    what: "Termómetro de refugio: correlación móvil a 60 días con el oro (GLD).",
    geopolitical:
      "Si la línea se acerca a +1 durante una crisis, esta empresa actúa como un búnker financiero. Si se acerca a -1, la crisis la destruye.",
    keyLevel: "Lectura sostenida por encima de +0.4 en periodos de estrés = activo refugio funcional."
  },
  regime: {
    what: "Compara cómo rinde la acción en días de paz vs. días de pánico en Wall Street (VIX > 25).",
    geopolitical:
      "Si la barra de pánico se desplaza claramente a la izquierda, la acción amplifica el miedo. Si no se mueve, es resiliente.",
    keyLevel: "Una mediana de retorno en pánico menor a -1% diario implica fragilidad estructural."
  },
  oilBeta: {
    what: "Mide la adicción de la empresa al coste de la energía. Es la pendiente respecto al crudo Brent (BZ=F).",
    geopolitical:
      "Beta > 1 = un conflicto en Oriente Medio le sube los costes proporcionalmente más que al mercado. Beta < 0 = se beneficia del petróleo caro.",
    keyLevel: "Beta entre -0.2 y +0.3 indica neutralidad energética; fuera de ese rango es exposición temática clara."
  }
} as const satisfies Record<string, Narrative>;

export type NarrativeKey = keyof typeof NARRATIVES;
