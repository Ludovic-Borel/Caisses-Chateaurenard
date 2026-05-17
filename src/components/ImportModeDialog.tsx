import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImportComplete: (mode: "full" | "addonly") => void;
  filesCount: number;
}

export default function ImportModeDialog({ open, onClose, onImportComplete, filesCount }: Props) {
  const [mode, setMode] = useState<"full" | "addonly">("full");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Excel — Mode d'import</DialogTitle>
          <DialogDescription>
            {filesCount > 1
              ? `${filesCount} fichier(s) à importer.`
              : "1 fichier à importer."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors">
            <input
              type="radio"
              name="importMode"
              value="full"
              checked={mode === "full"}
              onChange={() => setMode("full")}
              className="mt-1"
            />
            <div>
              <p className="font-medium">Importer le(s) fichier(s) complet(s)</p>
              <p className="text-sm text-muted-foreground">
                Remplace les données existantes pour les mois et chauffeurs concernés.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors">
            <input
              type="radio"
              name="importMode"
              value="addonly"
              checked={mode === "addonly"}
              onChange={() => setMode("addonly")}
              className="mt-1"
            />
            <div>
              <p className="font-medium">Mettre à jour uniquement le(s) mois concerné(s)</p>
              <p className="text-sm text-muted-foreground">
                Ajoute uniquement les données manquantes sans modifier les cellules déjà renseignées.
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onImportComplete(mode)}>
            {mode === "full" ? "Importer complet" : "Mettre à jour"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}