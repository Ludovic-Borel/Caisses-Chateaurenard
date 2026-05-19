import { useCallback, useState } from "react";
import { CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, DriverMonthData, MONTH_NAMES } from "@/lib/types";

interface Props {
  data: DriverMonthData;
  daysInMonth: number;
  year: number;
  month: number; // 0-11
  title?: string;
  onChange?: (data: DriverMonthData) => void;
  readOnly?: boolean;
  extractionMode?: boolean;
}

const fmtDate = (year: number, month: number, day: number) =>
  `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;

export default function RevenueGrid({ data, daysInMonth, year, month, title, onChange, readOnly = false, extractionMode = false }: Props) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const isHoverDisabled = extractionMode;

  const getValue = (day: number, cat: string, pt: string): number => {
    return data.days[day]?.[getCellKey(cat as any, pt as any)] || 0;
  };

  const getNrKey = (day: number, cat: string, pt: string) => `${day}_${cat}_${pt}`;

  const isNotReturned = (day: number, cat: string, pt: string): boolean => {
    return !!data.notReturned?.[getNrKey(day, cat, pt)];
  };

  const toggleNotReturned = useCallback(
    (day: number, cat: string, pt: string) => {
      if (!onChange || readOnly) return;
      const key = getNrKey(day, cat, pt);
      const nr = { ...(data.notReturned || {}) };
      if (nr[key]) {
        delete nr[key];
      } else {
        nr[key] = true;
      }
      onChange({ ...data, notReturned: nr });
    },
    [data, onChange, readOnly]
  );

  const setValue = useCallback(
    (day: number, cat: string, pt: string, value: number) => {
      if (!onChange) return;
      const key = getCellKey(cat as any, pt as any);
      const dayEntry = { ...(data.days[day] || {}), [key]: value };
      onChange({ ...data, days: { ...data.days, [day]: dayEntry } });
    },
    [data, onChange]
  );

  const getExtract = (day: number, cat: string, pt: string): number => {
    return data.extracts?.[day]?.[getCellKey(cat as any, pt as any)] || 0;
  };

  const setExtract = useCallback(
    (day: number, cat: string, pt: string, value: number) => {
      if (!onChange) return;
      const key = getCellKey(cat as any, pt as any);
      const dayExtracts = { ...(data.extracts?.[day] || {}) };
      if (value) dayExtracts[key] = value;
      else delete dayExtracts[key];
      const newExtracts = { ...(data.extracts || {}), [day]: dayExtracts };
      onChange({ ...data, extracts: newExtracts });
    },
    [data, onChange]
  );

  // Copy exact extraction values to the entered (Esp./CB) cells for a given day + category
  // Sets both cells to exactly match the extract values (including zeros)
  const copyExtractToEntered = useCallback(
    (day: number, cat: string) => {
      if (!onChange) return;
      const espKey = getCellKey(cat as any, "especes" as any);
      const cbKey = getCellKey(cat as any, "cb" as any);
      const extracts = data.extracts?.[day];
      if (!extracts) return;
      const xEsp = extracts[espKey] || 0;
      const xCb = extracts[cbKey] || 0;
      const dayEntry = { ...(data.days[day] || {}) };
      dayEntry[espKey] = xEsp;
      dayEntry[cbKey] = xCb;
      onChange({ ...data, days: { ...data.days, [day]: dayEntry } });
    },
    [data, onChange]
  );

  const getColumnExtractTotal = (cat: string, pt: string): number => {
    let t = 0;
    const key = getCellKey(cat as any, pt as any);
    for (let d = 1; d <= daysInMonth; d++) t += data.extracts?.[d]?.[key] || 0;
    return t;
  };

  const getDayTotal = (day: number): number => {
    const entry = data.days[day];
    if (!entry) return 0;
    return Object.values(entry).reduce((s, v) => s + (v || 0), 0);
  };

  const getColumnTotal = (cat: string, pt: string): number => {
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) total += getValue(d, cat, pt);
    return total;
  };

  const getGrandTotal = (): number => {
    return CATEGORIES.reduce(
      (s, cat) => s + PAYMENT_TYPES.reduce((s2, pt) => s2 + getColumnTotal(cat, pt), 0),
      0
    );
  };

  const getTotalEspeces = (): number =>
    CATEGORIES.reduce((s, cat) => s + getColumnTotal(cat, "especes"), 0);

  const getTotalCB = (): number =>
    CATEGORIES.reduce((s, cat) => s + getColumnTotal(cat, "cb"), 0);

  const fmt = (v: number) => v.toFixed(2).replace(".", ",") + " €";

  const hlBg = "hsl(var(--grid-highlight))";

  return (
    <div className="overflow-x-auto" onMouseLeave={() => { setHoverDay(null); setHoverCol(null); }}>
      {title && <h2 className="text-lg font-bold text-primary mb-3">{title}</h2>}
      <table className="w-full text-xs border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-2 py-1.5 text-left w-24">Date</th>
            {CATEGORIES.map((cat) => (
              <th
                key={cat}
                colSpan={extractionMode ? 4 : 2}
                className="border border-border px-2 py-1.5 text-center"
              >
                {cat}
              </th>
            ))}
            <th className="border border-border px-2 py-1.5 text-center w-20">Total</th>
          </tr>
          <tr className="bg-secondary text-secondary-foreground">
            <th className="border border-border px-2 py-1"></th>
            {CATEGORIES.map((cat) => (
              <>
                <th
                  key={`${cat}-e`}
                  className="border border-border px-1 py-1 text-center bg-grid-especes text-foreground font-medium transition-colors duration-150"
                  style={!isHoverDisabled && hoverCol === `${cat}_especes` ? { backgroundColor: hlBg } : undefined}
                >
                  Esp.
                </th>
                <th
                  key={`${cat}-c`}
                  className="border border-border px-1 py-1 text-center bg-grid-cb text-foreground font-medium transition-colors duration-150"
                  style={!isHoverDisabled && hoverCol === `${cat}_cb` ? { backgroundColor: hlBg } : undefined}
                >
                  CB
                </th>
                {extractionMode && (
                  <>
                    <th
                      key={`${cat}-xe`}
                      className="border border-border px-1 py-1 text-center bg-grid-extract text-foreground font-medium transition-colors duration-150"
                      style={!isHoverDisabled && hoverCol === `${cat}_extract_especes` ? { backgroundColor: hlBg } : undefined}
                    >
                      Ext. Esp.
                    </th>
                    <th
                      key={`${cat}-xc`}
                      className="border border-border px-1 py-1 text-center bg-grid-extract text-foreground font-medium transition-colors duration-150"
                      style={!isHoverDisabled && hoverCol === `${cat}_extract_cb` ? { backgroundColor: hlBg } : undefined}
                    >
                      Ext. CB
                    </th>
                  </>
                )}
              </>
            ))}
            <th className="border border-border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <tr key={day} className="transition-colors duration-150" style={!isHoverDisabled && hoverDay === day ? { backgroundColor: hlBg } : undefined}>
              <td
                className="border border-border px-2 py-0.5 font-medium transition-colors duration-150"
                style={!isHoverDisabled && hoverDay === day ? { backgroundColor: hlBg, fontWeight: 700, color: "hsl(var(--primary))" } : { color: "hsl(var(--muted-foreground))" }}
              >
                {fmtDate(year, month, day)}
              </td>
              {CATEGORIES.map((cat) => (
                <>
                  {PAYMENT_TYPES.map((pt) => {
                  const val = getValue(day, cat, pt);
                  const nr = isNotReturned(day, cat, pt);
                  const colKey = `${cat}_${pt}`;
                  const isHighlighted = hoverDay === day || hoverCol === colKey;
                  return (
                    <td
                      key={`${day}-${cat}-${pt}`}
                      className={`border border-border px-0 py-0 transition-colors duration-150 ${pt === "especes" ? "bg-grid-especes/50" : "bg-grid-cb/50"}`}
                      style={!isHoverDisabled && isHighlighted ? { backgroundColor: hlBg } : undefined}
                      onMouseEnter={() => { if (!isHoverDisabled) { setHoverDay(day); setHoverCol(colKey); } }}
                    >
                      <div className="flex items-center">
                        {readOnly ? (
                          <span className={`block px-1 py-0.5 text-right w-full ${nr ? "font-bold text-destructive" : ""}`}>
                            {fmt(val)}
                          </span>
                        ) : (
                          <>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`w-full px-1 py-0.5 text-right bg-transparent outline-none focus:bg-primary/5 text-xs ${nr ? "font-bold text-destructive" : ""}`}
                              value={editingCell === `${day}-${cat}-${pt}` ? editValue : (val ? fmt(val) : "")}
                              onFocus={() => {
                                if (!isHoverDisabled) { setHoverDay(day); setHoverCol(`${cat}_${pt}`); }
                                setEditingCell(`${day}-${cat}-${pt}`);
                                setEditValue(val ? val.toString().replace(".", ",") : "");
                              }}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                  setValue(day, cat, pt, parsed);
                                  setEditingCell(null);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              onBlur={() => {
                                if (editingCell === `${day}-${cat}-${pt}`) {
                                  const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                  setValue(day, cat, pt, parsed);
                                  setEditingCell(null);
                                }
                              }}
                            />
                            {val > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleNotReturned(day, cat, pt)}
                                className={`shrink-0 w-4 h-4 mr-0.5 rounded-full text-[8px] leading-none font-bold border ${
                                  nr
                                    ? "bg-destructive text-destructive-foreground border-destructive"
                                    : "bg-muted text-muted-foreground border-border hover:bg-destructive/20"
                                }`}
                                title={nr ? "Marquer comme rendu" : "Marquer comme non rendu"}
                              >
                                {nr ? "✓" : "!"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  );
                  })}
                  {extractionMode && PAYMENT_TYPES.map((pt) => {
                    const xVal = getExtract(day, cat, pt);
                    const entered = getValue(day, cat, pt);
                    const missingEntered = xVal > 0 && entered <= 0;
                    const mismatch = xVal > 0 && (missingEntered || Math.abs(xVal - entered) > 0.01);
                    const match = xVal > 0 && entered > 0 && Math.abs(xVal - entered) <= 0.01;
                    const xKey = `${cat}_extract_${pt}`;
                    const isHl = !isHoverDisabled && (hoverDay === day || hoverCol === xKey);
                    const editKey = `${day}-${cat}-extract-${pt}`;
                    // Check if totals match but individual cells differ (orange case)
                    const otherPt = pt === "especes" ? "cb" : "especes";
                    const enteredOther = getValue(day, cat, otherPt);
                    const xOther = getExtract(day, cat, otherPt);
                    const enteredTotal = entered + enteredOther;
                    const xTotal = xVal + xOther;
                    const totalsMatch = enteredTotal > 0 && xTotal > 0 && Math.abs(enteredTotal - xTotal) <= 0.01;
                    const cellsDiffer = (entered > 0 || enteredOther > 0) && (Math.abs(entered - xVal) > 0.01 || Math.abs(enteredOther - xOther) > 0.01);
                    const isOrange = xVal > 0 && totalsMatch && cellsDiffer;
                    const baseBg = isOrange ? "bg-grid-orange" : mismatch ? "bg-grid-mismatch" : match ? "bg-grid-match" : "bg-grid-extract";
                    const title = missingEntered
                      ? `Extraction présente (${fmt(xVal)}) mais aucune saisie ${pt === "especes" ? "Esp." : "CB"} en face`
                      : isOrange
                        ? `Totaux identiques (${fmt(enteredTotal)}) mais répartition différente : Saisie ${pt === "especes" ? "Esp." : "CB"} = ${fmt(entered)}, Ext. = ${fmt(xVal)}`
                        : mismatch
                          ? `Écart avec saisie : ${fmt(entered)} vs ${fmt(xVal)}`
                          : match
                            ? `Montant extraction identique à la saisie : ${fmt(xVal)}`
                            : undefined;
                    return (
                      <td
                        key={`${day}-${cat}-x-${pt}`}
                        className={`border border-border px-0 py-0 transition-colors duration-150 ${baseBg} relative`}
                        style={isHl ? { backgroundColor: hlBg } : undefined}
                        onMouseEnter={() => { setHoverDay(day); setHoverCol(xKey); }}
                        title={title}
                      >
                        <div className="flex items-center relative">
                          {readOnly ? (
                            <span className={`block px-1 py-0.5 text-right w-full ${mismatch && !totalsMatch ? "font-bold" : ""}`}>{xVal ? fmt(xVal) : ""}</span>
                          ) : (
                            <>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`w-full px-1 py-0.5 text-right bg-transparent outline-none focus:bg-primary/5 text-xs ${mismatch && !totalsMatch ? "font-bold" : ""}`}
                                value={editingCell === editKey ? editValue : (xVal ? fmt(xVal) : "")}
                                onFocus={() => {
                                  if (!isHoverDisabled) { setHoverDay(day); setHoverCol(xKey); }
                                  setEditingCell(editKey);
                                  setEditValue(xVal ? xVal.toString().replace(".", ",") : "");
                                }}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                    setExtract(day, cat, pt, parsed);
                                    setEditingCell(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                onBlur={() => {
                                  if (editingCell === editKey) {
                                    const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                    setExtract(day, cat, pt, parsed);
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </>
              ))}
              <td className="border border-border px-2 py-0.5 text-right font-semibold bg-grid-total">
                {fmt(getDayTotal(day))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-grid-header text-grid-header-foreground font-bold">
            <td className="border border-border px-2 py-1.5">Total</td>
            {CATEGORIES.map((cat) => (
              <>
                {PAYMENT_TYPES.map((pt) => (
                  <td
                    key={`t-${cat}-${pt}`}
                    className="border border-border px-2 py-1.5 text-right transition-colors duration-150"
                    style={!isHoverDisabled && hoverCol === `${cat}_${pt}` ? { backgroundColor: hlBg, color: "hsl(var(--foreground))" } : undefined}
                  >
                    {fmt(getColumnTotal(cat, pt))}
                  </td>
                ))}
                {extractionMode && PAYMENT_TYPES.map((pt) => (
                  <td
                    key={`t-${cat}-x-${pt}`}
                    className="border border-border px-2 py-1.5 text-right bg-grid-extract"
                    style={!isHoverDisabled && hoverCol === `${cat}_extract_${pt}` ? { backgroundColor: hlBg, color: "hsl(var(--foreground))" } : undefined}
                  >
                    {(() => { const t = getColumnExtractTotal(cat, pt); return t ? fmt(t) : "—"; })()}
                  </td>
                ))}
              </>
            ))}
            <td className="border border-border px-2 py-1.5 text-right">{fmt(getGrandTotal())}</td>
          </tr>
          <tr className="bg-secondary font-semibold text-sm">
            <td className="border border-border px-2 py-2" colSpan={3}>
              Total Espèces: <span className="text-primary">{fmt(getTotalEspeces())}</span>
            </td>
            <td className="border border-border px-2 py-2" colSpan={5}>
              Total CB: <span className="text-primary">{fmt(getTotalCB())}</span>
            </td>
            <td className="border border-border px-2 py-2 text-right" colSpan={(CATEGORIES.length * (extractionMode ? 4 : 2)) - 6}>
              Grand Total: <span className="text-primary font-bold">{fmt(getGrandTotal())}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}