import { MONTH_NAMES, getDaysInMonth } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export default function MonthSelector({ year, month, onChange }: Props) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  const prev = () => {
    if (month === 0) onChange(year - 1, 11);
    else onChange(year, month - 1);
  };
  const next = () => {
    if (month === 11) onChange(year + 1, 0);
    else onChange(year, month + 1);
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={prev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span
        className="text-lg font-semibold text-primary min-w-[200px] text-center flex items-center justify-center gap-2"
        title={isCurrentMonth ? "Mois en cours" : `${daysInMonth} jours`}
      >
        {MONTH_NAMES[month]} {year}
        {isCurrentMonth ? (
          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">
            <Calendar className="h-3 w-3 inline mr-0.5" />
            en cours
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-normal">
            {daysInMonth}j
          </span>
        )}
      </span>
      <Button variant="outline" size="icon" onClick={next} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}