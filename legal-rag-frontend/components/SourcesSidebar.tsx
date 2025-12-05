'use client';

import { X, ExternalLink, FileText, BookOpen, ChevronLeft, ChevronRight, Scale, Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface SourceItem {
  id: string;
  title: string;
  url?: string;
  content: string;
  page?: number;
  domain?: string;
  article?: string;
  breadcrumb?: string;
}

interface SourcesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceItem[];
  isLoading?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

const getDomainIcon = (domain?: string) => {
  if (!domain) return <FileText className="h-4 w-4" />;
  
  switch (domain.toLowerCase()) {
    case 'constitution':
      return <BookOpen className="h-4 w-4" />;
    case 'travail':
    case 'social':
      return <Scale className="h-4 w-4" />;
    case 'penal':
      return <Gavel className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getDomainStyles = (domain?: string) => {
  if (!domain) return {
    badge: 'bg-[#64748B]/10 text-[#64748B] border-[#64748B]/20',
    icon: 'from-[#64748B] to-[#475569]'
  };
  
  switch (domain.toLowerCase()) {
    case 'constitution':
      return {
        badge: 'bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20',
        icon: 'from-[#0891B2] to-[#14B8A6]'
      };
    case 'travail':
    case 'social':
      return {
        badge: 'bg-[#059669]/10 text-[#059669] border-[#059669]/20',
        icon: 'from-[#059669] to-[#10B981]'
      };
    case 'penal':
      return {
        badge: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20',
        icon: 'from-[#DC2626] to-[#EF4444]'
      };
    case 'finance':
      return {
        badge: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20',
        icon: 'from-[#D97706] to-[#F59E0B]'
      };
    default:
      return {
        badge: 'bg-[#64748B]/10 text-[#64748B] border-[#64748B]/20',
        icon: 'from-[#64748B] to-[#475569]'
      };
  }
};

export default function SourcesSidebar({ isOpen, onClose, sources, isLoading = false, onCollapseChange }: SourcesSidebarProps) {
  const [visibleSources, setVisibleSources] = useState<SourceItem[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsCollapsed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    if (!isOpen || sources.length === 0) {
      setVisibleSources([]);
      return;
    }

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < sources.length) {
        setVisibleSources((prev) => [...prev, sources[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isOpen, sources]);

  return (
    <>
      {/* Overlay - visible uniquement sur mobile/tablette */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0F2942]/30 lg:bg-[#0F2942]/10"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed right-0 top-0 z-50 h-full transform shadow-2xl
          transition-all duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          w-[85vw] max-w-[380px] sm:w-[400px] lg:w-[420px]
          ${isCollapsed ? 'lg:w-20' : ''}
        `}
        style={{
          background: isCollapsed 
            ? 'linear-gradient(180deg, #0891B2 0%, #14B8A6 100%)' 
            : 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 50%, #F0FDFA 100%)'
        }}
        onClick={(e) => {
          if (isCollapsed) {
            e.stopPropagation();
            setIsCollapsed(false);
          }
        }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className={`border-b transition-all duration-300 ${
            isCollapsed 
              ? 'border-white/20 px-3 py-4' 
              : 'border-[#E2E8F0] px-6 py-5'
          }`}>
            <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
              {!isCollapsed && (
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0891B2] to-[#14B8A6] text-white shadow-lg">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0F2942]">Sources</h2>
                    <p className="text-sm text-[#64748B]">
                      {sources.length} référence{sources.length > 1 ? 's' : ''} juridique{sources.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}
              
              {isCollapsed && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg backdrop-blur-sm">
                    <FileText className="h-6 w-6" />
                  </div>
                  {sources.length > 0 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0891B2] text-sm font-bold shadow-md">
                      {sources.length}
                    </div>
                  )}
                </div>
              )}
              
              <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col w-full mt-2' : ''}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCollapsed(!isCollapsed);
                  }}
                  className={`rounded-xl p-2.5 transition-all ${
                    isCollapsed 
                      ? 'bg-white/20 text-white hover:bg-white/30 w-full backdrop-blur-sm' 
                      : 'text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0891B2]'
                  }`}
                  title={isCollapsed ? "Agrandir" : "Réduire"}
                >
                  {isCollapsed ? <ChevronLeft className="h-5 w-5 mx-auto" /> : <ChevronRight className="h-5 w-5" />}
                </button>
                {!isCollapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="rounded-xl p-2.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#DC2626] transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sources List */}
          {!isCollapsed && (
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {isLoading && visibleSources.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full border-4 border-[#E2E8F0]"></div>
                      <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-[#0891B2] border-t-transparent"></div>
                    </div>
                    <p className="text-sm text-[#64748B] font-medium">Recherche des sources...</p>
                  </div>
                </div>
              ) : visibleSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 rounded-2xl bg-[#F1F5F9] p-5">
                    <FileText className="h-10 w-10 text-[#CBD5E1]" />
                  </div>
                  <p className="text-base font-medium text-[#475569]">Aucune source disponible</p>
                  <p className="text-sm text-[#94A3B8] mt-1">Les références apparaîtront ici</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleSources.map((source, index) => {
                    if (!source) return null;
                    
                    const uniqueKey = source.id 
                      ? `${source.id}-${index}` 
                      : `source-${index}-${source.title?.substring(0, 10) || 'unknown'}`;
                    
                    const styles = getDomainStyles(source?.domain);
                    
                    return (
                      <div
                        key={uniqueKey}
                        className="group animate-slide-in-right rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-md transition-all duration-300 hover:border-[#0891B2]/40 hover:shadow-xl hover:-translate-y-1 hover:ring-2 hover:ring-[#0891B2]/10"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        {/* Header */}
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="mb-3 flex items-start gap-3">
                              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${styles.icon} text-white shadow-lg ring-2 ring-white/50`}>
                                {getDomainIcon(source?.domain)}
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <h3 className="font-bold text-[#0F2942] line-clamp-2 text-base leading-snug mb-1.5">
                                  {source?.title || 'Source'}
                                </h3>
                                {source?.article && (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#0891B2]/10 to-[#14B8A6]/10 border border-[#0891B2]/20 mb-2">
                                    <Scale className="h-3.5 w-3.5 text-[#0891B2]" />
                                    <span className="text-xs font-bold text-[#0891B2] tracking-wide uppercase">
                                      {source.article}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {source?.breadcrumb && (
                              <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]/50">
                                <span className="text-[#0891B2] mt-0.5">📍</span>
                                <p className="text-xs text-[#64748B] leading-relaxed font-medium">
                                  {source.breadcrumb}
                                </p>
                              </div>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {source?.domain && (
                                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm ${styles.badge}`}>
                                  {getDomainIcon(source.domain)}
                                  <span>{source.domain}</span>
                                </span>
                              )}
                              {source?.page && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#F1F5F9] to-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#475569] shadow-sm border border-[#CBD5E1]/50">
                                  <FileText className="h-3 w-3" />
                                  <span>Page {source.page}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {source?.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#64748B] transition-all hover:bg-gradient-to-br hover:from-[#0891B2] hover:to-[#14B8A6] hover:text-white hover:shadow-lg hover:scale-110 border border-[#E2E8F0]"
                              title="Ouvrir dans un nouvel onglet"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>

                        {/* Contenu */}
                        <div className="relative max-h-64 overflow-y-auto rounded-xl bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] p-5 border border-[#E2E8F0]/50 shadow-inner">
                          {/* Gradient overlay en bas pour indiquer qu'il y a plus de contenu */}
                          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#F8FAFC] to-transparent pointer-events-none rounded-b-xl"></div>
                          
                          <div className="prose prose-sm max-w-none">
                            <div className="source-content text-sm leading-relaxed text-[#334155] whitespace-pre-wrap font-normal">
                              {source?.content ? (
                                <div className="space-y-2.5">
                                  {source.content.split('\n').map((paragraph, idx) => {
                                    // Ignorer les paragraphes vides
                                    if (!paragraph.trim()) return null;
                                    
                                    // Détecter les listes numérotées (1., 2., etc.)
                                    const numberedMatch = paragraph.trim().match(/^(\d+)[\.\)]\s(.+)$/);
                                    if (numberedMatch) {
                                      return (
                                        <div key={idx} className="flex items-start gap-3 pl-1">
                                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0891B2] to-[#14B8A6] text-white text-xs font-bold mt-0.5">
                                            {numberedMatch[1]}
                                          </span>
                                          <span className="flex-1 pt-0.5">{numberedMatch[2]}</span>
                                        </div>
                                      );
                                    }
                                    
                                    // Détecter les listes à puces (commençant par -, •)
                                    if (/^[-•]\s/.test(paragraph.trim())) {
                                      return (
                                        <div key={idx} className="flex items-start gap-2.5 pl-1">
                                          <span className="text-[#0891B2] font-bold mt-1.5 shrink-0 text-lg leading-none">•</span>
                                          <span className="flex-1">{paragraph.trim().replace(/^[-•]\s/, '')}</span>
                                        </div>
                                      );
                                    }
                                    
                                    // Détecter les titres (lignes courtes en majuscules ou avec des caractères spéciaux)
                                    if (paragraph.trim().length < 80 && (
                                      /^[A-ZÉÈÊÀÂÔÙÛÇ\s]+$/.test(paragraph.trim()) ||
                                      paragraph.trim().includes(':') && paragraph.trim().length < 60
                                    )) {
                                      return (
                                        <h4 key={idx} className="font-bold text-[#0F2942] text-base mt-3 mb-1.5 first:mt-0">
                                          {paragraph.trim()}
                                        </h4>
                                      );
                                    }
                                    
                                    // Paragraphe normal
                                    return (
                                      <p key={idx} className="text-[#334155] leading-7 first:mt-0">
                                        {paragraph.trim()}
                                      </p>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[#94A3B8] italic">Aucun contenu disponible</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Indicateur de chargement progressif */}
                  {isLoading && visibleSources.length < sources.length && (
                    <div className="flex items-center justify-center py-6">
                      <div className="flex items-center gap-3 text-sm text-[#64748B]">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0891B2] border-t-transparent"></div>
                        <span className="font-medium">Chargement...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Footer hint en mode collapsed */}
          {isCollapsed && sources.length > 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2">
              {sources.slice(0, 3).map((_, index) => (
                <div 
                  key={index}
                  className="h-2 w-8 rounded-full bg-white/30"
                  style={{ opacity: 1 - index * 0.3 }}
                />
              ))}
              {sources.length > 3 && (
                <span className="text-[10px] text-white/70 font-medium mt-1">
                  +{sources.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
