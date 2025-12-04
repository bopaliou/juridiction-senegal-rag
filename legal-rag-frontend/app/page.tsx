'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, Menu, FileText } from 'lucide-react';
import Image from 'next/image';
import Sidebar, { ChatHistoryItem } from '@/components/Sidebar';
import SourcesSidebar, { SourceItem } from '@/components/SourcesSidebar';
import SuggestedQuestions from '@/components/SuggestedQuestions';
import EmptyState from '@/components/EmptyState';
import FormattedResponse from '@/components/FormattedResponse';
import Header from '@/components/Header';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourcesSidebarOpen, setSourcesSidebarOpen] = useState(false);
  const [sourcesSidebarCollapsed, setSourcesSidebarCollapsed] = useState(false);
  const [currentMessageSources, setCurrentMessageSources] = useState<SourceItem[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [globalSuggestedQuestions, setGlobalSuggestedQuestions] = useState<string[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Clé localStorage pour les messages d'une conversation
  const getConversationKey = (id: string) => `lexsenegal_conversation_${id}`;

  // Sauvegarder les messages d'une conversation
  const saveConversation = useCallback((conversationId: string, msgs: Message[]) => {
    if (typeof window === 'undefined' || !conversationId || msgs.length === 0) return;
    try {
      localStorage.setItem(getConversationKey(conversationId), JSON.stringify(msgs));
    } catch (e) {
      console.error('Erreur sauvegarde conversation:', e);
    }
  }, []);

  // Charger les messages d'une conversation
  const loadConversation = useCallback((conversationId: string): Message[] => {
    if (typeof window === 'undefined' || !conversationId) return [];
    try {
      const stored = localStorage.getItem(getConversationKey(conversationId));
      if (stored) {
        return JSON.parse(stored) as Message[];
      }
    } catch (e) {
      console.error('Erreur chargement conversation:', e);
    }
    return [];
  }, []);

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
      // Questions citoyennes - accessibles et pratiques
      const CITIZEN_QUESTIONS = [
        // Travail - Questions pratiques du quotidien
        "Combien de jours de congé ai-je droit par an ?",
        "Mon employeur peut-il me licencier sans préavis ?",
        "Que faire si mon employeur ne me paie pas mon salaire ?",
        "Comment démissionner de mon travail ?",
        "Quels sont mes droits si je suis licencié ?",
        "Peut-on m'obliger à faire des heures supplémentaires ?",
        "Est-ce que j'ai droit à un contrat de travail écrit ?",
        "Comment contester un licenciement abusif ?",
        "Quelle est la durée légale du travail au Sénégal ?",
        "Ai-je droit à une pause pendant ma journée de travail ?",
        "Mon employeur peut-il réduire mon salaire ?",
        "Quels sont mes droits en cas d'accident de travail ?",
        "Peut-on me forcer à travailler le dimanche ?",
        "Ai-je droit à un congé de maternité ?",
        "Comment calculer mes indemnités de licenciement ?",
        
        // Retraite - Questions pratiques
        "À quel âge puis-je partir à la retraite au Sénégal ?",
        "Comment calculer ma pension de retraite ?",
        "Combien d'années faut-il cotiser pour la retraite ?",
        "Peut-on continuer à travailler après l'âge de la retraite ?",
        "Comment faire une demande de retraite ?",
        "Quels sont mes droits en tant que retraité ?",
        
        // Droits fondamentaux
        "Le travail forcé est-il interdit au Sénégal ?",
        "Ai-je le droit de m'exprimer librement au travail ?",
        "Peut-on me discriminer à l'embauche ?",
        "Quels sont mes droits fondamentaux en tant que travailleur ?",
        "Mon employeur peut-il lire mes messages privés ?",
        
        // Syndicats
        "Ai-je le droit de créer ou rejoindre un syndicat ?",
        "Comment créer un syndicat dans mon entreprise ?",
        "Mon employeur peut-il m'interdire d'adhérer à un syndicat ?",
        "Quels sont les avantages d'être membre d'un syndicat ?",
        
        // Justice et protection
        "Quelles sont les sanctions en cas de harcèlement au travail ?",
        "Comment porter plainte contre mon employeur ?",
        "Que faire en cas de harcèlement sexuel au travail ?",
        "Quelles sont les peines pour violences au Sénégal ?",
        "Comment saisir l'inspection du travail ?",
      ];
      // Sélectionner aléatoirement 3 à 5 questions
      const numQuestions = Math.floor(Math.random() * 3) + 3; // Entre 3 et 5
      const shuffled = [...CITIZEN_QUESTIONS].sort(() => Math.random() - 0.5);
      setGlobalSuggestedQuestions(shuffled.slice(0, numQuestions));
    }
  }, [globalSuggestedQuestions.length]);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Sauvegarder automatiquement la conversation quand les messages changent
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      saveConversation(sessionId, messages);
    }
  }, [messages, sessionId, saveConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const parseSources = useCallback((sources: unknown[]): SourceItem[] => {
    if (!sources || !Array.isArray(sources)) return [];
    
    const result: SourceItem[] = [];
    
    sources.forEach((source, index) => {
      try {
        // CAS 1: Objet direct (nouveau format backend avec SourceModel)
        if (typeof source === 'object' && source !== null) {
          const obj = source as Record<string, unknown>;
          const content = (obj.content as string) || '';
          if (content.length > 0) {
            result.push({
              id: (obj.id as string) || `source_${index}`,
              title: (obj.title as string) || 'Document Juridique',
              url: obj.url as string | undefined,
              content,
              page: obj.page as number | undefined,
              domain: obj.domain as string | undefined,
              article: obj.article as string | undefined,
              breadcrumb: obj.breadcrumb as string | undefined,
            });
          }
          return;
        }
        
        // CAS 2: String JSON (ancien format)
        if (typeof source === 'string') {
          const trimmed = source.trim();
          
          // Ignorer les messages système
          if (trimmed === 'Aucune source disponible' || 
              trimmed === 'Aucune source pertinente disponible' ||
              trimmed.length === 0) {
            return;
          }
          
          // Essayer de parser comme JSON
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              const content = parsed.content || '';
              if (content.length > 0) {
                result.push({
                  id: parsed.id || `source_${index}`,
                  title: parsed.title || 'Source',
                  url: parsed.url,
                  content,
                  page: parsed.page,
                  domain: parsed.domain,
                  article: parsed.article,
                  breadcrumb: parsed.breadcrumb,
                });
              }
              return;
            } catch {
              // Continuer au fallback
            }
          }
          
          // Fallback: texte brut
          result.push({
            id: `source_${index}`,
            title: 'Information',
            content: trimmed.length > 800 ? trimmed.substring(0, 800) + '...' : trimmed,
          });
        }
      } catch (error) {
        console.warn('Erreur parsing source:', error);
      }
    });
    
    return result;
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

    // Réinitialiser les sources de la question précédente
    setCurrentMessageSources([]);
    setSourcesSidebarOpen(false);
    setSourcesSidebarCollapsed(false);

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
      
      // Stocker les sources et ouvrir le sidebar uniquement sur desktop (lg: 1024px+)
      if (parsedSources.length > 0) {
        setCurrentMessageSources(parsedSources);
        // N'ouvrir automatiquement que sur grand écran
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setSourcesSidebarOpen(true);
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel API:', error);
      
      let errorContent = '❌ Impossible de se connecter au service.\n\n';
      
      // Vérifier si c'est une erreur de connexion réseau
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorContent += 'Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.\n\n';
        errorContent += '💡 Si le problème persiste, vérifiez votre connexion internet ou contactez le support.';
      } 
      // Vérifier si c'est une ApiError (objet avec propriété status)
      else if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as ApiError;
        if (apiError.status === 504) {
          errorContent += '⏱️ La requête a pris trop de temps. Veuillez reformuler votre question ou réessayer plus tard.';
        } else if (apiError.status === 429) {
          errorContent += '⏸️ Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.';
        } else if (apiError.status && apiError.status >= 500) {
          errorContent += '🔧 Le service rencontre des difficultés techniques. Veuillez réessayer dans quelques instants.';
        } else {
          errorContent += 'Une erreur s\'est produite. Veuillez réessayer.';
        }
      } 
      // Erreur générique
      else if (error instanceof Error) {
        // Ne pas exposer les détails techniques de l'erreur
        // Vérifier si c'est un timeout
        if (error.message.includes('temps') || error.message.includes('timeout')) {
          errorContent += '⏱️ La requête a pris trop de temps. Veuillez réessayer.';
        } else {
          errorContent += 'Une erreur s\'est produite lors du traitement de votre demande. Veuillez réessayer.';
        }
      } 
      // Erreur inconnue
      else {
        errorContent += 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
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

  const handleNewChat = useCallback(() => {
    // Générer un nouveau session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setMessages([]);
    setExpandedSources({});
    setCurrentMessageSources([]);
    setSourcesSidebarOpen(false);
    setSidebarOpen(false);
    setSessionId(newSessionId);
    setActiveConversationId(null);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('lexsenegal_session_id', newSessionId);
    }
    
    console.log('🆕 Nouvelle conversation créée:', newSessionId);
  }, []);

  const handleChatClick = useCallback((chatId: string) => {
    // Charger la conversation depuis localStorage
    const savedMessages = loadConversation(chatId);
    
    // Mettre à jour l'état
    setSessionId(chatId);
    setActiveConversationId(chatId);
    setMessages(savedMessages);
    setExpandedSources({});
    setCurrentMessageSources([]);
    setSourcesSidebarOpen(false);
    setSidebarOpen(false);
    
    // Scroll vers le bas après chargement
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    console.log(`📂 Conversation ${chatId} chargée (${savedMessages.length} messages)`);
  }, [loadConversation]);

  // Gérer le clic sur une citation d'article pour afficher la source
  const handleArticleClick = useCallback((articleText: string, messageSources?: string[]) => {
    if (!messageSources || messageSources.length === 0) return;
    
    // Parser les sources du message
    const parsedSources = parseSources(messageSources);
    
    // Chercher la source qui correspond le mieux à l'article cité
    const articleLower = articleText.toLowerCase();
    
    // Essayer de trouver une source correspondante
    let matchedSource = parsedSources.find(source => {
      const titleLower = source.title.toLowerCase();
      const contentLower = source.content.toLowerCase();
      
      // Vérifier si l'article est mentionné dans le titre ou le contenu
      if (articleLower.includes('code du travail') || articleLower.includes('travail')) {
        return titleLower.includes('travail') || titleLower.includes('codedutravail');
      }
      if (articleLower.includes('code pénal') || articleLower.includes('code penal') || articleLower.includes('pénal')) {
        return titleLower.includes('pénal') || titleLower.includes('penal');
      }
      if (articleLower.includes('constitution')) {
        return titleLower.includes('constitution');
      }
      
      // Recherche générique
      return contentLower.includes(articleText.toLowerCase().replace(/article\s+/i, ''));
    });
    
    // Si pas de correspondance exacte, prendre la première source
    if (!matchedSource && parsedSources.length > 0) {
      matchedSource = parsedSources[0];
    }
    
    // Ouvrir le sidebar des sources avec les sources du message
    setCurrentMessageSources(parsedSources);
    setSourcesSidebarOpen(true);
  }, [parseSources]);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar gauche (historique) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
        onChatClick={handleChatClick}
        onCollapseChange={setSidebarCollapsed}
        activeConversationId={activeConversationId || sessionId}
      />
      
      {/* Sidebar droite (sources) */}
      <SourcesSidebar
        isOpen={sourcesSidebarOpen}
        onClose={() => setSourcesSidebarOpen(false)}
        sources={currentMessageSources}
        isLoading={isLoading}
        onCollapseChange={setSourcesSidebarCollapsed}
      />
      
      {/* Bouton flottant pour ouvrir les sources sur mobile */}
      {currentMessageSources.length > 0 && !sourcesSidebarOpen && (
        <button
          onClick={() => setSourcesSidebarOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0891B2] to-[#14B8A6] px-4 py-3 text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95 lg:hidden"
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm font-semibold">{currentMessageSources.length} source{currentMessageSources.length > 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Zone principale */}
      <div className={`flex flex-1 flex-col transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} ${sourcesSidebarOpen && !sourcesSidebarCollapsed ? 'lg:mr-[420px]' : sourcesSidebarOpen && sourcesSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-0'}`}>
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Zone de chat scrollable */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-2 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8 lg:py-8"
        >
        <div className={`mx-auto space-y-4 sm:space-y-6 md:space-y-8 transition-all duration-300 ease-in-out ${
          !sourcesSidebarOpen || sourcesSidebarCollapsed 
            ? 'max-w-5xl' 
            : 'max-w-3xl'
        }`}>
          {messages.length === 0 ? (
            <EmptyState
              onQuestionClick={handleSuggestionClick}
              isLoading={isLoading}
            />
          ) : null}

          {messages.map((message, index) => (
            <div key={index} className="flex w-full animate-slide-in" style={{ animationDelay: `${index * 0.05}s` }}>
              {message.role === 'user' ? (
                // Message utilisateur - aligné à droite
                <div className={`ml-auto transition-all duration-300 ease-in-out ${
                  !sourcesSidebarOpen || sourcesSidebarCollapsed 
                    ? 'max-w-[92%] sm:max-w-[85%] md:max-w-[75%]' 
                    : 'max-w-[88%] sm:max-w-[80%] md:max-w-[70%]'
                }`}>
                  <div className="bg-gradient-to-br from-[#0891B2] to-[#0E7490] text-white rounded-xl sm:rounded-2xl rounded-br-sm sm:rounded-br-md px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-4 shadow-md">
                    <p className="whitespace-pre-wrap text-[13px] sm:text-[14px] md:text-[15px] leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ) : (
                // Message assistant - aligné à gauche
                <div className={`mr-auto transition-all duration-300 ease-in-out ${
                  !sourcesSidebarOpen || sourcesSidebarCollapsed 
                    ? 'max-w-[98%] sm:max-w-[95%] md:max-w-[90%]' 
                    : 'max-w-[95%] sm:max-w-[90%] md:max-w-[85%]'
                }`}>
                  <div className="flex gap-2 sm:gap-3 md:gap-4">
                    {/* Avatar - plus petit sur mobile */}
                    <div className="shrink-0">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-lg sm:rounded-xl bg-white shadow-md overflow-hidden border border-[#E2E8F0]">
                        <Image
                          src="/assets/logo.png"
                          alt="YoonAssist AI"
                          width={40}
                          height={40}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </div>
                    
                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      {/* Nom de l'assistant */}
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <span className="text-xs sm:text-sm font-semibold text-[#0F2942]">YoonAssist</span>
                        <span className="text-[8px] sm:text-[10px] font-medium text-[#0891B2] bg-[#0891B2]/10 px-1.5 sm:px-2 py-0.5 rounded-full">AI</span>
                      </div>
                      
                      {/* Message */}
                      <div className="bg-white rounded-xl sm:rounded-2xl rounded-tl-sm sm:rounded-tl-md px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-4 shadow-sm border border-[#E2E8F0]">
                        <FormattedResponse 
                          content={message.content} 
                          onArticleClick={(articleText) => handleArticleClick(articleText, message.sources)}
                        />
                      </div>

                      {/* Bouton pour ouvrir le sidebar des sources */}
                      {(() => {
                        const parsedSources = message.sources ? parseSources(message.sources) : [];
                        if (parsedSources.length === 0) return null;
                        
                        return (
                          <div className="mt-2 sm:mt-3">
                            <button
                              onClick={() => {
                                setCurrentMessageSources(parsedSources);
                                setSourcesSidebarOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0891B2] hover:text-[#0891B2] hover:shadow-md"
                            >
                              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span>
                                {parsedSources.length} source{parsedSources.length > 1 ? 's' : ''}
                              </span>
                            </button>
                          </div>
                        );
                      })()}

                      {/* Disclaimer */}
                      <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-amber-50/80 border border-amber-200 rounded-lg sm:rounded-xl">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500 text-sm sm:text-base shrink-0">⚠️</span>
                          <p className="text-[10px] sm:text-xs text-amber-700 leading-relaxed">
                            <strong className="font-semibold">Avertissement :</strong> Ces informations sont fournies à titre indicatif uniquement et ne constituent pas un avis juridique. Pour toute situation spécifique, consultez un professionnel du droit qualifié.
                          </p>
                        </div>
                      </div>

                      {/* Questions suggérées */}
                      {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                        <SuggestedQuestions
                          questions={message.suggestedQuestions}
                          onQuestionClick={handleSuggestionClick}
                          isLoading={isLoading}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Indicateur de chargement */}
          {isLoading && (
            <div className="flex w-full animate-slide-in">
              <div className={`mr-auto transition-all duration-300 ease-in-out ${
                !sourcesSidebarOpen || sourcesSidebarCollapsed 
                  ? 'max-w-[98%] sm:max-w-[95%] md:max-w-[90%]' 
                  : 'max-w-[95%] sm:max-w-[90%] md:max-w-[85%]'
              }`}>
                <div className="flex gap-2 sm:gap-3 md:gap-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-lg sm:rounded-xl bg-white shadow-md overflow-hidden border border-[#E2E8F0] animate-pulse">
                      <Image
                        src="/assets/logo.png"
                        alt="YoonAssist AI"
                        width={40}
                        height={40}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                  
                  {/* Contenu */}
                  <div className="flex-1">
                    {/* Nom */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <span className="text-xs sm:text-sm font-semibold text-[#0F2942]">YoonAssist</span>
                      <span className="text-[8px] sm:text-[10px] font-medium text-[#0891B2] bg-[#0891B2]/10 px-1.5 sm:px-2 py-0.5 rounded-full">AI</span>
                    </div>
                    
                    {/* Bulle de chargement */}
                    <div className="bg-white rounded-xl sm:rounded-2xl rounded-tl-sm sm:rounded-tl-md px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-4 shadow-sm border border-[#E2E8F0]">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-[#0891B2]" />
                        <span className="text-xs sm:text-sm text-[#64748B]">Analyse en cours...</span>
                      </div>
                      <div className="flex gap-1 sm:gap-1.5 mt-2 sm:mt-3">
                        <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[#0891B2] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[#0891B2] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[#0891B2] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Questions suggérées globales */}
          {!isLoading && globalSuggestedQuestions.length > 0 && (
            <div className="mt-6 w-full">
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
        <div className="sticky bottom-0 z-40 w-full border-t border-[#E2E8F0] glass px-2 py-3 sm:px-4 sm:py-4 md:px-6 lg:px-8 lg:py-5">
        <form onSubmit={handleSubmit} className={`mx-auto transition-all duration-300 ease-in-out ${
          !sourcesSidebarOpen || sourcesSidebarCollapsed 
            ? 'max-w-5xl' 
            : 'max-w-3xl'
        }`}>
          <div className="flex items-end gap-2 sm:gap-3 md:gap-4">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Posez votre question..."
                disabled={isLoading}
                rows={1}
                className="input-modern w-full resize-none text-[13px] sm:text-[14px] md:text-[15px] text-[#0F2942] placeholder:text-[#94A3B8] px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5"
                style={{
                  minHeight: '44px',
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
              className="btn-primary flex h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 shrink-0 items-center justify-center !rounded-xl sm:!rounded-2xl !p-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : (
                <Send className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </button>
          </div>
          <p className="hidden sm:block text-center text-[10px] sm:text-[11px] text-[#94A3B8] mt-2 sm:mt-3">
            YoonAssist peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </form>
        </div>
      </div>
    </div>
  );
}
