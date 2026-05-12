
## Problème

L'import affiche "3521 ventes / 0 chauffeur mis à jour" parce que les noms du fichier source ("Anthony PREAUX", "Kamel HAJJI", "KAROLE GARCIA") ne correspondent pas aux noms de l'app (noms de famille seuls, parfois suffixés : "PREAUX A", "REY J", "MHAYA M", "EL BADRI"…).

## Correctif : rapprochement par nom de famille + initiale

### Étape 1 — Parser un nom de chauffeur de l'app
Pour chaque entrée de la liste, extraire `{ lastName, initial? }` :
- Normaliser (upper, sans accents).
- Si un token final est constitué d'**une seule lettre** → c'est l'initiale du prénom, le reste est le nom.
  - "PREAUX A" → last=`PREAUX`, init=`A`
  - "REY J"    → last=`REY`,    init=`J`
  - "MHAYA M"  → last=`MHAYA`,  init=`M`
- Sinon, le tout est le nom (gère les composés "EL BADRI", "LE BIGOT", "ABBADI"…).
  - "EL BADRI" → last=`EL BADRI`
  - "ABBADI"   → last=`ABBADI`

### Étape 2 — Parser le "Conducteur" du fichier
Format observé : "Anthony PREAUX", "Kamel HAJJI", "KAROLE GARCIA", "JEAN LUC FILIPE", "FATIMA FATIHI".
- Normaliser (upper, sans accents, espaces simples, trim).
- Si la chaîne contient plusieurs tokens, isoler **le dernier token** comme `lastName` et le **premier token** comme prénom (init = première lettre).
- Exception composés : si l'avant-dernier token est ∈ {"EL", "LE", "DE", "DU", "DA", "DI"}, alors `lastName` = avant-dernier + dernier ("EL BADRI", "LE BIGOT").
- En extraire `{ lastName, firstInitial }`.

### Étape 3 — Matcher
Construire une `Map<lastName, AppDriver[]>` à partir de la liste de l'app.
Pour chaque conducteur du fichier :
1. Chercher par `lastName`.
2. Si **un seul** candidat → match.
3. Si **plusieurs** candidats → comparer `firstInitial` du fichier avec `init` de l'app pour disambiguïser (ex. PREAUX A ↔ Anthony PREAUX).
4. Sinon → ajouter aux non-rapprochés.

### Étape 4 — Toast détaillé
Lister explicitement les non-rapprochés (jusqu'à ~10) pour aider à corriger les écarts.

## Fichiers modifiés

- `src/lib/import.ts` — exposer `parseFileDriverName(raw): { last, initial }` et exporter (déjà présent) `normalizeDriverName`.
- `src/pages/Index.tsx` — dans `handleExtractionImport`, remplacer la `Map<norm, canonical>` actuelle par un index `Map<lastName, { canonical, initial }[]>` et appliquer la logique ci-dessus.

Aucun changement de schéma, aucun impact sur les autres flux d'import/export.
