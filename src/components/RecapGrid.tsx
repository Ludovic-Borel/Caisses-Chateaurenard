import { CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MonthData, MONTH_NAMES, DriverMonthData } from "@/lib/types";

interface Props {
  data: MonthData;
  drivers: string[];
}

export default function RecapGrid({ data, drivers }: Props) {
  const daysInMonth = getDaysInMonth(data.year, data.month);

  const fmt = (v: number) => (v === 0 ? "—" : v.toFixed(2).replace(".", ",") + " €");

  // Merge active drivers with any historical drivers present in this month's data
  // so deleted drivers still appear in past months (history preserved).
  const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort();

  // Compute per-driver totals + non-returned amounts
  const driverTotals = allDrivers.map((driver) => {
    const driverData = data.drivers[driver];
    let totalEspeces = 0;
    let totalCB = 0;
    let totalNotReturned = 0;
    const categoryTotals: Record<string, { especes: number; cb: number }> = {};

    CATEGORIES.forEach((cat) => {
      let especes = 0;
      let cb = 0;
      if (driverData) {
        for (let d = 1; d <= daysInMonth; d++) {
          const eVal = driverData.days[d]?.[getCellKey(cat, "especes")] || 0;
          const cVal = driverData.days[d]?.[getCellKey(cat, "cb")] || 0;
          especes += eVal;
          cb += cVal;
          // Check non-returned
          if (driverData.notReturned?.[`${d}_${cat}_especes`] && eVal) totalNotReturned += eVal;
          if (driverData.notReturned?.[`${d}_${cat}_cb`] && cVal) totalNotReturned += cVal;
        }
      }
      categoryTotals[cat] = { especes, cb };
      totalEspeces += especes;
      totalCB += cb;
    });

    return { driver, categoryTotals, totalEspeces, totalCB, total: totalEspeces + totalCB, totalNotReturned };
  });

  const grandTotals = {
    especes: driverTotals.reduce((s, d) => s + d.totalEspeces, 0),
    cb: driverTotals.reduce((s, d) => s + d.totalCB, 0),
    total: driverTotals.reduce((s, d) => s + d.total, 0),
    notReturned: driverTotals.reduce((s, d) => s + d.totalNotReturned, 0),
  };

  // Compute per-day per-category totals split by payment type (sum across all drivers)
  const dailyByCategory: Record<number, Record<string, { especes: number; cb: number }>> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    dailyByCategory[d] = {};
    CATEGORIES.forEach((cat) => {
      let e = 0, c = 0;
      allDrivers.forEach((driver) => {
        const dd = data.drivers[driver];
        if (!dd) return;
        e += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
        c += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
      });
      dailyByCategory[d][cat] = { especes: e, cb: c };
    });
  }

  const categoryDayTotals: Record<string, { especes: number; cb: number }> = {};
  CATEGORIES.forEach((cat) => {
    let e = 0, c = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      e += dailyByCategory[d][cat].especes;
      c += dailyByCategory[d][cat].cb;
    }
    categoryDayTotals[cat] = { especes: e, cb: c };
  });
  const dayGrandTotals: Record<number, { especes: number; cb: number; total: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const e = CATEGORIES.reduce((s, c) => s + dailyByCategory[d][c].especes, 0);
    const c = CATEGORIES.reduce((s, cat) => s + dailyByCategory[d][cat].cb, 0);
    dayGrandTotals[d] = { especes: e, cb: c, total: e + c };
  }
  const overallDaily = {
    especes: Object.values(dayGrandTotals).reduce((s, v) => s + v.especes, 0),
    cb: Object.values(dayGrandTotals).reduce((s, v) => s + v.cb, 0),
    total: Object.values(dayGrandTotals).reduce((s, v) => s + v.total, 0),
  };

  return (
    <div className="overflow-x-auto space-y-8">
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
            <th className="border border-border px-2 py-1.5 text-center text-destructive">Non rendu</th>
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
            <th className="border border-border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {driverTotals.map((dt) => (
            <tr key={dt.driver} className="hover:bg-muted/50 transition-colors">
              <td className={`border border-border px-3 py-1 font-medium ${dt.totalNotReturned > 0 ? "bg-destructive/15 text-destructive font-bold" : "text-foreground"}`}>
                {dt.driver}
              </td>
              {CATEGORIES.map((cat) => (
                <>
                  <td key={`${dt.driver}-${cat}-e`} className="border border-border px-1 py-1 bg-grid-especes/50 text-center">
                    {fmt(dt.categoryTotals[cat].especes)}
                  </td>
                  <td key={`${dt.driver}-${cat}-c`} className="border border-border px-1 py-1 bg-grid-cb/50 text-center">
                    {fmt(dt.categoryTotals[cat].cb)}
                  </td>
                </>
              ))}
              <td className="border border-border px-2 py-1 font-medium text-center">
                {fmt(dt.totalEspeces)}
              </td>
              <td className="border border-border px-2 py-1 font-medium text-center">
                {fmt(dt.totalCB)}
              </td>
              <td className="border border-border px-2 py-1 font-bold bg-grid-total text-center">
                {fmt(dt.total)}
              </td>
              <td className={`border border-border px-2 py-1 text-center font-bold ${dt.totalNotReturned > 0 ? "text-destructive" : ""}`}>
                {dt.totalNotReturned > 0 ? fmt(dt.totalNotReturned) : "—"}
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
                  <td key={`t-${cat}-e`} className="border border-border px-1 py-1 text-center">{fmt(catE)}</td>
                  <td key={`t-${cat}-c`} className="border border-border px-1 py-1 text-center">{fmt(catC)}</td>
                </>
              );
            })}
            <td className="border border-border px-2 py-1 font-medium text-center">{fmt(grandTotals.especes)}</td>
            <td className="border border-border px-2 py-1 font-medium text-center">{fmt(grandTotals.cb)}</td>
            <td className="border border-border px-2 py-1 font-medium text-center">{fmt(grandTotals.total)}</td>
            <td className={`border border-border px-2 py-1 text-center font-bold ${grandTotals.notReturned > 0 ? "text-destructive" : ""}`}>
              {grandTotals.notReturned > 0 ? fmt(grandTotals.notReturned) : "—"}
            </td>
          </tr>
          <tr className="bg-secondary text-secondary-foreground font-bold">
            <td className="border border-border px-3 py-1.5">TOTAL Esp.+CB</td>
            {CATEGORIES.map((cat) => {
              const catE = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].especes, 0);
              const catC = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].cb, 0);
              return (
                <td key={`t-sum-${cat}`} colSpan={2} className="border border-border px-1 py-1.5 bg-grid-total text-center">
                  {fmt(catE + catC)}
                </td>
              );
            })}
            <td colSpan={4} className="border border-border px-1 py-1.5 bg-grid-total text-center">
              {fmt(grandTotals.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div>
        <h3 className="text-base font-bold text-primary mb-3">
          Recettes par ligne et par jour
        </h3>
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-grid-header text-grid-header-foreground">
              <th rowSpan={2} className="border border-border px-3 py-1.5 text-left align-middle">Jour</th>
              {CATEGORIES.map((cat) => (
                <th key={`d-h-${cat}`} colSpan={2} className="border border-border px-2 py-1.5 text-center">
                  {cat}
                </th>
              ))}
              <th rowSpan={2} className="border border-border px-2 py-1.5 text-center align-middle">Espèces</th>
              <th rowSpan={2} className="border border-border px-2 py-1.5 text-center align-middle">CB</th>
              <th rowSpan={2} className="border border-border px-2 py-1.5 text-center align-middle">Total Esp.+CB</th>
            </tr>
            <tr className="bg-secondary text-secondary-foreground">
              {CATEGORIES.map((cat) => (
                <>
                  <th key={`d-h-${cat}-e`} className="border border-border px-1 py-1 text-center bg-grid-especes text-foreground font-medium text-[10px]">Esp.</th>
                  <th key={`d-h-${cat}-c`} className="border border-border px-1 py-1 text-center bg-grid-cb text-foreground font-medium text-[10px]">CB</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <tr key={`day-${d}`} className="hover:bg-muted/50 transition-colors">
                <td className="border border-border px-3 py-1 font-medium text-foreground text-center">{d}</td>
                {CATEGORIES.map((cat) => (
                  <>
                    <td key={`day-${d}-${cat}-e`} className="border border-border px-1 py-1 bg-grid-especes/50 text-center">
                      {dailyByCategory[d][cat].especes > 0 ? fmt(dailyByCategory[d][cat].especes) : "—"}
                    </td>
                    <td key={`day-${d}-${cat}-c`} className="border border-border px-1 py-1 bg-grid-cb/50 text-center">
                      {dailyByCategory[d][cat].cb > 0 ? fmt(dailyByCategory[d][cat].cb) : "—"}
                    </td>
                  </>
                ))}
                <td className="border border-border px-2 py-1 font-medium text-center">
                  {dayGrandTotals[d].especes > 0 ? fmt(dayGrandTotals[d].especes) : "—"}
                </td>
                <td className="border border-border px-2 py-1 font-medium text-center">
                  {dayGrandTotals[d].cb > 0 ? fmt(dayGrandTotals[d].cb) : "—"}
                </td>
                <td className="border border-border px-2 py-1 font-bold bg-grid-total text-center">
                  {dayGrandTotals[d].total > 0 ? fmt(dayGrandTotals[d].total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-grid-header text-grid-header-foreground font-bold">
              <td className="border border-border px-3 py-1.5">TOTAL</td>
              {CATEGORIES.map((cat) => (
                <>
                  <td key={`day-t-${cat}-e`} className="border border-border px-1 py-1 text-center">{fmt(categoryDayTotals[cat].especes)}</td>
                  <td key={`day-t-${cat}-c`} className="border border-border px-1 py-1 text-center">{fmt(categoryDayTotals[cat].cb)}</td>
                </>
              ))}
              <td className="border border-border px-2 py-1 font-medium text-center">{fmt(overallDaily.especes)}</td>
              <td className="border border-border px-2 py-1 font-medium text-center">{fmt(overallDaily.cb)}</td>
              <td className="border border-border px-2 py-1 font-medium text-center">{fmt(overallDaily.total)}</td>
            </tr>
            <tr className="bg-secondary text-secondary-foreground font-bold">
              <td className="border border-border px-3 py-1.5">TOTAL Esp.+CB</td>
              {CATEGORIES.map((cat) => (
                <td key={`day-t-sum-${cat}`} colSpan={2} className="border border-border px-1 py-1.5 bg-grid-total text-center">
                  {fmt(categoryDayTotals[cat].especes + categoryDayTotals[cat].cb)}
                </td>
              ))}
              <td colSpan={3} className="border border-border px-1 py-1.5 bg-grid-total text-center">
                {fmt(overallDaily.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
