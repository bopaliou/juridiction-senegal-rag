'use client';

import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, memo, useCallback } from 'react';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

function SuggestedQuestions({
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

  const scroll = useCallback((direction: 'left' | 'right') => {
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
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  if (!questions || questions.length === 0) return null;

  return (
    <div className="relative mt-4 w-full">
      {/* Label */}
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <Sparkles className="h-3.5 w-3.5 text-[#0891B2]" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Questions suggérées</span>
      </div>

      {/* Container */}
      <div className="relative overflow-hidden">
        {/* Bouton gauche */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md transition-all hover:bg-white hover:shadow-lg hover:scale-110 border border-slate-200"
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-4 w-4 text-[#0891B2]" />
          </button>
        )}

        {/* Questions scrollables */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
        >
          {questions.map((question, index) => (
            <button
              key={index}
              onClick={() => onQuestionClick(question)}
              disabled={isLoading}
              className="group shrink-0 flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-left text-sm text-slate-600 shadow-sm transition-all duration-200 hover:border-[#0891B2]/50 hover:bg-[#f0fdfa] hover:text-[#0891B2] hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed max-w-[300px]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0891B2]/10 to-[#14b8a6]/10 transition-colors group-hover:from-[#0891B2]/20 group-hover:to-[#14b8a6]/20">
                <Sparkles className="h-3 w-3 text-[#0891B2]" />
              </span>
              <span className="font-medium line-clamp-2 leading-snug">{question}</span>
            </button>
          ))}
        </div>

        {/* Bouton droit */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md transition-all hover:bg-white hover:shadow-lg hover:scale-110 border border-slate-200"
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-4 w-4 text-[#0891B2]" />
          </button>
        )}
      </div>
    </div>
  );
}

// Memoize le composant pour éviter les re-renders inutiles
export default memo(SuggestedQuestions);
