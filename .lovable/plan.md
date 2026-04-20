

## Plan

### 1. Header toolbar layout
In `src/pages/Index.tsx`, restructure the toolbar row so navigation buttons stay on the left and the import/export buttons move to the right:
- Wrap the toolbar in `flex justify-between` with two groups.
- **Left group**: `MonthSelector`, `Tableau de bord`, `Récap global`, loading indicator.
- **Right group**: `Importer Excel`, `Exporter Excel` (still conditional on past month).

### 2. Default to Dashboard + persistence across navigation
- Initial `selectedDriver` state becomes `"__dashboard__"` instead of `null` so the Dashboard shows immediately on load.
- In `handleMonthChange`, **remove** the `setSelectedDriver(null)` line — the current view (Dashboard, Récap, or driver) stays when changing months.
- The user explicitly switches to Récap global by clicking the button, or to a driver by clicking it in the list (existing behavior already does this).

### 3. Driver removal — keep history, only remove for current + future months
Rewrite `handleRemoveDriver`:
- Still remove the driver from the global `drivers` list (so it disappears from the sidebar going forward).
- For the **current month**, remove their entry from `data.drivers` (debounced save will persist).
- For **future months** (year/month strictly greater than current displayed month), call `loadAllMonths()`, filter to months `> (data.year, data.month)`, strip the driver from each, and `saveMonth` them.
- **Past months** are untouched: their `data.drivers[name]` stays intact, preserving history.
- Note: since the global driver list is removed, `RecapGrid` for past months won't list the deleted driver in its rows. To keep historical recaps showing them, `RecapGrid` already iterates over the `drivers` prop. We'll accept this limitation for now (driver disappears from sidebar/recap going forward but raw data is preserved in DB and re-adding the same name restores visibility).

### Technical notes
- `loadAllMonths` already exists in `src/lib/storage.ts`.
- Removing a driver fires a deletion of the driver row in Supabase (`saveDrivers` diff). Past `month_data.data.drivers[name]` JSONB entries stay intact regardless.
- No schema changes needed.

