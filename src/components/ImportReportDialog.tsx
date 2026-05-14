import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SkippedRow, SkipReason } from "@/lib/import";

interface UnmatchedDriver {
  name: string;
  days: number;
  total: number;
}

interface Report {
  matched: number;
  rowCount: number;
  totalRows: number;
  skipped: SkippedRow[];
  unmatched: UnmatchedDriver[];
}

interface Props {
  report: Report | null;
  onClose: () => void;
}

const REASON_LABELS: Record<SkipReason, string> = {
  annulee: "Vente annulée",
  ligne_inconnue: "Ligne non reconnue (code hors 704/705/707/708/915/74xx)",
  prix_invalide: "Prix manquant ou invalide",
  conducteur_vide: "Conducteur vide",
  date_invalide: "Date manquante ou illisible",
  hors_mois: "Date hors du mois importé",
};

const fmtEur = (n: number) =>
  n.toFixed(2).replace(".", ",") + " €";

function downloadCsv(report: Report) {
  const rows: string[] = [];
  rows.push("Type;Motif;Feuille;Ligne;Date;Conducteur;Ligne_vente;Prix");
  for (const u of report.unmatched) {
    rows.push(
      `Chauffeur non rapproché;Nom inconnu de l'application;;;;${csv(u.name)};;${u.total.toFixed(2).replace(".", ",")}`
    );
  }
  for (const s of report.skipped) {
    rows.push(
      [
        "Ligne ignorée",
        REASON_LABELS[s.reason],
        s.sheet,
        s.row,
        s.date,
        s.conducteur,
        s.ligne,
        s.prix,
      ]
        .map(csv)
        .join(";")
    );
  }
  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rapport-import-extraction.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function csv(v: unknown) {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ImportReportDialog({ report, onClose }: Props) {
  const open = report !== null;
  const issues = report ? report.skipped.length + report.unmatched.length : 0;

  // Group skipped by reason
  const grouped = new Map<SkipReason, SkippedRow[]>();
  if (report) {
    for (const s of report.skipped) {
      const arr = grouped.get(s.reason) || [];
      arr.push(s);
      grouped.set(s.reason, arr);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Rapport d'import — Extraction</DialogTitle>
          <DialogDescription>
            {report
              ? `${report.rowCount} ligne(s) importée(s) sur ${report.totalRows} — ${report.matched} chauffeur(s) mis à jour — ${issues} ligne(s) non importée(s)`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-6 pr-2">
          {report && report.unmatched.length > 0 && (
            <section>
              <h3 className="font-bold text-destructive mb-2">
                Chauffeurs non rapprochés ({report.unmatched.length})
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                Ces noms du fichier n'ont pas de correspondance dans la liste des chauffeurs de l'application.
                Ajoutez-les ou corrigez le nom existant pour qu'ils soient pris en compte au prochain import.
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-2 py-1 text-left">Conducteur (fichier)</th>
                    <th className="border border-border px-2 py-1 text-right">Jours</th>
                    <th className="border border-border px-2 py-1 text-right">Total ignoré</th>
                  </tr>
                </thead>
                <tbody>
                  {report.unmatched.map((u) => (
                    <tr key={u.name}>
                      <td className="border border-border px-2 py-1 font-medium">{u.name}</td>
                      <td className="border border-border px-2 py-1 text-right">{u.days}</td>
                      <td className="border border-border px-2 py-1 text-right">{fmtEur(u.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {report && Array.from(grouped.entries()).map(([reason, rows]) => (
            <section key={reason}>
              <h3 className="font-bold mb-2">
                {REASON_LABELS[reason]} — {rows.length}
              </h3>
              <div className="max-h-64 overflow-y-auto border border-border rounded">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="border border-border px-2 py-1 text-left">Feuille</th>
                      <th className="border border-border px-2 py-1 text-right">Ligne</th>
                      <th className="border border-border px-2 py-1 text-left">Date</th>
                      <th className="border border-border px-2 py-1 text-left">Conducteur</th>
                      <th className="border border-border px-2 py-1 text-left">Ligne vente</th>
                      <th className="border border-border px-2 py-1 text-right">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => (
                      <tr key={i}>
                        <td className="border border-border px-2 py-1">{r.sheet}</td>
                        <td className="border border-border px-2 py-1 text-right">{r.row}</td>
                        <td className="border border-border px-2 py-1">{r.date}</td>
                        <td className="border border-border px-2 py-1">{r.conducteur}</td>
                        <td className="border border-border px-2 py-1">{r.ligne}</td>
                        <td className="border border-border px-2 py-1 text-right">{r.prix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <p className="text-xs text-muted-foreground p-2">
                    {rows.length - 200} ligne(s) supplémentaire(s) — exportez le CSV pour la liste complète.
                  </p>
                )}
              </div>
            </section>
          ))}

          {report && issues === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune ligne ignorée. Toutes les ventes du fichier ont été importées.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          {report && issues > 0 && (
            <Button variant="outline" onClick={() => downloadCsv(report)}>
              Exporter en CSV
            </Button>
          )}
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
