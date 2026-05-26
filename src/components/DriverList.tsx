import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Users, Pencil, Check, X, Search } from "lucide-react";

interface Props {
  drivers: string[];
  activeDrivers?: string[];
  selectedDriver: string | null;
  onSelect: (driver: string | null) => void;
  onAddDriver: (name: string) => void;
  onRemoveDriver: (name: string) => void;
  onRenameDriver: (oldName: string, newName: string) => void;
}

export default function DriverList({ drivers, activeDrivers, selectedDriver, onSelect, onAddDriver, onRemoveDriver, onRenameDriver }: Props) {
  const activeSet = new Set(activeDrivers ?? drivers);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [deleteConfirmDriver, setDeleteConfirmDriver] = useState<string | null>(null);

  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;
    const q = searchQuery.trim().toLowerCase();
    return drivers.filter((d) => d.toLowerCase().includes(q));
  }, [drivers, searchQuery]);

  const handleAdd = () => {
    const name = newName.trim().toUpperCase();
    if (name && !drivers.includes(name)) {
      onAddDriver(name);
      setNewName("");
      setShowAdd(false);
    }
  };

  const handleStartEdit = (driver: string) => {
    setEditingDriver(driver);
    setEditName(driver);
  };

  const handleConfirmEdit = () => {
    if (!editingDriver) return;
    const name = editName.trim().toUpperCase();
    if (name && name !== editingDriver && !drivers.includes(name)) {
      onRenameDriver(editingDriver, name);
    }
    setEditingDriver(null);
    setEditName("");
  };

  // Scroll to center the selected driver in the scrollable area
  useEffect(() => {
    if (!selectedDriver || selectedDriver.startsWith("__")) return;
    const el = document.getElementById(`driver-item-${selectedDriver}`);
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const itemTop = el.offsetTop;
      const containerHeight = container.clientHeight;
      const itemHeight = el.offsetHeight;
      // Scroll to center the item in the container
      const scrollTarget = itemTop - (containerHeight / 2) + (itemHeight / 2);
      container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
    }
  }, [selectedDriver]);

  const confirmDelete = () => {
    if (deleteConfirmDriver) {
      onRemoveDriver(deleteConfirmDriver);
      setDeleteConfirmDriver(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-grid-header text-grid-header-foreground px-4 py-2.5 flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Chauffeurs ({drivers.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-grid-header-foreground hover:bg-primary/80"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showAdd && (
        <div className="p-2 border-b border-border flex gap-1">
          <Input
            placeholder="Nom du chauffeur"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2" onClick={handleAdd}>OK</Button>
        </div>
      )}

      {/* Search bar */}
      {showSearch ? (
        <div className="px-2 pt-1 pb-0.5 flex gap-1">
          <Input
            placeholder="Rechercher un chauffeur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
            }}
            className="h-7 text-xs"
            autoFocus
          />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        !showAdd && (
          <div className="px-2 pt-1 pb-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted-foreground hover:text-foreground justify-start gap-2 px-2"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-3 w-3" />
              Rechercher...
            </Button>
          </div>
        )
      )}

      <div className="max-h-[calc(100vh-272px)] overflow-y-auto" ref={scrollRef}>
        {filteredDrivers.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
            Aucun résultat
          </div>
        ) : filteredDrivers.map((driver) => {
          const isDeleted = !activeSet.has(driver);
          return (
            <div
            key={driver}
            id={`driver-item-${driver}`}
            className={`group flex items-center justify-between px-3 py-1.5 text-sm border-b border-border/50 cursor-pointer transition-colors ${
              selectedDriver === driver
                ? "bg-primary/10 text-primary font-medium"
                : isDeleted
                ? "hover:bg-muted text-muted-foreground italic opacity-70"
                : "hover:bg-muted text-foreground"
            }`}
          >
            {editingDriver === driver ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmEdit();
                    if (e.key === "Escape") setEditingDriver(null);
                  }}
                  className="h-6 text-xs flex-1"
                  autoFocus
                />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={handleConfirmEdit}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingDriver(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  className="flex-1 text-left"
                  onClick={() => onSelect(driver)}
                >
                  {driver}
                </button>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:text-primary hover:bg-primary/10"
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(driver); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmDriver(driver); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmDriver !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmDriver(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le chauffeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmDriver ? (
                <>Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirmDriver}</strong> ?<br />
                Les données des mois passés seront conservées (historique).<br />
                Le chauffeur sera retiré des mois futurs uniquement.</>
              ) : "Confirmer la suppression ?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}