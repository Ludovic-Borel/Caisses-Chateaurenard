import { useCallback } from "react";
import { CATEGORIES, PAYMENT_TYPES, getCellKey, getDaysInMonth, DriverMonthData, MONTH_NAMES } from "@/lib/types";

interface Props {
  data: DriverMonthData;
  daysInMonth: number;
  title?: string;
  onChange?: (data: DriverMonthData) => void;
  readOnly?: boolean;
}

export default function RevenueGrid({ data, daysInMonth, title, onChange, readOnly = false }: Props) {
  const getValue = (day: number, cat: string, pt: string): number => {
    return data.days[day]?.[getCellKey(cat as any, pt as any)] || 0;
  };

  const setValue = useCallback(
    (day: number, cat: string, pt: string, value: number) => {
      if (!onChange) return;
      const key = getCellKey(cat as any, pt as any);
      const dayEntry = { ...(data.days[day] || {}), [key]: value };
      onChange({ days: { ...data.days, [day]: dayEntry } });
    },
    [data, onChange]
  );

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

  const fmt = (v: number) => (v ? v.toFixed(2) + " €" : "");

  return (
    <div className="overflow-x-auto">
      {title && <h2 className="text-lg font-bold text-primary mb-3">{title}</h2>}
      <table className="w-full text-xs border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-2 py-1.5 text-left w-16">Jour</th>
            {CATEGORIES.map((cat) => (
              <th key={cat} colSpan={2} className="border border-border px-2 py-1.5 text-center">
                {cat}
              </th>
            ))}
            <th className="border border-border px-2 py-1.5 text-center w-20">Total</th>
          </tr>
          <tr className="bg-secondary text-secondary-foreground">
            <th className="border border-border px-2 py-1"></th>
            {CATEGORIES.map((cat) => (
              <>
                <th key={`${cat}-e`} className="border border-border px-1 py-1 text-center bg-grid-especes text-foreground font-medium">
                  Esp.
                </th>
                <th key={`${cat}-c`} className="border border-border px-1 py-1 text-center bg-grid-cb text-foreground font-medium">
                  CB
                </th>
              </>
            ))}
            <th className="border border-border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <tr key={day} className="hover:bg-muted/50 transition-colors">
              <td className="border border-border px-2 py-0.5 font-medium text-muted-foreground">
                {day}
              </td>
              {CATEGORIES.map((cat) =>
                PAYMENT_TYPES.map((pt) => (
                  <td
                    key={`${day}-${cat}-${pt}`}
                    className={`border border-border px-0 py-0 ${pt === "especes" ? "bg-grid-especes/50" : "bg-grid-cb/50"}`}
                  >
                    {readOnly ? (
                      <span className="block px-1 py-0.5 text-right">{fmt(getValue(day, cat, pt))}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full px-1 py-0.5 text-right bg-transparent outline-none focus:bg-primary/5 text-xs"
                        value={getValue(day, cat, pt) || ""}
                        onChange={(e) => setValue(day, cat, pt, parseFloat(e.target.value) || 0)}
                      />
                    )}
                  </td>
                ))
              )}
              <td className="border border-border px-2 py-0.5 text-right font-semibold bg-grid-total">
                {fmt(getDayTotal(day))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-grid-header text-grid-header-foreground font-bold">
            <td className="border border-border px-2 py-1.5">Total</td>
            {CATEGORIES.map((cat) =>
              PAYMENT_TYPES.map((pt) => (
                <td key={`t-${cat}-${pt}`} className="border border-border px-2 py-1.5 text-right">
                  {fmt(getColumnTotal(cat, pt))}
                </td>
              ))
            )}
            <td className="border border-border px-2 py-1.5 text-right">{fmt(getGrandTotal())}</td>
          </tr>
          <tr className="bg-secondary font-semibold text-sm">
            <td className="border border-border px-2 py-2" colSpan={3}>
              Total Espèces: <span className="text-primary">{fmt(getTotalEspeces())}</span>
            </td>
            <td className="border border-border px-2 py-2" colSpan={5}>
              Total CB: <span className="text-primary">{fmt(getTotalCB())}</span>
            </td>
            <td className="border border-border px-2 py-2 text-right" colSpan={CATEGORIES.length * 2 - 6}>
              Grand Total: <span className="text-primary font-bold">{fmt(getGrandTotal())}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
