import Link from 'next/link'
import Image from 'next/image'
import { Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/senegal_droit.jpg"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      <header className="relative z-10 p-6">
        <Link href="/" className="flex items-center gap-3 w-fit">
          <Image
            src="/assets/logo.png"
            alt="YoonAssist"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <span className="text-2xl font-bold text-white drop-shadow-lg">YoonAssist</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-[#00853F]/20 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-[#FDEF42]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[#00853F]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
            <p className="text-gray-600 mb-6">
              Un email de confirmation a été envoyé à votre adresse. 
              Cliquez sur le lien dans l'email pour activer votre compte.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#00853F] to-[#006B32] hover:from-[#006B32] hover:to-[#005528] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#00853F]/25"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}