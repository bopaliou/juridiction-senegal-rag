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
        // Questions sur le droit du travail - Dispositions générales (Code du Travail)
        "Qui est considéré comme travailleur selon l'article L.2 du Code du Travail ?",
        "Qu'est-ce qu'un travailleur au sens de l'article L.2 du Code du Travail ?",
        "Quelles sont les personnes soumises au Code du Travail sénégalais ?",
        "Qu'est-ce qu'une entreprise selon l'article L.3 du Code du Travail ?",
        "Qu'est-ce qu'un établissement au sens du Code du Travail ?",
        "Quelles sont les obligations de l'employeur envers les travailleurs ?",
        "Quel est le droit au travail selon l'article L.1 du Code du Travail ?",
        "Comment l'État assure-t-il l'égalité de chance en matière d'emploi ?",
        "Quelles sont les obligations de l'État envers les travailleurs ?",
        "Le travail forcé est-il interdit au Sénégal selon l'article L.4 ?",
        "Qu'est-ce que le travail forcé ou obligatoire selon l'article L.4 ?",
        "Quelles sont les exceptions à l'interdiction du travail forcé ?",
        "Qu'est-ce que le droit à l'expression des travailleurs selon l'article L.5 ?",
        "Quel est l'objet du droit d'expression des travailleurs dans l'entreprise ?",
        "Les opinions des travailleurs peuvent-elles motiver un licenciement selon l'article L.5 ?",
        "Quelles sont les conditions d'application du droit d'expression des travailleurs ?",
        "Un travailleur peut-il bénéficier d'avantages supérieurs à ceux du Code du Travail ?",
        "Les personnes nommées dans un emploi permanent de l'administration sont-elles soumises au Code du Travail ?",
        
        // Questions sur les syndicats professionnels (Code du Travail)
        "Quelles sont les règles de création d'un syndicat professionnel ?",
        "Quel est l'objet des syndicats professionnels selon l'article L.6 ?",
        "Qui peut constituer un syndicat professionnel selon l'article L.7 ?",
        "Qui peut adhérer à un syndicat professionnel ?",
        "Quelles sont les conditions pour créer un syndicat professionnel ?",
        "Comment fonctionne la procédure de dépôt des statuts d'un syndicat ?",
        "Où doit-on déposer les statuts d'un syndicat professionnel selon l'article L.8 ?",
        "Quels documents doivent être déposés pour créer un syndicat ?",
        "Quel est le délai pour le dépôt des statuts d'un syndicat ?",
        "Qui délivre le récépissé de reconnaissance d'un syndicat ?",
        "Quelles sont les conditions d'accès aux fonctions de direction syndicale ?",
        "Qui vérifie la régularité des statuts d'un syndicat ?",
        "Quelles sont les conséquences si un membre ne remplit pas les conditions pour diriger un syndicat ?",
        "Quand peut-on demander la dissolution d'un syndicat ?",
        "Quelles protections s'appliquent aux travailleurs dans l'exercice du droit d'expression ?",
        "Quelles sont les infractions concernant le travail forcé ?",
        "Quels sont les droits des syndicats devant la justice ?",
        "Quelles protections s'appliquent aux biens d'un syndicat ?",
        "Quelles sont les règles applicables aux syndicats ?",
        
        // Questions sur la retraite (Loi sur la retraite)
        "Quel est l'âge légal de départ à la retraite au Sénégal ?",
        "Quels sont les conditions pour bénéficier de la retraite ?",
        "Comment calculer la pension de retraite ?",
        "Quels travailleurs peuvent poursuivre leur activité au-delà de l'âge de la retraite ?",
        "Quelles sont les modalités de versement de la pension de retraite ?",
        "Comment fonctionne le système de retraite au Sénégal ?",
        "Quelles sont les cotisations nécessaires pour la retraite ?",
        "Quels sont les droits des retraités ?",
        "Comment faire une demande de retraite ?",
        "Quelles sont les conditions d'ancienneté pour la retraite ?",
        
        // Questions sur le droit pénal (Loi 84-20 du 02 février 1984)
        "Quelles sont les infractions prévues par la loi 84-20 du 02 février 1984 ?",
        "Quelles sont les peines prévues par la loi 84-20 ?",
        "Comment s'applique la loi 84-20 du 02 février 1984 ?",
        "Quelles sont les dispositions de la loi 84-20 concernant les infractions pénales ?",
        "Quels sont les délits réprimés par la loi 84-20 ?",
        "Quelles sont les sanctions prévues par la loi 84-20 ?",
        
        // Questions sur le droit pénal (Loi 2020-05 du 10 janvier 2020)
        "Quelles sont les modifications apportées par la loi 2020-05 du 10 janvier 2020 ?",
        "Comment la loi 2020-05 modifie-t-elle les peines pour violences sexuelles ?",
        "Quelles sont les nouvelles peines prévues par la loi 2020-05 ?",
        "Quelles sont les infractions concernées par la loi 2020-05 ?",
        "Comment s'applique la loi 2020-05 du 10 janvier 2020 ?",
        "Quelles sont les circonstances aggravantes prévues par la loi 2020-05 ?",
        "Quels sont les délais de prescription modifiés par la loi 2020-05 ?",
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
    <div className="flex h-screen bg-white">
      {/* Sidebar gauche (historique) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
        onChatClick={handleChatClick}
        onCollapseChange={setSidebarCollapsed}
      />
      
      {/* Sidebar droite (sources) */}
      <SourcesSidebar
        isOpen={sourcesSidebarOpen}
        onClose={() => setSourcesSidebarOpen(false)}
        sources={currentMessageSources}
        isLoading={isLoading}
        onCollapseChange={setSourcesSidebarCollapsed}
      />

      {/* Zone principale */}
      <div className={`flex flex-1 flex-col transition-all duration-300 overflow-x-hidden ${sidebarOpen && !sidebarCollapsed ? 'lg:ml-72' : sidebarOpen && sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-0'} ${sourcesSidebarOpen && !sourcesSidebarCollapsed ? 'lg:mr-[420px]' : sourcesSidebarOpen && sourcesSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-0'}`}>
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
                        <FormattedResponse content={message.content} />
                      </div>

                      {/* Bouton pour ouvrir le sidebar des sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 sm:mt-3">
                          <button
                            onClick={() => {
                              const parsedSources = parseSources(message.sources || []);
                              setCurrentMessageSources(parsedSources);
                              setSourcesSidebarOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0891B2] hover:text-[#0891B2] hover:shadow-md"
                          >
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span>
                              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                            </span>
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
