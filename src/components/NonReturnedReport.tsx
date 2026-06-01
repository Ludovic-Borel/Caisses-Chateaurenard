import { useEffect, useState } from "react";
import { MonthData, CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MONTH_NAMES } from "@/lib/types";
import { loadAllMonths } from "@/lib/storage";

interface Props {
  data: MonthData;
  drivers: string[];
}

export default function NonReturnedReport({ data, drivers }: Props) {
  const daysInMonth = getDaysInMonth(data.year, data.month);
  const fmt = (v: number) => v.toFixed(2).replace(".", ",") + " €";
  const [cumulatedData, setCumulatedData] = useState<MonthData[] | null>(null);

  // Load all months up to current month for cumulative data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await loadAllMonths();
      if (cancelled) return;
      // Filter months from January of current year up to current month
      const filtered = all.filter((m) => m.year === data.year && m.month <= data.month);
      setCumulatedData(filtered);
    })();
    return () => { cancelled = true; };
  }, [data.year, data.month]);

  // Collect non-returned entries for a specific month
  interface NonReturnEntry {
    driver: string;
    day: number;
    category: string;
    paymentType: string;
    amount: number;
  }

  function collectEntries(monthData: MonthData): NonReturnEntry[] {
    const entries: NonReturnEntry[] = [];
    const allDrivers = Array.from(new Set([...drivers, ...Object.keys(monthData.drivers || {})])).sort();
    const dim = getDaysInMonth(monthData.year, monthData.month);
    allDrivers.forEach((driver) => {
      const dd = monthData.drivers[driver];
      if (!dd || !dd.notReturned) return;
      for (let d = 1; d <= dim; d++) {
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
    return entries;
  }

  // Current month entries
  const currentEntries = collectEntries(data);

  // Group entries by driver for a given list
  function groupByDriver(entries: NonReturnEntry[]): { driver: string; entries: NonReturnEntry[]; total: number }[] {
    const driverMap = new Map<string, NonReturnEntry[]>();
    entries.forEach((e) => {
      const list = driverMap.get(e.driver) || [];
      list.push(e);
      driverMap.set(e.driver, list);
    });
    const grouped: { driver: string; entries: NonReturnEntry[]; total: number }[] = [];
    driverMap.forEach((entriesList, driver) => {
      const total = entriesList.reduce((s, e) => s + e.amount, 0);
      grouped.push({ driver, entries: entriesList, total });
    });
    grouped.sort((a, b) => b.total - a.total || a.driver.localeCompare(b.driver));
    return grouped;
  }

  const currentGrouped = groupByDriver(currentEntries);
  const currentGrandTotal = currentEntries.reduce((s, e) => s + e.amount, 0);

  // Compute cumulative non-returned totals per driver across all loaded months
  const cumulatedTotals: { driver: string; total: number }[] = [];
  if (cumulatedData) {
    const cumulatedByDriver = new Map<string, number>();
    cumulatedData.forEach((monthData) => {
      const entries = collectEntries(monthData);
      entries.forEach((e) => {
        cumulatedByDriver.set(e.driver, (cumulatedByDriver.get(e.driver) || 0) + e.amount);
      });
    });
    cumulatedByDriver.forEach((total, driver) => {
      cumulatedTotals.push({ driver, total });
    });
    cumulatedTotals.sort((a, b) => b.total - a.total || a.driver.localeCompare(b.driver));
  }
  const cumulatedGrandTotal = cumulatedTotals.reduce((s, d) => s + d.total, 0);

  const fmtDate = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day);
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return `${days[d.getDay()]} ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
  };

  const currentMonthTable = () => (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-primary">
        Non-rendus — {MONTH_NAMES[data.month]} {data.year}
        {currentGrandTotal > 0 && (
          <span className="ml-2 text-destructive font-bold text-sm">
            ({fmt(currentGrandTotal)})
          </span>
        )}
      </h3>
      <table className="w-full border-collapse text-xs min-w-[800px]">
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
          {currentGrouped.length === 0 && (
            <tr>
              <td colSpan={5} className="border border-border px-3 py-4 text-center text-muted-foreground">
                Aucun non-rendu pour ce mois
              </td>
            </tr>
          )}
          {currentGrouped.map((g) => (
            <>
              {g.entries.map((e, i) => (
                <tr key={`c-${g.driver}-${e.day}-${e.category}-${e.paymentType}`} className="hover:bg-muted/50 transition-colors">
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
              {g.entries.length > 1 && (
                <tr className="bg-secondary/50">
                  <td colSpan={4} className="border border-border px-3 py-1 text-right font-semibold text-sm">Sous-total {g.driver}</td>
                  <td className="border border-border px-3 py-1 text-right font-bold text-destructive">{fmt(g.total)}</td>
                </tr>
              )}
            </>
          ))}
        </tbody>
        {currentGrouped.length > 0 && (
          <tfoot>
            <tr className="bg-grid-header text-grid-header-foreground font-bold">
              <td colSpan={4} className="border border-border px-3 py-1.5 text-right text-sm">TOTAL NON-RENDU</td>
              <td className="border border-border px-3 py-1.5 text-right text-sm">{fmt(currentGrandTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const cumulatedTable = () => (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-primary">
        Non-rendus cumulés depuis janvier {data.year}
        {cumulatedGrandTotal > 0 && (
          <span className="ml-2 text-destructive font-bold text-sm">
            ({fmt(cumulatedGrandTotal)})
          </span>
        )}
      </h3>
      <table className="w-full border-collapse text-xs min-w-[600px]">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-3 py-1.5 text-left">Chauffeur</th>
            <th className="border border-border px-3 py-1.5 text-right">Total non-rendu</th>
          </tr>
        </thead>
        <tbody>
          {cumulatedTotals.length === 0 && (
            <tr>
              <td colSpan={2} className="border border-border px-3 py-4 text-center text-muted-foreground">
                Aucun non-rendu cumulé
              </td>
            </tr>
          )}
          {cumulatedTotals.map((d) => (
            <tr key={`cum-${d.driver}`} className="hover:bg-muted/50 transition-colors">
              <td className="border border-border px-3 py-1 font-bold text-foreground">{d.driver}</td>
              <td className="border border-border px-3 py-1 text-right font-bold text-destructive">{fmt(d.total)}</td>
            </tr>
          ))}
        </tbody>
        {cumulatedTotals.length > 0 && (
          <tfoot>
            <tr className="bg-grid-header text-grid-header-foreground font-bold">
              <td className="border border-border px-3 py-1.5 text-right text-sm">TOTAL CUMULÉ</td>
              <td className="border border-border px-3 py-1.5 text-right text-sm">{fmt(cumulatedGrandTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
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

      {/* Section : mois courant */}
      <div className="bg-card rounded-lg border border-border p-3">
        {currentMonthTable()}
      </div>

      {/* Section : cumulé */}
      <div className="bg-card rounded-lg border border-border p-3">
        {cumulatedTable()}
      </div>
    </div>
  );
}