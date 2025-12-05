'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Traduit les messages d'erreur Supabase en français
 */
function translateError(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.',
    'Invalid credentials': 'Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.',
    'Email not confirmed': 'Votre email n\'a pas été confirmé. Veuillez vérifier votre boîte de réception.',
    'User already registered': 'Cet email est déjà utilisé. Essayez de vous connecter ou réinitialisez votre mot de passe.',
    'Email rate limit exceeded': 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.',
    'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
    'Unable to validate email address: invalid format': 'Format d\'email invalide. Veuillez entrer une adresse email valide.',
    'User not found': 'Aucun compte trouvé avec cet email.',
    'Forbidden': 'Accès refusé. Veuillez contacter le support si le problème persiste.',
    'Email link is invalid or has expired': 'Le lien a expiré ou est invalide. Veuillez demander un nouveau lien.',
    'Token has expired or is invalid': 'Le lien a expiré. Veuillez demander un nouveau lien.',
    'New password should be different': 'Le nouveau mot de passe doit être différent de votre mot de passe actuel. Veuillez choisir un autre mot de passe.',
    'New password should be different from the old password': 'Le nouveau mot de passe doit être différent de votre mot de passe actuel. Veuillez choisir un autre mot de passe.',
    'Password should be different': 'Le nouveau mot de passe doit être différent de votre mot de passe actuel. Veuillez choisir un autre mot de passe.',
    'same password': 'Le nouveau mot de passe doit être différent de votre mot de passe actuel. Veuillez choisir un autre mot de passe.',
    'new password is the same': 'Le nouveau mot de passe doit être différent de votre mot de passe actuel. Veuillez choisir un autre mot de passe.',
    'password is the same': 'Le nouveau mot de passe doit être différent de votre mot de passe actuel. Veuillez choisir un autre mot de passe.',
  }

  // Chercher une correspondance exacte ou partielle
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  // Message par défaut plus rassurant
  return 'Une erreur est survenue. Veuillez réessayer ou contacter le support si le problème persiste.'
}

/**
 * Actions serveur pour l'authentification
 * Utilise 'use server' pour garantir l'exécution côté serveur
 */

export async function signUp(email: string, password: string, fullName?: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?type=signup`,
    },
  })

  if (error) {
    return { error: translateError(error.message) }
  }

  return { data, error: null }
}

export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: translateError(error.message) }
  }

  revalidatePath('/', 'layout')
  return { error: null }
}

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: translateError(error.message) }
  }

  revalidatePath('/', 'layout')
  return { error: null }
}

export async function resetPassword(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
  })

  if (error) {
    return { error: translateError(error.message) }
  }

  return { error: null }
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { error: translateError(error.message) }
  }

  return { error: null }
}

export async function getUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return { user: null, error: translateError(error.message) }
  }

  return { user, error: null }
}

