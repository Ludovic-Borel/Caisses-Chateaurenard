import { useState, useCallback, useEffect, useRef } from "react";
import { MonthData, MONTH_NAMES, DriverMonthData, getDaysInMonth } from "@/lib/types";
import { loadMonth, saveMonth, loadDrivers, saveDrivers, renameDriverRemote, migrateLocalToRemote, loadAllMonths } from "@/lib/storage";
import { saveWithFilePicker } from "@/lib/export";
import { importWorkbookFile } from "@/lib/import";
import { supabase } from "@/integrations/supabase/client";
import RevenueGrid from "@/components/RevenueGrid";
import RecapGrid from "@/components/RecapGrid";
import DriverList from "@/components/DriverList";
import MonthSelector from "@/components/MonthSelector";
import StatsPanel from "@/components/StatsPanel";
import Dashboard from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { Save, TableProperties, LayoutDashboard, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

function createEmptyMonth(year: number, month: number): MonthData {
  return { year, month, drivers: {}, days: {} };
}

export default function Index() {
  const now = new Date();
  const [data, setData] = useState<MonthData>(() => createEmptyMonth(now.getFullYear(), now.getMonth()));
  const [drivers, setDrivers] = useState<string[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>("__dashboard__");
  const [loading, setLoading] = useState(true);
  const skipNextSave = useRef(true);
  const skipNextDriversSave = useRef(true);
  const dataRef = useRef(data);
  const driversRef = useRef(drivers);

  // Initial load + migration
  useEffect(() => {
    (async () => {
      await migrateLocalToRemote();
      const [m, d] = await Promise.all([
        loadMonth(now.getFullYear(), now.getMonth()),
        loadDrivers(),
      ]);
      skipNextSave.current = true;
      skipNextDriversSave.current = true;
      setData(m || createEmptyMonth(now.getFullYear(), now.getMonth()));
      setDrivers(d);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save of month data
  useEffect(() => {
    dataRef.current = data;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const t = setTimeout(() => { saveMonth(data); }, 500);
    return () => clearTimeout(t);
  }, [data]);

  // Debounced save of drivers
  useEffect(() => {
    driversRef.current = drivers;
    if (skipNextDriversSave.current) { skipNextDriversSave.current = false; return; }
    const t = setTimeout(() => { saveDrivers(drivers); }, 500);
    return () => clearTimeout(t);
  }, [drivers]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("recettes-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "month_data" }, (payload) => {
        const row = (payload.new || payload.old) as { year: number; month: number; data: MonthData } | null;
        if (!row) return;
        if (row.year === dataRef.current.year && row.month === dataRef.current.month && payload.new) {
          const incoming = (payload.new as { data: MonthData }).data;
          if (JSON.stringify(incoming) !== JSON.stringify(dataRef.current)) {
            skipNextSave.current = true;
            setData({ ...incoming, year: row.year, month: row.month });
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, async () => {
        const list = await loadDrivers();
        if (JSON.stringify(list) !== JSON.stringify(driversRef.current)) {
          skipNextDriversSave.current = true;
          setDrivers(list);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleMonthChange = useCallback(async (year: number, month: number) => {
    setLoading(true);
    const m = await loadMonth(year, month);
    skipNextSave.current = true;
    setData(m || createEmptyMonth(year, month));
    setLoading(false);
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

  const handleRemoveDriver = useCallback(async (name: string) => {
    setDrivers((prev) => prev.filter((d) => d !== name));
    setData((prev) => {
      const { [name]: _, ...rest } = prev.drivers;
      return { ...prev, drivers: rest };
    });
    if (selectedDriver === name) setSelectedDriver("__dashboard__");

    // Strip from future months only (past months keep historical data)
    try {
      const all = await loadAllMonths();
      const cy = dataRef.current.year;
      const cm = dataRef.current.month;
      const future = all.filter((m) => m.year > cy || (m.year === cy && m.month > cm));
      await Promise.all(
        future
          .filter((m) => m.drivers && m.drivers[name])
          .map((m) => {
            const { [name]: _, ...rest } = m.drivers;
            return saveMonth({ ...m, drivers: rest });
          })
      );
    } catch (e) {
      console.warn("Failed to strip driver from future months", e);
    }

    toast.success(`Chauffeur ${name} supprimé (historique conservé)`);
  }, [selectedDriver]);

  const handleRenameDriver = useCallback((oldName: string, newName: string) => {
    setDrivers((prev) => prev.map((d) => (d === oldName ? newName : d)).sort());
    setData((prev) => {
      const { [oldName]: driverData, ...rest } = prev.drivers;
      return { ...prev, drivers: driverData ? { ...rest, [newName]: driverData } : rest };
    });
    if (selectedDriver === oldName) setSelectedDriver(newName);
    renameDriverRemote(oldName, newName);
    toast.success(`Chauffeur renommé : ${oldName} → ${newName}`);
  }, [selectedDriver]);

  const handleExportExcel = useCallback(async () => {
    const saved = await saveWithFilePicker(data, drivers);
    if (saved) {
      toast.success(`Recettes Lignes ${MONTH_NAMES[data.month]} ${data.year} exporté !`);
    }
  }, [data, drivers]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    let successCount = 0;
    let lastImported: { year: number; month: number } | null = null;
    const allNewDrivers = new Set<string>();

    for (const file of Array.from(files)) {
      try {
        const result = await importWorkbookFile(file);
        const existing = await loadMonth(result.data.year, result.data.month);
        const merged: MonthData = existing
          ? { ...existing, drivers: { ...existing.drivers, ...result.data.drivers } }
          : result.data;
        await saveMonth(merged);
        result.driversFound.forEach((d) => allNewDrivers.add(d));
        lastImported = { year: result.data.year, month: result.data.month };
        successCount++;
        toast.success(`${file.name} : ${result.driversFound.length} chauffeur(s)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`${file.name} : ${msg}`);
      }
    }

    if (allNewDrivers.size > 0) {
      const currentSet = new Set(driversRef.current);
      const toAdd = [...allNewDrivers].filter((d) => !currentSet.has(d));
      if (toAdd.length > 0) {
        const updated = [...driversRef.current, ...toAdd].sort();
        setDrivers(updated);
        await saveDrivers(updated);
      }
    }

    if (lastImported && lastImported.year === dataRef.current.year && lastImported.month === dataRef.current.month) {
      const refreshed = await loadMonth(lastImported.year, lastImported.month);
      if (refreshed) {
        skipNextSave.current = true;
        setData(refreshed);
      }
    }

    setLoading(false);
    if (successCount > 0) toast.success(`${successCount} fichier(s) importé(s)`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const daysInMonth = getDaysInMonth(data.year, data.month);
  const isCurrentMonth = data.year === now.getFullYear() && data.month === now.getMonth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-6 py-3 shadow-lg">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Pastouret Rubans-Bleus" className="h-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-center">Recettes Lignes</h1>
              <p className="text-primary-foreground/70 text-sm">Suivi Mensuel des Recettes Mensuelles en Temps Réel</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center flex-wrap gap-3">
          <MonthSelector year={data.year} month={data.month} onChange={handleMonthChange} />
          <Button
            variant={selectedDriver === "__dashboard__" ? "default" : "outline"}
            onClick={() => setSelectedDriver("__dashboard__")}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" /> Tableau de bord
          </Button>
          <Button
            variant={selectedDriver === null ? "default" : "outline"}
            onClick={() => setSelectedDriver(null)}
          >
            <TableProperties className="h-4 w-4 mr-2" /> Récap global
          </Button>
          {loading && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" /> Importer Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm"
            multiple
            className="hidden"
            onChange={(e) => handleImportFiles(e.target.files)}
          />
          {!isCurrentMonth && (
            <Button onClick={handleExportExcel} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Save className="h-4 w-4 mr-2" /> Exporter Excel
            </Button>
          )}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 pb-8">
        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <DriverList
              drivers={Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort()}
              activeDrivers={drivers}
              selectedDriver={selectedDriver}
              onSelect={setSelectedDriver}
              onAddDriver={handleAddDriver}
              onRemoveDriver={handleRemoveDriver}
              onRenameDriver={handleRenameDriver}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-lg border border-border shadow-sm p-4">
              {selectedDriver === "__stats__" ? (
                <StatsPanel currentData={data} drivers={drivers} />
              ) : selectedDriver === "__dashboard__" ? (
                <Dashboard currentData={data} drivers={drivers} />
              ) : selectedDriver === null ? (
                <RecapGrid data={data} drivers={drivers} />
              ) : (
                <div className="space-y-6">
                  <RevenueGrid
                    title={`Recettes — ${selectedDriver} — ${MONTH_NAMES[data.month]} ${data.year}`}
                    data={data.drivers[selectedDriver] || { days: {} }}
                    daysInMonth={daysInMonth}
                    onChange={(driverData) => handleDriverDataChange(selectedDriver, driverData)}
                  />
                  <RecapGrid data={data} drivers={drivers} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
