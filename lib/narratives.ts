export interface Narrative {
  what: string;
  geopolitical: string;
  keyLevel: string;
}

/**
 * Diccionario centralizado de narrativas. Cada gráfico/variable consume
 * estos textos a través de `<NarrativeBlock />`. Mantener el tono
 * accesible: nada de tecnicismos áridos, pero con criterio profesional.
 */
export const NARRATIVES = {
  riskFree: {
    what: "Es el refugio base del dinero: el bono del Tesoro de EEUU. Lo que tu dinero gana sin asumir riesgo.",
    geopolitical:
      "Si sube, el dinero huye de la bolsa hacia los bonos. Si baja durante una crisis, hay miedo profundo y la Fed compra deuda.",
    keyLevel:
      "Cualquier tasa por encima del 5% comprime las valoraciones. Por debajo del 2% es liquidez expansiva."
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
    what: "Simulación estadística que genera miles de trayectorias futuras de precio. Cada camino aplica un modelo Merton (volatilidad continua + saltos discretos por shocks). El resultado NO es una predicción: es un mapa de probabilidades.",
    geopolitical:
      "La densidad de la nube muestra los desenlaces más probables; las bandas indican la dispersión típica. Si la cola izquierda se alarga al subir el escenario severo, el riesgo geopolítico te está abriendo el rango bajista. Si la P95 se eleva, hay potencial alcista que el mercado puede infravalorar.",
    keyLevel:
      "Mira el percentil 5: si está más de un 30% por debajo del spot, el activo exige descuento. La distancia P95–P5 es el rango plausible; si es muy ancho, el modelo te dice que la incertidumbre domina."
  },
  percentiles: {
    what: "Los percentiles ordenan los resultados de las simulaciones de menor a mayor. P5 = el 5% peor, P50 = la mediana, P95 = el 5% mejor. Definen las bandas de confianza estadística del escenario.",
    geopolitical:
      "En crisis severas la P5 cae mucho más rápido que la P95 sube (asimetría negativa). En rallies, ocurre lo contrario. Comparar la anchura P5–P95 entre escenarios te muestra cómo de tóxico es el régimen.",
    keyLevel:
      "P5 sirve como Value-at-Risk implícito (95% confianza). P50 es el outcome 'típico'. P75–P25 es el rango intercuartílico: tu zona de comodidad."
  },
  probProfit: {
    what: "Porcentaje de trayectorias simuladas que terminan por encima del precio de entrada. Estimación directa de la probabilidad de cerrar en verde al final del horizonte.",
    geopolitical:
      "Una probabilidad alta NO garantiza ganancia: incluso al 70% una de cada tres veces pierdes. Mira siempre prob. profit JUNTO con la magnitud del downside (P5).",
    keyLevel:
      "Por encima del 60% el activo tiene asimetría favorable. Si está cerca del 50% el mercado lo está pricing como un coin-flip. Por debajo del 40%, el modelo te está diciendo que es más probable perder que ganar."
  },
  ratios: {
    what: "Sortino y Calmar miden si la acción te paga por el riesgo de pérdida real, no por la volatilidad general. Sortino sólo penaliza retornos negativos; Calmar compara el retorno anual con la peor caída histórica.",
    geopolitical:
      "En crisis, Sharpe puede engañar porque mete subidas y bajadas en el mismo saco. Sortino solo penaliza el dolor; Calmar te dice si la rentabilidad compensa el drawdown máximo.",
    keyLevel:
      "Sortino > 2.0 y Calmar > 1.0 son la línea de calidad institucional. Sharpe > 1.0 ya es respetable pero menos discriminante."
  },
  underwater: {
    what: "Drawdown serie: cuánto ha caído la acción en cada momento respecto a su máximo histórico previo. Mide el dolor del inversor que entró en el peor punto.",
    geopolitical:
      "En guerras y recesiones el underwater se vuelve un valle largo y profundo. La velocidad de recuperación define la calidad del activo: lo bueno tarda meses, lo frágil tarda años.",
    keyLevel:
      "Drawdowns mayores al 40% que tardan más de 24 meses en recuperarse son red flag. Drawdowns recurrentes del 20%+ en menos de 5 años indican fragilidad estructural."
  },
  refuge: {
    what: "Correlación móvil a 60 días entre el activo y el oro (GLD). Si es positiva y alta, el activo se mueve con el oro (refugio); si es negativa, hace lo contrario.",
    geopolitical:
      "Si la línea se acerca a +1 durante una crisis, esta empresa actúa como búnker financiero. Si se acerca a -1, la crisis la destruye y el oro la pasa por encima.",
    keyLevel:
      "Lectura sostenida por encima de +0.4 en periodos de estrés = activo refugio funcional. Por debajo de -0.4 = víctima sistemática del miedo."
  },
  regime: {
    what: "Histograma de retornos diarios separados en dos regímenes: calma (VIX ≤ 25) y pánico (VIX > 25). Permite ver si la acción amplifica o resiste el miedo del mercado.",
    geopolitical:
      "Si la barra de pánico se desplaza claramente a la izquierda, la acción amplifica el miedo (beta alta en estrés). Si no se mueve, es resiliente estructural.",
    keyLevel:
      "Una mediana de retorno en pánico menor a -1% diario implica fragilidad estructural. Si la distribución de pánico es casi simétrica con la de calma, el activo es 'all-weather'."
  },
  oilBeta: {
    what: "Beta OLS de retornos diarios del activo frente al crudo Brent (BZ=F). Mide la sensibilidad estadística a movimientos del petróleo.",
    geopolitical:
      "Beta > 1 = un conflicto en Oriente Medio le sube los costes proporcionalmente más que al mercado. Beta < 0 = se beneficia del petróleo caro (típico de petroleras, defensa, energía).",
    keyLevel:
      "Beta entre -0.2 y +0.3 indica neutralidad energética. Fuera de ese rango es exposición temática clara y debe entrar en tu tesis macro."
  }
} as const satisfies Record<string, Narrative>;

export type NarrativeKey = keyof typeof NARRATIVES;

/**
 * Mini-narrativas para tooltips de tiles individuales (P5, P50, P95,
 * Prob. Profit, Mediana). Más compactas que las del NarrativeBlock,
 * pensadas para un tooltip de 2-3 líneas.
 */
export const TILE_TOOLTIPS = {
  median: {
    title: "Mediana (P50)",
    body: "El resultado central: el 50% de las simulaciones terminó por encima y el 50% por debajo. Es el outcome 'típico', no la media — la media puede estar sesgada por colas extremas."
  },
  probProfit: {
    title: "Probabilidad de beneficio",
    body: "Porcentaje de trayectorias que cierran por encima del precio de entrada. Útil para dimensionar la asimetría: 64% suena bien, pero comprueba siempre la magnitud del 36% restante."
  },
  p05: {
    title: "P5 · Riesgo de cola",
    body: "El 5% peor de los escenarios simulados. Hay un 95% de probabilidad de que el precio final sea MAYOR que este valor. Es tu Value-at-Risk al 95% según el modelo."
  },
  p95: {
    title: "P95 · Potencial extremo",
    body: "El 5% mejor de los escenarios simulados. Hay un 5% de probabilidad de que el precio final supere este nivel. Marca el techo plausible del horizonte."
  },
  p25p75: {
    title: "Rango intercuartílico (P25–P75)",
    body: "Zona donde caen la mitad central de los escenarios. Si tu tesis es razonable, este es el rango donde 'debería' terminar el activo."
  }
} as const;
