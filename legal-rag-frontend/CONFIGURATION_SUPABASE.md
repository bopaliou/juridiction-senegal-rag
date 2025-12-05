# Configuration Supabase - Guide

## URLs configurées dans Supabase

### Site URL
```
http://172.233.114.185
```

### Redirect URLs autorisées
- `http://172.233.114.185/auth/callback` - Callback principal pour OAuth et confirmation email
- `http://172.233.114.185/reset-password` - Page de réinitialisation du mot de passe
- `http://172.233.114.185/**` - Wildcard pour toutes les routes (fallback)
- `http://172.233.114.185/auth/confirm` - Route alternative pour confirmation email
- `https://uaordlnuhjowjtdiknfh.supabase.co/auth/v1/callback` - Callback Supabase (automatique)

## Configuration dans le code

### Variables d'environnement requises (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_ici
NEXT_PUBLIC_SITE_URL=http://172.233.114.185
```

### URLs utilisées dans le code

1. **Inscription (signUp)** - `lib/auth/actions.ts`
   - URL de redirection : `${NEXT_PUBLIC_SITE_URL}/auth/callback?type=signup`
   - Route : `/auth/callback` avec paramètre `type=signup`

2. **Réinitialisation mot de passe (resetPassword)** - `lib/auth/actions.ts`
   - URL de redirection : `${NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`
   - Route : `/auth/callback` avec paramètre `type=recovery`
   - Redirection finale : `/reset-password`

3. **Callback handler** - `app/auth/callback/route.ts`
   - Gère les callbacks OAuth et email confirmation
   - Redirige vers `/reset-password` si `type=recovery`
   - Redirige vers `/` (page d'accueil) sinon

4. **Confirmation email alternative** - `app/auth/confirm/route.ts`
   - Route : `/auth/confirm` avec `token_hash` et `type`
   - Utilisée pour les liens email directs

## Vérification de la configuration

✅ **Toutes les URLs sont correctement configurées :**
- Les URLs dans Supabase correspondent aux routes dans le code
- Le paramètre `NEXT_PUBLIC_SITE_URL` doit être défini à `http://172.233.114.185`
- Les routes `/auth/callback` et `/reset-password` sont bien dans la liste des Redirect URLs

## Notes importantes

1. **Site URL** : Doit correspondre exactement à `http://172.233.114.185` (sans slash final)
2. **Redirect URLs** : Les wildcards `/**` permettent une flexibilité, mais les URLs spécifiques sont préférées
3. **Environnement** : Assurez-vous que `NEXT_PUBLIC_SITE_URL` est bien défini dans `.env.local` sur Linode

