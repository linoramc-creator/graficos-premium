# Gráficos Premium · Riesgo Geopolítico

Aplicación SaaS de análisis de riesgo geopolítico y métricas institucionales
construida con Next.js (App Router) + TypeScript + Tailwind CSS + Recharts.
El backend de persistencia/auth es Supabase. La capa de datos de mercado es
modular: por defecto consume Yahoo Finance (vía un proxy en
`app/api/quote/route.ts`) y puede conmutarse a EODHD con una variable de
entorno.

## Características

- **Motor Monte Carlo · Merton Jump-Diffusion**: 10.000 trayectorias
  combinando difusión gaussiana y saltos discretos según la mezcla
  geopolítica configurada (base / moderado / severo).
- **Ratios institucionales**: Sortino, Calmar, Sharpe, CAGR, Max Drawdown.
- **Underwater (Drawdown)**: dolor real del inversor.
- **Termómetro de refugio**: correlación móvil 60d con GLD (oro).
- **Histograma de regímenes**: comportamiento en calma vs. pánico (VIX > 25).
- **Beta temática al petróleo**: pendiente OLS frente a BZ=F.
- **Narrativa guionizada** integrada en la propia UI para cada gráfico:
  *¿Qué es?* · *Impacto Geopolítico* · *El Dato Clave*.

## Arquitectura

```
app/
  api/quote/route.ts        # Proxy modular: yfinance | EODHD
  layout.tsx
  page.tsx
  globals.css
components/
  Dashboard.tsx             # Orquestación + estado global del cliente
  Header.tsx
  InputPanel.tsx            # Variables (con tooltips y narrativas)
  NarrativeBlock.tsx        # Acordeón ¿Qué es? / Impacto / Dato Clave
  InfoTooltip.tsx
  ChartCard.tsx             # Wrapper estándar con narrativa adjunta
  EmptyState.tsx
  charts/
    MonteCarloHistogram.tsx
    TrajectoriesChart.tsx
    RatiosPanel.tsx
    UnderwaterChart.tsx
    RefugeThermometer.tsx
    RegimeHistogram.tsx
    ThematicBetaChart.tsx
lib/
  datasource.ts             # Fetch limpio + saneado contra el proxy
  montecarlo.ts             # Merton Jump-Diffusion en TS
  metrics.ts                # Sortino, Calmar, drawdown, correlaciones
  narratives.ts             # Diccionario de textos guionizados
  rng.ts                    # Mulberry32 + Box-Muller + Poisson
  scenarios.ts              # Presets institucionales
  supabase.ts               # Clientes browser y server-side
  format.ts                 # Utilidades de formato y percentiles
  types.ts
```

## Puesta en marcha local

```bash
pnpm install   # o npm install / yarn install
cp .env.local.example .env.local
# Edita .env.local con tus claves de Supabase (opcional para correr)
pnpm dev
```

Abre `http://localhost:3000`.

> **Nota**: si tu hosting (o este entorno) bloquea peticiones a Yahoo
> Finance, levanta un microservicio yfinance y apunta
> `YFINANCE_BASE_URL` a él, o conmuta a EODHD con `DATA_PROVIDER=eodhd`
> y `EODHD_API_KEY`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sí (auth) | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sí (auth) | Anon key pública. |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Service role (sólo backend). |
| `DATA_PROVIDER` | no | `yfinance` (default) o `eodhd`. |
| `EODHD_API_KEY` | si EODHD | API key de EODHD. |
| `YFINANCE_BASE_URL` | no | Reescritura del endpoint Yahoo si lo proxeas. |

## Robustez

- **Errores de fetch controlados**: si un ticker no existe o la red falla,
  la UI muestra un banner y los gráficos dependientes se quedan en
  `EmptyState`. La aplicación no se rompe.
- **Limpieza estricta de series**: `cleanSeries` filtra fechas inválidas,
  duplicados y cierres nulos/negativos antes de pasar a Recharts.
- **Determinismo**: el PRNG (Mulberry32) tiene seed configurable, así que
  las simulaciones son reproducibles.

## Conectar el repositorio a GitHub

```bash
git init
git add .
git commit -m "feat: dashboard de riesgo geopolítico"
git branch -M main
git remote add origin git@github.com:<tu-usuario>/graficos-premium.git
git push -u origin main
```

## Configurar Supabase

1. Crea un proyecto en https://supabase.com.
2. Copia `Project URL`, `anon key` y `service_role key` a `.env.local`.
3. (Opcional) Crea una tabla `saved_simulations` para persistir
   configuraciones de usuario:
   ```sql
   create table public.saved_simulations (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id) on delete cascade,
     ticker text not null,
     inputs jsonb not null,
     created_at timestamptz default now()
   );
   alter table public.saved_simulations enable row level security;
   create policy "owner read"  on public.saved_simulations for select using (auth.uid() = user_id);
   create policy "owner write" on public.saved_simulations for insert with check (auth.uid() = user_id);
   ```
4. Activa Email/OAuth en Authentication → Providers.

## Despliegue

Cualquier plataforma compatible con Next.js 14 (Vercel, Netlify, Render,
Railway). Recuerda exportar todas las variables de entorno y, si vas a
servir desde fuera de EEUU, valorar EODHD frente a yfinance para evitar
límites de Yahoo.
