'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const email = searchParams.get('email');
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      setStatus('error');
    }
  }, [error]);

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0891B2] to-[#14b8a6] p-1 shadow-lg">
            <div className="h-full w-full rounded-xl bg-white flex items-center justify-center overflow-hidden">
              <Image
                src="/assets/logo.png"
                alt="YoonAssist"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        {status === 'error' ? (
          /* Erreur de vérification */
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Erreur de vérification
            </h2>
            <p className="text-slate-500 mb-6">
              Le lien de vérification est invalide ou a expiré. Veuillez vous réinscrire ou demander un nouveau lien.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0891B2] to-[#14b8a6] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                S&apos;inscrire à nouveau
              </Link>
              <Link
                href="/login"
                className="text-sm text-slate-500 hover:text-[#0891B2] transition-colors"
              >
                Retour à la connexion
              </Link>
            </div>
          </div>
        ) : (
          /* En attente de vérification */
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-[#0891B2]/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-[#0891B2]" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Vérifiez votre email
            </h2>
            <p className="text-slate-500 mb-2">
              Nous avons envoyé un lien de confirmation à :
            </p>
            {email && (
              <p className="font-semibold text-[#0891B2] mb-4">
                {email}
              </p>
            )}
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-slate-600 mb-3">
                <strong>📧 Consultez votre boîte de réception</strong> et cliquez sur le lien pour activer votre compte YoonAssist.
              </p>
              <p className="text-xs text-slate-400">
                Si vous ne trouvez pas l&apos;email, vérifiez votre dossier spam ou courrier indésirable.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0891B2] to-[#14b8a6] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              J&apos;ai confirmé mon email
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Besoin d&apos;aide ? Contactez notre support
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="w-full max-w-md">
      <div className="flex justify-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0891B2] to-[#14b8a6] p-1 shadow-lg animate-pulse">
          <div className="h-full w-full rounded-xl bg-white"></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0891B2]" />
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 px-4 py-12">
      <Suspense fallback={<LoadingState />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
