'use client';

import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScrollability = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      }
    };

    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  }, [questions]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300; // Pixels à scroller
      const newScrollLeft =
        direction === 'left'
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      });
    }
  };

  if (!questions || questions.length === 0) return null;

  return (
    <div className="relative mt-5">
      {/* Bouton de défilement gauche */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow-lg transition-all hover:bg-slate-50 hover:shadow-xl"
          aria-label="Défiler vers la gauche"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
      )}

      {/* Container avec défilement horizontal */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto px-10 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={() => {
          if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
          }
        }}
      >
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            disabled={isLoading}
            className="group relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-full border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-blue-400 hover:from-blue-50 hover:to-blue-100 hover:text-blue-700 hover:shadow-md hover:shadow-blue-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* Effet de brillance au hover */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            
            <Sparkles className="relative z-10 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors duration-200 group-hover:text-blue-600" />
            <span className="relative z-10 whitespace-nowrap">{question}</span>
          </button>
        ))}
      </div>

      {/* Bouton de défilement droit */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow-lg transition-all hover:bg-slate-50 hover:shadow-xl"
          aria-label="Défiler vers la droite"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      )}
    </div>
  );
}
