import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Check, Star, Zap, Shield, CreditCard } from 'lucide-react-native';

type PlanType = 'subs' | 'topups';

type Plan = {
  id: string;
  title: string;
  price: string;
  credits: string;
  features: string[];
  badge?: 'RECOMMANDÉ' | 'POPULAIRE';
  accent?: 'primary' | 'accent';
  icon: React.ComponentType<{ size?: number; color?: string }>;
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
    icon: Shield,
  },
  {
    id: 'essential',
    title: 'Essentiel',
    price: '2 000 FCFA',
    credits: '500 crédits',
    features: ['Questions illimitées', 'Procédures guidées'],
    badge: 'RECOMMANDÉ',
    accent: 'primary',
    icon: Star,
  },
  {
    id: 'premium',
    title: 'Premium',
    price: '4 500 FCFA',
    credits: '1 500 crédits',
    features: ['Analyse PDF', 'Modèles juridiques', 'Audio'],
    accent: 'accent',
    icon: Zap,
  },
];

const TOPUP_PLANS: Plan[] = [
  {
    id: 'depanne',
    title: 'Recharge Dépanne',
    price: '500 FCFA',
    credits: '100 crédits',
    features: ['Idéal pour une question urgente'],
    icon: CreditCard,
  },
  {
    id: 'dossier',
    title: 'Recharge Dossier',
    price: '2 000 FCFA',
    credits: '500 crédits',
    features: ['Pour suivre un dossier complet'],
    badge: 'POPULAIRE',
    accent: 'primary',
    icon: Shield,
  },
  {
    id: 'pro',
    title: 'Recharge Pro',
    price: '5 000 FCFA',
    credits: '1 500 crédits',
    features: ['Volume élevé pour professionnels'],
    accent: 'accent',
    icon: Zap,
  },
];

export const PricingScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PlanType>('subs');

  const plans = useMemo(() => {
    return activeTab === 'subs' ? SUBSCRIPTION_PLANS : TOPUP_PLANS;
  }, [activeTab]);

  const handlePress = (plan: Plan) => {
    console.log(`Plan sélectionné : ${plan.id} (${activeTab})`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Offres & Crédits</Text>
          <Text style={styles.subtitle}>
            Choisissez un abonnement ou une recharge : flexibilité totale pour vos besoins juridiques.
          </Text>
        </View>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleButton, activeTab === 'subs' && styles.toggleButtonActive]}
            onPress={() => setActiveTab('subs')}
          >
            <Text style={[styles.toggleText, activeTab === 'subs' && styles.toggleTextActive]}>
              Abonnements
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, activeTab === 'topups' && styles.toggleButtonActive]}
            onPress={() => setActiveTab('topups')}
          >
            <Text style={[styles.toggleText, activeTab === 'topups' && styles.toggleTextActive]}>
              Recharges
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardsContainer}>
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isHighlighted = Boolean(plan.badge);
            const isPrimary = plan.accent === 'primary';
            const isAccent = plan.accent === 'accent';

            return (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  isHighlighted && styles.cardHighlighted,
                  isPrimary && styles.cardPrimaryBorder,
                  isAccent && styles.cardAccentBorder,
                ]}
              >
                {plan.badge && (
                  <View
                    style={[
                      styles.badge,
                      plan.badge === 'RECOMMANDÉ' ? styles.badgePrimary : styles.badgeAccent,
                    ]}
                  >
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                )}

                <View style={styles.cardHeader}>
                  <View style={styles.iconWrapper}>
                    <Icon size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{plan.title}</Text>
                    <Text style={styles.cardPrice}>{plan.price}</Text>
                    <Text style={styles.cardCredits}>{plan.credits}</Text>
                  </View>
                </View>

                <View style={styles.features}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureItem}>
                      <Check size={18} color={COLORS.success} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.button, isHighlighted ? styles.buttonPrimary : styles.buttonOutline]}
                  onPress={() => handlePress(plan)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isHighlighted ? styles.buttonTextPrimary : styles.buttonTextOutline,
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  toggleTextActive: {
    color: COLORS.primary,
  },
  cardsContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardHighlighted: {
    elevation: 4,
    shadowOpacity: 0.1,
  },
  cardPrimaryBorder: {
    borderColor: COLORS.primary,
  },
  cardAccentBorder: {
    borderColor: COLORS.accent,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgePrimary: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  badgeAccent: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  cardCredits: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  features: {
    gap: 8,
    marginBottom: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.textMain,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  buttonOutline: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: COLORS.white,
  },
  buttonTextOutline: {
    color: COLORS.textMain,
  },
});

export default PricingScreen;

