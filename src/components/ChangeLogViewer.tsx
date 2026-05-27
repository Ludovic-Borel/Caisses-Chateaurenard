import { useEffect, useState, useCallback } from "react";
import { loadChangeLogs, type ChangeLogEntry } from "@/lib/storage";
import { MONTH_NAMES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loader2, X, History } from "lucide-react";

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

export default function ChangeLogViewer({ year, month, onClose }: Props) {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const fmtEmpty = (v: string | undefined | null) => v || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card text-card-foreground rounded-lg shadow-xl border border-border max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">
              Historique — {MONTH_NAMES[month]} {year}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
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
          {!loading && logs.length > 0 && (
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
                  {logs.map((log, idx) => (
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
                {logs.length} modification{logs.length > 1 ? "s" : ""} — affichage des 500 plus récentes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}