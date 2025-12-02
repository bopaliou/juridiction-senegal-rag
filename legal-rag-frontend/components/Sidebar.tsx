'use client';

import { Plus, Trash2, Settings, User, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  chatHistory?: ChatHistoryItem[]; // Historique réel des conversations
  onChatClick?: (chatId: string) => void; // Callback pour charger une conversation
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: Date;
}

const groupHistoryByPeriod = (history: ChatHistoryItem[]) => {
  // Filtrer les doublons basés sur l'ID avant de grouper
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
    // S'assurer que la date est un objet Date valide
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

export default function Sidebar({ isOpen, onClose, onNewChat, chatHistory = [], onChatClick }: SidebarProps) {
  // État pour savoir si le composant est monté côté client (évite les erreurs d'hydratation)
  const [mounted, setMounted] = useState(false);
  
  // Utiliser l'historique passé en props, ou charger depuis localStorage
  // Toujours initialiser à un tableau vide pour éviter les erreurs d'hydratation
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);

  // Charger depuis localStorage uniquement après le montage côté client
  useEffect(() => {
    setMounted(true);
    
    // Si chatHistory est fourni en props, l'utiliser en priorité
    if (chatHistory && chatHistory.length > 0) {
      setHistory(chatHistory);
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem('lexsenegal_chat_history', JSON.stringify(chatHistory));
      } catch (e) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', e);
      }
    } else {
      // Sinon, charger depuis localStorage
      try {
        const stored = localStorage.getItem('lexsenegal_chat_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          const loadedHistory = parsed.map((item: any) => ({
            ...item,
            date: new Date(item.date),
          }));
          setHistory(loadedHistory);
        }
      } catch (e) {
        console.error('Erreur lors du chargement de l\'historique:', e);
      }
    }
  }, []); // Exécuter uniquement au montage

  // Mettre à jour l'historique quand chatHistory change (après le montage)
  useEffect(() => {
    if (!mounted) return;
    
    if (chatHistory && chatHistory.length > 0) {
      setHistory(chatHistory);
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem('lexsenegal_chat_history', JSON.stringify(chatHistory));
      } catch (e) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', e);
      }
    }
  }, [chatHistory, mounted]);

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter((item) => item.id !== id);
    setHistory(updatedHistory);
    // Sauvegarder dans localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lexsenegal_chat_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', e);
      }
    }
  };

  const { todayItems, weekItems, olderItems } = groupHistoryByPeriod(history);

  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-full w-64 transform bg-slate-900 text-gray-300 transition-transform duration-300 ease-in-out
          lg:relative lg:z-auto lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <button
              onClick={onNewChat}
              className="flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-emerald-700 hover:to-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau Chat</span>
            </button>
            <button
              onClick={onClose}
              className="ml-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Liste d'historique */}
          <div className="flex-1 overflow-y-auto p-2">
            {!mounted ? (
              // Pendant le SSR et avant le montage, afficher un état vide cohérent
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                Aucun historique
              </div>
            ) : (
              <>
                {todayItems.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Aujourd'hui
                    </h3>
                    <div className="space-y-1">
                      {todayItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onChatClick && onChatClick(item.id)}
                          className="group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800"
                        >
                          <div className="flex-1 truncate">{item.title}</div>
                          <button
                            onClick={(e) => handleDeleteChat(item.id, e)}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {weekItems.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      7 derniers jours
                    </h3>
                    <div className="space-y-1">
                      {weekItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onChatClick && onChatClick(item.id)}
                          className="group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800"
                        >
                          <div className="flex-1 truncate">{item.title}</div>
                          <button
                            onClick={(e) => handleDeleteChat(item.id, e)}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {olderItems.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Plus ancien
                    </h3>
                    <div className="space-y-1">
                      {olderItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onChatClick && onChatClick(item.id)}
                          className="group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800"
                        >
                          <div className="flex-1 truncate">{item.title}</div>
                          <button
                            onClick={(e) => handleDeleteChat(item.id, e)}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {history.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    Aucun historique
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pied de page */}
          <div className="border-t border-slate-800 p-4">
            <div className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                <User className="h-4 w-4 text-gray-300" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Utilisateur</div>
                <div className="text-xs text-gray-500">Membre</div>
              </div>
            </div>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-slate-800 hover:text-white">
              <Settings className="h-4 w-4" />
              <span>Paramètres</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

