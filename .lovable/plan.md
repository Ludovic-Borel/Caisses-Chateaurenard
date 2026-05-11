## Objectif

Ajouter un bouton **Extraction** à gauche du bouton **Importer Excel**. Quand on clique dessus, l'application ouvre directement la grille **Recettes** du premier chauffeur de la liste, avec, en plus des colonnes existantes (`704 Esp.` / `704 CB`, `705 Esp.` / `705 CB`, …), une troisième colonne **`Extract`** pour chaque ligne (704, 705, 707, 708, 915, Scolaires).

Cette nouvelle colonne `Extract` est créée vide pour le moment ; elle sera alimentée plus tard par l'import d'un fichier dédié (étape suivante, hors de ce plan).

## Comportement utilisateur

- Nouveau bouton **Extraction** (icône type "scan / download") placé à gauche de **Importer Excel** dans la barre d'actions.
- Au clic :
  - Le mode "extraction" est activé.
  - Le chauffeur sélectionné devient automatiquement le **premier de la liste triée** (chauffeurs actifs, sinon premier chauffeur historique présent dans le mois).
  - La grille `RevenueGrid` du chauffeur s'affiche avec, pour chaque catégorie, **3 colonnes** au lieu de 2 : `Esp.`, `CB`, `Extract`.
- Tant que le mode extraction est actif, la 3ᵉ colonne `Extract` est visible pour **tous** les chauffeurs sur lesquels on navigue (cohérence d'affichage).
- Le passage au Tableau de bord, Récap global ou Stats désactive automatiquement le mode extraction.
- Les valeurs `Extract` sont **éditables manuellement** (mêmes règles de saisie rapide que les autres cellules) et **persistées** comme le reste des données du mois — pour pouvoir être écrasées plus tard par l'import.
- Les colonnes `Extract` ne sont **pas** prises en compte dans les totaux Espèces / CB / Total existants ni dans le récap global, le tableau de bord ou les stats. Un sous-total `Extract` est affiché en bas de chaque colonne `Extract` uniquement.

## Impacts visuels

- En-tête de catégorie passe de `colSpan={2}` à `colSpan={3}` quand le mode extraction est actif.
- Sous-en-tête : ajout d'une cellule `Extract` à fond neutre (token existant, ex. `bg-muted` ou nouveau token léger), distincte des fonds Espèces / CB.
- Colonne `Total` du jour et `Total` de la colonne : inchangés (Extract exclu).
- Le bouton **Extraction** suit le style des autres boutons `outline` de la barre.

## Détails techniques

### Modèle de données

Étendre `DriverMonthData` dans `src/lib/types.ts` :

```ts
export interface DriverMonthData {
  days: Record<number, DayEntry>;
  notReturned?: Record<string, boolean>;
  extracts?: Record<number, Partial<Record<Category, number>>>; // jour -> catégorie -> montant
}
```

Pas de modification de `PAYMENT_TYPES` (pour ne pas casser Recap / Stats / Dashboard / export Excel).

### Composants

- **`src/pages/Index.tsx`**
  - Nouvel état `extractionMode: boolean`.
  - Nouveau bouton `Extraction` (icône `lucide-react`, ex. `ScanLine` ou `FileSearch`) à gauche du bouton `Importer Excel`.
  - Handler : active `extractionMode`, sélectionne le premier chauffeur de `Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort()[0]`. Toast d'info si aucun chauffeur.
  - Désactiver `extractionMode` quand on choisit Tableau de bord, Récap global ou Stats.
  - Passer `extractionMode` en prop à `RevenueGrid` (et seulement à lui).

- **`src/components/RevenueGrid.tsx`**
  - Nouvelle prop optionnelle `extractionMode?: boolean`.
  - Quand `true` :
    - Headers de catégorie en `colSpan={3}`.
    - Ajouter une 3ᵉ sous-cellule `Extract` après `CB`.
    - Pour chaque jour, ajouter une `<td>` éditable liée à `data.extracts?.[day]?.[cat]`.
    - Helpers : `getExtract(day, cat)`, `setExtract(day, cat, value)` — `setExtract` met à jour `data.extracts` via `onChange`.
    - Sous-total par colonne `Extract` dans le `tfoot` ; `colSpan` du Total existant ajusté en conséquence.
    - Les colonnes `Extract` n'entrent **pas** dans `getDayTotal`, `getColumnTotal`, `getGrandTotal`, `getTotalEspeces`, `getTotalCB`.

### Persistance

Aucune migration nécessaire : le champ `extracts` est optionnel et JSON, déjà compatible avec la table `month_data` (jsonb) et le `localStorage` dynamique par mois.

### Hors périmètre (étape suivante)

- L'import du fichier qui alimentera la colonne `Extract` n'est pas implémenté ici. Un emplacement clair sera prévu dans `src/lib/import.ts` lors de la prochaine itération.
