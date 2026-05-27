import { useEffect, useState, useCallback, useMemo } from "react";
import { loadChangeLogs, type ChangeLogEntry } from "@/lib/storage";
import { MONTH_NAMES, CATEGORIES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loader2, X, History, Search, User, Calendar, Filter } from "lucide-react";

interface Props {
  year: number;
  month: number;
  onClose: () => void;
}

const actionLabels: Record<string, string> = {
  update: "Modification cellule",
  add_driver: "Ajout conducteur",
  remove_driver: "Suppression conducteur",
  rename_driver: "Renommage conducteur",
  import: "Import Excel",
  extraction: "Import Extraction",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function extractCategory(field: string | undefined | null): string {
  if (!field) return "";
  // field is like "707_especes" or "707_cb"
  const parts = field.split("_");
  if (parts.length >= 2) return parts[0];
  return field;
}

export default function ChangeLogViewer({ year, month, onClose }: Props) {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [filterDriver, setFilterDriver] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterAction, setFilterAction] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await loadChangeLogs(year, month);
        setLogs(data);
      } catch (e: any) {
        setError(e?.message || "Erreur lors du chargement de l'historique");
      } finally {
        setLoading(false);
      }
    })();
  }, [year, month]);

  const getActionLabel = (action: string): string => actionLabels[action] || action;

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filtre conducteur
      if (filterDriver && (!log.driver || !log.driver.toLowerCase().includes(filterDriver.toLowerCase()))) {
        return false;
      }
      // Filtre catégorie/ligne
      if (filterCategory) {
        const cat = extractCategory(log.field);
        if (!cat || !cat.toLowerCase().includes(filterCategory.toLowerCase())) {
          return false;
        }
      }
      // Filtre date
      if (filterDate && log.created_at) {
        const logDate = formatDateShort(log.created_at);
        if (!logDate.includes(filterDate)) {
          return false;
        }
      }
      // Filtre action
      if (filterAction && log.action !== filterAction) {
        return false;
      }
      return true;
    });
  }, [logs, filterDriver, filterCategory, filterDate, filterAction]);

  const uniqueDrivers = useMemo(() => {
    const drivers = new Set<string>();
    logs.forEach((l) => { if (l.driver) drivers.add(l.driver); });
    return Array.from(drivers).sort();
  }, [logs]);

  const fmtEmpty = (v: string | undefined | null) => v || "—";

  const clearFilters = useCallback(() => {
    setFilterDriver("");
    setFilterCategory("");
    setFilterDate("");
    setFilterAction("");
  }, []);

  const hasFilters = filterDriver || filterCategory || filterDate || filterAction;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card text-card-foreground rounded-lg shadow-xl border border-border max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">
              Historique — {MONTH_NAMES[month]} {year}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={clearFilters}>
                <Filter className="h-3 w-3 mr-1" /> Réinitialiser
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Barre de filtres */}
        <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Conducteur..."
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              list="driver-suggestions"
              className="w-32 px-2 py-1 rounded border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
            />
            <datalist id="driver-suggestions">
              {uniqueDrivers.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Ligne (ex: 707)..."
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              list="cat-suggestions"
              className="w-28 px-2 py-1 rounded border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
            />
            <datalist id="cat-suggestions">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Date (JJ/MM)..."
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-28 px-2 py-1 rounded border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-36 px-2 py-1 rounded border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
            >
              <option value="">Toutes actions</option>
              <option value="update">Modification cellule</option>
              <option value="add_driver">Ajout conducteur</option>
              <option value="remove_driver">Suppression conducteur</option>
              <option value="rename_driver">Renommage conducteur</option>
              <option value="import">Import Excel</option>
              <option value="extraction">Import Extraction</option>
            </select>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Chargement de l'historique...
            </div>
          )}
          {error && (
            <div className="text-center py-8 text-destructive">
              <p className="font-semibold">Erreur</p>
              <p className="text-sm mt-1">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                L'historique n'est disponible que lorsque Supabase est connecté.
              </p>
            </div>
          )}
          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Aucune modification enregistrée pour ce mois.</p>
              <p className="text-xs mt-1">Les modifications sont tracées lorsque Supabase est connecté.</p>
            </div>
          )}
          {!loading && !error && logs.length > 0 && filteredLogs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Aucun résultat pour ces filtres.</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={clearFilters}>
                <Filter className="h-3 w-3 mr-1" /> Réinitialiser les filtres
              </Button>
            </div>
          )}
          {!loading && filteredLogs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Date/Heure</th>
                    <th className="px-2 py-1.5 text-left font-medium">Utilisateur</th>
                    <th className="px-2 py-1.5 text-left font-medium">Action</th>
                    <th className="px-2 py-1.5 text-left font-medium">Conducteur</th>
                    <th className="px-2 py-1.5 text-left font-medium">Champ</th>
                    <th className="px-2 py-1.5 text-right font-medium">Ancien</th>
                    <th className="px-2 py-1.5 text-right font-medium">Nouveau</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {log.created_at ? formatDate(log.created_at) : "—"}
                      </td>
                      <td className="px-2 py-1.5 font-medium">{log.username}</td>
                      <td className="px-2 py-1.5">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{fmtEmpty(log.driver)}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{fmtEmpty(log.field)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtEmpty(log.old_value)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-medium">{fmtEmpty(log.new_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-3 text-center">
                {filteredLogs.length} / {logs.length} résultat{filteredLogs.length > 1 ? "s" : ""} — affichage des 500 plus récentes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}