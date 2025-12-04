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

  // Stocker les cookies à définir
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  // Créer le client Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach((cookie) => {
            cookiesToSet.push(cookie)
          })
        },
      },
    }
  )

  // Helper pour créer une réponse HTML avec redirection client-side
  const createClientRedirect = (url: string) => {
    const fullUrl = url.startsWith('/') ? `${origin}${url}` : url
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${fullUrl}">
          <script>window.location.href="${fullUrl}";</script>
        </head>
        <body>
          <p>Redirection en cours...</p>
        </body>
      </html>
    `
    const response = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    console.log('[Auth Callback] Client redirect to:', fullUrl, 'with', cookiesToSet.length, 'cookies')
    return response
  }

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
        return createClientRedirect(`/login?error=${encodeURIComponent(error.message)}`)
      }

      // Succès - rediriger vers la page demandée
      if (type === 'recovery') {
        return createClientRedirect('/reset-password')
      }
      
      return createClientRedirect(next)
    } catch (e) {
      console.error('[Auth Callback] Exception:', e)
      return createClientRedirect('/login?error=callback_error')
    }
  }

  // Cas 2: Email confirmation ou reset avec token_hash
  if (token_hash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as 'signup' | 'recovery' | 'email',
        token_hash,
      })
      console.log('[Auth Callback] OTP result:', { error: error?.message })

      if (error) {
        return createClientRedirect(`/login?error=${encodeURIComponent(error.message)}`)
      }

      if (type === 'recovery') {
        return createClientRedirect('/reset-password')
      }
      
      return createClientRedirect(next)
    } catch (e) {
      console.error('[Auth Callback] OTP Exception:', e)
      return createClientRedirect('/login?error=otp_error')
    }
  }

  // Pas de code ni token - erreur
  console.log('[Auth Callback] No code or token_hash')
  return createClientRedirect('/login?error=missing_params')
}
