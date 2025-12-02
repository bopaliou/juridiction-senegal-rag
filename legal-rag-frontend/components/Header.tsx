'use client';

import { Menu, Scale, Sparkles } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-sm">
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
            {/* Logo avec gradient moderne */}
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-100">
              <Scale className="h-6 w-6" />
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <Sparkles className="h-2.5 w-2.5" />
              </div>
            </div>
            
            {/* Nom et description */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                  YoonAssist
                </h1>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
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
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
            <span className="text-xs font-medium text-emerald-700">En ligne</span>
          </div>
        </div>
      </div>
    </header>
  );
}

