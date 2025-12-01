'use client';

import { Sparkles } from 'lucide-react';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

export default function SuggestedQuestions({
  questions,
  onQuestionClick,
  isLoading = false,
}: SuggestedQuestionsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      {questions.map((question, index) => (
        <button
          key={index}
          onClick={() => onQuestionClick(question)}
          disabled={isLoading}
          className="group relative flex items-center gap-2.5 overflow-hidden rounded-full border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-blue-400 hover:from-blue-50 hover:to-blue-100 hover:text-blue-700 hover:shadow-md hover:shadow-blue-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {/* Effet de brillance au hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          
          <Sparkles className="relative z-10 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors duration-200 group-hover:text-blue-600" />
          <span className="relative z-10 whitespace-nowrap">{question}</span>
        </button>
      ))}
    </div>
  );
}
