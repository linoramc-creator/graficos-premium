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

## Despliegue en Vercel (paso a paso)

> Yahoo Finance bloquea con 401/429 las IPs de cloud (Vercel, AWS,
> Render…). Por eso `/api/quote` ya implementa una **cascada
> automática**: intenta Yahoo, si falla cae a **Stooq** (gratis, sin
> API key, cloud-friendly) y, si configuras `EODHD_API_KEY`, a EODHD.
> No tienes que tocar nada para que funcione en Vercel.

### 1. Sube la rama a GitHub

```bash
git push -u origin claude/modest-volta-YQz3P
# Cuando estés conforme, mergea a main desde la UI de GitHub.
```

### 2. Importa el proyecto en Vercel

1. Entra en https://vercel.com/new
2. *Import Git Repository* → `linoramc-creator/graficos-premium`
3. *Framework Preset* → **Next.js** (autodetectado)
4. *Build & Output Settings* → deja los valores por defecto
   (`next build`, `.next`)
5. *Root Directory* → `./`

### 3. Configura las variables de entorno

En *Environment Variables* añade (Production + Preview + Development):

| Clave | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (sólo si haces server actions) |
| `TWELVE_DATA_API_KEY` | **muy recomendado** — gratis, 800 req/día. Regístrate en https://twelvedata.com (1 min, sin tarjeta) |
| `DATA_PROVIDER` | *(opcional)* `yfinance` / `stooq` / `twelvedata` / `eodhd`. Vacío = cascada auto (recomendado) |
| `EODHD_API_KEY` | *(opcional)* alternativa premium |

> **Por qué Twelve Data**: Yahoo Finance devuelve `HTTP 429` desde las IPs
> de Vercel (rate-limit a hostings), y Stooq a veces sirve HTML/captcha
> cuando detecta tráfico cloud. Con `TWELVE_DATA_API_KEY` configurada,
> la cascada del proxy la usa primero y los datos llegan siempre.

### 4. Deploy

Pulsa **Deploy**. En 1–2 minutos tendrás la URL
`https://graficos-premium-<hash>.vercel.app`.

### 5. Verifica

- Abre la URL. Debería cargar el ticker por defecto (AAPL).
- Si la cascada cayó a Stooq verás en el JSON de `/api/quote?ticker=AAPL&range=2y`
  un campo `"provider": "stooq"`.
- Si hay error de red total, la UI muestra un banner pero **no se rompe**:
  los gráficos dependientes quedan en estado vacío.

### Notas

- `vercel.json` fija región `iad1` (Virginia) y `maxDuration=20s` para el
  endpoint, suficiente para Stooq incluso si Yahoo se cuelga.
- El motor Monte Carlo se ejecuta **en el navegador** del cliente, así
  que no consume tiempo de función serverless.
- Para conmutar manualmente a un único proveedor, define
  `DATA_PROVIDER=stooq` (o `yfinance` / `eodhd`) en Vercel y redeploy.
