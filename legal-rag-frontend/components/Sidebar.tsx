'use client';

import { Plus, Trash2, Settings, X, ChevronLeft, ChevronRight, MessageSquare, Clock, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  chatHistory?: ChatHistoryItem[];
  onChatClick?: (chatId: string) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
  activeConversationId?: string | null;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: Date;
}

// Composant HistorySection extrait pour éviter re-création à chaque render
interface HistorySectionProps {
  title: string;
  items: ChatHistoryItem[];
  activeConversationId?: string | null;
  onChatClick?: (chatId: string) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
}

function HistorySection({ title, items, activeConversationId, onChatClick, onDeleteChat }: HistorySectionProps) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-[#0891B2]">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = activeConversationId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onChatClick && onChatClick(item.id)}
              className={`sidebar-item group ${
                isActive 
                  ? 'bg-gradient-to-r from-[#0891B2]/20 to-[#14B8A6]/10 border-l-2 border-[#0891B2]' 
                  : ''
              }`}
            >
              <MessageSquare className={`h-4 w-4 shrink-0 ${
                isActive ? 'text-[#0891B2]' : 'text-[#64748B] group-hover:text-[#0891B2]'
              }`} />
              <div className={`flex-1 truncate text-sm ${
                isActive ? 'text-[#0F2942] font-medium' : 'text-[#475569] group-hover:text-[#0F2942]'
              }`}>
                {item.title}
              </div>
              <button
                onClick={(e) => onDeleteChat(item.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#94A3B8] hover:text-red-500" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const groupHistoryByPeriod = (history: ChatHistoryItem[]) => {
  const uniqueHistory = history.filter((item, index, self) => 
    index === self.findIndex((t) => t.id === item.id)
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayItems: ChatHistoryItem[] = [];
  const weekItems: ChatHistoryItem[] = [];
  const olderItems: ChatHistoryItem[] = [];

  uniqueHistory.forEach((item) => {
    const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
    
    if (itemDate >= today) {
      todayItems.push(item);
    } else if (itemDate >= weekAgo) {
      weekItems.push(item);
    } else {
      olderItems.push(item);
    }
  });

  return { todayItems, weekItems, olderItems };
};

export default function Sidebar({ isOpen, onClose, onNewChat, chatHistory = [], onChatClick, onCollapseChange, activeConversationId }: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Utiliser directement chatHistory prop
  const history = chatHistory;

  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sauvegarder dans localStorage quand chatHistory change
  useEffect(() => {
    if (!mounted || chatHistory.length === 0) return;
    try {
      localStorage.setItem('lexsenegal_chat_history', JSON.stringify(chatHistory));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde:', e);
    }
  }, [chatHistory, mounted]);

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter((item) => item.id !== id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lexsenegal_chat_history', JSON.stringify(updatedHistory));
        // Recharger pour synchroniser l'état
        window.location.reload();
      } catch (err) {
        console.error('Erreur lors de la sauvegarde:', err);
      }
    }
  };

  const { todayItems, weekItems, olderItems } = groupHistoryByPeriod(history);

  return (
    <>
      {/* Overlay pour mobile et tablette uniquement */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0F2942]/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-full transform
          glass-dark text-white
          transition-all duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          w-[85vw] max-w-[300px] sm:w-72
          ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}
        `}
        style={{
          background: 'linear-gradient(180deg, #0F2942 0%, #1E3A5F 100%)'
        }}
      >
        <div className="flex h-full flex-col">
          {/* En-tête */}
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-2">
              {/* Logo mini en mode collapsed */}
              {isCollapsed ? (
                <div className="mx-auto">
                  <div className="logo-container h-10 w-10 rounded-xl overflow-hidden">
                    <Image
                      src="/assets/logo.png"
                      alt="YoonAssist"
                      width={40}
                      height={40}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={onNewChat}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0891B2] to-[#14B8A6] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nouvelle conversation</span>
                </button>
              )}
              
              {/* Boutons de contrôle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={`rounded-xl p-2.5 transition-all ${
                    isCollapsed 
                      ? 'bg-[#0891B2] text-white hover:bg-[#0891B2]/80' 
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  title={isCollapsed ? "Agrandir" : "Réduire"}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl p-2.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Bouton new chat en mode collapsed */}
            {isCollapsed && (
              <button
                onClick={onNewChat}
                className="mt-3 w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0891B2] to-[#14B8A6] p-2.5 text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95"
                title="Nouvelle conversation"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Liste d'historique */}
          <div className="flex-1 overflow-y-auto p-3">
            {!mounted ? (
              <div className="py-8 text-center text-sm text-white/40">
                {!isCollapsed && 'Chargement...'}
              </div>
            ) : isCollapsed ? (
              /* Mode réduit */
              <div className="flex flex-col items-center gap-3 py-4">
                {history.length > 0 ? (
                  <>
                    <div className="relative mb-2">
                      <MessageSquare className="h-5 w-5 text-white/60" />
                      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0891B2] text-[10px] font-bold text-white">
                        {history.length > 9 ? '9+' : history.length}
                      </span>
                    </div>
                    
                    {history.slice(0, 5).map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => onChatClick && onChatClick(item.id)}
                        className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 transition-all hover:bg-[#0891B2] hover:text-white hover:scale-110"
                        title={item.title}
                      >
                        <Clock className="h-4 w-4" />
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1E3A5F] text-[9px] font-bold text-white/80 group-hover:bg-[#0891B2]">
                          {index + 1}
                        </span>
                      </button>
                    ))}
                    
                    {history.length > 5 && (
                      <span className="text-[10px] text-white/40 font-medium">
                        +{history.length - 5} autres
                      </span>
                    )}
                  </>
                ) : (
                  <MessageSquare className="h-5 w-5 text-white/30" />
                )}
              </div>
            ) : (
              /* Mode étendu */
              <>
                {todayItems.length > 0 && <HistorySection title="Aujourd'hui" items={todayItems} activeConversationId={activeConversationId} onChatClick={onChatClick} onDeleteChat={handleDeleteChat} />}
                {weekItems.length > 0 && <HistorySection title="Cette semaine" items={weekItems} activeConversationId={activeConversationId} onChatClick={onChatClick} onDeleteChat={handleDeleteChat} />}
                {olderItems.length > 0 && <HistorySection title="Plus ancien" items={olderItems} activeConversationId={activeConversationId} onChatClick={onChatClick} onDeleteChat={handleDeleteChat} />}
                
                {history.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 rounded-2xl bg-white/5 p-4">
                      <MessageSquare className="h-8 w-8 text-white/30" />
                    </div>
                    <p className="text-sm text-white/40">Aucune conversation</p>
                    <p className="text-xs text-white/25 mt-1">Commencez par poser une question</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pied de page - Paramètres uniquement */}
          <div className="border-t border-white/10 p-4">
            {!isCollapsed ? (
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 rounded-xl p-3 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors">
                  <Settings className="h-4 w-4" />
                  <span>Paramètres</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button 
                  className="flex items-center justify-center rounded-xl p-2.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors" 
                  title="Paramètres"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}