import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  // Construire l'origine depuis les headers (important pour nginx proxy)
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  console.log('[Auth Callback] Received:', { 
    code: code ? 'present' : 'missing', 
    token_hash: token_hash ? 'present' : 'missing', 
    type, 
    origin,
    host
  })

  // Créer une réponse temporaire pour collecter les cookies
  const response = NextResponse.next({ request })
  
  // Créer le client Supabase avec gestion des cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  let redirectPath = '/login?error=unknown'

  // Cas 1: OAuth callback avec code (Google, etc.)
  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      console.log('[Auth Callback] Exchange result:', { 
        success: !!data?.session, 
        error: error?.message 
      })
      
      if (error) {
        console.error('[Auth Callback] Error:', error)
        redirectPath = `/login?error=${encodeURIComponent(error.message)}`
      } else {
        // Succès
        if (type === 'recovery') {
          redirectPath = '/reset-password'
        } else {
          redirectPath = next
        }
      }
    } catch (e) {
      console.error('[Auth Callback] Exception:', e)
      redirectPath = '/login?error=callback_error'
    }
  }
  // Cas 2: Email confirmation ou reset avec token_hash
  else if (token_hash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as 'signup' | 'recovery' | 'email',
        token_hash,
      })
      console.log('[Auth Callback] OTP result:', { error: error?.message })

      if (error) {
        redirectPath = `/login?error=${encodeURIComponent(error.message)}`
      } else {
        if (type === 'recovery') {
          redirectPath = '/reset-password'
        } else {
          redirectPath = next
        }
      }
    } catch (e) {
      console.error('[Auth Callback] OTP Exception:', e)
      redirectPath = '/login?error=otp_error'
    }
  } else {
    console.log('[Auth Callback] No code or token_hash')
    redirectPath = '/login?error=missing_params'
  }

  // Créer la réponse de redirection avec les cookies
  const redirectUrl = new URL(redirectPath, origin)
  const redirectResponse = NextResponse.redirect(redirectUrl, { status: 302 })
  
  // Copier tous les cookies de la réponse temporaire vers la réponse de redirection
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      domain: cookie.domain,
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite as 'lax' | 'strict' | 'none' | undefined,
    })
  })
  
  console.log('[Auth Callback] Redirecting to:', redirectUrl.toString(), 'with', redirectResponse.cookies.getAll().length, 'cookies')
  
  return redirectResponse
}
