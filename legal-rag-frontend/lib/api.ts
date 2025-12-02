/**
 * Client API sécurisé pour communiquer avec le backend FastAPI.
 * Gère les erreurs, le timeout, et la validation des réponses.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const API_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '120000', 10);

export interface ApiResponse {
  reponse: string;
  sources: string[];
  suggested_questions?: string[];
}

export interface ApiError {
  detail: string;
  status?: number;
}

/**
 * Effectue une requête avec timeout et gestion d'erreur.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La requête a pris trop de temps. Veuillez réessayer.');
    }
    throw error;
  }
}

/**
 * Sanitize le texte pour éviter les attaques XSS.
 */
export function sanitizeText(text: string): string {
  if (typeof window === 'undefined') {
    return text; // SSR: pas besoin de sanitization
  }

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Valide et nettoie la question avant l'envoi.
 */
export function validateQuestion(question: string): { valid: boolean; error?: string } {
  if (!question || !question.trim()) {
    return { valid: false, error: 'La question ne peut pas être vide' };
  }

  if (question.length > 5000) {
    return { valid: false, error: 'La question est trop longue (max 5000 caractères)' };
  }

  // Vérifier les caractères dangereux
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(question)) {
      return { valid: false, error: 'La question contient des caractères non autorisés' };
    }
  }

  return { valid: true };
}

/**
 * Envoie une question à l'API et retourne la réponse.
 */
export async function askQuestion(
  question: string,
  threadId: string
): Promise<ApiResponse> {
  // Valider la question
  const validation = validateQuestion(question);
  if (!validation.valid) {
    throw new Error(validation.error || 'Question invalide');
  }

  // Valider le threadId
  if (threadId && threadId.length > 100) {
    throw new Error('Thread ID invalide');
  }

  try {
    const response = await fetchWithTimeout(
      `${API_URL}/ask`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          thread_id: threadId || 'default',
        }),
      }
    );

    if (!response.ok) {
      let errorDetail = 'Une erreur est survenue';
      
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorDetail;
      } catch {
        // Si la réponse n'est pas du JSON, utiliser le statut
        errorDetail = `Erreur HTTP ${response.status}`;
      }

      const error: ApiError = {
        detail: errorDetail,
        status: response.status,
      };

      // Gérer les erreurs spécifiques
      if (response.status === 429) {
        error.detail = 'Trop de requêtes. Veuillez patienter avant de réessayer.';
      } else if (response.status === 504) {
        error.detail = 'La requête a pris trop de temps. Veuillez reformuler votre question.';
      }

      throw error;
    }

    const data: ApiResponse = await response.json();

    // Valider la structure de la réponse
    if (!data.reponse || typeof data.reponse !== 'string') {
      throw new Error('Réponse invalide de l\'API');
    }

    // Ne pas sanitizer les réponses (React les sécurise automatiquement avec textContent)
    // Le backend ne les encode plus en HTML, donc pas besoin de double encodage
    return {
      reponse: data.reponse,
      sources: data.sources || [],
      suggested_questions: data.suggested_questions || [],
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    // Ne pas exposer les détails techniques
    throw new Error('Impossible de se connecter au service');
  }
}

/**
 * Vérifie si l'API est accessible.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/health`,
      { method: 'GET' },
      5000 // Timeout court pour le health check
    );
    return response.ok;
  } catch {
    return false;
  }
}

