"use client";

import React from 'react';
import { CreditCard, AlertTriangle } from 'lucide-react';

interface CreditGaugeProps {
  credits: number;
  quota: number;
  plan: string;
  resetDate: string;
}

export const CreditGauge: React.FC<CreditGaugeProps> = ({
  credits,
  quota,
  plan,
  resetDate
}) => {
  const usagePercentage = ((quota - credits) / quota) * 100;
  const isLowCredits = credits < quota * 0.1; // Moins de 10%
  const isExhausted = credits === 0;

  const getColor = () => {
    if (isExhausted) return 'text-red-600';
    if (isLowCredits) return 'text-amber-600';
    return 'text-green-600';
  };

  const getBgColor = () => {
    if (isExhausted) return 'bg-red-100';
    if (isLowCredits) return 'bg-amber-100';
    return 'bg-green-100';
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()} border-current`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CreditCard className={`h-5 w-5 ${getColor()}`} />
          <span className={`font-semibold ${getColor()}`}>
            Crédits {plan.charAt(0).toUpperCase() + plan.slice(1)}
          </span>
        </div>
        {isLowCredits && (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>Utilisés: {quota - credits}</span>
          <span>Disponibles: {credits}</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isExhausted ? 'bg-red-500' :
              isLowCredits ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-600">
          <span>Quota: {quota}</span>
          <span>Reset: {new Date(resetDate).toLocaleDateString('fr-FR')}</span>
        </div>

        {isLowCredits && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
            ⚠️ Crédits faibles. Pensez à recharger !
          </div>
        )}

        {isExhausted && (
          <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded">
            ❌ Crédits épuisés. Rechargez pour continuer.
          </div>
        )}
      </div>
    </div>
  );
};
