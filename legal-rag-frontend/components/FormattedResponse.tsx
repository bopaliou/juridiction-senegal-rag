'use client';

import { useMemo } from 'react';

interface FormattedResponseProps {
  content: string;
}

export default function FormattedResponse({ content }: FormattedResponseProps) {
  const formattedContent = useMemo(() => {
    if (!content) return '';

    // Normaliser les sauts de ligne
    let text = content.replace(/\r\n/g, '\n').trim();

    // Séparer les éléments de liste condensés sur une seule ligne
    // Ex: "1. Premier 2. Deuxième" -> "1. Premier\n2. Deuxième"
    text = text.replace(/(\d+\.)\s+([^0-9\n]+?)(?=\s*\d+\.)/g, '$1 $2\n');
    
    // Ex: "• Premier • Deuxième" ou "- Premier - Deuxième"
    text = text.replace(/([-•])\s+([^-•\n]+?)(?=\s*[-•])/g, '$1 $2\n');

    // Diviser en lignes pour traitement
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

      // Détecter les listes numérotées
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) result.push(listType === 'ol' ? '</ol>' : '</ul>');
          result.push('<ol class="numbered-list">');
          inList = true;
          listType = 'ol';
        }
        const itemContent = formatInlineText(numberedMatch[2]);
        result.push(`<li><span class="list-num">${numberedMatch[1]}.</span><span class="list-content">${itemContent}</span></li>`);
        continue;
      }

      // Détecter les listes à puces
      const bulletMatch = line.match(/^[-•]\s+(.+)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) result.push(listType === 'ol' ? '</ol>' : '</ul>');
          result.push('<ul class="bullet-list">');
          inList = true;
          listType = 'ul';
        }
        const itemContent = formatInlineText(bulletMatch[1]);
        result.push(`<li><span class="bullet">•</span><span class="list-content">${itemContent}</span></li>`);
        continue;
      }

      // Ligne normale (paragraphe ou titre)
      if (inList) {
        result.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }

      // Détecter les titres/sous-titres (lignes courtes suivies de tirets ou terminées par :)
      const isTitle = (line.endsWith(':') && line.length < 100) || 
                      (line.length < 60 && !line.includes('.') && i < lines.length - 1);
      
      if (isTitle && line.endsWith(':')) {
        result.push(`<h4 class="section-title">${formatInlineText(line)}</h4>`);
      } else {
        result.push(`<p>${formatInlineText(line)}</p>`);
      }
    }

    // Fermer la liste si on termine dedans
    if (inList) {
      result.push(listType === 'ol' ? '</ol>' : '</ul>');
    }

    return result.join('');
  }, [content]);

  // Formater le texte inline (gras, italique, références)
  function formatInlineText(text: string): string {
    let formatted = text
      // Échapper HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Markdown gras **texte**
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Markdown italique *texte*
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Références légales [Article X]
    formatted = formatted.replace(/\[([^\]]+)\]/g, '<span class="legal-ref">📄 $1</span>');
    
    // Articles de loi (L.1, L.2, etc.)
    formatted = formatted.replace(/\b(Article\s+)?(L\.\d+)/gi, '<span class="article-ref">$1$2</span>');

    return formatted;
  }

  return (
    <div className="formatted-response">
      <style jsx>{`
        .formatted-response {
          font-size: 14px;
          line-height: 1.75;
          color: #475569;
        }
        
        @media (min-width: 640px) {
          .formatted-response {
            font-size: 15px;
          }
        }
        
        .formatted-response :global(p) {
          margin-bottom: 0.875rem;
        }
        
        .formatted-response :global(p:last-child) {
          margin-bottom: 0;
        }
        
        .formatted-response :global(strong) {
          font-weight: 600;
          color: #0f2942;
        }
        
        .formatted-response :global(em) {
          font-style: italic;
          color: #334155;
        }
        
        .formatted-response :global(.section-title) {
          font-size: 15px;
          font-weight: 700;
          color: #0f2942;
          margin: 1rem 0 0.5rem 0;
          padding-bottom: 0.25rem;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .formatted-response :global(.section-title:first-child) {
          margin-top: 0;
        }
        
        .formatted-response :global(.bullet-list),
        .formatted-response :global(.numbered-list) {
          list-style: none;
          padding: 0;
          margin: 0.75rem 0;
        }
        
        .formatted-response :global(.bullet-list li),
        .formatted-response :global(.numbered-list li) {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.625rem;
          padding: 0.5rem 0.75rem;
          background: #f8fafc;
          border-radius: 0.5rem;
          border-left: 3px solid #0891b2;
        }
        
        .formatted-response :global(.bullet) {
          color: #0891b2;
          font-weight: bold;
          font-size: 1.25rem;
          line-height: 1.2;
          flex-shrink: 0;
        }
        
        .formatted-response :global(.list-num) {
          color: #0891b2;
          font-weight: 700;
          font-size: 0.875rem;
          min-width: 1.5rem;
          flex-shrink: 0;
        }
        
        .formatted-response :global(.list-content) {
          flex: 1;
          color: #334155;
        }
        
        .formatted-response :global(.legal-ref) {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: #64748b;
          background: #f1f5f9;
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          margin: 0.5rem 0;
          border: 1px solid #e2e8f0;
        }
        
        .formatted-response :global(.article-ref) {
          font-weight: 600;
          color: #0891b2;
          background: rgba(8, 145, 178, 0.1);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
    </div>
  );
}
