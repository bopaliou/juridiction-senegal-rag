import AuthForm from '@/components/auth/AuthForm'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">
      {/* Image de fond avec blur */}
      <div className="absolute inset-0">
        <Image
          src="/assets/senegal_droit.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        {/* Overlay sombre pour améliorer le contraste */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2942]/85 via-[#0F2942]/75 to-[#0891B2]/80" />
        {/* Effet de blur subtil pour réduire la distraction */}
        <div className="absolute inset-0 backdrop-blur-[1px]" />
      </div>
      
      {/* Contenu centré */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        <AuthForm mode="login" />
      </div>
    </div>
  )
}

