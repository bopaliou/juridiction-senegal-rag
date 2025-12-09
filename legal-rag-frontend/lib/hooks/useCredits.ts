"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  getCreditBalance,
  estimateCost,
  getPlans,
  getTopUpPacks,
  purchaseTopUp,
  getUsageStats,
  getCreditTransactions,
  type CreditBalance,
  type CreditEstimate,
  type PlanInfo,
  type TopUpInfo,
  type CreditTransaction
} from '@/lib/credits/client';

interface CreditHook {
  balance: CreditBalance | null;
  loading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
  isLowBalance: boolean;
  isExhausted: boolean;
}

interface CreditEstimateHook {
  estimate: CreditEstimate | null;
  loading: boolean;
  estimateCost: (requestType: string, estimatedTokens?: number) => Promise<CreditEstimate | null>;
}

interface PlansHook {
  plans: PlanInfo[];
  loading: boolean;
  error: string | null;
  refreshPlans: () => Promise<void>;
}

interface TopUpHook {
  packs: TopUpInfo[];
  loading: boolean;
  error: string | null;
  refreshPacks: () => Promise<void>;
  purchaseTopUp: (packType: string, paymentMethod?: string) => Promise<any>;
}

interface UsageStatsHook {
  stats: any;
  loading: boolean;
  error: string | null;
  refreshStats: (days?: number) => Promise<void>;
}

interface TransactionsHook {
  transactions: CreditTransaction[];
  total: number;
  loading: boolean;
  error: string | null;
  refreshTransactions: (limit?: number, offset?: number) => Promise<void>;
}

export function useCredits(): CreditHook {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCreditBalance();
      setBalance(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur récupération crédits:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const isLowBalance = balance ? balance.credits < balance.monthlyQuota * 0.1 : false;
  const isExhausted = balance ? balance.credits === 0 : false;

  return {
    balance,
    loading,
    error,
    refreshBalance,
    isLowBalance,
    isExhausted,
  };
}

export function useCreditEstimate(): CreditEstimateHook {
  const [estimate, setEstimate] = useState<CreditEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  const estimateRequestCost = useCallback(async (requestType: string, estimatedTokens?: number) => {
    try {
      setLoading(true);
      const data = await estimateCost(requestType, estimatedTokens);
      setEstimate(data || null);
      return data;
    } catch (err) {
      console.error('Erreur estimation coût:', err);
      setEstimate({
        estimatedTokens: 0,
        estimatedCredits: 0,
        canExecute: false,
        currentBalance: 0,
        message: 'Erreur estimation',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    estimate,
    loading,
    estimateCost: estimateRequestCost,
  };
}

export function usePlans(): PlansHook {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlans();
      setPlans(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur récupération plans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPlans = useCallback(async () => {
    await fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    loading,
    error,
    refreshPlans,
  };
}

export function useTopUp(): TopUpHook {
  const [packs, setPacks] = useState<TopUpInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPacks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTopUpPacks();
      setPacks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur récupération packs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPacks = useCallback(async () => {
    await fetchPacks();
  }, [fetchPacks]);

  const purchasePack = useCallback(async (packType: string, paymentMethod: string = 'mobile_money') => {
    try {
      setLoading(true);
      setError(null);
      const result = await purchaseTopUp(packType, paymentMethod);
      // Rafraîchir le solde après achat réussi
      await refreshPacks();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur achat topup:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshPacks]);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  return {
    packs,
    loading,
    error,
    refreshPacks,
    purchaseTopUp: purchasePack,
  };
}

export function useUsageStats(): UsageStatsHook {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (days: number = 30) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsageStats(days);
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur récupération stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async (days: number = 30) => {
    await fetchStats(days);
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refreshStats,
  };
}

export function useCreditTransactions(): TransactionsHook {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (limit: number = 20, offset: number = 0) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCreditTransactions(limit, offset);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur récupération transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTransactions = useCallback(async (limit: number = 20, offset: number = 0) => {
    await fetchTransactions(limit, offset);
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    total,
    loading,
    error,
    refreshTransactions,
  };
}

export function useCreditEstimate() {
  const [estimate, setEstimate] = useState<{
    estimatedCredits: number;
    canExecute: boolean;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const estimateCost = useCallback(async (requestType: string, estimatedTokens?: number) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        request_type: requestType,
      });

      if (estimatedTokens) {
        params.append('estimated_tokens', estimatedTokens.toString());
      }

      const response = await fetch(`/api/credits/estimate?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      setEstimate({
        estimatedCredits: data.estimated_credits,
        canExecute: data.can_execute,
        message: data.message,
      });

      return data;
    } catch (err) {
      console.error('Erreur estimation coût:', err);
      setEstimate({
        estimatedCredits: 0,
        canExecute: false,
        message: 'Erreur estimation',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    estimate,
    loading,
    estimateCost,
  };
}

export function useTopUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseTopUp = useCallback(async (packType: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/credits/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pack_type: packType,
          payment_method: 'mobile_money',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur achat topup:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    purchaseTopUp,
    loading,
    error,
  };
}
