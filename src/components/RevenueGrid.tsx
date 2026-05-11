import { useCallback, useState } from "react";
import { CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, DriverMonthData, MONTH_NAMES } from "@/lib/types";

interface Props {
  data: DriverMonthData;
  daysInMonth: number;
  title?: string;
  onChange?: (data: DriverMonthData) => void;
  readOnly?: boolean;
  extractionMode?: boolean;
}

export default function RevenueGrid({ data, daysInMonth, title, onChange, readOnly = false, extractionMode = false }: Props) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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
            <th className="border border-border px-2 py-1.5 text-left w-16">Jour</th>
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
                  style={hoverCol === `${cat}_especes` ? { backgroundColor: hlBg } : undefined}
                >
                  Esp.
                </th>
                <th
                  key={`${cat}-c`}
                  className="border border-border px-1 py-1 text-center bg-grid-cb text-foreground font-medium transition-colors duration-150"
                  style={hoverCol === `${cat}_cb` ? { backgroundColor: hlBg } : undefined}
                >
                  CB
                </th>
                {extractionMode && (
                  <>
                    <th
                      key={`${cat}-xe`}
                      className="border border-border px-1 py-1 text-center bg-muted text-foreground font-medium transition-colors duration-150"
                      style={hoverCol === `${cat}_extract_especes` ? { backgroundColor: hlBg } : undefined}
                    >
                      Ext. Esp.
                    </th>
                    <th
                      key={`${cat}-xc`}
                      className="border border-border px-1 py-1 text-center bg-muted text-foreground font-medium transition-colors duration-150"
                      style={hoverCol === `${cat}_extract_cb` ? { backgroundColor: hlBg } : undefined}
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
            <tr key={day} className="transition-colors duration-150" style={hoverDay === day ? { backgroundColor: hlBg } : undefined}>
              <td
                className="border border-border px-2 py-0.5 font-medium transition-colors duration-150"
                style={hoverDay === day ? { backgroundColor: hlBg, fontWeight: 700, color: "hsl(var(--primary))" } : { color: "hsl(var(--muted-foreground))" }}
              >
                {day}
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
                      style={isHighlighted ? { backgroundColor: hlBg } : undefined}
                      onMouseEnter={() => { setHoverDay(day); setHoverCol(colKey); }}
                    >
                      <div className="flex items-center">
                        {readOnly ? (
                          <span className={`block px-1 py-0.5 text-right w-full ${nr ? "text-destructive font-bold" : ""}`}>
                            {fmt(val)}
                          </span>
                        ) : (
                          <>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`w-full px-1 py-0.5 text-right bg-transparent outline-none focus:bg-primary/5 text-xs ${nr ? "text-destructive font-bold" : ""}`}
                              value={editingCell === `${day}-${cat}-${pt}` ? editValue : (val ? fmt(val) : "")}
                              onFocus={() => {
                                setHoverDay(day); setHoverCol(`${cat}_${pt}`);
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
                    const xKey = `${cat}_extract_${pt}`;
                    const isHl = hoverDay === day || hoverCol === xKey;
                    const editKey = `${day}-${cat}-extract-${pt}`;
                    return (
                      <td
                        key={`${day}-${cat}-x-${pt}`}
                        className="border border-border px-0 py-0 transition-colors duration-150 bg-muted/40"
                        style={isHl ? { backgroundColor: hlBg } : undefined}
                        onMouseEnter={() => { setHoverDay(day); setHoverCol(xKey); }}
                      >
                        {readOnly ? (
                          <span className="block px-1 py-0.5 text-right w-full">{xVal ? fmt(xVal) : ""}</span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full px-1 py-0.5 text-right bg-transparent outline-none focus:bg-primary/5 text-xs"
                            value={editingCell === editKey ? editValue : (xVal ? fmt(xVal) : "")}
                            onFocus={() => {
                              setHoverDay(day); setHoverCol(xKey);
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
                        )}
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
                    style={hoverCol === `${cat}_${pt}` ? { backgroundColor: hlBg, color: "hsl(var(--foreground))" } : undefined}
                  >
                    {fmt(getColumnTotal(cat, pt))}
                  </td>
                ))}
                {extractionMode && (
                  <td
                    key={`t-${cat}-x`}
                    className="border border-border px-2 py-1.5 text-right bg-muted/40"
                    style={hoverCol === `${cat}_extract` ? { backgroundColor: hlBg, color: "hsl(var(--foreground))" } : undefined}
                  >
                    {(() => { const t = getColumnExtractTotal(cat); return t ? fmt(t) : "—"; })()}
                  </td>
                )}
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
            <td className="border border-border px-2 py-2 text-right" colSpan={(CATEGORIES.length * (extractionMode ? 3 : 2)) - 6}>
              Grand Total: <span className="text-primary font-bold">{fmt(getGrandTotal())}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
