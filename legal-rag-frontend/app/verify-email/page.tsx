'use client'

import { Suspense } from 'react'
import { MailCheck, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#E0F7FA] to-[#B2EBF2] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mb-6 flex justify-center">
          <MailCheck className="h-16 w-16 text-[#0891B2]" />
        </div>
        <h2 className="mb-4 text-3xl font-bold text-[#0F2942]">Vérifiez votre email</h2>
        <p className="mb-6 text-slate-600">
          Un lien de confirmation a été envoyé à <strong className="text-[#0F2942]">{email || 'votre adresse email'}</strong>.
          Veuillez cliquer sur ce lien pour activer votre compte YoonAssist.
        </p>
        <p className="mb-8 text-sm text-slate-500">
          Si vous ne recevez pas l'email, vérifiez votre dossier de spams ou réessayez de vous inscrire.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0891B2] to-[#14B8A6] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#E0F7FA] to-[#B2EBF2] p-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#0891B2]" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}

