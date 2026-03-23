import { CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MonthData, MONTH_NAMES, DriverMonthData } from "@/lib/types";

interface Props {
  data: MonthData;
  drivers: string[];
}

export default function RecapGrid({ data, drivers }: Props) {
  const daysInMonth = getDaysInMonth(data.year, data.month);

  // Compute per-driver totals
  const driverTotals = drivers.map((driver) => {
    const driverData = data.drivers[driver];
    let totalEspeces = 0;
    let totalCB = 0;
    const categoryTotals: Record<string, { especes: number; cb: number }> = {};

    CATEGORIES.forEach((cat) => {
      let especes = 0;
      let cb = 0;
      if (driverData) {
        for (let d = 1; d <= daysInMonth; d++) {
          especes += driverData.days[d]?.[getCellKey(cat, "especes")] || 0;
          cb += driverData.days[d]?.[getCellKey(cat, "cb")] || 0;
        }
      }
      categoryTotals[cat] = { especes, cb };
      totalEspeces += especes;
      totalCB += cb;
    });

    return { driver, categoryTotals, totalEspeces, totalCB, total: totalEspeces + totalCB };
  });

  const grandTotals = {
    especes: driverTotals.reduce((s, d) => s + d.totalEspeces, 0),
    cb: driverTotals.reduce((s, d) => s + d.totalCB, 0),
    total: driverTotals.reduce((s, d) => s + d.total, 0),
  };

  const fmt = (v: number) => (v ? v.toFixed(2) + " €" : "");

  // Only show drivers that have data
  const activeDrivers = driverTotals.filter((d) => d.total > 0);

  return (
    <div className="overflow-x-auto">
      <h2 className="text-lg font-bold text-primary mb-3">
        Récapitulatif — {MONTH_NAMES[data.month]} {data.year}
      </h2>
      <table className="w-full text-xs border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-3 py-1.5 text-left">Chauffeur</th>
            {CATEGORIES.map((cat) => (
              <th key={cat} colSpan={2} className="border border-border px-2 py-1.5 text-center">
                {cat}
              </th>
            ))}
            <th className="border border-border px-2 py-1.5 text-center">Espèces</th>
            <th className="border border-border px-2 py-1.5 text-center">CB</th>
            <th className="border border-border px-2 py-1.5 text-center">Total</th>
          </tr>
          <tr className="bg-secondary text-secondary-foreground">
            <th className="border border-border px-3 py-1"></th>
            {CATEGORIES.map((cat) => (
              <>
                <th key={`${cat}-e`} className="border border-border px-1 py-1 text-center bg-grid-especes text-foreground font-medium text-[10px]">
                  Esp.
                </th>
                <th key={`${cat}-c`} className="border border-border px-1 py-1 text-center bg-grid-cb text-foreground font-medium text-[10px]">
                  CB
                </th>
              </>
            ))}
            <th className="border border-border px-2 py-1"></th>
            <th className="border border-border px-2 py-1"></th>
            <th className="border border-border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {(activeDrivers.length > 0 ? activeDrivers : driverTotals.slice(0, 10)).map((dt) => (
            <tr key={dt.driver} className="hover:bg-muted/50 transition-colors">
              <td className="border border-border px-3 py-1 font-medium text-foreground">
                {dt.driver}
              </td>
              {CATEGORIES.map((cat) => (
                <>
                  <td key={`${dt.driver}-${cat}-e`} className="border border-border px-1 py-1 text-right bg-grid-especes/50">
                    {fmt(dt.categoryTotals[cat].especes)}
                  </td>
                  <td key={`${dt.driver}-${cat}-c`} className="border border-border px-1 py-1 text-right bg-grid-cb/50">
                    {fmt(dt.categoryTotals[cat].cb)}
                  </td>
                </>
              ))}
              <td className="border border-border px-2 py-1 text-right font-medium">
                {fmt(dt.totalEspeces)}
              </td>
              <td className="border border-border px-2 py-1 text-right font-medium">
                {fmt(dt.totalCB)}
              </td>
              <td className="border border-border px-2 py-1 text-right font-bold bg-grid-total">
                {fmt(dt.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-grid-header text-grid-header-foreground font-bold">
            <td className="border border-border px-3 py-1.5">TOTAL</td>
            {CATEGORIES.map((cat) => {
              const catE = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].especes, 0);
              const catC = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].cb, 0);
              return (
                <>
                  <td key={`t-${cat}-e`} className="border border-border px-1 py-1.5 text-right">{fmt(catE)}</td>
                  <td key={`t-${cat}-c`} className="border border-border px-1 py-1.5 text-right">{fmt(catC)}</td>
                </>
              );
            })}
            <td className="border border-border px-2 py-1.5 text-right">{fmt(grandTotals.especes)}</td>
            <td className="border border-border px-2 py-1.5 text-right">{fmt(grandTotals.cb)}</td>
            <td className="border border-border px-2 py-1.5 text-right">{fmt(grandTotals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
