/**
 * Utilitaires de sécurité pour valider et nettoyer les entrées utilisateur
 */

/**
 * Valide et nettoie une chaîne de caractères pour éviter les injections
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Supprimer les caractères de contrôle
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

  // Limiter la longueur
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }

  return sanitized.trim();
}

/**
 * Valide un email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valide un mot de passe (minimum 6 caractères, recommandations de sécurité)
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Le mot de passe doit contenir au moins 6 caractères');
  }

  if (password.length > 128) {
    errors.push('Le mot de passe est trop long (max 128 caractères)');
  }

  // Vérifier les caractères dangereux
  if (/[<>]/.test(password)) {
    errors.push('Le mot de passe contient des caractères non autorisés');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un thread ID pour éviter les injections
 */
export function validateThreadId(threadId: string): boolean {
  if (!threadId || typeof threadId !== 'string') {
    return false;
  }

  // Thread ID doit être alphanumérique avec tirets et underscores, max 100 caractères
  const threadIdRegex = /^[a-zA-Z0-9_-]{1,100}$/;
  return threadIdRegex.test(threadId);
}

/**
 * Échappe les caractères HTML pour éviter XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

