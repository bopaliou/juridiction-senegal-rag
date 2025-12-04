import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * Route handler pour les callbacks OAuth et email confirmation
 * Gère les redirections après authentification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const type = searchParams.get('type') // 'signup' | 'recovery'

  // Obtenir l'origine depuis les headers (compatible avec nginx proxy)
  const headersList = await headers()
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Redirection selon le type
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', origin))
      }
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // En cas d'erreur, rediriger vers login
  return NextResponse.redirect(new URL(`/login?error=auth_failed`, origin))
}

