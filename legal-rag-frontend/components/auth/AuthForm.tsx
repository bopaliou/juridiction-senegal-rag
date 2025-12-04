'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signIn, signUp, resetPassword } from '@/lib/auth/actions'
import { Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type AuthMode = 'login' | 'signup' | 'forgot-password'

interface AuthFormProps {
  mode?: AuthMode
}

export default function AuthForm({ mode = 'login' }: AuthFormProps) {
  const router = useRouter()
  const [currentMode, setCurrentMode] = useState<AuthMode>(mode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (currentMode === 'signup') {
        const result = await signUp(email, password, fullName)
        if (result.error) {
          setError(result.error)
        } else {
          setSuccess('Compte créé ! Vérifiez votre email pour confirmer votre compte.')
          setTimeout(() => {
            router.push('/verify-email?email=' + encodeURIComponent(email))
          }, 2000)
        }
      } else if (currentMode === 'forgot-password') {
        const result = await resetPassword(email)
        if (result.error) {
          setError(result.error)
        } else {
          setSuccess('Un email de réinitialisation a été envoyé à ' + email)
        }
      } else {
        // Login
        const result = await signIn(email, password)
        if (result.error) {
          setError(result.error)
        } else {
          router.push('/')
          router.refresh()
        }
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-8 text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-xl overflow-hidden bg-gradient-to-br from-[#0891B2] to-[#14B8A6] p-2">
            <Image
              src="/assets/logo.png"
              alt="YoonAssist"
              width={64}
              height={64}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-[#0F2942]">
          {currentMode === 'signup' && 'Créer un compte'}
          {currentMode === 'login' && 'Connexion'}
          {currentMode === 'forgot-password' && 'Mot de passe oublié'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {currentMode === 'signup' && 'Rejoignez YoonAssist AI'}
          {currentMode === 'login' && 'Accédez à votre assistant juridique'}
          {currentMode === 'forgot-password' && 'Réinitialisez votre mot de passe'}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-600">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {currentMode === 'signup' && (
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nom complet
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Votre nom"
                className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-[#0891B2] focus:outline-none focus:ring-0 transition-colors"
                required={currentMode === 'signup'}
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-[#0891B2] focus:outline-none focus:ring-0 transition-colors"
              required
            />
          </div>
        </div>

        {currentMode !== 'forgot-password' && (
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-[#0891B2] focus:outline-none focus:ring-0 transition-colors"
                required
                minLength={6}
              />
            </div>
          </div>
        )}

        {currentMode === 'login' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => setCurrentMode('forgot-password')}
              className="text-sm font-semibold text-[#0891B2] hover:underline"
            >
              Mot de passe oublié ?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-[#0891B2] to-[#14B8A6] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement...
            </span>
          ) : (
            <>
              {currentMode === 'signup' && 'Créer un compte'}
              {currentMode === 'login' && 'Se connecter'}
              {currentMode === 'forgot-password' && 'Envoyer le lien'}
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-600">
        {currentMode === 'login' && (
          <>
            Pas encore de compte ?{' '}
            <button
              type="button"
              onClick={() => setCurrentMode('signup')}
              className="font-semibold text-[#0891B2] hover:underline"
            >
              S'inscrire
            </button>
          </>
        )}
        {currentMode === 'signup' && (
          <>
            Déjà un compte ?{' '}
            <button
              type="button"
              onClick={() => setCurrentMode('login')}
              className="font-semibold text-[#0891B2] hover:underline"
            >
              Se connecter
            </button>
          </>
        )}
        {currentMode === 'forgot-password' && (
          <>
            <button
              type="button"
              onClick={() => setCurrentMode('login')}
              className="font-semibold text-[#0891B2] hover:underline"
            >
              Retour à la connexion
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        En continuant, vous acceptez nos{' '}
        <Link href="/terms" className="text-[#0891B2] hover:underline">
          conditions d'utilisation
        </Link>
      </p>
    </div>
  )
}

