import { useCallback, useState, useRef, useMemo } from "react";
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
  onCellChange?: (field: string, oldVal: number, newVal: number) => void;
}

const fmtDate = (year: number, month: number, day: number) => {
  const d = new Date(year, month, day);
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return `${days[d.getDay()]} ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
};

export default function RevenueGrid({ data, daysInMonth, year, month, title, onChange, readOnly = false, extractionMode = false }: Props) {
  const now = new Date();
  const isToday = (day: number) => year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const isHoverDisabled = extractionMode;

  // Build a flat ordered list of cell keys for keyboard navigation
  const cellKeys = useMemo(() => {
    const keys: { day: number; cat: string; pt: string; type: "enter" | "extract" }[] = [];
    const cats = CATEGORIES;
    const pts = PAYMENT_TYPES;
    for (let day = 1; day <= daysInMonth; day++) {
      for (const cat of cats) {
        for (const pt of pts) {
          keys.push({ day, cat, pt, type: "enter" });
        }
        if (extractionMode) {
          for (const pt of pts) {
            keys.push({ day, cat, pt, type: "extract" });
          }
        }
      }
    }
    return keys;
  }, [daysInMonth, extractionMode]);

  const getCellId = (day: number, cat: string, pt: string, type: "enter" | "extract") =>
    `cell-${day}-${cat}-${pt}-${type}`;

  const focusCell = (day: number, cat: string, pt: string, type: "enter" | "extract") => {
    const id = getCellId(day, cat, pt, type);
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      (el as HTMLInputElement).select();
    }
  };

  const navigateCell = (currentKey: { day: number; cat: string; pt: string; type: "enter" | "extract" }, direction: "prev" | "next" | "up" | "down") => {
    const idx = cellKeys.findIndex(
      (k) => k.day === currentKey.day && k.cat === currentKey.cat && k.pt === currentKey.pt && k.type === currentKey.type
    );
    if (idx < 0) return;

    let targetIdx = -1;
    if (direction === "prev") targetIdx = idx - 1;
    else if (direction === "next") targetIdx = idx + 1;
    else if (direction === "up") {
      for (let i = idx - 1; i >= 0; i--) {
        if (cellKeys[i].cat === currentKey.cat && cellKeys[i].pt === currentKey.pt && cellKeys[i].type === currentKey.type) {
          targetIdx = i;
          break;
        }
      }
    } else if (direction === "down") {
      for (let i = idx + 1; i < cellKeys.length; i++) {
        if (cellKeys[i].cat === currentKey.cat && cellKeys[i].pt === currentKey.pt && cellKeys[i].type === currentKey.type) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx >= 0 && targetIdx < cellKeys.length) {
      const target = cellKeys[targetIdx];
      focusCell(target.day, target.cat, target.pt, target.type);
    }
  };

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

  // Handle keyboard navigation for any cell input
  const handleKeyNav = (
    e: React.KeyboardEvent<HTMLInputElement>,
    day: number, cat: string, pt: string, type: "enter" | "extract",
    commitValue: () => void
  ) => {
    const key = { day, cat, pt, type };
    if (e.key === "Enter") {
      commitValue();
      navigateCell(key, "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitValue();
      navigateCell(key, e.shiftKey ? "prev" : "next");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      commitValue();
      navigateCell(key, "up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      commitValue();
      navigateCell(key, "down");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      commitValue();
      navigateCell(key, "prev");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      commitValue();
      navigateCell(key, "next");
    }
  };

  return (
    <div className="overflow-x-auto" onMouseLeave={() => { setHoverDay(null); setHoverCol(null); }}>
      {title && <h2 className="text-lg font-bold text-primary mb-3">{title}</h2>}
      <table className="w-full text-xs border-collapse min-w-[900px] table-auto">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-1.5 py-1.5 text-left min-w-[130px]">Date</th>
            {CATEGORIES.map((cat) => (
              <th
                key={cat}
                colSpan={extractionMode ? 4 : 2}
                className="border border-border px-1 py-1.5 text-center min-w-[90px]"
              >
                {cat}
              </th>
            ))}
            <th className="border border-border px-1.5 py-1.5 text-center min-w-[65px]">Total</th>
          </tr>
          <tr className="bg-secondary text-secondary-foreground">
            <th className="border border-border px-1.5 py-1"></th>
            {CATEGORIES.map((cat) => (
              <>
                <th
                  key={`${cat}-e`}
                  className="border border-border px-0.5 py-1 text-center bg-grid-especes text-foreground font-medium text-[10px] transition-colors duration-150 min-w-[44px]"
                  style={!isHoverDisabled && hoverCol === `${cat}_especes` ? { backgroundColor: hlBg } : undefined}
                >
                  Esp.
                </th>
                <th
                  key={`${cat}-c`}
                  className="border border-border px-0.5 py-1 text-center bg-grid-cb text-foreground font-medium text-[10px] transition-colors duration-150 min-w-[44px]"
                  style={!isHoverDisabled && hoverCol === `${cat}_cb` ? { backgroundColor: hlBg } : undefined}
                >
                  CB
                </th>
                {extractionMode && (
                  <>
                    <th
                      key={`${cat}-xe`}
                      className="border border-border px-0.5 py-1 text-center bg-grid-extract text-foreground font-medium text-[10px] transition-colors duration-150 min-w-[44px]"
                      style={!isHoverDisabled && hoverCol === `${cat}_extract_especes` ? { backgroundColor: hlBg } : undefined}
                    >
                      Ext. Esp.
                    </th>
                    <th
                      key={`${cat}-xc`}
                      className="border border-border px-0.5 py-1 text-center bg-grid-extract text-foreground font-medium text-[10px] transition-colors duration-150 min-w-[44px]"
                      style={!isHoverDisabled && hoverCol === `${cat}_extract_cb` ? { backgroundColor: hlBg } : undefined}
                    >
                      Ext. CB
                    </th>
                  </>
                )}
              </>
            ))}
            <th className="border border-border px-1.5 py-1"></th>
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
              {CATEGORIES.map((cat) => {
                const enteredEsp = getValue(day, cat, "especes");
                const enteredCb = getValue(day, cat, "cb");
                const extEsp = getExtract(day, cat, "especes");
                const extCb = getExtract(day, cat, "cb");
                const hasEntered = enteredEsp > 0 || enteredCb > 0;
                const bothExtractsEmpty = extEsp <= 0 && extCb <= 0;
                const isOrangeLight = extractionMode && hasEntered && bothExtractsEmpty;
                return (
                <>
                  {PAYMENT_TYPES.map((pt) => {
                  const val = getValue(day, cat, pt);
                  const nr = isNotReturned(day, cat, pt);
                  const extVal = getExtract(day, cat, pt);
                  // En mode extraction : si extraction > 0 mais saisie absente, on affiche l'extraction en rouge (non-rendu)
                  // Sauf pour le jour même car les montants peuvent encore changer
                  const showExtractAsMissing = extractionMode && extVal > 0 && val === 0 && !isToday(day);
                  const displayValue = showExtractAsMissing ? extVal : val;
                  const displayNr = showExtractAsMissing ? true : nr;
                  const colKey = `${cat}_${pt}`;
                  const isHighlighted = hoverDay === day || hoverCol === colKey;
                  const bgClass = isOrangeLight
                    ? "bg-grid-orange-light"
                    : pt === "especes" ? "bg-grid-especes/50" : "bg-grid-cb/50";
                  return (
                    <td
                      key={`${day}-${cat}-${pt}`}
                      className={`border border-border px-0 py-0 transition-colors duration-150 ${bgClass}`}
                      style={!isHoverDisabled && isHighlighted ? { backgroundColor: hlBg } : undefined}
                      onMouseEnter={() => { if (!isHoverDisabled) { setHoverDay(day); setHoverCol(colKey); } }}
                    >
                      <div className="flex items-center">
                        {readOnly ? (
                          <span className={`block px-1 py-0.5 text-center w-full ${displayNr ? "font-bold text-destructive" : ""}`}>
                            {fmt(displayValue)}
                          </span>
                        ) : (
                          <>
                            <input
                              id={getCellId(day, cat, pt, "enter")}
                              type="text"
                              inputMode="decimal"
                              className={`w-full px-1 py-0.5 text-center bg-transparent outline-none focus:bg-primary/5 text-xs ${displayNr ? "font-bold text-destructive" : ""}`}
                              value={editingCell === `${day}-${cat}-${pt}` ? editValue : (displayValue ? fmt(displayValue) : "")}
                              onFocus={() => {
                                if (!isHoverDisabled) { setHoverDay(day); setHoverCol(`${cat}_${pt}`); }
                                setEditingCell(`${day}-${cat}-${pt}`);
                                setEditValue(displayValue ? displayValue.toString().replace(".", ",") : "");
                              }}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyNav(e, day, cat, pt, "enter", () => {
                                const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                setValue(day, cat, pt, parsed);
                                setEditingCell(null);
                              })}
                              onBlur={() => {
                                if (editingCell === `${day}-${cat}-${pt}`) {
                                  const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                  setValue(day, cat, pt, parsed);
                                  setEditingCell(null);
                                }
                              }}
                            />
                            {displayValue > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (showExtractAsMissing) {
                                    // Copier la valeur extraction dans la saisie
                                    setValue(day, cat, pt, extVal);
                                  } else {
                                    toggleNotReturned(day, cat, pt);
                                  }
                                }}
                                className={`shrink-0 w-4 h-4 mr-0.5 rounded-full text-[8px] leading-none font-bold border ${
                                  displayNr
                                    ? "bg-destructive text-destructive-foreground border-destructive"
                                    : "bg-muted text-muted-foreground border-border hover:bg-destructive/20"
                                }`}
                                title={showExtractAsMissing ? `Copier ${fmt(extVal)} dans la saisie` : (nr ? "Marquer comme rendu" : "Marquer comme non rendu")}
                              >
                                {displayNr ? "✓" : "!"}
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
                    const otherPt = pt === "especes" ? "cb" : "especes";
                    const enteredOther = getValue(day, cat, otherPt);
                    const xOther = getExtract(day, cat, otherPt);
                    const enteredTotal = entered + enteredOther;
                    const xTotal = xVal + xOther;
                    const totalsMatch = enteredTotal > 0 && xTotal > 0 && Math.abs(enteredTotal - xTotal) <= 0.01;
                    const cellsDiffer = (entered > 0 || enteredOther > 0) && (Math.abs(entered - xVal) > 0.01 || Math.abs(enteredOther - xOther) > 0.01);
                    const isOrange = xVal > 0 && totalsMatch && cellsDiffer;
                    const extBgHighlight = extractionMode && bothExtractsEmpty && hasEntered;
                    const baseBg = extBgHighlight
                      ? "bg-grid-orange-light"
                      : isOrange ? "bg-grid-orange" : mismatch ? "bg-grid-mismatch" : match ? "bg-grid-match" : "bg-grid-extract";
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
                            <span className={`block px-1 py-0.5 text-center w-full ${mismatch && !totalsMatch ? "font-bold" : ""}`}>{xVal ? fmt(xVal) : ""}</span>
                          ) : (
                            <>
                              <input
                                id={getCellId(day, cat, pt, "extract")}
                                type="text"
                                inputMode="decimal"
                                className={`w-full px-1 py-0.5 text-center bg-transparent outline-none focus:bg-primary/5 text-xs ${mismatch && !totalsMatch ? "font-bold" : ""}`}
                                value={editingCell === editKey ? editValue : (xVal ? fmt(xVal) : "")}
                                onFocus={() => {
                                  if (!isHoverDisabled) { setHoverDay(day); setHoverCol(xKey); }
                                  setEditingCell(editKey);
                                  setEditValue(xVal ? xVal.toString().replace(".", ",") : "");
                                }}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, day, cat, pt, "extract", () => {
                                  const parsed = parseFloat(editValue.replace(",", ".")) || 0;
                                  setExtract(day, cat, pt, parsed);
                                  setEditingCell(null);
                                })}
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
                );
              })}
              <td className="border border-border px-2 py-0.5 text-center font-semibold bg-grid-total">
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
                    className="border border-border px-2 py-1.5 text-center transition-colors duration-150"
                    style={!isHoverDisabled && hoverCol === `${cat}_${pt}` ? { backgroundColor: hlBg, color: "hsl(var(--foreground))" } : undefined}
                  >
                    {fmt(getColumnTotal(cat, pt))}
                  </td>
                ))}
                {extractionMode && PAYMENT_TYPES.map((pt) => (
                  <td
                    key={`t-${cat}-x-${pt}`}
                    className="border border-border px-2 py-1.5 text-center bg-grid-extract"
                    style={!isHoverDisabled && hoverCol === `${cat}_extract_${pt}` ? { backgroundColor: hlBg, color: "hsl(var(--foreground))" } : undefined}
                  >
                    {(() => { const t = getColumnExtractTotal(cat, pt); return t ? fmt(t) : "—"; })()}
                  </td>
                ))}
              </>
            ))}
            <td className="border border-border px-2 py-1.5 text-center">{fmt(getGrandTotal())}</td>
          </tr>
          <tr className="bg-secondary font-semibold text-sm">
            <td className="border border-border px-1.5 py-2" colSpan={3}>
              Total Espèces: <span className="text-primary">{fmt(getTotalEspeces())}</span>
            </td>
            <td className="border border-border px-1.5 py-2" colSpan={extractionMode ? 7 : 3}>
              Total CB: <span className="text-primary">{fmt(getTotalCB())}</span>
            </td>
            <td className="border border-border px-1.5 py-2 text-center" colSpan={extractionMode ? CATEGORIES.length * 4 - 8 : CATEGORIES.length * 2 - 4}>
              Grand Total: <span className="text-primary font-bold">{fmt(getGrandTotal())}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}