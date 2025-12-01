'use client';

import { X, ExternalLink, FileText, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface SourceItem {
  id: string;
  title: string;
  url?: string;
  content: string;
  page?: number;
  domain?: string;
}

interface SourcesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceItem[];
  isLoading?: boolean;
}

const getDomainIcon = (domain?: string) => {
  if (!domain) return <FileText className="h-4 w-4" />;
  
  switch (domain.toLowerCase()) {
    case 'constitution':
      return <BookOpen className="h-4 w-4" />;
    case 'travail':
    case 'social':
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getDomainColor = (domain?: string) => {
  if (!domain) return 'bg-gray-100 text-gray-700 border-gray-200';
  
  switch (domain.toLowerCase()) {
    case 'constitution':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'travail':
    case 'social':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'penal':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'finance':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export default function SourcesSidebar({ isOpen, onClose, sources, isLoading = false }: SourcesSidebarProps) {
  const [visibleSources, setVisibleSources] = useState<SourceItem[]>([]);

  // Charger les sources progressivement
  useEffect(() => {
    if (!isOpen || sources.length === 0) {
      setVisibleSources([]);
      return;
    }

    // Charger les sources une par une avec un délai pour l'effet de progression
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < sources.length) {
        setVisibleSources((prev) => [...prev, sources[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 150); // 150ms entre chaque source

    return () => clearInterval(interval);
  }, [isOpen, sources]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed right-0 top-0 z-50 h-full w-full transform bg-white shadow-2xl transition-transform duration-300 ease-in-out
          lg:w-96 lg:translate-x-0
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sources</h2>
                <p className="text-xs text-gray-500">
                  {sources.length} source{sources.length > 1 ? 's' : ''} référencée{sources.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sources List */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading && visibleSources.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <p className="text-sm text-gray-500">Chargement des sources...</p>
                </div>
              </div>
            ) : visibleSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="mt-4 text-sm text-gray-500">Aucune source disponible</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSources.map((source, index) => {
                  if (!source) return null;
                  
                  return (
                  <div
                    key={source.id || `source-${index}`}
                    className="group animate-fade-in rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Header avec titre et badge */}
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          {getDomainIcon(source?.domain)}
                          <h3 className="font-semibold text-gray-900 line-clamp-2">
                            {source?.title || 'Source'}
                          </h3>
                        </div>
                        {source?.domain && (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getDomainColor(source.domain)}`}
                          >
                            {source.domain}
                          </span>
                        )}
                        {source?.page && (
                          <span className="ml-2 text-xs text-gray-500">
                            Page {source.page}
                          </span>
                        )}
                      </div>
                      {source?.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                          title="Ouvrir dans un nouvel onglet"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>

                    {/* Contenu */}
                    <div className="max-h-64 overflow-y-auto">
                      <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                        {source?.content || 'Aucun contenu disponible'}
                      </p>
                    </div>
                  </div>
                  );
                })}

                {/* Indicateur de chargement progressif */}
                {isLoading && visibleSources.length < sources.length && (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span>Chargement des sources...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

