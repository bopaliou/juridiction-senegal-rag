"use client";

import React from 'react';
import { CreditCard, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCredits } from '@/lib/hooks/useCredits';

interface CreditGaugeProps {
  showRefresh?: boolean;
}

export const CreditGauge: React.FC<CreditGaugeProps> = ({
  showRefresh = false
}) => {
  const { balance, loading, error, refreshBalance, isLowBalance, isExhausted } = useCredits();

  if (loading) {
    return (
      <div className="p-4 rounded-lg border bg-gray-100 border-gray-200 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <span className="font-semibold text-gray-400">Chargement...</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2"></div>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="p-4 rounded-lg border bg-red-50 border-red-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="font-semibold text-red-600">Erreur de chargement</span>
        </div>
        <p className="text-sm text-red-700">{error || 'Impossible de récupérer les crédits'}</p>
      </div>
    );
  }

  const usagePercentage = balance.usagePercentage;
  const { credits, monthlyQuota, plan, resetDate } = balance;

  const getColor = () => {
    if (isExhausted) return 'text-red-600';
    if (isLowBalance) return 'text-amber-600';
    return 'text-green-600';
  };

  const getBgColor = () => {
    if (isExhausted) return 'bg-red-100';
    if (isLowBalance) return 'bg-amber-100';
    return 'bg-green-100';
  };

  const getBorderColor = () => {
    if (isExhausted) return 'border-red-200';
    if (isLowBalance) return 'border-amber-200';
    return 'border-green-200';
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()} ${getBorderColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CreditCard className={`h-5 w-5 ${getColor()}`} />
          <span className={`font-semibold ${getColor()}`}>
            Crédits {plan.charAt(0).toUpperCase() + plan.slice(1).replace('_', '+')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLowBalance && (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {showRefresh && (
            <button
              onClick={refreshBalance}
              className="p-1 hover:bg-white/50 rounded transition-colors"
              title="Actualiser"
            >
              <RefreshCw className="h-4 w-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>Utilisés: {monthlyQuota - credits}</span>
          <span>Disponibles: {credits}</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isExhausted ? 'bg-red-500' :
              isLowBalance ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-600">
          <span>Quota: {monthlyQuota}</span>
          <span>Reset: {new Date(resetDate).toLocaleDateString('fr-FR')}</span>
        </div>

        {isLowBalance && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            ⚠️ Crédits faibles. Pensez à recharger !
          </div>
        )}

        {isExhausted && (
          <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
            ❌ Crédits épuisés. Rechargez pour continuer.
          </div>
        )}
      </div>
    </div>
  );
};
