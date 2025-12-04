'use client';

import { Briefcase, Gavel, ArrowRight, Sparkles, Users, Clock, Shield } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';

interface EmptyStateProps {
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

// Questions citoyennes - accessibles et pratiques
const ALL_CITIZEN_QUESTIONS = [
  // Travail - Questions pratiques
  {
    icon: Briefcase,
    question: "Combien de jours de congé ai-je droit par an ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Mon employeur peut-il me licencier sans préavis ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Que faire si mon employeur ne me paie pas mon salaire ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Comment démissionner de mon travail ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Quels sont mes droits si je suis licencié ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Peut-on m'obliger à faire des heures supplémentaires ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Est-ce que j'ai droit à un contrat de travail écrit ?",
    category: "Travail",
    color: "cyan"
  },
  {
    icon: Briefcase,
    question: "Comment contester un licenciement abusif ?",
    category: "Travail",
    color: "cyan"
  },
  // Retraite
  {
    icon: Clock,
    question: "À quel âge puis-je partir à la retraite au Sénégal ?",
    category: "Retraite",
    color: "teal"
  },
  {
    icon: Clock,
    question: "Comment calculer ma pension de retraite ?",
    category: "Retraite",
    color: "teal"
  },
  {
    icon: Clock,
    question: "Combien d'années faut-il cotiser pour la retraite ?",
    category: "Retraite",
    color: "teal"
  },
  {
    icon: Clock,
    question: "Peut-on continuer à travailler après l'âge de la retraite ?",
    category: "Retraite",
    color: "teal"
  },
  // Droits fondamentaux
  {
    icon: Shield,
    question: "Le travail forcé est-il interdit au Sénégal ?",
    category: "Droits",
    color: "green"
  },
  {
    icon: Shield,
    question: "Ai-je le droit de m'exprimer librement au travail ?",
    category: "Droits",
    color: "green"
  },
  {
    icon: Shield,
    question: "Peut-on me discriminer à l'embauche ?",
    category: "Droits",
    color: "green"
  },
  {
    icon: Shield,
    question: "Quels sont mes droits fondamentaux en tant que travailleur ?",
    category: "Droits",
    color: "green"
  },
  // Syndicats
  {
    icon: Users,
    question: "Ai-je le droit de créer ou rejoindre un syndicat ?",
    category: "Syndicats",
    color: "navy"
  },
  {
    icon: Users,
    question: "Comment créer un syndicat dans mon entreprise ?",
    category: "Syndicats",
    color: "navy"
  },
  {
    icon: Users,
    question: "Mon employeur peut-il m'interdire d'adhérer à un syndicat ?",
    category: "Syndicats",
    color: "navy"
  },
  // Justice
  {
    icon: Gavel,
    question: "Quelles sont les sanctions en cas de harcèlement au travail ?",
    category: "Justice",
    color: "green"
  },
  {
    icon: Gavel,
    question: "Comment porter plainte contre mon employeur ?",
    category: "Justice",
    color: "green"
  },
  {
    icon: Gavel,
    question: "Quelles sont les peines pour violences au Sénégal ?",
    category: "Justice",
    color: "green"
  },
];

const colorStyles = {
  cyan: {
    bg: 'bg-[#0891B2]/5',
    border: 'border-[#0891B2]/20',
    hoverBorder: 'hover:border-[#0891B2]/50',
    icon: 'text-[#0891B2]',
    iconBg: 'bg-[#0891B2]/10',
    badge: 'bg-[#0891B2]/10 text-[#0891B2]'
  },
  teal: {
    bg: 'bg-[#14B8A6]/5',
    border: 'border-[#14B8A6]/20',
    hoverBorder: 'hover:border-[#14B8A6]/50',
    icon: 'text-[#14B8A6]',
    iconBg: 'bg-[#14B8A6]/10',
    badge: 'bg-[#14B8A6]/10 text-[#14B8A6]'
  },
  green: {
    bg: 'bg-[#059669]/5',
    border: 'border-[#059669]/20',
    hoverBorder: 'hover:border-[#059669]/50',
    icon: 'text-[#059669]',
    iconBg: 'bg-[#059669]/10',
    badge: 'bg-[#059669]/10 text-[#059669]'
  },
  navy: {
    bg: 'bg-[#0F2942]/5',
    border: 'border-[#0F2942]/20',
    hoverBorder: 'hover:border-[#0F2942]/50',
    icon: 'text-[#0F2942]',
    iconBg: 'bg-[#0F2942]/10',
    badge: 'bg-[#0F2942]/10 text-[#0F2942]'
  }
};

// Fonction pour mélanger un tableau
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function EmptyState({ onQuestionClick, isLoading = false }: EmptyStateProps) {
  // Utiliser useMemo pour éviter setState dans useEffect
  const [randomQuestions] = useState(() => {
    // Initialisation lazy - exécutée une seule fois
    return shuffleArray(ALL_CITIZEN_QUESTIONS).slice(0, 4);
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Déclencher le montage après le premier render côté client
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8 md:py-12 overflow-x-hidden">
      <div className="mx-auto w-full max-w-3xl text-center px-2 sm:px-0">
        {/* Logo animé */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="relative animate-float">
            {/* Glow effect - plus petit sur mobile */}
            <div className="absolute inset-0 blur-2xl sm:blur-3xl bg-gradient-to-r from-[#0891B2]/20 via-[#14B8A6]/20 to-[#059669]/20 rounded-full scale-125 sm:scale-150"></div>
            
            {/* Logo container */}
            <div className="relative logo-container h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 shadow-lg sm:shadow-xl animate-pulse-glow">
              <Image
                src="/assets/logo.png"
                alt="YoonAssist AI Logo"
                width={160}
                height={160}
                className="h-full w-full object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* Titre avec gradient */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-2 sm:mb-3">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text-navy">
              Bienvenue sur YoonAssist
            </h2>
            <span className="badge badge-cyan animate-scale-in mt-1 sm:mt-0">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              AI
            </span>
          </div>
          
          {/* Slogan */}
          <p className="text-sm sm:text-base md:text-lg font-semibold gradient-text mb-3 sm:mb-4 px-2">
            Votre assistant juridique intelligent pour le droit sénégalais
          </p>
          
          {/* Description */}
          <p className="text-xs sm:text-sm md:text-base text-[#64748B] max-w-xl mx-auto leading-relaxed px-2">
            Posez vos questions sur vos droits au travail, la retraite, les congés et bien plus encore.
          </p>
        </div>

        {/* Séparateur décoratif */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 md:mb-8 justify-center px-4">
          <div className="h-px w-8 sm:w-16 bg-gradient-to-r from-transparent to-[#0891B2]/30"></div>
          <span className="text-[10px] sm:text-xs text-[#94A3B8] font-medium uppercase tracking-wider whitespace-nowrap">Questions suggérées</span>
          <div className="h-px w-8 sm:w-16 bg-gradient-to-l from-transparent to-[#0891B2]/30"></div>
        </div>

        {/* Grille de suggestions - 1 colonne sur mobile, 2 sur tablette+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          {randomQuestions.map((item, index) => {
            const Icon = item.icon;
            const styles = colorStyles[item.color as keyof typeof colorStyles];
            
            return (
              <button
                key={index}
                onClick={() => onQuestionClick(item.question)}
                disabled={isLoading}
                className={`
                  group relative flex items-start gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 md:p-5 text-left
                  transition-all duration-300 ease-out
                  ${styles.bg} ${styles.border} ${styles.hoverBorder}
                  hover:shadow-lg hover:-translate-y-1
                  active:scale-[0.98] active:translate-y-0
                  disabled:cursor-not-allowed disabled:opacity-50
                  animate-fade-in
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icône */}
                <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${styles.iconBg} transition-transform group-hover:scale-110`}>
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${styles.icon}`} />
                </div>
                
                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  {/* Badge catégorie */}
                  <span className={`inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1.5 sm:mb-2 px-1.5 sm:px-2 py-0.5 rounded-full ${styles.badge}`}>
                    {item.category}
                  </span>
                  
                  {/* Question */}
                  <p className="text-xs sm:text-sm font-medium text-[#334155] group-hover:text-[#0F2942] leading-relaxed line-clamp-2">
                    {item.question}
                  </p>
                </div>
                
                {/* Flèche - cachée sur mobile */}
                <ArrowRight className={`hidden sm:block h-5 w-5 shrink-0 ${styles.icon} opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`} />
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <p className="mt-6 sm:mt-8 text-[10px] sm:text-xs text-[#94A3B8] px-4">
          Tapez votre question ci-dessous ou cliquez sur une suggestion
        </p>
      </div>
    </div>
  );
}
