/**
 * Client pour les opérations de crédits côté frontend
 * Utilise l'API backend pour gérer les crédits
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export type PlanType = 'free' | 'premium' | 'premium_plus' | 'pro';

export interface CreditBalance {
  credits: number;
  plan: string;
  monthlyQuota: number;
  resetDate: string;
  usagePercentage: number;
}

export interface CreditEstimate {
  estimatedTokens: number;
  estimatedCredits: number;
  canExecute: boolean;
  currentBalance: number;
  message?: string;
}

export interface CreditTransaction {
  id: number;
  amount: number;
  reason: string;
  packType?: string;
  timestamp: string;
  paymentId?: string;
}

export interface PlanInfo {
  planType: string;
  name: string;
  monthlyCredits: number;
  features: string[];
  priceXof: number;
}

export interface TopUpInfo {
  packType: string;
  name: string;
  credits: number;
  priceXof: number;
  description: string;
}

/**
 * Récupère le solde de crédits de l'utilisateur
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  const response = await fetch(`${API_BASE_URL}/credits/balance`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Pour les cookies de session
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Estime le coût en crédits pour une requête
 */
export async function estimateCost(requestType: string, estimatedTokens?: number): Promise<CreditEstimate> {
  const params = new URLSearchParams({
    request_type: requestType,
  });

  if (estimatedTokens) {
    params.append('estimated_tokens', estimatedTokens.toString());
  }

  const response = await fetch(`${API_BASE_URL}/credits/estimate?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère la liste des plans disponibles
 */
export async function getPlans(): Promise<PlanInfo[]> {
  const response = await fetch(`${API_BASE_URL}/credits/plans`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère la liste des packs de recharge
 */
export async function getTopUpPacks(): Promise<TopUpInfo[]> {
  const response = await fetch(`${API_BASE_URL}/credits/topups`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Achète un pack de recharge
 */
export async function purchaseTopUp(packType: string, paymentMethod: string = 'mobile_money') {
  const response = await fetch(`${API_BASE_URL}/credits/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      pack_type: packType,
      payment_method: paymentMethod,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `Erreur HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère les statistiques d'utilisation
 */
export async function getUsageStats(days: number = 30) {
  const response = await fetch(`${API_BASE_URL}/credits/usage/stats?days=${days}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère l'historique des transactions
 */
export async function getCreditTransactions(limit: number = 20, offset: number = 0): Promise<{
  transactions: CreditTransaction[];
  total: number;
}> {
  const response = await fetch(`${API_BASE_URL}/credits/transactions?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }

  return response.json();
}
