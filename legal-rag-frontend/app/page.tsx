'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Scale, Loader2, ChevronDown, ChevronUp, Menu } from 'lucide-react';
import Sidebar, { ChatHistoryItem } from '@/components/Sidebar';
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
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
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
        setChatHistory(parsed.map((item: any) => ({
          ...item,
          date: new Date(item.date),
        })));
      }
    } catch (e) {
      console.error('Erreur lors du chargement de l\'historique:', e);
    }
  }, []);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        const limitedHistory = storedHistory 
          ? [newHistoryItem, ...JSON.parse(storedHistory).slice(0, 49)]
          : [newHistoryItem];
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

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reponse,
        sources: data.sources || [],
        // Utiliser les questions suggérées de l'API si disponibles, sinon générer localement
        suggestedQuestions: data.suggested_questions && data.suggested_questions.length > 0
          ? data.suggested_questions
          : generateSuggestedQuestions(data.reponse),
      };

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
            // Vérifier si cette conversation existe déjà
            const existingIndex = prevHistory.findIndex((item) => item.id === sessionId);
            let updatedHistory: ChatHistoryItem[];
            
            if (existingIndex >= 0) {
              // Mettre à jour la conversation existante
              updatedHistory = [...prevHistory];
              updatedHistory[existingIndex] = {
                ...updatedHistory[existingIndex],
                date: new Date(), // Mettre à jour la date
              };
            } else {
              // Ajouter la nouvelle conversation en haut
              updatedHistory = [newHistoryItem, ...prevHistory];
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
  }, [input, isLoading, sessionId, messages.length]);

  const toggleSources = (messageIndex: number) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageIndex]: !prev[messageIndex],
    }));
  };

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

  // Générer des questions suggérées basées sur le contenu de la réponse
  const generateSuggestedQuestions = (content: string): string[] => {
    // Questions contextuelles selon les domaines juridiques
    const questionsByDomain: { [key: string]: string[] } = {
      penal: [
        'Quelles sont les peines encourues ?',
        'Quels sont les délais de prescription ?',
        'Quelle est la procédure pénale ?',
        'Quels sont les recours possibles ?',
      ],
      social: [
        'Quels sont les droits des travailleurs ?',
        'Quelle est la procédure de licenciement ?',
        'Quels sont les congés payés ?',
        'Comment calculer les indemnités ?',
      ],
      travail: [
        'Quel est le nombre d\'heures de travail ?',
        'Quels sont les jours de repos ?',
        'Quelle est la durée du préavis ?',
        'Quels sont les droits en cas de grève ?',
      ],
      organisation: [
        'Quelle est l\'organisation administrative ?',
        'Quels sont les pouvoirs des autorités ?',
        'Quelle est la structure de l\'État ?',
        'Comment fonctionne l\'administration ?',
      ],
      constitution: [
        'Quels sont les droits fondamentaux ?',
        'Quelle est la séparation des pouvoirs ?',
        'Quels sont les pouvoirs du Président ?',
        'Comment fonctionne le Parlement ?',
      ],
      finances: [
        'Quels sont les impôts applicables ?',
        'Quelle est la procédure fiscale ?',
        'Quels sont les délais de paiement ?',
        'Quelles sont les sanctions fiscales ?',
      ],
      aviation: [
        'Quelles sont les règles de sécurité ?',
        'Quels sont les droits des passagers ?',
        'Quelle est la responsabilité du transporteur ?',
        'Quels sont les documents requis ?',
      ],
      collectivites: [
        'Quels sont les pouvoirs des collectivités ?',
        'Quelle est l\'organisation territoriale ?',
        'Quels sont les budgets locaux ?',
        'Comment fonctionnent les élections locales ?',
      ],
    };

    // Détecter le domaine selon le contenu
    const contentLower = content.toLowerCase();
    let selectedDomain = 'social'; // Par défaut
    
    if (contentLower.includes('pénal') || contentLower.includes('penal') || contentLower.includes('infraction') || contentLower.includes('sanction')) {
      selectedDomain = 'penal';
    } else if (contentLower.includes('travail') || contentLower.includes('employeur') || contentLower.includes('salarié') || contentLower.includes('contrat')) {
      selectedDomain = 'travail';
    } else if (contentLower.includes('constitution') || contentLower.includes('président') || contentLower.includes('parlement')) {
      selectedDomain = 'constitution';
    } else if (contentLower.includes('organisation') || contentLower.includes('administration') || contentLower.includes('fonction publique')) {
      selectedDomain = 'organisation';
    } else if (contentLower.includes('fiscal') || contentLower.includes('impôt') || contentLower.includes('finances')) {
      selectedDomain = 'finances';
    } else if (contentLower.includes('aviation') || contentLower.includes('aérien')) {
      selectedDomain = 'aviation';
    } else if (contentLower.includes('collectivité') || contentLower.includes('local') || contentLower.includes('commune') || contentLower.includes('région')) {
      selectedDomain = 'collectivites';
    }

    const domainQuestions = questionsByDomain[selectedDomain] || questionsByDomain.social;
    
    // Retourner 3 questions aléatoires du domaine détecté
    return domainQuestions.sort(() => Math.random() - 0.5).slice(0, 3);
  };

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
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
        onChatClick={handleChatClick}
      />

      {/* Zone principale */}
      <div className="flex flex-1 flex-col lg:ml-0">
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

                  {/* Affichage des sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleSources(index)}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <span>📚 Voir les {message.sources.length} source{message.sources.length > 1 ? 's' : ''}</span>
                        {expandedSources[index] ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {expandedSources[index] && (
                        <div className="mt-3 space-y-3">
                          {message.sources.map((source, sourceIndex) => {
                            const { title, content } = formatSourceText(source);
                            return (
                              <div
                                key={sourceIndex}
                                className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                              >
                                <h4 className="mb-3 font-semibold text-slate-900">
                                  {title}
                                </h4>
                                <div className="max-h-96 overflow-y-auto">
                                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                                    {content}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
