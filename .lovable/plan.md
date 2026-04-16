

# Plan : Migration vers Supabase Cloud (offre gratuite)

## Résumé

Migrer le stockage localStorage vers Supabase (via Lovable Cloud) pour permettre le travail collaboratif multi-postes en temps réel. Les données seront synchronisées automatiquement entre tous les utilisateurs.

## Architecture de la base de données

Deux tables simples, adaptées au modèle JSON existant :

```text
drivers
├── id (uuid, PK)
├── name (text, unique)
├── created_at (timestamptz)

month_data
├── id (uuid, PK)
├── year (int)
├── month (int)  -- 0-11
├── data (jsonb) -- contient drivers: {}, days: {}
├── updated_at (timestamptz)
├── UNIQUE(year, month)
```

On garde le format JSONB pour `data` afin de minimiser les changements dans le code existant. La structure `MonthData` reste identique.

## Pas d'authentification

L'app est un outil interne, pas besoin de login. Les tables auront des politiques RLS permissives (accès anonyme en lecture/écriture) pour simplifier. L'accès est contrôlé par l'URL elle-même.

## Étapes d'implémentation

### 1. Activer Lovable Cloud et créer les tables
- Activer Supabase via Lovable Cloud
- Créer les migrations pour les 2 tables avec RLS permissif (anon access)

### 2. Réécrire `src/lib/storage.ts`
- Remplacer les appels localStorage par des requêtes Supabase
- `loadMonth()` → `select` from `month_data` where year/month
- `saveMonth()` → `upsert` into `month_data` (on conflict year+month)
- `loadDrivers()` → `select` from `drivers` ordered by name
- `saveDrivers()` → sync (delete removed, insert new)
- `loadAllMonths()` → `select *` from `month_data`
- Garder le fallback localStorage en cas de perte de connexion

### 3. Ajouter la synchronisation temps réel
- Utiliser Supabase Realtime (channels) sur `month_data` et `drivers`
- Quand un autre poste modifie les données, le state se met à jour automatiquement
- Ajouter un listener dans `Index.tsx` qui écoute les changements et rafraîchit le state

### 4. Adapter `Index.tsx`
- Rendre le chargement initial asynchrone (loading state)
- Les `useEffect` de sauvegarde appellent les nouvelles fonctions async
- Debounce les sauvegardes (500ms) pour éviter trop de requêtes

### 5. Migration des données existantes
- Au premier lancement, détecter si localStorage contient des données
- Les pousser vers Supabase automatiquement puis vider localStorage

## Détails techniques

- **Debounce** : Les sauvegardes seront regroupées avec un délai de 500ms pour éviter de surcharger la base
- **Realtime** : Supabase Realtime est inclus dans l'offre gratuite (jusqu'à 200 connexions simultanées)
- **JSONB** : On stocke `MonthData` tel quel en JSONB, ce qui évite de restructurer tout le code
- **Conflits** : Stratégie "last write wins" — le dernier à sauvegarder écrase. Suffisant pour 2-3 utilisateurs simultanés

