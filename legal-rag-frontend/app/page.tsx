'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Scale, Loader2, ChevronDown, ChevronUp, Menu, FileText } from 'lucide-react';
import Sidebar, { ChatHistoryItem } from '@/components/Sidebar';
import SourcesSidebar, { SourceItem } from '@/components/SourcesSidebar';
import SuggestedQuestions from '@/components/SuggestedQuestions';
import EmptyState from '@/components/EmptyState';
import { askQuestion, ApiError } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  suggestedQuestions?: string[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [expandedSources, setExpandedSources] = useState<{ [key: number]: boolean }>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sourcesSidebarOpen, setSourcesSidebarOpen] = useState(false);
  const [currentMessageSources, setCurrentMessageSources] = useState<SourceItem[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [globalSuggestedQuestions, setGlobalSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Générer un session_id unique au montage
  useEffect(() => {
    // Vérifier que nous sommes côté client
    if (typeof window === 'undefined') {
      return;
    }

    const storedSessionId = localStorage.getItem('lexsenegal_session_id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('lexsenegal_session_id', newSessionId);
      setSessionId(newSessionId);
    }

    // Charger l'historique des conversations depuis localStorage
    try {
      const storedHistory = localStorage.getItem('lexsenegal_chat_history');
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        // Filtrer les doublons lors du chargement
        const uniqueHistory = parsed.filter((item: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === item.id)
        );
        setChatHistory(uniqueHistory.map((item: any) => ({
          ...item,
          date: new Date(item.date),
        })));
      }
    } catch (e) {
      console.error('Erreur lors du chargement de l\'historique:', e);
    }

    // Générer des questions suggérées initiales au démarrage si aucune n'existe
    if (globalSuggestedQuestions.length === 0) {
      const AUTHORIZED_QUESTIONS = [
        "Quelles sont les missions du juge de l'application des peines au Sénégal ?",
        "Comment fonctionne la commission pénitentiaire consultative de l'aménagement des peines ?",
        "Quelles sont les règles de séparation des détenus dans les établissements pénitentiaires ?",
        "Quelles sont les conditions d'application du travail d'intérêt général ?",
        "Comment se déroule l'extraction d'un détenu pour comparution devant un juge ?",
        "Quels sont les droits des détenus provisoires selon le décret 2001-362 ?",
        "Quel est le rôle des visiteurs de prison dans le système pénitentiaire ?",
        "Comment la loi 2020-05 modifie-t-elle les peines pour viol au Sénégal ?",
        "Quelles sont les nouvelles peines prévues pour les actes de pédophilie ?",
        "Quelles sont les circonstances aggravantes en matière de violences sexuelles ?",
        "Quels délais de prescription ont été suspendus pendant l'état d'urgence ?",
        "Comment la loi 2020-16 affecte-t-elle les délais de recours en matière pénale ?",
        "Quelles sont les règles concernant les contraintes par corps durant la période Covid-19 ?",
        "Quels dossiers sont jugés par les tribunaux départementaux en matière correctionnelle ?",
        "Quelles sont les infractions relevant uniquement du tribunal régional ?",
        "Comment s'effectue le transfert d'une procédure entre le tribunal régional et le tribunal départemental ?",
        "Qui est considéré comme travailleur selon l'article L.2 du Code du Travail ?",
        "Quelles sont les obligations de l'employeur envers les travailleurs ?",
        "Quelles sont les règles de création d'un syndicat professionnel ?",
        "Quelles protections s'appliquent aux travailleurs dans l'exercice du droit d'expression ?",
        "Quelles sont les infractions concernant le travail forcé ?",
        "Quels sont les droits des syndicats devant la justice ?",
        "Comment fonctionne la procédure de dépôt des statuts d'un syndicat ?",
        "Quelles sont les conditions d'accès aux fonctions de direction syndicale ?",
        "Quelles protections s'appliquent aux biens d'un syndicat ?",
        "Quel est l'âge légal de départ à la retraite au Sénégal ?",
        "Quels travailleurs peuvent poursuivre leur activité au-delà de 60 ans ?",
        "Quelles professions sont autorisées à travailler jusqu'à 65 ans ?",
        "Comment s'applique l'article L.69 modifié du Code du Travail ?",
        "Un travailleur peut-il continuer d'exercer volontairement après 60 ans ?",
        "Quels sont les axes stratégiques du budget 2025 ?",
        "Comment se répartissent les ressources et charges de l'État pour 2025 ?",
        "Quels sont les objectifs macroéconomiques du PLF 2026 ?",
        "Quelles taxes nouvelles sont prévues dans la stratégie SUPREC ?",
        "Quelles sont les mesures d'assainissement des finances publiques en 2026 ?",
        "Comment évolue le déficit budgétaire entre 2024, 2025 et 2026 ?",
        "Quels sont les domaines de dépenses prioritaires dans le budget 2026 ?",
        "Quels textes régissent l'organisation pénitentiaire au Sénégal ?",
        "Comment contester une décision judiciaire en matière correctionnelle ?",
        "Quelles sont les obligations de l'État envers les travailleurs ?",
        "Comment déterminer l'autorité compétente pour une infraction ?",
        "Quelles sont les règles applicables aux syndicats ?",
        "Quelles sont les récentes réformes impactant le droit pénal sénégalais ?",
        "Comment fonctionne la procédure d'aménagement de peine ?",
        "Quel est le rôle de l'État dans la protection sociale selon les budgets 2025/2026 ?",
      ];
      // Sélectionner aléatoirement 3 à 7 questions
      const numQuestions = Math.floor(Math.random() * 5) + 3; // Entre 3 et 7
      const shuffled = [...AUTHORIZED_QUESTIONS].sort(() => Math.random() - 0.5);
      setGlobalSuggestedQuestions(shuffled.slice(0, numQuestions));
    }
  }, [globalSuggestedQuestions.length]);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const parseSources = useCallback((sources: string[]): SourceItem[] => {
    return sources
      .map((source, index) => {
        try {
          // Essayer de parser comme JSON d'abord
          const parsed = JSON.parse(source);
          return {
            id: parsed.id || `source_${index}`,
            title: parsed.title || 'Source',
            url: parsed.url,
            content: parsed.content || '',
            page: parsed.page,
            domain: parsed.domain,
          };
        } catch {
          // Si ce n'est pas du JSON, parser l'ancien format
          const lines = source.split('\n\n');
          let title = 'Source';
          let content = source;
          let url: string | undefined;
          let page: number | undefined;

          // Extraire l'URL si présente
          const urlMatch = source.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            url = urlMatch[1];
          }

          // Si la source commence par un nom de document et page
          const titleMatch = source.match(/^([^(]+(?:\(page (\d+)\))?)/);
          if (titleMatch) {
            title = titleMatch[1].trim();
            if (titleMatch[2]) {
              page = parseInt(titleMatch[2], 10);
            }
            // Enlever le titre du contenu
            content = source.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n\\n?`, 'i'), '').trim();
          }

          // Nettoyer le contenu (enlever les URLs répétées)
          if (url) {
            content = content.replace(url, '').trim();
          }

          return {
            id: `source_${index}`,
            title,
            url,
            content: content.length > 800 ? content.substring(0, 800) + '...' : content,
            page,
          };
        }
      })
      .filter((source) => source.content && source.content.length > 0);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent | string) => {
    let currentInput = '';
    if (typeof e === 'string') {
      currentInput = e; // Question from suggestion click
    } else {
      e.preventDefault();
      currentInput = input.trim();
    }

    if (!currentInput || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: currentInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Mettre à jour l'historique si c'est le premier message
    if (messages.length === 0 && typeof window !== 'undefined') {
      const newHistoryItem: ChatHistoryItem = {
        id: sessionId,
        title: currentInput.length > 50 
          ? currentInput.substring(0, 50) + '...' 
          : currentInput,
        date: new Date(),
      };
      
      try {
        const storedHistory = localStorage.getItem('lexsenegal_chat_history');
        const parsedHistory = storedHistory ? JSON.parse(storedHistory) : [];
        
        // Filtrer les doublons et éviter d'ajouter le même ID
        const filteredHistory = parsedHistory.filter((item: ChatHistoryItem) => item.id !== sessionId);
        
        // Ajouter le nouvel élément en premier et limiter à 50
        const limitedHistory = [newHistoryItem, ...filteredHistory].slice(0, 50);
        
        localStorage.setItem('lexsenegal_chat_history', JSON.stringify(limitedHistory));
        setChatHistory(limitedHistory.map((item: any) => ({
          ...item,
          date: new Date(item.date),
        })));
      } catch (e) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', e);
      }
    }

    try {
      const data = await askQuestion(userMessage.content, sessionId);

      // Parser les sources
      const parsedSources = parseSources(data.sources || []);

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reponse,
        sources: data.sources || [],
        // Utiliser uniquement les questions suggérées de l'API (liste autorisée de 45 questions)
        suggestedQuestions: data.suggested_questions || [],
      };

      // Mettre à jour les questions suggérées globales avec les nouvelles questions de l'assistant
      if (data.suggested_questions && data.suggested_questions.length > 0) {
        setGlobalSuggestedQuestions(data.suggested_questions);
      }

      setMessages((prev) => {
        const updated = [...prev, assistantMessage];
        
        // Mettre à jour l'historique si c'est le premier message de la conversation
        if (typeof window !== 'undefined' && prev.length === 0) {
          const newHistoryItem: ChatHistoryItem = {
            id: sessionId,
            title: userMessage.content.length > 50 
              ? userMessage.content.substring(0, 50) + '...' 
              : userMessage.content,
            date: new Date(),
          };
          
          setChatHistory((prevHistory) => {
            // Filtrer les doublons d'abord
            const uniqueHistory = prevHistory.filter((item, index, self) => 
              index === self.findIndex((t) => t.id === item.id)
            );
            
            // Vérifier si cette conversation existe déjà
            const existingIndex = uniqueHistory.findIndex((item) => item.id === sessionId);
            let updatedHistory: ChatHistoryItem[];
            
            if (existingIndex >= 0) {
              // Mettre à jour la conversation existante
              updatedHistory = [...uniqueHistory];
              updatedHistory[existingIndex] = {
                ...updatedHistory[existingIndex],
                title: userMessage.content.length > 50 
                  ? userMessage.content.substring(0, 50) + '...' 
                  : userMessage.content,
                date: new Date(),
              };
              // Déplacer en haut de la liste
              const [updatedItem] = updatedHistory.splice(existingIndex, 1);
              updatedHistory.unshift(updatedItem);
            } else {
              // Ajouter la nouvelle conversation en haut
              updatedHistory = [newHistoryItem, ...uniqueHistory];
            }
            
            // Limiter à 50 conversations maximum
            const limitedHistory = updatedHistory.slice(0, 50);
            
            // Sauvegarder dans localStorage
            try {
              localStorage.setItem('lexsenegal_chat_history', JSON.stringify(limitedHistory));
            } catch (e) {
              console.error('Erreur lors de la sauvegarde de l\'historique:', e);
            }
            
            return limitedHistory;
          });
        } else if (typeof window !== 'undefined' && prev.length > 0) {
          // Mettre à jour la date de la conversation existante
          setChatHistory((prevHistory) => {
            const existingIndex = prevHistory.findIndex((item) => item.id === sessionId);
            if (existingIndex >= 0) {
              const updatedHistory = [...prevHistory];
              updatedHistory[existingIndex] = {
                ...updatedHistory[existingIndex],
                date: new Date(),
              };
              // Déplacer en haut de la liste
              const [updatedItem] = updatedHistory.splice(existingIndex, 1);
              updatedHistory.unshift(updatedItem);
              
              try {
                localStorage.setItem('lexsenegal_chat_history', JSON.stringify(updatedHistory));
              } catch (e) {
                console.error('Erreur lors de la sauvegarde de l\'historique:', e);
              }
              return updatedHistory;
            }
            return prevHistory;
          });
        }
        
        return updated;
      });
      
      // Ouvrir le sidebar des sources si des sources sont disponibles
      if (parsedSources.length > 0) {
        setCurrentMessageSources(parsedSources);
        setSourcesSidebarOpen(true);
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel API:', error);
      
      let errorContent = '❌ Erreur de connexion au serveur.\n\n';
      
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorContent += '🔍 Vérifications à faire :\n';
        errorContent += '1. Le serveur FastAPI est-il lancé ? (uvicorn src.server:app --reload)\n';
        errorContent += '2. Le serveur écoute-t-il sur http://127.0.0.1:8000 ?\n';
        errorContent += '3. Les CORS sont-ils configurés dans le serveur ?\n\n';
        errorContent += '💡 Assurez-vous que le serveur FastAPI est démarré avant d\'utiliser l\'application.';
      } else if (error instanceof Error) {
        errorContent += `Détails : ${error.message}`;
      } else {
        errorContent += 'Une erreur inattendue s\'est produite.';
      }
      
      const errorMessage: Message = {
        role: 'assistant',
        content: errorContent,
        sources: [],
        suggestedQuestions: [],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [input, isLoading, sessionId, messages.length, parseSources]);

  const formatSourceText = (source: string): { title: string; content: string } => {
    // Extraire le titre (première ligne ou partie avant \n\n)
    const lines = source.split('\n\n');
    let title = 'Source';
    let content = source;

    // Si la source commence par un nom de document et page
    const titleMatch = source.match(/^([^(]+(?:\(page \d+\))?)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Enlever le titre du contenu
      content = source.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n\\n?`, 'i'), '').trim();
    }

    // Si le contenu est trop long, extraire la partie la plus pertinente (premiers 500 caractères)
    // et ajouter "..." si nécessaire
    const maxLength = 800;
    if (content.length > maxLength) {
      // Essayer de trouver un point de coupure naturel (phrase complète)
      const truncated = content.substring(0, maxLength);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastNewline = truncated.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      if (cutPoint > maxLength * 0.7) {
        // Si on trouve un bon point de coupure, l'utiliser
        content = content.substring(0, cutPoint + 1) + '...';
      } else {
        // Sinon, couper au maxLength
        content = truncated + '...';
      }
    }

    return { title, content };
  };

  // Les questions suggérées viennent uniquement du backend (liste autorisée de 45 questions)
  // La fonction generateSuggestedQuestions a été supprimée car elle utilisait des questions non autorisées

  const handleSuggestionClick = useCallback((question: string) => {
    handleSubmit(question); // Directly send the question
  }, [handleSubmit]);

  const handleNewChat = () => {
    setMessages([]);
    setExpandedSources({});
    setSidebarOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lexsenegal_session_id'); // Clear session ID
    }
    setSessionId(''); // Reset session ID state
    // A new session ID will be generated by useEffect on next render
  };

  const handleChatClick = (chatId: string) => {
    // Charger la conversation depuis localStorage si nécessaire
    // Pour l'instant, on crée juste une nouvelle session avec cet ID
    setSessionId(chatId);
    setMessages([]);
    setExpandedSources({});
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar gauche (historique) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
        onChatClick={handleChatClick}
      />
      
      {/* Sidebar droite (sources) */}
      <SourcesSidebar
        isOpen={sourcesSidebarOpen}
        onClose={() => setSourcesSidebarOpen(false)}
        sources={currentMessageSources}
        isLoading={isLoading}
      />

      {/* Zone principale */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'} ${sourcesSidebarOpen ? 'lg:mr-96' : 'lg:mr-0'}`}>
        {/* Header fixe */}
        <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-white">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">LexSenegal AI</h1>
                <p className="text-xs text-slate-500">Assistant Juridique Sénégalais</p>
              </div>
            </div>
          </div>
        </header>

        {/* Zone de chat scrollable */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        >
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <EmptyState
              onQuestionClick={handleSuggestionClick}
              isLoading={isLoading}
            />
          ) : null}

          {messages.map((message, index) => (
            <div key={index} className="flex w-full">
              {message.role === 'user' ? (
                // Message utilisateur - aligné à droite
                <div className="ml-auto max-w-[80%] sm:max-w-[75%]">
                  <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-white shadow-md">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ) : (
                // Message assistant - aligné à gauche
                <div className="mr-auto max-w-[80%] sm:max-w-[75%]">
                  <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-gray-800 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>

                  {/* Bouton pour ouvrir le sidebar des sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          const parsedSources = parseSources(message.sources || []);
                          setCurrentMessageSources(parsedSources);
                          setSourcesSidebarOpen(true);
                        }}
                        className="group flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100 hover:shadow-sm"
                      >
                        <FileText className="h-4 w-4" />
                        <span>
                          {message.sources.length} source{message.sources.length > 1 ? 's' : ''} référencée{message.sources.length > 1 ? 's' : ''}
                        </span>
                        <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  )}

                  {/* Questions suggérées */}
                  {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                    <SuggestedQuestions
                      questions={message.suggestedQuestions}
                      onQuestionClick={handleSuggestionClick}
                      isLoading={isLoading}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Indicateur de chargement */}
          {isLoading && (
            <div className="flex w-full">
              <div className="mr-auto max-w-[80%] sm:max-w-[75%]">
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                    <span className="text-sm text-slate-600">Recherche en cours...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Questions suggérées globales - affichées après chaque message ou quand il n'y a pas de questions dans le dernier message */}
          {!isLoading && globalSuggestedQuestions.length > 0 && (
            <div className="mt-4 w-full">
              <SuggestedQuestions
                questions={globalSuggestedQuestions}
                onQuestionClick={handleSuggestionClick}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Référence pour auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
        </div>

        {/* Zone de saisie fixe en bas */}
        <div className="sticky bottom-0 z-40 w-full border-t border-slate-200 bg-white px-4 py-4 shadow-lg sm:px-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Posez votre question juridique ici..."
                disabled={isLoading}
                rows={1}
                className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  minHeight: '48px',
                  maxHeight: '120px',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
