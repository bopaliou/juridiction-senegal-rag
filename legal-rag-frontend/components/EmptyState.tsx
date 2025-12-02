'use client';

import { Scale, Briefcase, Calendar, Shield, HeartHandshake } from 'lucide-react';

interface EmptyStateProps {
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

// Questions de démarrage sélectionnées parmi la liste officielle de 45 questions autorisées
const starterQuestions = [
  {
    icon: Briefcase,
    question: 'Qui est considéré comme travailleur selon l\'article L.2 du Code du Travail ?',
    color: 'text-blue-600',
  },
  {
    icon: Calendar,
    question: 'Quelles sont les missions du juge de l\'application des peines au Sénégal ?',
    color: 'text-green-600',
  },
  {
    icon: Shield,
    question: 'Quelles sont les obligations de l\'employeur envers les travailleurs ?',
    color: 'text-purple-600',
  },
  {
    icon: HeartHandshake,
    question: 'Quel est l\'âge légal de départ à la retraite au Sénégal ?',
    color: 'text-orange-600',
  },
];

export default function EmptyState({ onQuestionClick, isLoading = false }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo/Icône */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200">
            <Scale className="h-10 w-10 text-slate-500" />
          </div>
        </div>

        {/* Message de Bienvenue */}
        <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl">
          Assistant Juridique Sénégalais
        </h2>

        {/* Sous-titre */}
        <p className="mb-8 text-base text-slate-600 sm:text-lg">
          Je peux vous aider avec le Code du Travail, la Constitution et le Code Pénal.
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
                className="group relative flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 transition-colors group-hover:bg-blue-50 ${item.color}`}>
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

