import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * Route handler pour la confirmation d'email via token_hash
 * Alternative à /auth/callback pour les liens email directs
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  const headersList = await headers()
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'recovery' | 'email',
      token_hash,
    })

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', origin))
      }
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL(`/login?error=invalid_token`, origin))
}

