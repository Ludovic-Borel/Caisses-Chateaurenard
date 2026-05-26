import { useMemo, useState, useEffect } from "react";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth, MONTH_NAMES } from "@/lib/types";
import { loadAllMonths } from "@/lib/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  drivers: string[];
}

const fmt = (v: number) => (v === 0 ? "—" : v.toFixed(2).replace(".", ",") + " €");

const monthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    for (let m = 11; m >= 0; m--) {
      if (y === now.getFullYear() && m > now.getMonth()) continue;
      opts.push({ value: `${y}_${m}`, label: `${MONTH_NAMES[m]} ${y}` });
    }
  }
  return opts;
};

export default function MonthComparison({ drivers }: Props) {
  const now = new Date();
  const [allMonths, setAllMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [month1, setMonth1] = useState(`${now.getFullYear()}_${now.getMonth()}`);
  const [month2, setMonth2] = useState(now.getMonth() > 0
    ? `${now.getFullYear()}_${now.getMonth() - 1}`
    : `${now.getFullYear() - 1}_11`);
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const months = await loadAllMonths();
      setAllMonths(months);
      setLoading(false);
    })();
  }, []);

  const parseKey = (key: string) => {
    const [y, m] = key.split("_").map(Number);
    return { year: y, month: m };
  };

  const stats = useMemo(() => {
    const k1 = parseKey(month1);
    const k2 = parseKey(month2);
    const m1 = allMonths.find((m) => m.year === k1.year && m.month === k1.month);
    const m2 = allMonths.find((m) => m.year === k2.year && m.month === k2.month);
    const allDrivers = Array.from(new Set([
      ...drivers,
      ...Object.keys(m1?.drivers || {}),
      ...Object.keys(m2?.drivers || {}),
    ])).sort();

    const compute = (md: MonthData | undefined) => {
      if (!md) return null;
      let total = 0, especes = 0, cb = 0, notReturned = 0;
      const daysInMonth = getDaysInMonth(md.year, md.month);
      const catTotals: Record<string, number> = {};
      CATEGORIES.forEach((c) => catTotals[c] = 0);
      const driverTotals: Record<string, number> = {};

      allDrivers.forEach((driver) => {
        const dd = md.drivers[driver];
        if (!dd) return;
        let dt = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          CATEGORIES.forEach((cat) => {
            const e = dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            const c = dd.days[d]?.[getCellKey(cat, "cb")] || 0;
            especes += e; cb += c; dt += e + c;
            catTotals[cat] += e + c;
            if (dd.notReturned?.[`${d}_${cat}_especes`] && e) notReturned += e;
            if (dd.notReturned?.[`${d}_${cat}_cb`] && c) notReturned += c;
          });
        }
        if (dt > 0) driverTotals[driver] = Math.round(dt * 100) / 100;
      });
      total = Math.round((especes + cb) * 100) / 100;
      return { total, especes: Math.round(especes * 100) / 100, cb: Math.round(cb * 100) / 100, notReturned: Math.round(notReturned * 100) / 100, catTotals, driverTotals };
    };

    const s1 = compute(m1);
    const s2 = compute(m2);

    if (!s1 || !s2) return null;

    const driverNames = Array.from(new Set([...Object.keys(s1.driverTotals), ...Object.keys(s2.driverTotals)])).sort();
    const driverRows = driverNames.map((name) => ({
      name,
      m1: s1.driverTotals[name] || 0,
      m2: s2.driverTotals[name] || 0,
      diff: (s2.driverTotals[name] || 0) - (s1.driverTotals[name] || 0),
    })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return { s1, s2, m1Label: `${MONTH_NAMES[k1.month]} ${k1.year}`, m2Label: `${MONTH_NAMES[k2.month]} ${k2.year}`, driverRows, m1, m2 };
  }, [allMonths, month1, month2, drivers]);

  const handleShowAllDrivers = () => setShowAllDrivers(true);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-primary">Comparaison mois/mois</h2>
      </div>

      {/* Month selectors */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Mois 1 :</span>
          <Select value={month1} onValueChange={setMonth1}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions().map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Mois 2 :</span>
          <Select value={month2} onValueChange={setMonth2}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions().map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stats && (
        <>
          {/* KPI comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComparisonKpiCard label="Total" val1={stats.s1.total} val2={stats.s2.total} m1={stats.m1Label} m2={stats.m2Label} fmt={fmt} />
            <ComparisonKpiCard label="Espèces" val1={stats.s1.especes} val2={stats.s2.especes} m1={stats.m1Label} m2={stats.m2Label} fmt={fmt} />
            <ComparisonKpiCard label="CB" val1={stats.s1.cb} val2={stats.s2.cb} m1={stats.m1Label} m2={stats.m2Label} fmt={fmt} />
          </div>

          {/* Category comparison table */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <h3 className="text-sm font-semibold text-primary mb-3">Par ligne</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-grid-header text-grid-header-foreground">
                  <th className="border border-border px-2 py-1.5 text-left">Ligne</th>
                  <th className="border border-border px-2 py-1.5 text-right">{stats.m1Label}</th>
                  <th className="border border-border px-2 py-1.5 text-right">{stats.m2Label}</th>
                  <th className="border border-border px-2 py-1.5 text-right">Écart</th>
                  <th className="border border-border px-2 py-1.5 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => {
                  const v1 = stats.s1.catTotals[cat] || 0;
                  const v2 = stats.s2.catTotals[cat] || 0;
                  const diff = v2 - v1;
                  const pct = v1 > 0 ? Math.round((diff / v1) * 100) : v2 > 0 ? 100 : 0;
                  return (
                    <tr key={cat} className="hover:bg-muted/50">
                      <td className="border border-border px-2 py-1 font-medium">{cat}</td>
                      <td className="border border-border px-2 py-1 text-right">{fmt(v1)}</td>
                      <td className="border border-border px-2 py-1 text-right">{fmt(v2)}</td>
                      <td className={`border border-border px-2 py-1 text-right font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>{diff > 0 ? "+" : ""}{fmt(diff)}</td>
                      <td className={`border border-border px-2 py-1 text-right ${pct > 0 ? "text-green-600" : pct < 0 ? "text-destructive" : ""}`}>{pct > 0 ? "+" : ""}{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Driver comparison */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <h3 className="text-sm font-semibold text-primary mb-3">Par chauffeur ({stats.driverRows.length} au total)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-grid-header text-grid-header-foreground">
                    <th className="border border-border px-2 py-1.5 text-left">Chauffeur</th>
                    <th className="border border-border px-2 py-1.5 text-right">{stats.m1Label}</th>
                    <th className="border border-border px-2 py-1.5 text-right">{stats.m2Label}</th>
                    <th className="border border-border px-2 py-1.5 text-right">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllDrivers ? stats.driverRows : stats.driverRows.slice(0, 30)).map((d) => (
                    <tr key={d.name} className="hover:bg-muted/50">
                      <td className="border border-border px-2 py-1 font-medium">{d.name}</td>
                      <td className="border border-border px-2 py-1 text-right">{fmt(d.m1)}</td>
                      <td className="border border-border px-2 py-1 text-right">{fmt(d.m2)}</td>
                      <td className={`border border-border px-2 py-1 text-right font-bold ${d.diff > 0 ? "text-green-600" : d.diff < 0 ? "text-destructive" : ""}`}>{d.diff > 0 ? "+" : ""}{fmt(d.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!showAllDrivers && stats.driverRows.length > 30 && (
                <Button variant="outline" size="sm" className="mt-3 w-full text-xs" onClick={handleShowAllDrivers}>
                  Voir les {stats.driverRows.length} chauffeurs
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ComparisonKpiCard({ label, val1, val2, m1, m2, fmt }: { label: string; val1: number; val2: number; m1: string; m2: string; fmt: (v: number) => string }) {
  const diff = val2 - val1;
  const pct = val1 > 0 ? Math.round((diff / val1) * 100) : val2 > 0 ? 100 : 0;
  return (
    <div className="rounded-lg border border-border p-4 bg-card flex flex-col items-center">
      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-3 w-full text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">{m1}</p>
          <p className="text-sm font-bold">{fmt(val1)}</p>
        </div>
        <div className="border-x border-border px-2">
          <p className="text-[10px] text-muted-foreground">Écart</p>
          <p className={`text-sm font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>{diff > 0 ? "+" : ""}{fmt(diff)}</p>
          <p className={`text-[10px] ${pct > 0 ? "text-green-600" : pct < 0 ? "text-destructive" : "text-muted-foreground"}`}>{pct > 0 ? "+" : ""}{pct}%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{m2}</p>
          <p className="text-sm font-bold">{fmt(val2)}</p>
        </div>
      </div>
    </div>
  );
}