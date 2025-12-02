'use client';

import { Scale } from 'lucide-react';
import { useMemo } from 'react';

interface FormattedResponseProps {
  content: string;
}

export default function FormattedResponse({ content }: FormattedResponseProps) {
  const formattedContent = useMemo(() => {
    let formatted = content;

    // Traiter le markdown : convertir **texte** en <strong>
    formatted = formatted.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold text-slate-900">$1</strong>'
    );

    // Traiter le markdown : convertir *texte* en <em> (italique)
    formatted = formatted.replace(
      /\*(.+?)\*/g,
      '<em class="italic text-slate-800">$1</em>'
    );

    // Détecter et formater les articles de loi (L.2, L.69, Article 25, etc.)
    formatted = formatted.replace(
      /\b(Article\s+)?(L\.\d+|L\.\s*\d+|[A-Z]\.\d+)\b/gi,
      '<span class="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-block">$&</span>'
    );

    // Détecter et formater les dates (2025, 2026, etc.)
    formatted = formatted.replace(
      /\b(19|20)\d{2}\b/g,
      '<span class="font-semibold text-purple-700">$&</span>'
    );

    // Détecter et formater les nombres importants (60 ans, 65 ans, montants, etc.)
    formatted = formatted.replace(
      /\b(\d+)\s*(ans?|mois|jours?|heures?|francs?|FCFA|euros?|%)\b/gi,
      '<span class="font-semibold text-emerald-700">$&</span>'
    );

    // Formater les listes à puces (commençant par - ou •)
    formatted = formatted.replace(
      /^[\-\•]\s+(.+)$/gm,
      '<div class="ml-6 mb-2 flex items-start gap-3"><span class="text-emerald-600 mt-1.5 shrink-0 font-bold">•</span><span class="flex-1 text-slate-700 leading-relaxed">$1</span></div>'
    );

    // Formater les listes numérotées
    formatted = formatted.replace(
      /^(\d+)\.\s+(.+)$/gm,
      '<div class="ml-6 mb-2 flex items-start gap-3"><span class="font-semibold text-emerald-600 shrink-0 min-w-[24px]">$1.</span><span class="flex-1 text-slate-700 leading-relaxed">$2</span></div>'
    );

    // Mettre en gras les mots-clés importants
    const importantKeywords = [
      'doit',
      'obligation',
      'droit',
      'interdit',
      'autorisé',
      'requis',
      'nécessaire',
      'important',
      'selon',
      'conformément',
    ];
    importantKeywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(
        regex,
        '<strong class="font-semibold text-slate-900">$&</strong>'
      );
    });

    // Diviser en paragraphes et formater
    const paragraphs = formatted.split(/\n\n+/);
    return paragraphs
      .map((para) => {
        const trimmed = para.trim();
        if (!trimmed) return '';
        
        // Si c'est déjà une div (liste), retourner tel quel
        if (trimmed.startsWith('<div')) {
          return trimmed;
        }
        
        // Sinon, créer un paragraphe avec meilleur espacement
        return `<p class="mb-4 leading-relaxed text-slate-700 text-[15px]">${trimmed}</p>`;
      })
      .join('');

  }, [content]);

  return (
    <div 
      className="text-sm"
      dangerouslySetInnerHTML={{ __html: formattedContent }}
    />
  );
}

