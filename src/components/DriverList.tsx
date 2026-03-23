import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users } from "lucide-react";

interface Props {
  drivers: string[];
  selectedDriver: string | null;
  onSelect: (driver: string | null) => void;
  onAddDriver: (name: string) => void;
  onRemoveDriver: (name: string) => void;
}

export default function DriverList({ drivers, selectedDriver, onSelect, onAddDriver, onRemoveDriver }: Props) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = () => {
    const name = newName.trim().toUpperCase();
    if (name && !drivers.includes(name)) {
      onAddDriver(name);
      setNewName("");
      setShowAdd(false);
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

      {/* Récap button */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-4 py-2 text-sm font-semibold border-b border-border transition-colors ${
          selectedDriver === null
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted text-foreground"
        }`}
      >
        📊 Récapitulatif Global
      </button>

      <div className="max-h-[60vh] overflow-y-auto">
        {drivers.map((driver) => (
          <div
            key={driver}
            className={`flex items-center justify-between px-4 py-1.5 text-sm border-b border-border/50 cursor-pointer transition-colors ${
              selectedDriver === driver
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <button
              className="flex-1 text-left"
              onClick={() => onSelect(driver)}
            >
              {driver}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveDriver(driver);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
