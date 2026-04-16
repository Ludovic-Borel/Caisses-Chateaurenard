import { useState, useCallback, useEffect } from "react";
import { MonthData, MONTH_NAMES, DriverMonthData, getDaysInMonth } from "@/lib/types";
import { loadMonth, saveMonth, loadDrivers, saveDrivers } from "@/lib/storage";
import { saveWithFilePicker } from "@/lib/export";
import RevenueGrid from "@/components/RevenueGrid";
import RecapGrid from "@/components/RecapGrid";
import DriverList from "@/components/DriverList";
import MonthSelector from "@/components/MonthSelector";
import StatsPanel from "@/components/StatsPanel";
import Dashboard from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { Save, BarChart3, TableProperties, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

function createEmptyMonth(year: number, month: number): MonthData {
  return { year, month, drivers: {}, days: {} };
}

export default function Index() {
  const now = new Date();
  const [data, setData] = useState<MonthData>(() => {
    return loadMonth(now.getFullYear(), now.getMonth()) || createEmptyMonth(now.getFullYear(), now.getMonth());
  });
  const [drivers, setDrivers] = useState<string[]>(() => loadDrivers());
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  useEffect(() => { saveMonth(data); }, [data]);
  useEffect(() => { saveDrivers(drivers); }, [drivers]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setData(loadMonth(year, month) || createEmptyMonth(year, month));
    setSelectedDriver(null);
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

  const handleExportExcel = useCallback(async () => {
    const saved = await saveWithFilePicker(data, drivers);
    if (saved) {
      toast.success(`Recettes Lignes ${MONTH_NAMES[data.month]} ${data.year} exporté !`);
    }
  }, [data, drivers]);

  const daysInMonth = getDaysInMonth(data.year, data.month);
  const isCurrentMonth = data.year === now.getFullYear() && data.month === now.getMonth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-6 py-3 shadow-lg">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Pastouret Rubans-Bleus" className="h-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Recettes Lignes</h1>
              <p className="text-primary-foreground/70 text-sm">Suivi mensuel des recettes par chauffeur et par ligne</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center flex-wrap gap-3">
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
        <Button
          variant={selectedDriver === "__stats__" ? "default" : "outline"}
          onClick={() => setSelectedDriver("__stats__")}
        >
          <BarChart3 className="h-4 w-4 mr-2" /> Statistiques
        </Button>
        {!isCurrentMonth && (
          <Button onClick={handleExportExcel} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Save className="h-4 w-4 mr-2" /> Exporter Excel
          </Button>
        )}
      </div>

      <main className="max-w-[1600px] mx-auto px-6 pb-8">
        <div className="flex gap-6">
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

          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-lg border border-border shadow-sm p-4">
              {selectedDriver === "__stats__" ? (
                <StatsPanel currentData={data} drivers={drivers} />
              ) : selectedDriver === "__dashboard__" ? (
                <Dashboard currentData={data} drivers={drivers} />
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
      </main>
    </div>
  );
}
