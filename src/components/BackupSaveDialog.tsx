import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, FileEdit, Loader2 } from "lucide-react";
import { MONTH_NAMES } from "@/lib/types";
import type { MonthData } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MonthData | null;
  onSave: (mode: "new" | "update", file?: File) => Promise<void>;
}

export default function BackupSaveDialog({ open, onOpenChange, data, onSave }: Props) {
  const [mode, setMode] = useState<"new" | "update">("new");
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileName = data
    ? `Sauvegarde ${MONTH_NAMES[data.month]} ${data.year} Chateaurenard.xlsx`
    : "";

  const handleSave = useCallback(async () => {
    if (mode === "update" && !selectedFile) {
      setFileError("Veuillez sélectionner un fichier .xlsm");
      return;
    }
    setSaving(true);
    setFileError(null);
    try {
      await onSave(mode, selectedFile || undefined);
      onOpenChange(false);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [mode, selectedFile, onSave, onOpenChange]);

  const handleFileSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
        setFileError(null);
      }
    };
    input.click();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Sauvegarder le mois
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${MONTH_NAMES[data.month]} ${data.year} — ${Object.keys(data.drivers || {}).length} chauffeurs`
              : "Aucune donnée chargée"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "new" | "update")} className="gap-3">
            <div className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${mode === "new" ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => setMode("new")}
            >
              <RadioGroupItem value="new" id="new" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="new" className="text-base font-semibold cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Nouvelle sauvegarde
                  </div>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Créer un nouveau fichier <strong>{fileName}</strong>
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${mode === "update" ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => setMode("update")}
            >
              <RadioGroupItem value="update" id="update" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="update" className="text-base font-semibold cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4" />
                    Mettre à jour un fichier existant
                  </div>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Sélectionner un fichier .xlsx existant pour le mettre à jour
                </p>
                {mode === "update" && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFileSelect}
                      type="button"
                    >
                      {selectedFile ? `✓ ${selectedFile.name}` : "Choisir un fichier..."}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>

          {fileError && (
            <p className="text-sm text-destructive font-medium">{fileError}</p>
          )}

          {mode === "new" && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p>Nom du fichier : <strong>{fileName}</strong></p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || (mode === "update" && !selectedFile)}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === "new" ? "Sauvegarder" : "Mettre à jour"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}