'use client';

import { Menu } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/60 bg-white/98 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Section gauche : Menu et Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <Image
                src="/assets/logo.png"
                alt="YoonAssist AI Logo"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            
            {/* Nom et description */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  YoonAssist
                </h1>
                <span className="rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                  AI
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600">
                L'expertise juridique sénégalaise à votre service
              </p>
            </div>
          </div>
        </div>

        {/* Section droite : Badge de statut (optionnel) */}
        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
            <span className="text-xs font-medium text-emerald-700">En ligne</span>
          </div>
        </div>
      </div>
    </header>
  );
}

