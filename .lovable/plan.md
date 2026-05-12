
## Objectif

Importer le fichier "ventes-realises-orientees-reseau_YYYY-MM-DD…xlsx" et alimenter automatiquement les colonnes **Ext. Esp.** et **Ext. CB** du tableau Recettes, par jour, par chauffeur et par catégorie.

## Mapping détecté dans le fichier source

Colonnes utilisées :
- `Date` → jour du mois
- `Conducteur` → nom du chauffeur
- `Ligne` → ex. "704 _ Cavaillon - Arles", "915 _ …", "7401 _ …"
- `Prix TTC` → montant
- `Annulée` → on exclut les lignes "Oui"
- `Moyens de paiement` → "Espèce" → Ext. Esp., sinon (CB / Carte bancaire / etc.) → Ext. CB

Mapping ligne → catégorie :
- Préfixe `704` → catégorie **704**
- `705` → **705**
- `707` → **707**
- `708` → **708**
- `915` → **915**
- `7400`, `7401`, `7402`, `7403`, `7404` → **Scolaires**
- Toute autre ligne (916, 917, …) est ignorée

Le code ligne est extrait par regex `^(\d{3,4})` au début du champ `Ligne`. On teste d'abord les 4 chiffres (Scolaires 7400-7404) puis les 3 chiffres.

## UI

1. **Nouveau bouton "Importer Extraction"** placé à côté du bouton **Extraction** dans la barre d'actions de `src/pages/Index.tsx`, visible uniquement quand `extractionMode` est actif.
2. Ouvre un input fichier (`.xlsx`).
3. Après import :
   - toast récapitulatif (nb lignes traitées, nb chauffeurs trouvés, chauffeurs non rapprochés listés)
   - les valeurs apparaissent immédiatement dans les colonnes Ext. Esp. / Ext. CB de tous les chauffeurs.

## Logique d'import (`src/lib/import.ts`)

Nouvelle fonction `importExtractionFile(file: File): Promise<ExtractionImportResult>` :

1. Lire la 1ère feuille avec ExcelJS, détecter les colonnes via la ligne d'en-têtes (par nom).
2. Détecter le mois/année à partir du nom de fichier (`YYYY-MM-DD`) ou à défaut de la 1ère date.
3. Pour chaque ligne valide (Annulée ≠ "Oui", Prix TTC > 0, ligne mappée) :
   - normaliser le nom conducteur (trim, upper, suppression accents/doubles espaces)
   - clé : `(driverNorm, day, category, paymentType)`
   - cumuler Prix TTC
4. Retourner `{ year, month, totals: Map<driverNorm, Record<day, DayEntry>>, unmatchedDrivers: [] }`.

## Application dans `Index.tsx`

`handleExtractionImport(result)` :
- Vérifier que `result.year/month` = mois courant ; sinon, demander confirmation (toast d'avertissement, bascule possible).
- Construire un `nameIndex` : pour chaque chauffeur connu (liste fusionnée du mois), mapper son nom normalisé → nom canonique.
- Pour chaque chauffeur du fichier :
  - si trouvé : remplacer (`extracts[day][cat_paymentType] = montant`) sur le `DriverMonthData` correspondant
  - sinon : ajouter à `unmatched`
- Sauvegarder via `saveMonthData` et mettre à jour `monthData` dans le state.
- Toast : "X chauffeurs mis à jour, Y non rapprochés : …".

## Détails techniques

- `Moyens de paiement` valeurs observées : "Espèce". On mappe :
  - `/esp[èe]ce/i` → `especes`
  - sinon → `cb`
- Les valeurs précédentes des colonnes Extract du mois sont **écrasées** par l'import (remplacement complet, pas cumul) pour permettre des ré-imports propres.
- Aucun changement de schéma : `extracts?: Record<number, DayEntry>` existe déjà sur `DriverMonthData`.
- Aucune modification des totaux ou de l'export Excel (les colonnes Extract restent hors totaux comme convenu).

## Fichiers modifiés

- `src/lib/import.ts` — ajout de `importExtractionFile` + types
- `src/pages/Index.tsx` — bouton "Importer Extraction", input file caché, handler de fusion
