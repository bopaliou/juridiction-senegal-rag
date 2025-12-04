import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      // Email vérifié avec succès - rediriger vers l'app
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Erreur - rediriger vers la page de vérification avec erreur
  return NextResponse.redirect(`${origin}/verify-email?error=invalid_token`)
}

