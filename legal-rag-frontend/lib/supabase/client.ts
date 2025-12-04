import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase pour le navigateur (Client Components)
 * Utilise createBrowserClient pour gérer automatiquement les cookies
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

