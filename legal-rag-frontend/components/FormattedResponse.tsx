'use client';

import { useMemo } from 'react';

interface FormattedResponseProps {
  content: string;
  onArticleClick?: (articleText: string) => void;
}

export default function FormattedResponse({ content, onArticleClick }: FormattedResponseProps) {
  const formattedContent = useMemo(() => {
    if (!content) return '';

    let text = content.replace(/\r\n/g, '\n').trim();

    // Séparer les éléments de liste condensés
    text = text.replace(/(\d+\.)\s+([^0-9\n]+?)(?=\s*\d+\.)/g, '$1 $2\n');
    text = text.replace(/([-•])\s+([^-•\n]+?)(?=\s*[-•])/g, '$1 $2\n');

    const lines = text.split('\n');
    const result: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
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
          result.push('<ol class="list">');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${formatInlineText(numberedMatch[2])}</li>`);
        continue;
      }

      // Listes à puces
      const bulletMatch = line.match(/^[-•]\s+(.+)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) result.push(listType === 'ol' ? '</ol>' : '</ul>');
          result.push('<ul class="list">');
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
        result.push(`<h4 class="title">${formatInlineText(line)}</h4>`);
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

    // Gras **texte**
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italique *texte*
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Citations d'articles entre crochets [Article X du Code Y]
    formatted = formatted.replace(
      /\[([^\]]*(?:Article|Art\.?)[^\]]*)\]/gi, 
      '<button type="button" class="cite" data-article="$1">📜 $1</button>'
    );
    
    // Autres références entre crochets
    formatted = formatted.replace(/\[([^\]]+)\]/g, '<span class="ref">[$1]</span>');

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
    <div className="response" onClick={handleClick}>
      <style jsx>{`
        .response {
          font-size: 15px;
          line-height: 1.7;
          color: #334155;
        }
        
        .response :global(p) {
          margin: 0 0 0.75rem;
        }
        
        .response :global(p:last-child) {
          margin-bottom: 0;
        }
        
        .response :global(strong) {
          font-weight: 600;
          color: #1e293b;
        }
        
        .response :global(em) {
          font-style: italic;
        }
        
        .response :global(.title) {
          font-size: 14px;
          font-weight: 600;
          color: #0891b2;
          margin: 1rem 0 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        
        .response :global(.title:first-child) {
          margin-top: 0;
        }
        
        .response :global(.list) {
          margin: 0.5rem 0;
          padding-left: 1.25rem;
        }
        
        .response :global(.list li) {
          margin-bottom: 0.375rem;
          padding-left: 0.25rem;
        }
        
        .response :global(ol.list) {
          list-style: decimal;
        }
        
        .response :global(ul.list) {
          list-style: disc;
        }
        
        .response :global(ul.list li::marker) {
          color: #0891b2;
        }
        
        .response :global(ol.list li::marker) {
          color: #0891b2;
          font-weight: 600;
        }
        
        /* Citation d'article - badge élégant */
        .response :global(.cite) {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #0891b2;
          background: linear-gradient(135deg, #ecfeff 0%, #f0fdfa 100%);
          padding: 0.25rem 0.625rem;
          border-radius: 1rem;
          border: 1px solid #99f6e4;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          margin: 0.125rem 0;
        }
        
        .response :global(.cite:hover) {
          background: linear-gradient(135deg, #cffafe 0%, #ccfbf1 100%);
          border-color: #5eead4;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(8, 145, 178, 0.15);
        }
        
        .response :global(.ref) {
          font-size: 0.8125rem;
          color: #64748b;
          font-style: italic;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
    </div>
  );
}
