"use client";

import React from 'react';
import { AlertTriangle, CreditCard, X } from 'lucide-react';

interface LowBalancePopupProps {
  isVisible: boolean;
  onClose: () => void;
  onTopUp: () => void;
  credits: number;
  plan: string;
}

export const LowBalancePopup: React.FC<LowBalancePopupProps> = ({
  isVisible,
  onClose,
  onTopUp,
  credits,
  plan
}) => {
  if (!isVisible) return null;

  const getMessage = () => {
    if (credits === 0) {
      return {
        title: "Crédits épuisés",
        description: "Vous n'avez plus de crédits disponibles. Rechargez pour continuer à utiliser YoonAssist AI.",
        severity: "error" as const
      };
    }
    return {
      title: "Crédits faibles",
      description: `Il ne vous reste que ${credits} crédit${credits > 1 ? 's' : ''}. Pensez à recharger pour éviter l'interruption.`,
      severity: "warning" as const
    };
  };

  const message = getMessage();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              message.severity === 'error' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                message.severity === 'error' ? 'text-red-600' : 'text-amber-600'
              }`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {message.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-600 mb-4">
            {message.description}
          </p>

          <div className={`p-3 rounded-lg mb-4 ${
            message.severity === 'error' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">
                Plan actuel: {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Crédits restants: <span className="font-semibold">{credits}</span>
            </div>
          </div>

          {/* Quick top-up options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Recharges rapides:</p>
            <div className="grid grid-cols-3 gap-2">
              <button className="p-2 text-center border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <div className="text-xs text-gray-600">100 crédits</div>
                <div className="text-sm font-semibold text-gray-900">500 XOF</div>
              </button>
              <button className="p-2 text-center border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <div className="text-xs text-gray-600">500 crédits</div>
                <div className="text-sm font-semibold text-gray-900">2000 XOF</div>
              </button>
              <button className="p-2 text-center border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <div className="text-xs text-gray-600">1500 crédits</div>
                <div className="text-sm font-semibold text-gray-900">5000 XOF</div>
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Plus tard
          </button>
          <button
            onClick={onTopUp}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Recharger
          </button>
        </div>
      </div>
    </div>
  );
};
