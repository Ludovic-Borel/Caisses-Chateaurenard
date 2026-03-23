import { useState, useCallback, useEffect } from "react";
import { MonthData, SavedMonth, MONTH_NAMES } from "@/lib/types";
import { loadCurrentMonth, saveCurrentMonth, archiveMonth, loadArchives, deleteArchive } from "@/lib/storage";
import RevenueGrid from "@/components/RevenueGrid";
import MonthSelector from "@/components/MonthSelector";
import ArchiveList from "@/components/ArchiveList";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, Archive, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function createEmptyMonth(year: number, month: number): MonthData {
  return { year, month, days: {} };
}

export default function Index() {
  const now = new Date();
  const [data, setData] = useState<MonthData>(() => {
    const saved = loadCurrentMonth();
    return saved || createEmptyMonth(now.getFullYear(), now.getMonth());
  });
  const [archives, setArchives] = useState<SavedMonth[]>(() => loadArchives());
  const [viewingArchive, setViewingArchive] = useState<SavedMonth | null>(null);

  useEffect(() => {
    saveCurrentMonth(data);
  }, [data]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setData(createEmptyMonth(year, month));
  }, []);

  const handleSaveAndArchive = useCallback(() => {
    archiveMonth(data);
    setArchives(loadArchives());
    toast.success(`${MONTH_NAMES[data.month]} ${data.year} archivé avec succès !`);
  }, [data]);

  const handleReset = useCallback(() => {
    const next = data.month === 11
      ? createEmptyMonth(data.year + 1, 0)
      : createEmptyMonth(data.year, data.month + 1);
    setData(next);
    toast.info(`Nouveau mois : ${MONTH_NAMES[next.month]} ${next.year}`);
  }, [data]);

  const handleDeleteArchive = useCallback((id: string) => {
    deleteArchive(id);
    setArchives(loadArchives());
    toast.success("Archive supprimée");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-4 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">📊 Recettes Lignes</h1>
            <p className="text-primary-foreground/70 text-sm">Suivi mensuel des recettes par ligne</p>
          </div>
          <MonthSelector year={data.year} month={data.month} onChange={handleMonthChange} />
        </div>
      </header>

      {/* Actions */}
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-3">
        <Button onClick={handleSaveAndArchive} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Save className="h-4 w-4 mr-2" /> Sauvegarder & Archiver ce mois
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" /> Mois suivant (remise à zéro)
        </Button>
      </div>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-card rounded-lg border border-border shadow-sm p-4">
          <RevenueGrid data={data} onChange={setData} />
        </div>

        {/* Archives */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" /> Mois archivés
          </h3>
          <ArchiveList
            archives={archives}
            onView={setViewingArchive}
            onDelete={handleDeleteArchive}
          />
        </div>
      </main>

      {/* Archive Viewer Dialog */}
      <Dialog open={!!viewingArchive} onOpenChange={() => setViewingArchive(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Archive — {viewingArchive && `${MONTH_NAMES[viewingArchive.month]} ${viewingArchive.year}`}
            </DialogTitle>
          </DialogHeader>
          {viewingArchive && (
            <RevenueGrid data={viewingArchive.data} onChange={() => {}} readOnly />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
