import { useState, useCallback, useEffect } from "react";
import { MonthData, SavedMonth, MONTH_NAMES, DriverMonthData, getDaysInMonth } from "@/lib/types";
import { loadCurrentMonth, saveCurrentMonth, archiveMonth, loadArchives, deleteArchive, updateArchive, loadDrivers, saveDrivers } from "@/lib/storage";
import RevenueGrid from "@/components/RevenueGrid";
import RecapGrid from "@/components/RecapGrid";
import DriverList from "@/components/DriverList";
import MonthSelector from "@/components/MonthSelector";
import ArchiveList from "@/components/ArchiveList";
import StatsPanel from "@/components/StatsPanel";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, Archive, BarChart3, TableProperties } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function createEmptyMonth(year: number, month: number): MonthData {
  return { year, month, drivers: {}, days: {} };
}

export default function Index() {
  const now = new Date();
  const [data, setData] = useState<MonthData>(() => {
    const saved = loadCurrentMonth();
    return saved || createEmptyMonth(now.getFullYear(), now.getMonth());
  });
  const [drivers, setDrivers] = useState<string[]>(() => loadDrivers());
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [archives, setArchives] = useState<SavedMonth[]>(() => loadArchives());
  const [viewingArchive, setViewingArchive] = useState<SavedMonth | null>(null);
  const [editingArchive, setEditingArchive] = useState<SavedMonth | null>(null);
  const [editingArchiveData, setEditingArchiveData] = useState<MonthData | null>(null);
  const [editingArchiveDriver, setEditingArchiveDriver] = useState<string | null>(null);

  useEffect(() => { saveCurrentMonth(data); }, [data]);
  useEffect(() => { saveDrivers(drivers); }, [drivers]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setData(createEmptyMonth(year, month));
  }, []);

  const handleDriverDataChange = useCallback((driver: string, driverData: DriverMonthData) => {
    setData((prev) => ({
      ...prev,
      drivers: { ...prev.drivers, [driver]: driverData },
    }));
  }, []);

  const handleAddDriver = useCallback((name: string) => {
    setDrivers((prev) => [...prev, name].sort());
    toast.success(`Chauffeur ${name} ajouté`);
  }, []);

  const handleRemoveDriver = useCallback((name: string) => {
    setDrivers((prev) => prev.filter((d) => d !== name));
    setData((prev) => {
      const { [name]: _, ...rest } = prev.drivers;
      return { ...prev, drivers: rest };
    });
    if (selectedDriver === name) setSelectedDriver(null);
    toast.success(`Chauffeur ${name} supprimé`);
  }, [selectedDriver]);

  const handleRenameDriver = useCallback((oldName: string, newName: string) => {
    setDrivers((prev) => prev.map((d) => (d === oldName ? newName : d)).sort());
    setData((prev) => {
      const { [oldName]: driverData, ...rest } = prev.drivers;
      return { ...prev, drivers: driverData ? { ...rest, [newName]: driverData } : rest };
    });
    if (selectedDriver === oldName) setSelectedDriver(newName);
    toast.success(`Chauffeur renommé : ${oldName} → ${newName}`);
  }, [selectedDriver]);

  const handleSaveAndArchive = useCallback(() => {
    archiveMonth(data);
    setArchives(loadArchives());
    toast.success(`Recettes Lignes ${MONTH_NAMES[data.month]} ${data.year} archivé avec succès !`);
  }, [data]);

  const handleReset = useCallback(() => {
    const next = data.month === 11
      ? createEmptyMonth(data.year + 1, 0)
      : createEmptyMonth(data.year, data.month + 1);
    setData(next);
    setSelectedDriver(null);
    toast.info(`Nouveau mois : ${MONTH_NAMES[next.month]} ${next.year}`);
  }, [data]);

  const handleDeleteArchive = useCallback((id: string) => {
    deleteArchive(id);
    setArchives(loadArchives());
    toast.success("Archive supprimée");
  }, []);

  const daysInMonth = getDaysInMonth(data.year, data.month);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-6 py-4 shadow-md">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">📊 Recettes Lignes</h1>
            <p className="text-primary-foreground/70 text-sm">Suivi mensuel des recettes par chauffeur et par ligne</p>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center flex-wrap gap-3">
        <MonthSelector year={data.year} month={data.month} onChange={handleMonthChange} />
        <Button
          variant={selectedDriver === null ? "default" : "outline"}
          onClick={() => setSelectedDriver(null)}
        >
          <TableProperties className="h-4 w-4 mr-2" /> Récap global
        </Button>
        <Button
          variant={selectedDriver === "__stats__" ? "default" : "outline"}
          onClick={() => setSelectedDriver("__stats__")}
        >
          <BarChart3 className="h-4 w-4 mr-2" /> Statistiques
        </Button>
        <Button onClick={handleSaveAndArchive} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Save className="h-4 w-4 mr-2" /> Sauvegarder & Archiver
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" /> Mois suivant (RAZ)
        </Button>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 pb-8">
        <div className="flex gap-6">
          {/* Left: Driver list */}
          <div className="w-64 flex-shrink-0">
            <DriverList
              drivers={drivers}
              selectedDriver={selectedDriver}
              onSelect={setSelectedDriver}
              onAddDriver={handleAddDriver}
              onRemoveDriver={handleRemoveDriver}
              onRenameDriver={handleRenameDriver}
            />
          </div>

          {/* Right: Grid or Stats */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-lg border border-border shadow-sm p-4">
              {selectedDriver === "__stats__" ? (
                <StatsPanel currentData={data} archives={archives} drivers={drivers} />
              ) : selectedDriver === null ? (
                <RecapGrid data={data} drivers={drivers} />
              ) : (
                <RevenueGrid
                  title={`Recettes — ${selectedDriver} — ${MONTH_NAMES[data.month]} ${data.year}`}
                  data={data.drivers[selectedDriver] || { days: {} }}
                  daysInMonth={daysInMonth}
                  onChange={(driverData) => handleDriverDataChange(selectedDriver, driverData)}
                />
              )}
            </div>
          </div>
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

      <Dialog open={!!viewingArchive} onOpenChange={() => setViewingArchive(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingArchive && `Recettes Lignes ${MONTH_NAMES[viewingArchive.month]} ${viewingArchive.year}`}
            </DialogTitle>
          </DialogHeader>
          {viewingArchive && (
            <RecapGrid data={viewingArchive.data} drivers={drivers} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
