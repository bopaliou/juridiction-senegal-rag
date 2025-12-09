/**
 * Actions serveur pour la gestion des crédits
 * Intègre avec Supabase pour créer et gérer les utilisateurs crédits
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { PlanType } from '@/lib/credits/client'

/**
 * Crée un utilisateur dans le système de crédits
 * Appelé automatiquement lors de l'inscription
 */
export async function createCreditUser(userId: string, email: string, plan: PlanType = PlanType.FREE) {
  try {
    const supabase = await createClient()

    // Calculer les crédits selon le plan
    const planCredits = {
      [PlanType.FREE]: 30,
      [PlanType.PREMIUM]: 500,
      [PlanType.PREMIUM_PLUS]: 1500,
      [PlanType.PRO]: 10000,
    }

    const monthlyQuota = planCredits[plan]

    // Insérer dans la table users du système de crédits
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        plan: plan,
        credits: monthlyQuota, // Commencer avec le quota complet
        monthly_quota: monthlyQuota,
        reset_date: new Date().toISOString().split('T')[0], // Aujourd'hui
      })
      .select()

    if (error) {
      console.error('Erreur création utilisateur crédits:', error)
      // Ne pas throw pour ne pas bloquer l'inscription
      // L'utilisateur pourra utiliser le plan free par défaut
      return { success: false, error: error.message }
    }

    console.log('Utilisateur crédits créé:', data)
    return { success: true, data }
  } catch (err) {
    console.error('Erreur création utilisateur crédits:', err)
    return { success: false, error: 'Erreur système' }
  }
}

/**
 * Met à jour le plan d'un utilisateur
 * Utile pour les upgrades/downgrades
 */
export async function updateUserPlan(userId: string, newPlan: PlanType) {
  try {
    const supabase = await createClient()

    // Calculer les nouveaux crédits selon le plan
    const planCredits = {
      [PlanType.FREE]: 30,
      [PlanType.PREMIUM]: 500,
      [PlanType.PREMIUM_PLUS]: 1500,
      [PlanType.PRO]: 10000,
    }

    const newMonthlyQuota = planCredits[newPlan]

    const { data, error } = await supabase
      .from('users')
      .update({
        plan: newPlan,
        monthly_quota: newMonthlyQuota,
        // Optionnel: remettre les crédits au quota complet lors du changement de plan
        // credits: newMonthlyQuota,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Erreur mise à jour plan:', error)
      return { success: false, error: error.message }
    }

    console.log('Plan utilisateur mis à jour:', data)
    return { success: true, data }
  } catch (err) {
    console.error('Erreur mise à jour plan:', err)
    return { success: false, error: 'Erreur système' }
  }
}

/**
 * Vérifie si un utilisateur existe dans le système de crédits
 */
export async function checkCreditUserExists(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Erreur vérification utilisateur crédits:', error)
      return false
    }

    return !!data
  } catch (err) {
    console.error('Erreur vérification utilisateur crédits:', err)
    return false
  }
}
