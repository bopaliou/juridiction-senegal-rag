import AuthForm from '@/components/auth/AuthForm'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#E0F7FA] to-[#B2EBF2] p-4">
      <AuthForm mode="signup" />
    </div>
  )
}

