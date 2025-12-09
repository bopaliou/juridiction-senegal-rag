"use client";

import React, { useMemo, useState } from 'react';

type PlanType = 'subs' | 'topups';

type Plan = {
  id: string;
  title: string;
  price: string;
  credits: string;
  features: string[];
  badge?: 'RECOMMANDÉ' | 'POPULAIRE';
  accent?: 'primary' | 'accent';
  icon: string; // Pour Next.js, on utilisera des noms d'icônes
};

const COLORS = {
  primary: '#2563EB',
  background: '#F8FAFC',
  textMain: '#0F172A',
  textMuted: '#64748B',
  accent: '#F59E0B',
  white: '#FFFFFF',
  border: '#E2E8F0',
  success: '#22C55E',
};

const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: 'free',
    title: 'Gratuit',
    price: '0 FCFA',
    credits: '30 crédits',
    features: ['Fonctionnalités limitées'],
    icon: 'Shield',
  },
  {
    id: 'essential',
    title: 'Essentiel',
    price: '2 000 FCFA',
    credits: '500 crédits',
    features: ['Questions illimitées', 'Procédures guidées'],
    badge: 'RECOMMANDÉ',
    accent: 'primary',
    icon: 'Star',
  },
  {
    id: 'premium',
    title: 'Premium',
    price: '4 500 FCFA',
    credits: '1 500 crédits',
    features: ['Analyse PDF', 'Modèles juridiques', 'Audio'],
    accent: 'accent',
    icon: 'Zap',
  },
];

const TOPUP_PLANS: Plan[] = [
  {
    id: 'depanne',
    title: 'Recharge Dépanne',
    price: '500 FCFA',
    credits: '100 crédits',
    features: ['Idéal pour une question urgente'],
    icon: 'CreditCard',
  },
  {
    id: 'dossier',
    title: 'Recharge Dossier',
    price: '2 000 FCFA',
    credits: '500 crédits',
    features: ['Pour suivre un dossier complet'],
    badge: 'POPULAIRE',
    accent: 'primary',
    icon: 'Shield',
  },
  {
    id: 'pro',
    title: 'Recharge Pro',
    price: '5 000 FCFA',
    credits: '1 500 crédits',
    features: ['Volume élevé pour professionnels'],
    accent: 'accent',
    icon: 'Zap',
  },
];

export default function PricingScreen() {
  const [activeTab, setActiveTab] = useState<PlanType>('subs');

  const plans = useMemo(() => {
    return activeTab === 'subs' ? SUBSCRIPTION_PLANS : TOPUP_PLANS;
  }, [activeTab]);

  const handlePress = (plan: Plan) => {
    console.log(`Plan sélectionné : ${plan.id} (${activeTab})`);
    // Ici vous pouvez intégrer le paiement ou la logique métier
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Offres & Crédits
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Choisissez un abonnement ou une recharge : flexibilité totale pour vos besoins juridiques.
          </p>
        </div>

        <div className="flex bg-gray-200 rounded-lg p-1 mb-8">
          <button
            className={`flex-1 py-3 px-4 rounded-md text-center font-semibold transition-all ${
              activeTab === 'subs'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('subs')}
          >
            Abonnements
          </button>
          <button
            className={`flex-1 py-3 px-4 rounded-md text-center font-semibold transition-all ${
              activeTab === 'topups'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('topups')}
          >
            Recharges
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {plans.map((plan) => {
            const isHighlighted = Boolean(plan.badge);
            const isPrimary = plan.accent === 'primary';
            const isAccent = plan.accent === 'accent';

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl p-6 border-2 shadow-lg transition-all hover:shadow-xl ${
                  isHighlighted ? 'border-blue-500 shadow-blue-100' :
                  isAccent ? 'border-amber-400' : 'border-gray-200'
                }`}
              >
                {plan.badge && (
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-4 ${
                    plan.badge === 'RECOMMANDÉ'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mr-4">
                    <span className="text-xl text-blue-600">★</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {plan.title}
                    </h3>
                    <p className="text-lg font-bold text-gray-900">
                      {plan.price}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {plan.credits}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 px-4 rounded-lg font-bold transition-all ${
                    isHighlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                      : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => handlePress(plan)}
                >
                  Choisir
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
