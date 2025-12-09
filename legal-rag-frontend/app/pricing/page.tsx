import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Adaptation pour Next.js - on utilise des composants web équivalents
// Note: Dans un vrai projet mobile, ces imports seraient différents

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
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.background, padding: '20px 0' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 }}>
              Offres & Crédits
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textMuted, lineHeight: '20px' }}>
              Choisissez un abonnement ou une recharge : flexibilité totale pour vos besoins juridiques.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4, marginBottom: 16 }}>
            <TouchableOpacity
              style={[
                { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
                activeTab === 'subs' && { backgroundColor: COLORS.white, elevation: 2, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
              ]}
              onPress={() => setActiveTab('subs')}
            >
              <Text
                style={[
                  { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
                  activeTab === 'subs' && { color: COLORS.primary }
                ]}
              >
                Abonnements
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
                activeTab === 'topups' && { backgroundColor: COLORS.white, elevation: 2, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
              ]}
              onPress={() => setActiveTab('topups')}
            >
              <Text
                style={[
                  { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
                  activeTab === 'topups' && { color: COLORS.primary }
                ]}
              >
                Recharges
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 14 }}>
            {plans.map((plan) => {
              const isHighlighted = Boolean(plan.badge);
              const isPrimary = plan.accent === 'primary';
              const isAccent = plan.accent === 'accent';

              return (
                <View
                  key={plan.id}
                  style={[
                    {
                      backgroundColor: COLORS.white,
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      elevation: 2,
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 3 }
                    },
                    isHighlighted && { elevation: 4, shadowOpacity: 0.1 },
                    isPrimary && { borderColor: COLORS.primary },
                    isAccent && { borderColor: COLORS.accent }
                  ]}
                >
                  {plan.badge && (
                    <View
                      style={[
                        {
                          alignSelf: 'flex-start',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 20,
                          marginBottom: 10
                        },
                        plan.badge === 'RECOMMANDÉ'
                          ? { backgroundColor: 'rgba(37, 99, 235, 0.12)' }
                          : { backgroundColor: 'rgba(245, 158, 11, 0.14)' }
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMain }}>
                        {plan.badge}
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12
                    }}>
                      {/* Ici vous pouvez remplacer par une vraie icône */}
                      <Text style={{ fontSize: 18, color: COLORS.primary }}>★</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 2 }}>
                        {plan.title}
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textMain }}>
                        {plan.price}
                      </Text>
                      <Text style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 2 }}>
                        {plan.credits}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginBottom: 14 }}>
                    {plan.features.map((feature) => (
                      <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16, color: COLORS.success }}>✓</Text>
                        <Text style={{ fontSize: 14, color: COLORS.textMain }}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      {
                        borderRadius: 12,
                        paddingVertical: 12,
                        alignItems: 'center',
                        borderWidth: 1.5
                      },
                      isHighlighted
                        ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                        : { backgroundColor: COLORS.white, borderColor: COLORS.border }
                    ]}
                    onPress={() => handlePress(plan)}
                  >
                    <Text
                      style={[
                        { fontSize: 15, fontWeight: '700' },
                        isHighlighted
                          ? { color: COLORS.white }
                          : { color: COLORS.textMain }
                      ]}
                    >
                      Choisir
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </div>
    </div>
  );
}

// Styles adaptés pour Next.js/React (utilisation limitée car on utilise inline styles principalement)
const styles = StyleSheet.create({
  // Styles vides car on utilise principalement des objets de style inline
  // Dans un vrai projet mobile, on garderait StyleSheet
});
