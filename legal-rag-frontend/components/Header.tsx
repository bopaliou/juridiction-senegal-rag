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
          
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div 
              className="relative h-20 w-20 shrink-0 rounded-lg shadow-lg overflow-hidden logo-no-transparency"
              style={{ 
                backgroundColor: '#ffffff',
                background: '#ffffff'
              }}
            >
              <Image
                src="/assets/logo.png"
                alt="YoonAssist AI Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain"
                priority
                style={{ 
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  display: 'block',
                  imageRendering: 'auto'
                }}
              />
            </div>
            
            {/* Nom et description */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  YoonAssist
                </h1>
                <span className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  AI
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600">
                Trouvez facilement toutes les informations sur le droit sénégalais
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

