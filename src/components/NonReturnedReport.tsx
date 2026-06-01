import { MonthData, CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MONTH_NAMES } from "@/lib/types";

interface Props {
  data: MonthData;
  drivers: string[];
}

export default function NonReturnedReport({ data, drivers }: Props) {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const fmt = (v: number) => v.toFixed(2).replace(".", ",") + " €";

  // Collect all non-returned entries
  interface NonReturnEntry {
    driver: string;
    day: number;
    category: string;
    paymentType: string;
    amount: number;
  }

  const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort();
  const entries: NonReturnEntry[] = [];

  allDrivers.forEach((driver) => {
    const dd = data.drivers[driver];
    if (!dd || !dd.notReturned) return;
    for (let d = 1; d <= daysInMonth; d++) {
      CATEGORIES.forEach((cat) => {
        PAYMENT_TYPES.forEach((pt) => {
          const key = `${d}_${cat}_${pt}`;
          if (dd.notReturned[key]) {
            const amount = dd.days[d]?.[getCellKey(cat, pt)] || 0;
            if (amount > 0) {
              entries.push({ driver, day: d, category: cat, paymentType: pt, amount });
            }
          }
        });
      });
    }
  });

  // Group by driver
  const grouped: { driver: string; entries: NonReturnEntry[]; total: number }[] = [];
  const driverMap = new Map<string, NonReturnEntry[]>();
  entries.forEach((e) => {
    const list = driverMap.get(e.driver) || [];
    list.push(e);
    driverMap.set(e.driver, list);
  });
  driverMap.forEach((entriesList, driver) => {
    const total = entriesList.reduce((s, e) => s + e.amount, 0);
    grouped.push({ driver, entries: entriesList, total });
  });
  grouped.sort((a, b) => b.total - a.total || a.driver.localeCompare(b.driver));

  const grandTotal = entries.reduce((s, e) => s + e.amount, 0);

  const fmtDate = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day);
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return `${days[d.getDay()]} ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
  };

  const renderTable = (compact = false) => (
    <table className={`w-full border-collapse text-xs ${compact ? "min-w-[600px]" : "min-w-[800px]"}`}>
      <thead>
        <tr className="bg-grid-header text-grid-header-foreground">
          <th className="border border-border px-3 py-1.5 text-left">Chauffeur</th>
          <th className="border border-border px-3 py-1.5 text-left">Date</th>
          <th className="border border-border px-3 py-1.5 text-left">Ligne</th>
          <th className="border border-border px-3 py-1.5 text-left">Mode</th>
          <th className="border border-border px-3 py-1.5 text-right">Montant</th>
        </tr>
      </thead>
      <tbody>
        {grouped.length === 0 && (
          <tr>
            <td colSpan={5} className="border border-border px-3 py-4 text-center text-muted-foreground">
              Aucun non-rendu pour ce mois
            </td>
          </tr>
        )}
        {grouped.map((g) => (
          <>
            {g.entries.map((e, i) => (
              <tr key={`${g.driver}-${e.day}-${e.category}-${e.paymentType}`} className="hover:bg-muted/50 transition-colors">
                {i === 0 && (
                  <td className="border border-border px-3 py-1 font-bold text-foreground" rowSpan={g.entries.length}>
                    {g.driver}
                  </td>
                )}
                <td className="border border-border px-3 py-1 text-center">{fmtDate(data.year, data.month, e.day)}</td>
                <td className="border border-border px-3 py-1 text-center">{e.category}</td>
                <td className="border border-border px-3 py-1 text-center">{e.paymentType === "especes" ? "Espèces" : "CB"}</td>
                <td className="border border-border px-3 py-1 text-right font-bold text-destructive">{fmt(e.amount)}</td>
              </tr>
            ))}
            {/* Sous-total chauffeur */}
            {g.entries.length > 1 && (
              <tr className="bg-secondary/50">
                <td colSpan={4} className="border border-border px-3 py-1 text-right font-semibold text-sm">Sous-total {g.driver}</td>
                <td className="border border-border px-3 py-1 text-right font-bold text-destructive">{fmt(g.total)}</td>
              </tr>
            )}
          </>
        ))}
      </tbody>
      {grouped.length > 0 && (
        <tfoot>
          <tr className="bg-grid-header text-grid-header-foreground font-bold">
            <td colSpan={4} className="border border-border px-3 py-1.5 text-right text-sm">TOTAL NON-RENDU</td>
            <td className="border border-border px-3 py-1.5 text-right text-sm">{fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print-hidden">
        <h2 className="text-lg font-bold text-primary">
          ⚠ Non-rendus — {MONTH_NAMES[data.month]} {data.year}
          {grandTotal > 0 && (
            <span className="ml-2 text-destructive font-bold text-base">
              ({fmt(grandTotal)})
            </span>
          )}
        </h2>
      </div>

      {grouped.length > 0 && (
        <div className="flex items-center gap-2 print-hidden">
          <span className="text-xs text-muted-foreground">
            {entries.length} ligne(s) non-rendues sur {grouped.length} chauffeur(s)
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        {renderTable(false)}
      </div>

      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          body { font-size: 10pt; }
          table { page-break-inside: auto; font-size: 9pt !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>
    </div>
  );
}