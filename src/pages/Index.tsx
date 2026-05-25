import { useState, useCallback, useEffect, useRef } from "react";
import { MonthData, MONTH_NAMES, DriverMonthData, getDaysInMonth } from "@/lib/types";
import { loadMonth, saveMonth, loadDrivers, saveDrivers, renameDriverRemote, migrateLocalToRemote, loadAllMonths, enableRealtime, onMonthChange, onDriversChange, checkSupabaseStatus, type SupabaseStatus, type MigrationResult } from "@/lib/storage";
import { initializeSupabase } from "@/lib/setup";
import { configureSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { importWorkbookFile, importExtractionFile, parseAppDriverName, parseFileDriverName, type SkippedRow, type SkipReason } from "@/lib/import";
import { selectBackupDir, clearBackupDir, getBackupDirName, selectTemplateFile, clearTemplateFile, getTemplateFileName, saveBackup } from "@/lib/backup";
import RevenueGrid from "@/components/RevenueGrid";
import RecapGrid from "@/components/RecapGrid";
import DriverList from "@/components/DriverList";
import MonthSelector from "@/components/MonthSelector";
import StatsPanel from "@/components/StatsPanel";
import Dashboard from "@/components/Dashboard";
import YearlyOverview from "@/components/YearlyOverview";
import MonthComparison from "@/components/MonthComparison";
import ImportReportDialog from "@/components/ImportReportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableProperties, LayoutDashboard, Loader2, Upload, ScanLine, FileDown, Folder, FileText, Settings2, Database, CheckCircle2, PanelLeftClose, PanelLeft, BarChart3, GitCompare, Printer, RotateCcw, Sun, Moon, HelpCircle, Bug } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import logo from "@/assets/logo.png";

function createEmptyMonth(year: number, month: number): MonthData {
  return { year, month, drivers: {}, days: {} };
}

export default function Index() {
  const now = new Date();
  const [data, setData] = useState<MonthData>(() => createEmptyMonth(now.getFullYear(), now.getMonth()));
  const [drivers, setDrivers] = useState<string[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>("__dashboard__");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("recettes_sidebar_open");
    return saved !== null ? saved === "true" : true;
  });
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
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [excelBackupStatus, setExcelBackupStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [undoState, setUndoState] = useState<{ data: MonthData; drivers: string[] } | null>(null);
  const [modifiedSinceSave, setModifiedSinceSave] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoState) return;
    setData(undoState.data);
    setDrivers(undoState.drivers);
    setUndoState(null);
    toast.success("Import annulé, état précédent restauré");
  }, [undoState]);

  const saveSnapshot = useCallback(() => {
    setUndoState({ data: JSON.parse(JSON.stringify(dataRef.current)), drivers: [...driversRef.current] });
  }, []);

  const skipNextSave = useRef(true);
  const skipNextDriversSave = useRef(true);
  const saveDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDriversTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excelBackupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      // Check for new version on GitHub
      try {
        const res = await fetch("https://api.github.com/repos/Ludovic-Borel/Caisses-Chateaurenard/releases/latest");
        if (res.ok) {
          const release = await res.json();
          const current = "v2.00";
          const latest = release.tag_name || release.name || "";
          if (latest && latest !== current && latest.localeCompare(current, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
            setNewVersion(latest);
          }
        }
      } catch {
        // Silently ignore network errors
      }
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
    setModifiedSinceSave(true);
    setSaveStatus("saving");
    if (saveDataTimeoutRef.current) clearTimeout(saveDataTimeoutRef.current);
    saveDataTimeoutRef.current = setTimeout(async () => {
      await saveMonth(data);
      setSaveStatus("saved");
      setModifiedSinceSave(false);
      saveIdleTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
    return () => { if (saveDataTimeoutRef.current) clearTimeout(saveDataTimeoutRef.current); if (saveIdleTimeoutRef.current) clearTimeout(saveIdleTimeoutRef.current); };
  }, [data]);

  // Debounced save of drivers
  useEffect(() => {
    driversRef.current = drivers;
    if (skipNextDriversSave.current) { skipNextDriversSave.current = false; return; }
    setModifiedSinceSave(true);
    setSaveStatus("saving");
    if (saveDriversTimeoutRef.current) clearTimeout(saveDriversTimeoutRef.current);
    saveDriversTimeoutRef.current = setTimeout(async () => {
      await saveDrivers(drivers);
      setSaveStatus("saved");
      setModifiedSinceSave(false);
      saveIdleTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
    return () => { if (saveDriversTimeoutRef.current) clearTimeout(saveDriversTimeoutRef.current); if (saveIdleTimeoutRef.current) clearTimeout(saveIdleTimeoutRef.current); };
  }, [drivers]);

  // ---------- Auto-save Excel backup (debounced) ----------
  useEffect(() => {
    if (!backupDirName) return;
    if (excelBackupTimeoutRef.current) clearTimeout(excelBackupTimeoutRef.current);
    excelBackupTimeoutRef.current = setTimeout(async () => {
      setExcelBackupStatus("saving");
      try {
        const saved = await saveBackup(data, drivers);
        if (saved) {
          setExcelBackupStatus("saved");
          setTimeout(() => setExcelBackupStatus("idle"), 3000);
        } else {
          setExcelBackupStatus("idle");
        }
      } catch (e) {
        console.warn("Excel backup failed:", e);
        setExcelBackupStatus("idle");
      }
    }, 5000);
    return () => {
      if (excelBackupTimeoutRef.current) clearTimeout(excelBackupTimeoutRef.current);
    };
  }, [data, drivers, backupDirName]);

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
    saveSnapshot();
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
    saveSnapshot();
    let successCount = 0;
    let lastImported: { year: number; month: number } | null = null;
    const allNewDrivers = new Set<string>();
    const fileArray = Array.from(files);
    setImportProgress({ current: 0, total: fileArray.length });

    for (let idx = 0; idx < fileArray.length; idx++) {
      const file = fileArray[idx];
      setImportProgress({ current: idx + 1, total: fileArray.length });
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

    setImportProgress(null);
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

  const { theme, setTheme } = useTheme();
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
            {/* Save status indicators */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-xs text-primary-foreground/60 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-green-300">
                <CheckCircle2 className="h-3 w-3" /> Enregistré
              </span>
            )}
            {backupDirName && excelBackupStatus === "saving" && (
              <span className="flex items-center gap-1 text-xs text-primary-foreground/60 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Excel...
              </span>
            )}
            {backupDirName && excelBackupStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-green-300">
                <CheckCircle2 className="h-3 w-3" /> Excel OK
              </span>
            )}
            {/* Import progress bar */}
            {importProgress && (
              <span className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Import {importProgress.current}/{importProgress.total}</span>
                <div className="w-16 h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-foreground/60 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </span>
            )}
            {/* Modified badge */}
            {modifiedSinceSave && (
              <span className="flex items-center gap-1 text-xs text-amber-300 animate-pulse">
                Modifié
              </span>
            )}
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="text-xs h-8">
                  <Settings2 className="h-3.5 w-3.5 mr-1" /> Config et Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {/* Import Excel */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); fileInputRef.current?.click(); }} className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  <span>Importer Excel</span>
                </DropdownMenuItem>
                {/* Import Extraction - grisé si mode extraction inactif */}
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (!extractionMode) {
                      toast.error("Activer le mode Extraction pour importer une extraction");
                      return;
                    }
                    extractionFileRef.current?.click();
                  }}
                  className={`cursor-pointer ${!extractionMode ? "opacity-40" : ""}`}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  <span>Importer Extraction</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
                {/* Supabase */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleConfigureSupabase(); }} className="cursor-pointer">
                  <Database className="h-4 w-4 mr-2" />
                  <span>Configurer Supabase</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Help */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setHelpOpen(true); }} className="cursor-pointer">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  <span>Aide</span>
                </DropdownMenuItem>
                {/* Report bug */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); window.open("https://github.com/Ludovic-Borel/Caisses-Chateaurenard/issues/new", "_blank"); }} className="cursor-pointer">
                  <Bug className="h-4 w-4 mr-2" />
                  <span>Signaler un bug</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {undoState && (
              <Button
                variant="destructive"
                size="sm"
                className="text-xs h-8 no-print"
                onClick={handleUndo}
                title="Annuler le dernier import et restaurer l'état précédent"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Annuler
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="text-xs h-8 no-print hidden md:inline-flex"
              onClick={handlePrint}
              title="Exporter en PDF (impression navigateur)"
            >
              <Printer className="h-3.5 w-3.5 mr-1" /> PDF
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
          <Button
            variant={selectedDriver === "__yearly__" ? "default" : "outline"}
            onClick={() => { setExtractionMode(false); setSelectedDriver("__yearly__"); }}
          >
            <BarChart3 className="h-4 w-4 mr-2" /> Annuel
          </Button>
          <Button
            variant={selectedDriver === "__comparison__" ? "default" : "outline"}
            onClick={() => { setExtractionMode(false); setSelectedDriver("__comparison__"); }}
          >
            <GitCompare className="h-4 w-4 mr-2" /> Comparer
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
                if (extractionMode) {
                  setExtractionMode(false);
                  return;
                }
                const list = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort();
                if (list.length === 0) {
                  toast.error("Aucun chauffeur disponible");
                  return;
                }
                setExtractionMode(true);
                // Keep current driver if it's a real driver, otherwise go back to dashboard
                if (selectedDriver === "__dashboard__" || selectedDriver === "__stats__" || selectedDriver === null) {
                  setSelectedDriver("__dashboard__");
                }
              }}
            >
            <ScanLine className="h-4 w-4 mr-2" /> Extraction
          </Button>
          {extractionMode && (
            <>
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

      <main className="px-6 pb-8 print-content view-enter" key={selectedDriver}>
        <div className="flex gap-6">
          {sidebarOpen && (
          <div className="w-[220px] flex-shrink-0">
            <DriverList
              drivers={Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort()}
              activeDrivers={drivers}
              selectedDriver={selectedDriver}
              onSelect={(d) => {
                if (d === "__stats__" || d === "__dashboard__" || d === "__yearly__" || d === "__comparison__" || d === null) setExtractionMode(false);
                setSelectedDriver(d);
              }}
              onAddDriver={handleAddDriver}
              onRemoveDriver={handleRemoveDriver}
              onRenameDriver={handleRenameDriver}
            />
          </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-lg border border-border shadow-sm p-4">
              <div className="flex items-center justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    const next = !sidebarOpen;
                    setSidebarOpen(next);
                    localStorage.setItem("recettes_sidebar_open", String(next));
                  }}
                  title={sidebarOpen ? "Masquer la liste des chauffeurs" : "Afficher la liste des chauffeurs"}
                >
                  {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
                  <span className="ml-1">{sidebarOpen ? "Masquer" : "Chauffeurs"}</span>
                </Button>
              </div>
              {selectedDriver === "__comparison__" ? (
                <MonthComparison drivers={drivers} />
              ) : selectedDriver === "__yearly__" ? (
                <YearlyOverview year={data.year} drivers={drivers} />
              ) : selectedDriver === "__stats__" ? (
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
      <footer className="text-center text-[10px] text-muted-foreground/50 py-2 select-none border-t border-border/20 no-print">
        Caisses Chateaurenard v2.00 •
        <a href="https://github.com/Ludovic-Borel/Caisses-Chateaurenard" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors ml-1">
          GitHub
        </a>
        {newVersion && (
          <span className="ml-2 text-amber-500 font-semibold">
            • Nouvelle version disponible : <a href="https://github.com/Ludovic-Borel/Caisses-Chateaurenard/releases" target="_blank" rel="noopener noreferrer" className="hover:text-primary underline">{newVersion}</a>
          </span>
        )}
      </footer>

      {/* Help Dialog */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setHelpOpen(false)}>
          <div className="bg-card text-card-foreground rounded-lg shadow-xl border border-border max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold">Aide - Caisses Chateaurenard</h2>
            </div>
            <div className="p-4 text-sm space-y-3">
              <div>
                <h3 className="font-semibold text-primary mb-1">📥 Importer un fichier Excel</h3>
                <p className="text-muted-foreground">Ouvrez le menu <strong>Config et Import</strong> → <strong>Importer Excel</strong>. Sélectionnez un fichier "Recettes Lignes MM - YYYY.xlsx". Les données sont fusionnées avec le mois correspondant.</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">📄 Importer une Extraction</h3>
                <p className="text-muted-foreground">Activez d'abord le mode <strong>Extraction</strong> (bouton en haut), puis utilisez <strong>Importer Extraction</strong> dans le menu. Les fichiers attendus sont du type <em>ventes-realisees-orientees-reseau_*.xlsx</em>.</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">💾 Sauvegarde automatique</h3>
                <p className="text-muted-foreground">Configurez un <strong>dossier de sauvegarde</strong> dans le menu. Un fichier Excel est automatiquement généré à chaque modification (5s après la dernière saisie).</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">☁️ Synchronisation Cloud</h3>
                <p className="text-muted-foreground">Cliquez sur <strong>Configurer Supabase</strong> pour entrer votre URL et clé API. Une fois connecté, les données sont synchronisées automatiquement toutes les 5 minutes et au retour en ligne.</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">🖨️ Export PDF</h3>
                <p className="text-muted-foreground">Utilisez le bouton <strong>PDF</strong> dans le header. L'impression navigateur génère un PDF en format A4 paysage.</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">🌙 Mode sombre</h3>
                <p className="text-muted-foreground">Cliquez sur l'icône ☀️/🌙 dans le header pour basculer entre les thèmes clair et sombre.</p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <Button variant="default" size="sm" onClick={() => setHelpOpen(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}