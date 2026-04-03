import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users, Pencil, Check, X } from "lucide-react";

interface Props {
  drivers: string[];
  selectedDriver: string | null;
  onSelect: (driver: string | null) => void;
  onAddDriver: (name: string) => void;
  onRemoveDriver: (name: string) => void;
  onRenameDriver: (oldName: string, newName: string) => void;
}

export default function DriverList({ drivers, selectedDriver, onSelect, onAddDriver, onRemoveDriver, onRenameDriver }: Props) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

      <div className="flex-1 overflow-y-auto">
        {drivers.map((driver) => (
          <div
            key={driver}
            className={`group flex items-center justify-between px-3 py-1.5 text-sm border-b border-border/50 cursor-pointer transition-colors ${
              selectedDriver === driver
                ? "bg-primary/10 text-primary font-medium"
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
                  className="flex-1 text-left truncate"
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
                    onClick={(e) => { e.stopPropagation(); onRemoveDriver(driver); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
