'use client';

import { useMemo } from 'react';

interface FormattedResponseProps {
  content: string;
}

export default function FormattedResponse({ content }: FormattedResponseProps) {
  const formattedContent = useMemo(() => {
    // Échapper les caractères HTML dangereux d'abord
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Traiter le markdown : convertir **texte** en <strong>
    formatted = formatted.replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Traiter le markdown : convertir *texte* en <em> (italique)
    formatted = formatted.replace(
      /(?<!\*)\*([^*]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    // Détecter les références légales entre crochets [Article X, Code Y]
    formatted = formatted.replace(
      /\[([^\]]+)\]/g,
      '<span class="ref-legal">📄 $1</span>'
    );

    // Formater les listes à puces
    // Séparer les éléments condensés sur une même ligne
    formatted = formatted.replace(
      /([-•]\s+[^-•\n]+?)(?=\s+[-•]\s)/g,
      '$1\n'
    );
    
    // Formater chaque élément de liste à puces
    formatted = formatted.replace(
      /^[-•]\s+(.+)$/gm,
      '<li class="list-bullet">$1</li>'
    );

    // Formater les listes numérotées
    // Séparer les éléments condensés
    formatted = formatted.replace(
      /(\d+\.\s+[^\n]+?)(?=\s+\d+\.\s)/g,
      '$1\n'
    );
    
    // Formater chaque élément de liste numérotée
    formatted = formatted.replace(
      /^(\d+)\.\s+(.+)$/gm,
      '<li class="list-number"><span class="num">$1.</span> $2</li>'
    );

    // Grouper les li consécutifs dans des ul
    formatted = formatted.replace(
      /(<li class="list-(?:bullet|number)">.+?<\/li>\n?)+/g,
      '<ul class="response-list">$&</ul>'
    );

    // Convertir les sauts de ligne en paragraphes
    const paragraphs = formatted.split(/\n\n+/);
    formatted = paragraphs
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<ul') || trimmed.startsWith('<li')) {
          return trimmed;
        }
        // Convertir les sauts de ligne simples en <br>
        const withBreaks = trimmed.replace(/\n/g, '<br>');
        return `<p>${withBreaks}</p>`;
      })
      .filter(p => p)
      .join('');

    return formatted;
  }, [content]);

  return (
    <div className="formatted-response">
      <style jsx>{`
        .formatted-response {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        }
        .formatted-response p {
          margin-bottom: 0.75rem;
        }
        .formatted-response p:last-child {
          margin-bottom: 0;
        }
        .formatted-response strong {
          font-weight: 600;
          color: #1e293b;
        }
        .formatted-response em {
          font-style: italic;
        }
        .formatted-response :global(.ref-legal) {
          display: inline-block;
          font-size: 12px;
          color: #64748b;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
          margin-top: 8px;
        }
        .formatted-response :global(.response-list) {
          list-style: none;
          padding-left: 0;
          margin: 0.75rem 0;
        }
        .formatted-response :global(.list-bullet) {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
          padding-left: 4px;
        }
        .formatted-response :global(.list-bullet)::before {
          content: "•";
          color: #0891b2;
          font-weight: bold;
          font-size: 18px;
          line-height: 1.4;
          flex-shrink: 0;
        }
        .formatted-response :global(.list-number) {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
          padding-left: 4px;
        }
        .formatted-response :global(.list-number) :global(.num) {
          color: #0891b2;
          font-weight: 600;
          flex-shrink: 0;
          min-width: 24px;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
    </div>
  );
}
