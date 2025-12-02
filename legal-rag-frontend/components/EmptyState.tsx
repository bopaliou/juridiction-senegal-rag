'use client';

import { Briefcase, Calendar, Shield, HeartHandshake } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';

interface EmptyStateProps {
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

// Liste officielle et exhaustive des 45 questions autorisées (identique au backend)
const AUTHORIZED_QUESTIONS = [
  "Quelles sont les missions du juge de l'application des peines au Sénégal ?",
  "Comment fonctionne la commission pénitentiaire consultative de l'aménagement des peines ?",
  "Quelles sont les règles de séparation des détenus dans les établissements pénitentiaires ?",
  "Quelles sont les conditions d'application du travail d'intérêt général ?",
  "Comment se déroule l'extraction d'un détenu pour comparution devant un juge ?",
  "Quels sont les droits des détenus provisoires selon le décret 2001-362 ?",
  "Quel est le rôle des visiteurs de prison dans le système pénitentiaire ?",
  "Comment la loi 2020-05 modifie-t-elle les peines pour viol au Sénégal ?",
  "Quelles sont les nouvelles peines prévues pour les actes de pédophilie ?",
  "Quelles sont les circonstances aggravantes en matière de violences sexuelles ?",
  "Quels délais de prescription ont été suspendus pendant l'état d'urgence ?",
  "Comment la loi 2020-16 affecte-t-elle les délais de recours en matière pénale ?",
  "Quelles sont les règles concernant les contraintes par corps durant la période Covid-19 ?",
  "Quels dossiers sont jugés par les tribunaux départementaux en matière correctionnelle ?",
  "Quelles sont les infractions relevant uniquement du tribunal régional ?",
  "Comment s'effectue le transfert d'une procédure entre le tribunal régional et le tribunal départemental ?",
  "Qui est considéré comme travailleur selon l'article L.2 du Code du Travail ?",
  "Quelles sont les obligations de l'employeur envers les travailleurs ?",
  "Quelles sont les règles de création d'un syndicat professionnel ?",
  "Quelles protections s'appliquent aux travailleurs dans l'exercice du droit d'expression ?",
  "Quelles sont les infractions concernant le travail forcé ?",
  "Quels sont les droits des syndicats devant la justice ?",
  "Comment fonctionne la procédure de dépôt des statuts d'un syndicat ?",
  "Quelles sont les conditions d'accès aux fonctions de direction syndicale ?",
  "Quelles protections s'appliquent aux biens d'un syndicat ?",
  "Quel est l'âge légal de départ à la retraite au Sénégal ?",
  "Quels travailleurs peuvent poursuivre leur activité au-delà de 60 ans ?",
  "Quelles professions sont autorisées à travailler jusqu'à 65 ans ?",
  "Comment s'applique l'article L.69 modifié du Code du Travail ?",
  "Un travailleur peut-il continuer d'exercer volontairement après 60 ans ?",
  "Quels sont les axes stratégiques du budget 2025 ?",
  "Comment se répartissent les ressources et charges de l'État pour 2025 ?",
  "Quels sont les objectifs macroéconomiques du PLF 2026 ?",
  "Quelles taxes nouvelles sont prévues dans la stratégie SUPREC ?",
  "Quelles sont les mesures d'assainissement des finances publiques en 2026 ?",
  "Comment évolue le déficit budgétaire entre 2024, 2025 et 2026 ?",
  "Quels sont les domaines de dépenses prioritaires dans le budget 2026 ?",
  "Quels textes régissent l'organisation pénitentiaire au Sénégal ?",
  "Comment contester une décision judiciaire en matière correctionnelle ?",
  "Quelles sont les obligations de l'État envers les travailleurs ?",
  "Comment déterminer l'autorité compétente pour une infraction ?",
  "Quelles sont les règles applicables aux syndicats ?",
  "Quelles sont les récentes réformes impactant le droit pénal sénégalais ?",
  "Comment fonctionne la procédure d'aménagement de peine ?",
  "Quel est le rôle de l'État dans la protection sociale selon les budgets 2025/2026 ?",
];

// Icônes disponibles pour les questions
const icons = [Briefcase, Calendar, Shield, HeartHandshake];
const colors = ['text-emerald-600', 'text-teal-600', 'text-amber-600', 'text-slate-600'];

// Fonction pour sélectionner aléatoirement 4 questions parmi les 45
function getRandomQuestions() {
  // Créer une copie de la liste et la mélanger
  const shuffled = [...AUTHORIZED_QUESTIONS].sort(() => Math.random() - 0.5);
  // Sélectionner 4 questions
  return shuffled.slice(0, 4).map((question, index) => ({
    icon: icons[index % icons.length],
    question,
    color: colors[index % colors.length],
  }));
}

export default function EmptyState({ onQuestionClick, isLoading = false }: EmptyStateProps) {
  // Éviter l'erreur d'hydratation en générant les questions uniquement côté client
  const [starterQuestions, setStarterQuestions] = useState<Array<{
    icon: typeof Briefcase;
    question: string;
    color: string;
  }>>([]);

  useEffect(() => {
    // Générer les questions uniquement après le montage côté client
    setStarterQuestions(getRandomQuestions());
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo très agrandi et percutant - sans arrière-plan */}
        <div className="mb-10 flex justify-center">
          <div className="relative flex h-64 w-64 items-center justify-center bg-transparent">
            <Image
              src="/assets/logo.png"
              alt="YoonAssist AI Logo"
              width={256}
              height={256}
              className="h-64 w-64 object-contain"
              priority
              style={{ 
                filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25))',
                backgroundColor: 'transparent'
              }}
            />
          </div>
        </div>

        {/* Message de Bienvenue */}
        <h2 className="mb-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          Bienvenue sur YoonAssist AI
        </h2>
        
        {/* Slogan */}
        <p className="mb-3 text-sm font-semibold text-emerald-600 sm:text-base">
          Trouvez facilement toutes les informations sur le droit sénégalais
        </p>

        {/* Sous-titre */}
        <p className="mb-8 text-base text-slate-600 sm:text-lg">
          Je peux vous aider avec le Code du Travail, la Constitution, le Code Pénal et bien plus encore.
          <br />
          Posez-moi une question ou choisissez un exemple ci-dessous.
        </p>

        {/* Grille de Suggestions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {starterQuestions.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => onQuestionClick(item.question)}
                disabled={isLoading}
                className="group relative flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 transition-colors group-hover:bg-emerald-50 ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-relaxed text-slate-700 group-hover:text-slate-900">
                    {item.question}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

