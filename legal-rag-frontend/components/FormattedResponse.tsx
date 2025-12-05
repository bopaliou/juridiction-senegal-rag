'use client';

import { useMemo, memo } from 'react';

interface FormattedResponseProps {
  content: string;
  onArticleClick?: (articleText: string) => void;
}

function FormattedResponse({ content, onArticleClick }: FormattedResponseProps) {
  const formattedContent = useMemo(() => {
    if (!content) return '';

    let text = content.replace(/\r\n/g, '\n').trim();

    // Séparer les éléments de liste condensés
    text = text.replace(/(\d+\.)\s+([^0-9\n]+?)(?=\s*\d+\.)/g, '$1 $2\n');
    text = text.replace(/([-•*])\s+([^-•*\n]+?)(?=\s*[-•*])/g, '$1 $2\n');

    const lines = text.split('\n');
    const result: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inList) {
          result.push(listType === 'ol' ? '</ol>' : '</ul>');
          inList = false;
          listType = null;
        }
        continue;
      }

      // Listes numérotées
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) result.push(listType === 'ol' ? '</ol>' : '</ul>');
          result.push('<ol class="legal-list numbered">');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${formatInlineText(numberedMatch[2])}</li>`);
        continue;
      }

      // Listes à puces (tiret, puce, ou astérisque)
      const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) result.push(listType === 'ol' ? '</ol>' : '</ul>');
          result.push('<ul class="legal-list bullets">');
          inList = true;
          listType = 'ul';
        }
        result.push(`<li>${formatInlineText(bulletMatch[1])}</li>`);
        continue;
      }

      // Fermer la liste si on sort
      if (inList) {
        result.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }

      // Titre de section
      if (line.endsWith(':') && line.length < 80) {
        result.push(`<h4 class="section-heading">${formatInlineText(line)}</h4>`);
      } else {
        result.push(`<p>${formatInlineText(line)}</p>`);
      }
    }

    if (inList) {
      result.push(listType === 'ol' ? '</ol>' : '</ul>');
    }

    return result.join('');
  }, [content]);

  function formatInlineText(text: string): string {
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Gras **texte** → remplacer par balise strong
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italique *texte* → remplacer par balise em (seulement si pas double astérisque)
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Nettoyer les astérisques orphelins qui restent (puces mal formatées)
    formatted = formatted.replace(/^\*\s+/gm, '• ');
    formatted = formatted.replace(/\s\*\s/g, ' • ');
    
    // Citations d'articles entre crochets [Article X du Code Y] - badge professionnel
    formatted = formatted.replace(
      /\[([^\]]*(?:Article|Art\.?)[^\]]*)\]/gi, 
      '<button type="button" class="article-badge" data-article="$1"><span class="badge-icon">⚖️</span><span class="badge-text">$1</span></button>'
    );
    
    // Autres références entre crochets
    formatted = formatted.replace(/\[([^\]]+)\]/g, '<span class="text-ref">[$1]</span>');

    return formatted;
  }

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button[data-article]');
    if (button && onArticleClick) {
      const articleText = button.getAttribute('data-article');
      if (articleText) {
        onArticleClick(articleText);
      }
    }
  };

  return (
    <div className="legal-response" onClick={handleClick}>
      <style jsx>{`
        .legal-response {
          font-size: 15px;
          line-height: 1.75;
          color: #374151;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .legal-response :global(p) {
          margin: 0 0 1rem;
        }
        
        .legal-response :global(p:last-child) {
          margin-bottom: 0;
        }
        
        .legal-response :global(strong) {
          font-weight: 600;
          color: #111827;
        }
        
        .legal-response :global(em) {
          font-style: italic;
          color: #4b5563;
        }
        
        /* Titres de section */
        .legal-response :global(.section-heading) {
          font-size: 14px;
          font-weight: 700;
          color: #0d9488;
          margin: 1.25rem 0 0.625rem;
          padding-bottom: 0.375rem;
          border-bottom: 2px solid #99f6e4;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .legal-response :global(.section-heading:first-child) {
          margin-top: 0;
        }
        
        /* Listes juridiques */
        .legal-response :global(.legal-list) {
          margin: 0.75rem 0;
          padding: 0;
          list-style: none;
        }
        
        .legal-response :global(.legal-list li) {
          position: relative;
          padding: 0.625rem 0.875rem 0.625rem 2rem;
          margin-bottom: 0.5rem;
          background: linear-gradient(to right, #f0fdfa, #f8fafc);
          border-radius: 0.5rem;
          border-left: 3px solid #14b8a6;
        }
        
        .legal-response :global(.legal-list li:last-child) {
          margin-bottom: 0;
        }
        
        .legal-response :global(.legal-list.bullets li::before) {
          content: "•";
          position: absolute;
          left: 0.75rem;
          color: #14b8a6;
          font-weight: bold;
          font-size: 1.25rem;
          line-height: 1.4;
        }
        
        .legal-response :global(.legal-list.numbered) {
          counter-reset: item;
        }
        
        .legal-response :global(.legal-list.numbered li::before) {
          counter-increment: item;
          content: counter(item) ".";
          position: absolute;
          left: 0.625rem;
          color: #0d9488;
          font-weight: 700;
          font-size: 0.875rem;
        }
        
        /* Badge de citation d'article - Design professionnel */
        .legal-response :global(.article-badge) {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #0f766e;
          background: linear-gradient(135deg, #ccfbf1 0%, #d1fae5 100%);
          padding: 0.375rem 0.75rem;
          border-radius: 2rem;
          border: 1.5px solid #5eead4;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          margin: 0.25rem 0.125rem;
          box-shadow: 0 1px 3px rgba(20, 184, 166, 0.1);
          white-space: nowrap;
        }
        
        .legal-response :global(.article-badge:hover) {
          background: linear-gradient(135deg, #99f6e4 0%, #a7f3d0 100%);
          border-color: #2dd4bf;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(20, 184, 166, 0.25);
        }
        
        .legal-response :global(.article-badge:active) {
          transform: translateY(0);
        }
        
        .legal-response :global(.badge-icon) {
          font-size: 0.875rem;
        }
        
        .legal-response :global(.badge-text) {
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        /* Référence simple */
        .legal-response :global(.text-ref) {
          font-size: 0.875rem;
          color: #6b7280;
          font-style: italic;
        }
        
        @media (max-width: 640px) {
          .legal-response {
            font-size: 14px;
          }
          
          .legal-response :global(.legal-list li) {
            padding: 0.5rem 0.75rem 0.5rem 1.75rem;
          }
          
          .legal-response :global(.article-badge) {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
          }
          
          .legal-response :global(.badge-text) {
            max-width: 180px;
          }
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
    </div>
  );
}

// Memoize le composant pour éviter les re-renders inutiles
export default memo(FormattedResponse);
