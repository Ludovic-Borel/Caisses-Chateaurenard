import { useState, useCallback, useEffect, useRef } from "react";
import { MonthData, MONTH_NAMES, DriverMonthData, getDaysInMonth } from "@/lib/types";
import { loadMonth, saveMonth, loadDrivers, saveDrivers, renameDriverRemote, migrateLocalToRemote, loadAllMonths, enableRealtime, onMonthChange, onDriversChange, checkSupabaseStatus, type SupabaseStatus, type MigrationResult } from "@/lib/storage";
import { initializeSupabase } from "@/lib/setup";
import { configureSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { importWorkbookFile, importExtractionFile, parseAppDriverName, parseFileDriverName, type SkippedRow, type SkipReason } from "@/lib/import";
import { selectBackupDir, clearBackupDir, getBackupDirName, selectTemplateFile, clearTemplateFile, getTemplateFileName, saveBackup, saveNewBackup, updateExistingBackup, getSaveFileName } from "@/lib/backup";
import RevenueGrid from "@/components/RevenueGrid";
import RecapGrid from "@/components/RecapGrid";
import DriverList from "@/components/DriverList";
import MonthSelector from "@/components/MonthSelector";
import StatsPanel from "@/components/StatsPanel";
import Dashboard from "@/components/Dashboard";
import ImportReportDialog from "@/components/ImportReportDialog";
import BackupSaveDialog from "@/components/BackupSaveDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableProperties, LayoutDashboard, Loader2, Upload, ScanLine, FileDown, Folder, FileText, Settings2, FileArchive, Database } from "lucide-react";
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
  const [extractionMode, setExtractionMode] = useState(false);
  const [importReport, setImportReport] = useState<{
    matched: number;
    rowCount: number;
    totalRows: number;
    skipped: SkippedRow[];
    unmatched: { name: string; days: number; total: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupDirName, setBackupDirName] = useState<string | null>(getBackupDirName());
  const [templateFileName, setTemplateFileName] = useState<string | null>(getTemplateFileName());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const skipNextSave = useRef(true);
  const skipNextDriversSave = useRef(true);
  const dataRef = useRef(data);
  const driversRef = useRef(drivers);

  // Initial load + Supabase init + migration + realtime
  useEffect(() => {
    (async () => {
      // Initialize Supabase (sign in + create tables if needed)
      const supabaseReady = await initializeSupabase();
      if (supabaseReady) {
        console.log("Supabase initialized successfully");
        // Enable real-time subscriptions
        await enableRealtime();
      } else {
        console.log("Supabase not available, using localStorage only");
      }

      // Migrate local data to Supabase
      await migrateLocalToRemote();

      // Check Supabase status
      const status = await checkSupabaseStatus();
      setSupabaseStatus(status);
      console.log("[Supabase] Status:", status);

      // Load initial data
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

  // Real-time listeners for the current month
  useEffect(() => {
    if (loading) return;

    // Listen for changes to the current month data
    const unsubMonth = onMonthChange(data.year, data.month, (updatedData) => {
      console.log(`Real-time update: month ${data.year}-${data.month} changed`);
      // Only update if we're not the one who saved (avoid double-save)
      // We use skipNextSave to prevent re-saving the same data
      skipNextSave.current = true;
      setData(updatedData);
    });

    // Listen for drivers list changes
    const unsubDrivers = onDriversChange((updatedDrivers) => {
      console.log("Real-time update: drivers list changed");
      skipNextDriversSave.current = true;
      setDrivers(updatedDrivers);
    });

    return () => {
      unsubMonth();
      unsubDrivers();
    };
  }, [data.year, data.month, loading]);

  // Cleanup: remove realtime listeners on unmount
  useEffect(() => {
    return () => {
      // Realtime channels are cleaned up automatically on page unload
    };
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

  // ---------- Sync handler ----------
  const handleSyncToSupabase = useCallback(async () => {
    setSyncing(true);
    try {
      const result: MigrationResult = await migrateLocalToRemote();
      
      // Refresh status after sync
      const status = await checkSupabaseStatus();
      setSupabaseStatus(status);
      
      if (result.errors.length > 0) {
        toast.error(
          `Sync terminé avec ${result.errors.length} erreur(s) : ${result.errors.slice(0, 3).join("; ")}` +
            (result.errors.length > 3 ? `... (${result.errors.length - 3} autres)` : ""),
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Synchronisé ! ${result.monthsMigrated}/${result.monthsTotal} mois et ${result.driversCount} conducteurs envoyés à Supabase`
        );
      }
    } catch (e: any) {
      toast.error(`Erreur sync : ${e?.message || String(e)}`);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Allow user to configure Supabase at runtime (stores creds in localStorage)
  const handleConfigureSupabase = useCallback(async () => {
    try {
      const url = window.prompt("Supabase URL (ex: https://xyz.supabase.co)");
      if (!url) return;
      const key = window.prompt("Supabase publishable (anon) key");
      if (!key) return;
      localStorage.setItem("SUPABASE_URL", url);
      localStorage.setItem("SUPABASE_KEY", key);
      configureSupabase(url, key);
      const ready = await initializeSupabase();
      if (ready) {
        await migrateLocalToRemote();
        const status = await checkSupabaseStatus();
        setSupabaseStatus(status);
        toast.success("Supabase configuré et synchronisé");
      } else {
        toast.error("Impossible d'initialiser Supabase");
      }
    } catch (e: any) {
      toast.error(`Erreur configuration Supabase: ${e?.message || String(e)}`);
    }
  }, []);

  // Periodic automatic sync (every 5 minutes) if Supabase configured
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const id = setInterval(async () => {
      try {
        const res = await migrateLocalToRemote();
        if (res.errors.length > 0) {
          console.warn("Auto sync errors:", res.errors);
        }
      } catch (e) {
        console.warn("Auto sync failed:", e);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Sync when returning online
  useEffect(() => {
    const onOnline = async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const res = await migrateLocalToRemote();
        if (res.errors.length === 0) toast.success("Sync automatique terminée");
      } catch (e) {
        console.warn("Online sync failed:", e);
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractionFileRef = useRef<HTMLInputElement>(null);

  const handleExtractionImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setLoading(true);
    try {
      const result = await importExtractionFile(file);
      if (result.year !== dataRef.current.year || result.month !== dataRef.current.month) {
        toast.error(
          `Le fichier concerne ${MONTH_NAMES[result.month]} ${result.year}, mois courant : ${MONTH_NAMES[dataRef.current.month]} ${dataRef.current.year}`
        );
        setLoading(false);
        if (extractionFileRef.current) extractionFileRef.current.value = "";
        return;
      }

      // Build last-name index from known drivers + drivers in current month
      const knownNames = Array.from(new Set([...driversRef.current, ...Object.keys(dataRef.current.drivers || {})]));
      const lastNameIndex = new Map<string, { canonical: string; initial: string | null }[]>();
      for (const n of knownNames) {
        const p = parseAppDriverName(n);
        if (!p.lastName) continue;
        const arr = lastNameIndex.get(p.lastName) || [];
        arr.push({ canonical: n, initial: p.initial });
        lastNameIndex.set(p.lastName, arr);
      }

      const matched: string[] = [];
      const unmatched: { name: string; days: number; total: number }[] = [];
      const newDrivers = { ...dataRef.current.drivers };

      for (const [normFull, dayMap] of Object.entries(result.byDriver)) {
        const parsed = parseFileDriverName(normFull);
        const candidates = lastNameIndex.get(parsed.lastName);
        let canonical: string | null = null;
        if (candidates && candidates.length === 1) {
          canonical = candidates[0].canonical;
        } else if (candidates && candidates.length > 1) {
          const exact = candidates.find((c) => c.initial && parsed.initial && c.initial === parsed.initial);
          if (exact) canonical = exact.canonical;
          else {
            const noInit = candidates.find((c) => !c.initial);
            if (noInit) canonical = noInit.canonical;
          }
        }
        if (!canonical) {
          let total = 0;
          const days = Object.keys(dayMap).length;
          for (const dd of Object.values(dayMap)) for (const v of Object.values(dd)) total += v;
          unmatched.push({ name: normFull, days, total: Math.round(total * 100) / 100 });
          continue;
        }
        matched.push(canonical);
        const existing = newDrivers[canonical] || { days: {} };
        newDrivers[canonical] = { ...existing, extracts: dayMap };
      }

      const updatedMonth = { ...dataRef.current, drivers: newDrivers };
      setData(updatedMonth);
      await saveMonth(updatedMonth);

      setImportReport({
        matched: matched.length,
        rowCount: result.rowCount,
        totalRows: result.totalRows,
        skipped: result.skipped,
        unmatched,
      });

      const issuesCount = result.skipped.length + unmatched.length;
      toast.success(
        `Extraction importée : ${matched.length} chauffeur(s) — ${result.rowCount} ventes` +
          (issuesCount > 0 ? ` — ${issuesCount} ligne(s) non importée(s) (voir rapport)` : "")
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Import extraction : ${msg}`);
    } finally {
      setLoading(false);
      if (extractionFileRef.current) extractionFileRef.current.value = "";
    }
  }, []);

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
          ? {
              ...existing,
              drivers: {
                ...existing.drivers,
                ...Object.fromEntries(
                  Object.entries(result.data.drivers).map(([driver, importedData]) => {
                    const existingDriver = existing.drivers[driver] || { days: {} };
                    return [driver, {
                      days: {
                        ...existingDriver.days,
                        ...importedData.days,
                      },
                      ...(importedData.notReturned && { notReturned: importedData.notReturned }),
                      // Preserve extracts from existing driver
                      ...(existingDriver.extracts && { extracts: existingDriver.extracts }),
                    }];
                  })
                ),
              },
            }
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

  // ---------- Backup handlers ----------
  const handleSelectBackupDir = useCallback(async () => {
    const result = await selectBackupDir();
    if (result) {
      setBackupDirName(result.name);
      toast.success(`Dossier de sauvegarde : ${result.name}`);
    }
  }, []);

  const handleClearBackupDir = useCallback(async () => {
    await clearBackupDir();
    setBackupDirName(null);
    toast.success("Dossier de sauvegarde retiré");
  }, []);

  const handleSelectTemplateFile = useCallback(async () => {
    const result = await selectTemplateFile();
    if (result) {
      setTemplateFileName(result.name);
      toast.success(`Fichier modèle : ${result.name}`);
    }
  }, []);

  const handleClearTemplateFile = useCallback(async () => {
    await clearTemplateFile();
    setTemplateFileName(null);
    toast.success("Fichier modèle retiré");
  }, []);

  const handleSaveBackup = useCallback(async () => {
    if (!backupDirName) {
      setShowSaveDialog(true);
      return;
    }
    setLoading(true);
    try {
      const saved = await saveBackup(data, drivers);
      if (saved) {
        toast.success(`Sauvegarde effectuée : ${MONTH_NAMES[data.month]} ${data.year}`);
      } else {
        toast.error("Aucun dossier de sauvegarde sélectionné. Cliquez d'abord sur ⚙ Config sauvegarde.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur sauvegarde : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [data, drivers, backupDirName]);

  const handleSaveToXlsm = useCallback(async (mode: "new" | "update", file?: File) => {
    if (mode === "new") {
      const saved = await saveNewBackup(data, drivers);
      if (saved) {
        toast.success(`Sauvegarde créée : ${getSaveFileName(data)}`);
      } else {
        toast.error("Sauvegarde annulée");
      }
    } else {
      const saved = await updateExistingBackup(data, drivers, file);
      if (saved) {
        toast.success(`Fichier mis à jour : ${file?.name || getSaveFileName(data)}`);
      } else {
        toast.error("Mise à jour annulée");
      }
    }
  }, [data, drivers]);

  const daysInMonth = getDaysInMonth(data.year, data.month);
  const isCurrentMonth = data.year === now.getFullYear() && data.month === now.getMonth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-6 py-3 shadow-lg">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <img src={logo} alt="Pastouret Rubans-Bleus" className="h-10 object-contain justify-self-start" />
          <div className="flex flex-col items-center justify-center gap-1">
            <h1 className="text-xl font-bold tracking-tight">Caisses Chateaurenard</h1>
            <p className="text-primary-foreground/70 text-sm">Relevé des Caisses Mensuel</p>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="text-xs h-8">
                  <Settings2 className="h-3.5 w-3.5 mr-1" /> Config sauvegarde
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {/* Backup folder */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleSelectBackupDir(); }} className="cursor-pointer">
                  <Folder className="h-4 w-4 mr-2" />
                  <div className="flex flex-col">
                    <span className="text-sm">Dossier de sauvegarde</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {backupDirName || "Non défini"}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleConfigureSupabase(); }} className="cursor-pointer">
                  <Database className="h-4 w-4 mr-2" />
                  <span>Configurer Supabase</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {backupDirName && (
                  <DropdownMenuItem onSelect={handleClearBackupDir} className="cursor-pointer text-destructive">
                    <Folder className="h-4 w-4 mr-2" />
                    <span>Retirer le dossier</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {/* Template file */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleSelectTemplateFile(); }} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  <div className="flex flex-col">
                    <span className="text-sm">Fichier modèle vierge</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {templateFileName || "Aucun (export normal)"}
                    </span>
                  </div>
                </DropdownMenuItem>
                {templateFileName && (
                  <DropdownMenuItem onSelect={handleClearTemplateFile} className="cursor-pointer text-destructive">
                    <FileText className="h-4 w-4 mr-2" />
                    <span>Retirer le modèle</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="secondary"
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowSaveDialog(true)}
              title="Sauvegarder le mois au format .xlsm"
            >
              <FileArchive className="h-3.5 w-3.5 mr-1" /> Sauvegarder
            </Button>
          </div>
        </div>
      </header>

      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center flex-wrap gap-3">
          <MonthSelector year={data.year} month={data.month} onChange={handleMonthChange} />
          <Button
            variant={selectedDriver === "__dashboard__" ? "default" : "outline"}
            onClick={() => { setExtractionMode(false); setSelectedDriver("__dashboard__"); }}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" /> Tableau de bord
          </Button>
          <Button
            variant={selectedDriver === null ? "default" : "outline"}
            onClick={() => { setExtractionMode(false); setSelectedDriver(null); }}
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
            {/* Supabase status badge */}
            {!extractionMode && supabaseStatus && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer ${
                  supabaseStatus.connected && supabaseStatus.monthsTable && supabaseStatus.driversTable
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-red-100 text-red-800 border border-red-300"
                }`}
                onClick={handleSyncToSupabase}
                title={
                  supabaseStatus.error
                    ? `Erreur: ${supabaseStatus.error}`
                    : `${supabaseStatus.monthsCount} mois, ${supabaseStatus.driversCount} conducteurs`
                }
              >
                <Database className="h-3 w-3" />
                <span>
                  {syncing
                    ? "Sync..."
                    : supabaseStatus.connected && supabaseStatus.monthsTable && supabaseStatus.driversTable
                    ? `${supabaseStatus.monthsCount}M ${supabaseStatus.driversCount}C`
                    : "Déconnecté"}
                </span>
              </div>
            )}
            {!extractionMode && !supabaseStatus?.connected && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={handleSyncToSupabase}
                disabled={syncing}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                {syncing ? "Sync..." : "Sync Supabase"}
              </Button>
            )}
            <Button
              variant={extractionMode ? "default" : "outline"}
            onClick={() => {
              const list = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort();
              if (list.length === 0) {
                toast.error("Aucun chauffeur disponible");
                return;
              }
              setExtractionMode(true);
              setSelectedDriver(list[0]);
            }}
          >
            <ScanLine className="h-4 w-4 mr-2" /> Extraction
          </Button>
          {extractionMode && (
            <>
              <Button variant="outline" onClick={() => extractionFileRef.current?.click()}>
                <FileDown className="h-4 w-4 mr-2" /> Importer Extraction
              </Button>
              <input
                ref={extractionFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleExtractionImport(e.target.files)}
              />
            </>
          )}
          {isCurrentMonth && !extractionMode && (
            <>
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
            </>
          )}
        </div>
      </div>

      <main className="px-6 pb-8">
        <div className="flex gap-6">
          <div className="w-[280px] flex-shrink-0">
            <DriverList
              drivers={Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort()}
              activeDrivers={drivers}
              selectedDriver={selectedDriver}
              onSelect={(d) => {
                if (d === "__stats__" || d === "__dashboard__" || d === null) setExtractionMode(false);
                setSelectedDriver(d);
              }}
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
                    year={data.year}
                    month={data.month}
                    onChange={(driverData) => handleDriverDataChange(selectedDriver, driverData)}
                    extractionMode={extractionMode}
                  />
                  <RecapGrid data={data} drivers={drivers} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ImportReportDialog report={importReport} onClose={() => setImportReport(null)} />
      <BackupSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        data={data}
        onSave={handleSaveToXlsm}
      />
    </div>
  );
}