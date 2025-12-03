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
      const scrollAmount = 280;
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
    <div className="relative mt-4 sm:mt-5 md:mt-6">
      {/* Bouton de défilement gauche */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:bg-[#F8FAFC] hover:shadow-xl hover:scale-110 border border-[#E2E8F0]"
          aria-label="Défiler vers la gauche"
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 text-[#0891B2]" />
        </button>
      )}

      {/* Container avec défilement horizontal */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 sm:gap-3 overflow-x-auto px-8 sm:px-10 md:px-12 py-1.5 sm:py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
            className="group relative flex shrink-0 items-center gap-2 sm:gap-3 overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl border-2 border-[#E2E8F0] bg-white px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 text-xs sm:text-sm font-medium text-[#475569] shadow-sm transition-all duration-300 hover:border-[#0891B2]/40 hover:bg-gradient-to-r hover:from-[#0891B2]/5 hover:to-[#14B8A6]/5 hover:text-[#0891B2] hover:shadow-md hover:-translate-y-1 active:scale-[0.98] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* Effet de brillance au hover */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            
            <div className="relative z-10 flex h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-md sm:rounded-lg bg-[#F1F5F9] transition-all duration-300 group-hover:bg-[#0891B2]/10">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-[#94A3B8] transition-colors duration-300 group-hover:text-[#0891B2]" />
            </div>
            <span className="relative z-10 whitespace-nowrap text-[11px] sm:text-xs md:text-sm">{question}</span>
          </button>
        ))}
      </div>

      {/* Bouton de défilement droit */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:bg-[#F8FAFC] hover:shadow-xl hover:scale-110 border border-[#E2E8F0]"
          aria-label="Défiler vers la droite"
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-[#0891B2]" />
        </button>
      )}
    </div>
  );
}
