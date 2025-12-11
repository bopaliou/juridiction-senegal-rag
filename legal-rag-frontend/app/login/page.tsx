import { AuthForm } from '@/components/auth/AuthForm'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
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
        <AuthForm mode="login" />
      </main>
    </div>
  )
}