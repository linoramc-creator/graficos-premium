import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente Supabase para componentes client-side. Lazy singleton.
 * - Devuelve `null` si las env vars no están configuradas, así la UI
 *   sigue funcionando en modo "anónimo" sin romper el render.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return browserClient;
}

/**
 * Cliente Supabase para Server Components / Route Handlers con service role.
 * Sólo se invoca en el server.
 */
export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
