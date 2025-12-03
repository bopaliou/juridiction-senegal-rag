'use client';

import { Menu, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full glass border-b border-[#0891B2]/10">
      <div className="mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 py-2 sm:px-4 sm:py-3 lg:px-8">
        {/* Section gauche : Menu et Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onMenuClick}
            className="rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-[#0F2942] transition-all hover:bg-[#0891B2]/10 hover:text-[#0891B2] active:scale-95 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Logo */}
            <div className="logo-container relative h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 shrink-0 shadow-md sm:shadow-lg hover:shadow-xl transition-shadow duration-300">
              <Image
                src="/assets/logo.png"
                alt="YoonAssist AI Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            
            {/* Nom et description */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl md:text-2xl font-bold gradient-text-navy tracking-tight">
                  YoonAssist
                </h1>
                <span className="badge badge-cyan text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5">
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="hidden xs:inline">AI</span>
                </span>
              </div>
              <p className="hidden md:block text-xs lg:text-sm text-[#475569] font-medium mt-0.5">
                Assistant juridique intelligent pour le droit sénégalais
              </p>
            </div>
          </div>
        </div>

        {/* Section droite : Badge de statut */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicateur de connexion - version compacte sur mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#059669]/10 border border-[#059669]/20">
            <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-[#10B981]"></span>
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-[#059669] hidden xs:inline">En ligne</span>
          </div>
        </div>
      </div>
    </header>
  );
}
