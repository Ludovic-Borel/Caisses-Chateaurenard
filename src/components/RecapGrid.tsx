import { CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, MonthData, MONTH_NAMES, DriverMonthData } from "@/lib/types";

interface Props {
  data: MonthData;
  drivers: string[];
  extractionMode?: boolean;
}

export default function RecapGrid({ data, drivers, extractionMode = false }: Props) {
  const daysInMonth = getDaysInMonth(data.year, data.month);

  const fmt = (v: number) => (v === 0 ? "—" : v.toFixed(2).replace(".", ",") + " €");

  // Merge active drivers with any historical drivers present in this month's data
  const allDrivers = Array.from(new Set([...drivers, ...Object.keys(data.drivers || {})])).sort();

  // Compute per-driver totals + non-returned amounts + extract totals
  const driverTotals = allDrivers.map((driver) => {
    const driverData = data.drivers[driver];
    let totalEspeces = 0;
    let totalCB = 0;
    let totalNotReturned = 0;
    const categoryTotals: Record<string, { especes: number; cb: number; extEspeces: number; extCb: number }> = {};

    CATEGORIES.forEach((cat) => {
      let especes = 0;
      let cb = 0;
      let extEspeces = 0;
      let extCb = 0;
      if (driverData) {
        for (let d = 1; d <= daysInMonth; d++) {
          const eVal = driverData.days[d]?.[getCellKey(cat, "especes")] || 0;
          const cVal = driverData.days[d]?.[getCellKey(cat, "cb")] || 0;
          especes += eVal;
          cb += cVal;
          // Extraction data
          extEspeces += driverData.extracts?.[d]?.[getCellKey(cat, "especes")] || 0;
          extCb += driverData.extracts?.[d]?.[getCellKey(cat, "cb")] || 0;
          // Check non-returned
          if (driverData.notReturned?.[`${d}_${cat}_especes`] && eVal) totalNotReturned += eVal;
          if (driverData.notReturned?.[`${d}_${cat}_cb`] && cVal) totalNotReturned += cVal;
        }
      }
      categoryTotals[cat] = { especes, cb, extEspeces, extCb };
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

  // Grand totals for extraction
  const grandExtEspeces = driverTotals.reduce((s, d) => s + CATEGORIES.reduce((s2, cat) => s2 + d.categoryTotals[cat].extEspeces, 0), 0);
  const grandExtCb = driverTotals.reduce((s, d) => s + CATEGORIES.reduce((s2, cat) => s2 + d.categoryTotals[cat].extCb, 0), 0);

  // Determine cell style for extraction columns
  function getExtractDiffStyle(entered: number, extract: number): string {
    if (extract === 0 && entered === 0) return "";
    if (extract === 0 && entered > 0) return ""; // No extract data, don't highlight
    if (entered > 0 && extract > 0 && Math.abs(entered - extract) <= 0.01) return "bg-grid-match"; // Vert = match
    if (entered > 0 && extract > 0 && Math.abs(entered - extract) > 0.01) {
      // Check if totals match but cells differ (orange)
      return "bg-grid-orange"; // Orange = mismatch
    }
    if (entered === 0 && extract > 0) return "bg-grid-mismatch"; // Rouge = missing entry
    return "";
  }

  // Compute per-day per-category totals (with extracts)
  const dailyByCategory: Record<number, Record<string, { especes: number; cb: number; extEspeces: number; extCb: number }>> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    dailyByCategory[d] = {};
    CATEGORIES.forEach((cat) => {
      let e = 0, c = 0, xe = 0, xc = 0;
      allDrivers.forEach((driver) => {
        const dd = data.drivers[driver];
        if (!dd) return;
        e += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
        c += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
        xe += dd.extracts?.[d]?.[getCellKey(cat, "especes")] || 0;
        xc += dd.extracts?.[d]?.[getCellKey(cat, "cb")] || 0;
      });
      dailyByCategory[d][cat] = { especes: e, cb: c, extEspeces: xe, extCb: xc };
    });
  }

  const categoryDayTotals: Record<string, { especes: number; cb: number; extEspeces: number; extCb: number }> = {};
  CATEGORIES.forEach((cat) => {
    let e = 0, c = 0, xe = 0, xc = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      e += dailyByCategory[d][cat].especes;
      c += dailyByCategory[d][cat].cb;
      xe += dailyByCategory[d][cat].extEspeces;
      xc += dailyByCategory[d][cat].extCb;
    }
    categoryDayTotals[cat] = { especes: e, cb: c, extEspeces: xe, extCb: xc };
  });

  const dayGrandTotals: Record<number, { especes: number; cb: number; total: number; extEspeces: number; extCb: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const e = CATEGORIES.reduce((s, c) => s + dailyByCategory[d][c].especes, 0);
    const cb = CATEGORIES.reduce((s, cat) => s + dailyByCategory[d][cat].cb, 0);
    const xe = CATEGORIES.reduce((s, cat) => s + dailyByCategory[d][cat].extEspeces, 0);
    const xc = CATEGORIES.reduce((s, cat) => s + dailyByCategory[d][cat].extCb, 0);
    dayGrandTotals[d] = { especes: e, cb, total: e + cb, extEspeces: xe, extCb: xc };
  }

  const overallDaily = {
    especes: Object.values(dayGrandTotals).reduce((s, v) => s + v.especes, 0),
    cb: Object.values(dayGrandTotals).reduce((s, v) => s + v.cb, 0),
    total: Object.values(dayGrandTotals).reduce((s, v) => s + v.total, 0),
    extEspeces: Object.values(dayGrandTotals).reduce((s, v) => s + v.extEspeces, 0),
    extCb: Object.values(dayGrandTotals).reduce((s, v) => s + v.extCb, 0),
  };

  const DAY_COLS = extractionMode ? 4 : 2; // Esp/CB or Esp/CB/ExtEsp/ExtCB per category

  return (
    <div className="overflow-x-auto space-y-8">
      <h2 className="text-lg font-bold text-primary mb-3">
        Récapitulatif — {MONTH_NAMES[data.month]} {data.year}
        {extractionMode && <span className="ml-2 text-xs font-normal text-muted-foreground">(mode extraction)</span>}
      </h2>

      {/* ====== TABLEAU 1 : PAR CHAUFFEUR ====== */}
      <table className="w-full text-xs border-collapse min-w-[900px] table-auto">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-2 py-1.5 text-left w-[140px]">Chauffeur</th>
            {CATEGORIES.map((cat) => (
              <th key={cat} colSpan={extractionMode ? 4 : 2} className="border border-border px-1 py-1.5 text-center min-w-[130px]">
                {cat}
              </th>
            ))}
            <th className="border border-border px-1.5 py-1.5 text-center min-w-[70px]">Espèces</th>
            <th className="border border-border px-1.5 py-1.5 text-center min-w-[70px]">CB</th>
            <th className="border border-border px-1.5 py-1.5 text-center min-w-[70px]">Total</th>
            <th className="border border-border px-1.5 py-1.5 text-center min-w-[75px]">Non rendu</th>
          </tr>
          <tr className="bg-secondary text-secondary-foreground">
            <th className="border border-border px-2 py-1"></th>
            {CATEGORIES.map((cat) => (
              <>
                <th key={`${cat}-e`} className="border border-border px-0.5 py-1 text-center bg-grid-especes text-foreground font-medium text-[10px] min-w-[44px]">
                  Esp.
                </th>
                <th key={`${cat}-c`} className="border border-border px-0.5 py-1 text-center bg-grid-cb text-foreground font-medium text-[10px] min-w-[44px]">
                  CB
                </th>
                {extractionMode && (
                  <>
                    <th key={`${cat}-xe`} className="border border-border px-0.5 py-1 text-center bg-grid-extract text-foreground font-medium text-[10px] min-w-[44px]">
                      Ext. Esp.
                    </th>
                    <th key={`${cat}-xc`} className="border border-border px-0.5 py-1 text-center bg-grid-extract text-foreground font-medium text-[10px] min-w-[44px]">
                      Ext. CB
                    </th>
                  </>
                )}
              </>
            ))}
            <th className="border border-border px-1.5 py-1"></th>
            <th className="border border-border px-1.5 py-1"></th>
            <th className="border border-border px-1.5 py-1"></th>
            <th className="border border-border px-1.5 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {driverTotals.map((dt) => (
            <tr key={dt.driver} className="hover:bg-muted/50 transition-colors grid-row">
              <td className={`border border-border px-2 py-1 font-medium text-[11px] ${dt.totalNotReturned > 0 ? "bg-destructive/15 font-bold" : "text-foreground"}`}>
                {dt.driver}
              </td>
              {CATEGORIES.map((cat) => {
                const catTotal = dt.categoryTotals[cat];
                const enteredTotal = catTotal.especes + catTotal.cb;
                const extTotal = catTotal.extEspeces + catTotal.extCb;
                const hasBoth = enteredTotal > 0 && extTotal > 0;
                const totalsMatch = hasBoth && Math.abs(enteredTotal - extTotal) <= 0.01;
                const cellsDiffer = hasBoth && (Math.abs(catTotal.especes - catTotal.extEspeces) > 0.01 || Math.abs(catTotal.cb - catTotal.extCb) > 0.01);
                const isOrange = hasBoth && totalsMatch && cellsDiffer;
                return (
                  <>
                    <td key={`${dt.driver}-${cat}-e`} className="border border-border px-0.5 py-1 bg-grid-especes/50 text-center text-[11px]">
                      {fmt(catTotal.especes)}
                    </td>
                    <td key={`${dt.driver}-${cat}-c`} className="border border-border px-0.5 py-1 bg-grid-cb/50 text-center text-[11px]">
                      {fmt(catTotal.cb)}
                    </td>
                    {extractionMode && (
                      <>
                        <td key={`${dt.driver}-${cat}-xe`} className={`border border-border px-0.5 py-1 text-center text-[11px] ${getExtractDiffStyle(catTotal.especes, catTotal.extEspeces)}`}>
                          {catTotal.extEspeces > 0 ? fmt(catTotal.extEspeces) : "—"}
                        </td>
                        <td key={`${dt.driver}-${cat}-xc`} className={`border border-border px-0.5 py-1 text-center text-[11px] ${getExtractDiffStyle(catTotal.cb, catTotal.extCb)}`}>
                          {catTotal.extCb > 0 ? fmt(catTotal.extCb) : "—"}
                        </td>
                      </>
                    )}
                  </>
                );
              })}
              <td className="border border-border px-1.5 py-1 font-medium text-center text-[11px]">
                {fmt(dt.totalEspeces)}
              </td>
              <td className="border border-border px-1.5 py-1 font-medium text-center text-[11px]">
                {fmt(dt.totalCB)}
              </td>
              <td className="border border-border px-1.5 py-1 font-bold bg-grid-total text-center text-[11px]">
                {fmt(dt.total)}
              </td>
              <td className={`border border-border px-1.5 py-1 text-center font-bold text-[11px]`}>
                {dt.totalNotReturned > 0 ? fmt(dt.totalNotReturned) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-grid-header text-grid-header-foreground font-bold">
            <td className="border border-border px-2 py-1.5">TOTAL</td>
            {CATEGORIES.map((cat) => {
              const catE = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].especes, 0);
              const catC = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].cb, 0);
              const catXE = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].extEspeces, 0);
              const catXC = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].extCb, 0);
              return (
                <>
                  <td key={`t-${cat}-e`} className="border border-border px-0.5 py-1 text-center">{fmt(catE)}</td>
                  <td key={`t-${cat}-c`} className="border border-border px-0.5 py-1 text-center">{fmt(catC)}</td>
                  {extractionMode && (
                    <>
                      <td key={`t-${cat}-xe`} className="border border-border px-0.5 py-1 text-center bg-grid-extract bg-opacity-30">{catXE > 0 ? fmt(catXE) : "—"}</td>
                      <td key={`t-${cat}-xc`} className="border border-border px-0.5 py-1 text-center bg-grid-extract bg-opacity-30">{catXC > 0 ? fmt(catXC) : "—"}</td>
                    </>
                  )}
                </>
              );
            })}
            <td className="border border-border px-1.5 py-1 font-medium text-center">{fmt(grandTotals.especes)}</td>
            <td className="border border-border px-1.5 py-1 font-medium text-center">{fmt(grandTotals.cb)}</td>
            <td className="border border-border px-1.5 py-1 font-medium text-center">{fmt(grandTotals.total)}</td>
            <td className={`border border-border px-1.5 py-1 text-center font-bold`}>
              {grandTotals.notReturned > 0 ? fmt(grandTotals.notReturned) : "—"}
            </td>
          </tr>
          <tr className="bg-secondary text-secondary-foreground font-bold">
            <td className="border border-border px-2 py-1.5">TOTAL Esp.+CB</td>
            {CATEGORIES.map((cat) => {
              const catE = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].especes, 0);
              const catC = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].cb, 0);
              const catTot = catE + catC;
              return (
                <td key={`t-sum-${cat}`} colSpan={extractionMode ? 4 : 2} className="border border-border px-0.5 py-1.5 bg-grid-total text-center">
                  {fmt(catTot)}
                </td>
              );
            })}
            <td colSpan={4} className="border border-border px-1 py-1.5 bg-grid-total text-center">
              {fmt(grandTotals.total)}
            </td>
          </tr>
          {extractionMode && (
            <tr className="bg-grid-extract/30 text-foreground font-bold">
              <td className="border border-border px-2 py-1.5">TOTAL Ext. Esp.+CB</td>
              {CATEGORIES.map((cat) => {
                const catXE = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].extEspeces, 0);
                const catXC = driverTotals.reduce((s, d) => s + d.categoryTotals[cat].extCb, 0);
                const catXTot = catXE + catXC;
                return (
                  <td key={`t-xsum-${cat}`} colSpan={4} className="border border-border px-0.5 py-1.5 bg-grid-total text-center">
                    {catXTot > 0 ? fmt(catXTot) : "—"}
                  </td>
                );
              })}
              <td colSpan={4} className="border border-border px-1 py-1.5 bg-grid-total text-center">
                {grandExtEspeces + grandExtCb > 0 ? fmt(grandExtEspeces + grandExtCb) : "—"}
              </td>
            </tr>
          )}
        </tfoot>
      </table>

      {/* ====== TABLEAU 2 : PAR JOUR ====== */}
      <div>
        <h3 className="text-base font-bold text-primary mb-3">
          Recettes par ligne et par jour
          {extractionMode && <span className="ml-2 text-xs font-normal text-muted-foreground">(mode extraction)</span>}
        </h3>
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-grid-header text-grid-header-foreground">
              <th rowSpan={2} className="border border-border px-3 py-1.5 text-left align-middle">Date</th>
              {CATEGORIES.map((cat) => (
                <th key={`d-h-${cat}`} colSpan={extractionMode ? 4 : 2} className="border border-border px-2 py-1.5 text-center">
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
                  {extractionMode && (
                    <>
                      <th key={`d-h-${cat}-xe`} className="border border-border px-1 py-1 text-center bg-grid-extract text-foreground font-medium text-[10px]">Ext. Esp.</th>
                      <th key={`d-h-${cat}-xc`} className="border border-border px-1 py-1 text-center bg-grid-extract text-foreground font-medium text-[10px]">Ext. CB</th>
                    </>
                  )}
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <tr key={`day-${d}`} className="hover:bg-muted/50 transition-colors">
                <td className="border border-border px-3 py-1 font-medium text-foreground text-center">
                  {(() => {
                    const dt = new Date(data.year, data.month, d);
                    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
                    return `${days[dt.getDay()]} ${String(d).padStart(2,"0")}/${String(data.month+1).padStart(2,"0")}`;
                  })()}
                </td>
                {CATEGORIES.map((cat) => (
                  <>
                    <td key={`day-${d}-${cat}-e`} className="border border-border px-1 py-1 bg-grid-especes/50 text-center">
                      {dailyByCategory[d][cat].especes > 0 ? fmt(dailyByCategory[d][cat].especes) : "—"}
                    </td>
                    <td key={`day-${d}-${cat}-c`} className="border border-border px-1 py-1 bg-grid-cb/50 text-center">
                      {dailyByCategory[d][cat].cb > 0 ? fmt(dailyByCategory[d][cat].cb) : "—"}
                    </td>
                    {extractionMode && (
                      <>
                        <td key={`day-${d}-${cat}-xe`} className={`border border-border px-1 py-1 text-center ${getExtractDiffStyle(dailyByCategory[d][cat].especes, dailyByCategory[d][cat].extEspeces)}`}>
                          {dailyByCategory[d][cat].extEspeces > 0 ? fmt(dailyByCategory[d][cat].extEspeces) : "—"}
                        </td>
                        <td key={`day-${d}-${cat}-xc`} className={`border border-border px-1 py-1 text-center ${getExtractDiffStyle(dailyByCategory[d][cat].cb, dailyByCategory[d][cat].extCb)}`}>
                          {dailyByCategory[d][cat].extCb > 0 ? fmt(dailyByCategory[d][cat].extCb) : "—"}
                        </td>
                      </>
                    )}
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
                  {extractionMode && (
                    <>
                      <td key={`day-t-${cat}-xe`} className="border border-border px-1 py-1 text-center bg-grid-extract/30">{categoryDayTotals[cat].extEspeces > 0 ? fmt(categoryDayTotals[cat].extEspeces) : "—"}</td>
                      <td key={`day-t-${cat}-xc`} className="border border-border px-1 py-1 text-center bg-grid-extract/30">{categoryDayTotals[cat].extCb > 0 ? fmt(categoryDayTotals[cat].extCb) : "—"}</td>
                    </>
                  )}
                </>
              ))}
              <td className="border border-border px-2 py-1 font-medium text-center">{fmt(overallDaily.especes)}</td>
              <td className="border border-border px-2 py-1 font-medium text-center">{fmt(overallDaily.cb)}</td>
              <td className="border border-border px-2 py-1 font-medium text-center">{fmt(overallDaily.total)}</td>
            </tr>
            <tr className="bg-secondary text-secondary-foreground font-bold">
              <td className="border border-border px-3 py-1.5">TOTAL Esp.+CB</td>
              {CATEGORIES.map((cat) => (
                <td key={`day-t-sum-${cat}`} colSpan={extractionMode ? 4 : 2} className="border border-border px-1 py-1.5 bg-grid-total text-center">
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