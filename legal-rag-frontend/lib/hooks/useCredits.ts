"use client";

import { useState, useEffect, useCallback } from 'react';

interface CreditBalance {
  credits: number;
  plan: string;
  monthlyQuota: number;
  resetDate: string;
  usagePercentage: number;
}

interface CreditHook {
  balance: CreditBalance | null;
  loading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
  isLowBalance: boolean;
  isExhausted: boolean;
}

export function useCredits(): CreditHook {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/credits/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
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
