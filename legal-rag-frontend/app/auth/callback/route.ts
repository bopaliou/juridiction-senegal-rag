import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  try {
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

    console.log('[Auth Callback] Processing:', { code: !!code, token_hash: !!token_hash, type, origin })

    const supabase = await createClient()

    // Cas 1: OAuth callback avec code (Google, etc.)
    if (code) {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        console.log('[Auth Callback] Exchange result:', { error: error?.message })
        
        if (!error) {
          if (type === 'recovery') {
            return NextResponse.redirect(`${origin}/reset-password`)
          }
          return NextResponse.redirect(`${origin}${next}`)
        }
      } catch (e) {
        console.error('[Auth Callback] Exchange error:', e)
      }
    }

    // Cas 2: Email confirmation ou reset avec token_hash
    if (token_hash && type) {
      try {
        const { error } = await supabase.auth.verifyOtp({
          type: type as 'signup' | 'recovery' | 'email',
          token_hash,
        })
        console.log('[Auth Callback] OTP verify result:', { error: error?.message })

        if (!error) {
          if (type === 'recovery') {
            return NextResponse.redirect(`${origin}/reset-password`)
          }
          return NextResponse.redirect(`${origin}${next}`)
        }
      } catch (e) {
        console.error('[Auth Callback] OTP error:', e)
      }
    }

    // Erreur - rediriger avec message
    console.log('[Auth Callback] Redirecting to login with error')
    return NextResponse.redirect(`${origin}/login?error=link_expired`)
    
  } catch (error) {
    console.error('[Auth Callback] Fatal error:', error)
    return NextResponse.redirect('http://172.233.114.185/login?error=server_error')
  }
}
