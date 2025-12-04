import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  // Obtenir l'origine correcte depuis les headers
  const headersList = await headers()
  const host = headersList.get('host') || '172.233.114.185'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  const supabase = await createClient()

  // Cas 1: OAuth callback avec code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Si c'est un recovery (reset password), rediriger vers la page de reset
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Cas 2: Email confirmation ou reset avec token_hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'recovery' | 'email',
      token_hash,
    })

    if (!error) {
      // Si c'est un recovery, rediriger vers reset-password
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      // Sinon, rediriger vers l'accueil (email confirmé)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Erreur - rediriger avec message
  return NextResponse.redirect(`${origin}/login?error=link_expired`)
}
