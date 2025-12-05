import AuthForm from '@/components/auth/AuthForm'
import Image from 'next/image'

export default function SignupPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#E0F7FA] to-[#B2EBF2] p-4 overflow-hidden">
      {/* Image de fond */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="relative w-full max-w-4xl h-full">
          <Image
            src="/assets/logo.png"
            alt=""
            fill
            className="object-contain"
            priority
            quality={90}
          />
        </div>
      </div>
      
      {/* Contenu au-dessus */}
      <div className="relative z-10 w-full">
        <AuthForm mode="signup" />
      </div>
    </div>
  )
}

