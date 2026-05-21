import { useMemo, useState, useEffect } from "react";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth, MONTH_NAMES } from "@/lib/types";
import { loadAllMonths } from "@/lib/storage";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

interface Props {
  year: number;
  drivers: string[];
}

const fmt = (v: number) => (v === 0 ? "—" : v.toFixed(2).replace(".", ",") + " €");
const fmtShort = (v: number) => v.toFixed(0).replace(".", ",") + " €";

export default function YearlyOverview({ year, drivers }: Props) {
  const [allMonths, setAllMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const months = await loadAllMonths();
      setAllMonths(months.filter((m) => m.year === year));
      setLoading(false);
    })();
  }, [year]);

  const stats = useMemo(() => {
    const monthsOfYear = allMonths.filter((m) => m.year === year).sort((a, b) => a.month - b.month);
    const allDrivers = Array.from(new Set([
      ...drivers,
      ...monthsOfYear.flatMap((m) => Object.keys(m.drivers || {})),
    ])).sort();

    // Per-month totals
    const monthlyData = monthsOfYear.map((m) => {
      let total = 0, especes = 0, cb = 0, notReturned = 0;
      const catTotals: Record<string, number> = {};
      CATEGORIES.forEach((c) => catTotals[c] = 0);
      const daysInMonth = getDaysInMonth(m.year, m.month);

      allDrivers.forEach((driver) => {
        const dd = m.drivers[driver];
        if (!dd) return;
        for (let d = 1; d <= daysInMonth; d++) {
          CATEGORIES.forEach((cat) => {
            const e = dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            const c = dd.days[d]?.[getCellKey(cat, "cb")] || 0;
            especes += e; cb += c;
            catTotals[cat] += e + c;
            if (dd.notReturned?.[`${d}_${cat}_especes`] && e) notReturned += e;
            if (dd.notReturned?.[`${d}_${cat}_cb`] && c) notReturned += c;
          });
        }
      });
      total = especes + cb;
      return {
        month: m.month,
        label: MONTH_NAMES[m.month],
        total: Math.round(total * 100) / 100,
        especes: Math.round(especes * 100) / 100,
        cb: Math.round(cb * 100) / 100,
        notReturned: Math.round(notReturned * 100) / 100,
        catTotals,
        activeDrivers: allDrivers.filter((d) => {
          const dd = m.drivers[d];
          if (!dd) return false;
          for (let day = 1; day <= daysInMonth; day++) {
            if (CATEGORIES.some((cat) => (dd.days[day]?.[getCellKey(cat, "especes")] || 0) + (dd.days[day]?.[getCellKey(cat, "cb")] || 0) > 0)) return true;
          }
          return false;
        }).length,
      };
    });

    const grandTotal = monthlyData.reduce((s, m) => s + m.total, 0);
    const grandEspeces = monthlyData.reduce((s, m) => s + m.especes, 0);
    const grandCB = monthlyData.reduce((s, m) => s + m.cb, 0);
    const grandNotReturned = monthlyData.reduce((s, m) => s + m.notReturned, 0);

    // Per-driver annual totals
    const driverAnnualTotals: { name: string; total: number; monthsActive: number }[] = [];
    allDrivers.forEach((driver) => {
      let total = 0;
      let monthsActive = 0;
      monthsOfYear.forEach((m) => {
        const dd = m.drivers[driver];
        if (!dd) return;
        const daysInMonth = getDaysInMonth(m.year, m.month);
        let driverTotal = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          CATEGORIES.forEach((cat) => {
            driverTotal += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            driverTotal += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
          });
        }
        if (driverTotal > 0) monthsActive++;
        total += driverTotal;
      });
      if (total > 0) {
        driverAnnualTotals.push({ name: driver, total: Math.round(total * 100) / 100, monthsActive });
      }
    });
    driverAnnualTotals.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return {
      monthlyData,
      grandTotal,
      grandEspeces,
      grandCB,
      grandNotReturned,
      monthsLoaded: monthsOfYear.length,
      driverAnnualTotals: driverAnnualTotals.slice(0, 15),
      chartData: monthlyData.map((m) => ({
        name: m.label.substring(0, 3),
        total: m.total,
        Espèces: m.especes,
        CB: m.cb,
      })),
    };
  }, [allMonths, year, drivers]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement des données annuelles...</div>;
  }

  if (stats.monthsLoaded === 0) {
    return <div className="text-center py-8 text-muted-foreground">Aucune donnée pour {year}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-primary">Cumul Annuel {year}</h2>
        <p className="text-sm text-muted-foreground">{stats.monthsLoaded} mois chargés</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="CA Annuel" value={fmt(stats.grandTotal)} accent />
        <KpiCard label="Espèces" value={fmt(stats.grandEspeces)} sub={`${stats.grandTotal > 0 ? Math.round(stats.grandEspeces / stats.grandTotal * 100) : 0}%`} />
        <KpiCard label="CB" value={fmt(stats.grandCB)} sub={`${stats.grandTotal > 0 ? Math.round(stats.grandCB / stats.grandTotal * 100) : 0}%`} />
        <KpiCard label="Non rendu" value={fmt(stats.grandNotReturned)} danger={stats.grandNotReturned > 0} />
      </div>

      {/* Monthly evolution chart */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-primary mb-3">Évolution mensuelle</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats.chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: number) => v.toFixed(2) + " €"} />
            <Legend />
            <Bar dataKey="Espèces" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} stackId="a" />
            <Bar dataKey="CB" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly detail table */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-primary mb-3">Détail par mois</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-grid-header text-grid-header-foreground">
                <th className="border border-border px-2 py-1.5 text-left">Mois</th>
                <th className="border border-border px-2 py-1.5 text-right">Espèces</th>
                <th className="border border-border px-2 py-1.5 text-right">CB</th>
                <th className="border border-border px-2 py-1.5 text-right">Total</th>
                <th className="border border-border px-2 py-1.5 text-right">Non rendu</th>
                <th className="border border-border px-2 py-1.5 text-right">Chauffeurs</th>
              </tr>
            </thead>
            <tbody>
              {stats.monthlyData.map((m) => (
                <tr key={m.month} className="hover:bg-muted/50 transition-colors">
                  <td className="border border-border px-2 py-1 font-medium">{m.label}</td>
                  <td className="border border-border px-2 py-1 text-right">{fmt(m.especes)}</td>
                  <td className="border border-border px-2 py-1 text-right">{fmt(m.cb)}</td>
                  <td className="border border-border px-2 py-1 text-right font-bold">{fmt(m.total)}</td>
                  <td className={`border border-border px-2 py-1 text-right ${m.notReturned > 0 ? "font-bold" : ""}`}>{m.notReturned > 0 ? fmt(m.notReturned) : "—"}</td>
                  <td className="border border-border px-2 py-1 text-right">{m.activeDrivers}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-grid-header text-grid-header-foreground font-bold">
                <td className="border border-border px-2 py-1.5">TOTAL</td>
                <td className="border border-border px-2 py-1.5 text-right">{fmt(stats.grandEspeces)}</td>
                <td className="border border-border px-2 py-1.5 text-right">{fmt(stats.grandCB)}</td>
                <td className="border border-border px-2 py-1.5 text-right">{fmt(stats.grandTotal)}</td>
                <td className="border border-border px-2 py-1.5 text-right">{stats.grandNotReturned > 0 ? fmt(stats.grandNotReturned) : "—"}</td>
                <td className="border border-border px-2 py-1.5 text-right"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Top 15 drivers of the year */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-primary mb-3">Top 15 chauffeurs {year}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.driverAnnualTotals} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} fontSize={10} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: number) => v.toFixed(2) + " €"} />
            <Bar dataKey="total" name="Total annuel" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-grid-header text-grid-header-foreground">
                <th className="border border-border px-2 py-1.5 text-left">#</th>
                <th className="border border-border px-2 py-1.5 text-left">Chauffeur</th>
                <th className="border border-border px-2 py-1.5 text-right">Total</th>
                <th className="border border-border px-2 py-1.5 text-right">Mois actifs</th>
              </tr>
            </thead>
            <tbody>
              {stats.driverAnnualTotals.map((d, i) => (
                <tr key={d.name} className="hover:bg-muted/50 transition-colors">
                  <td className="border border-border px-2 py-1 font-medium">{i + 1}</td>
                  <td className="border border-border px-2 py-1 font-medium">{d.name}</td>
                  <td className="border border-border px-2 py-1 text-right font-bold">{fmt(d.total)}</td>
                  <td className="border border-border px-2 py-1 text-right">{d.monthsActive}/{stats.monthsLoaded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent, danger }: { label: string; value: string; sub?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col ${accent ? "bg-primary text-primary-foreground border-primary" : danger ? "bg-destructive/10 border-destructive/30" : "bg-card border-border"}`}>
      <p className={`text-xs uppercase tracking-wider font-semibold ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className={`text-xl font-bold ${danger && !accent ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className={`text-sm ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</p>}
      </div>
    </div>
  );
}