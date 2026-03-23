import { SavedMonth, MONTH_NAMES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Eye, Trash2 } from "lucide-react";

interface Props {
  archives: SavedMonth[];
  onView: (archive: SavedMonth) => void;
  onDelete: (id: string) => void;
}

export default function ArchiveList({ archives, onView, onDelete }: Props) {
  if (archives.length === 0) {
    return <p className="text-muted-foreground text-sm italic">Aucun mois archivé.</p>;
  }

  return (
    <div className="space-y-2">
      {archives.map((a) => (
        <div key={a.id} className="flex items-center justify-between bg-card border border-border rounded-md px-4 py-2">
          <div>
            <span className="font-medium text-foreground">
              {MONTH_NAMES[a.month]} {a.year}
            </span>
            <span className="text-muted-foreground text-xs ml-3">
              Sauvegardé le {new Date(a.savedAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onView(a)}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Voir
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(a.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
