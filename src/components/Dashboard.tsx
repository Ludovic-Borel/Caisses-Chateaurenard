import { useMemo } from "react";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth, MONTH_NAMES } from "@/lib/types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import logo from "@/assets/logo.png";

interface Props {
  currentData: MonthData;
  drivers: string[];
}

const COLORS = ["#0000a6", "#00b4d8", "#ea580c", "#8b5cf6", "#dc2626", "#0891b2", "#d97706", "#4f46e5"];

export default function Dashboard({ currentData, drivers }: Props) {
  const daysInMonth = getDaysInMonth(currentData.year, currentData.month);
  const fmt = (v: number) => v.toFixed(2).replace(".", ",") + " €";
  const pct = (v: number, total: number) => total > 0 ? Math.round((v / total) * 100) : 0;

  const stats = useMemo(() => {
    let totalEspeces = 0, totalCB = 0, totalNotReturned = 0;
    const catTotals: Record<string, number> = {};
    const driverTotals: { name: string; total: number; notReturned: number }[] = [];
    const dayTotals: number[] = new Array(daysInMonth).fill(0);

    CATEGORIES.forEach(c => catTotals[c] = 0);

    drivers.forEach(driver => {
      const dd = currentData.drivers[driver];
      let dEsp = 0, dCB = 0, dNR = 0;
      if (dd) {
        for (let d = 1; d <= daysInMonth; d++) {
          CATEGORIES.forEach(cat => {
            const e = dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            const c = dd.days[d]?.[getCellKey(cat, "cb")] || 0;
            dEsp += e; dCB += c;
            catTotals[cat] += e + c;
            dayTotals[d - 1] += e + c;
            if (dd.notReturned?.[`${d}_${cat}_especes`] && e) dNR += e;
            if (dd.notReturned?.[`${d}_${cat}_cb`] && c) dNR += c;
          });
        }
      }
      totalEspeces += dEsp; totalCB += dCB; totalNotReturned += dNR;
      if (dEsp + dCB > 0) driverTotals.push({ name: driver, total: dEsp + dCB, notReturned: dNR });
    });

    driverTotals.sort((a, b) => b.total - a.total);
    const activeDays = dayTotals.filter(v => v > 0);
    const bestDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
    const worstActiveDay = activeDays.length > 0 ? Math.min(...activeDays) : 0;
    const worstDayIdx = dayTotals.indexOf(worstActiveDay);

    return {
      totalEspeces, totalCB, grandTotal: totalEspeces + totalCB, totalNotReturned,
      activeDrivers: driverTotals.length, activeDays: activeDays.length,
      avgPerDay: activeDays.length > 0 ? (totalEspeces + totalCB) / activeDays.length : 0,
      catTotals, driverTotals: driverTotals.slice(0, 10),
      bestDay: bestDayIdx + 1, bestDayAmount: dayTotals[bestDayIdx] || 0,
      worstDay: worstDayIdx + 1, worstDayAmount: worstActiveDay,
      catChartData: CATEGORIES.map(c => ({ name: c, value: Math.round(catTotals[c] * 100) / 100 })),
      paymentData: [
        { name: "Espèces", value: Math.round(totalEspeces * 100) / 100 },
        { name: "CB", value: Math.round(totalCB * 100) / 100 },
      ],
    };
  }, [currentData, drivers, daysInMonth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <img src={logo} alt="Logo" className="h-10 object-contain" />
        <div>
          <h2 className="text-lg font-bold text-primary">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground">{MONTH_NAMES[currentData.month]} {currentData.year}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Recette totale" value={fmt(stats.grandTotal)} accent />
        <KpiCard label="Espèces" value={fmt(stats.totalEspeces)} sub={`${pct(stats.totalEspeces, stats.grandTotal)}%`} />
        <KpiCard label="CB" value={fmt(stats.totalCB)} sub={`${pct(stats.totalCB, stats.grandTotal)}%`} />
        <KpiCard label="Non rendu" value={fmt(stats.totalNotReturned)} danger={stats.totalNotReturned > 0} />
        <KpiCard label="Chauffeurs actifs" value={`${stats.activeDrivers}`} sub={`/ ${drivers.length}`} />
        <KpiCard label="Jours actifs" value={`${stats.activeDays}`} sub={`/ ${daysInMonth}`} />
        <KpiCard label="Moyenne / jour" value={fmt(stats.avgPerDay)} />
        <KpiCard label="Meilleur jour" value={`J${stats.bestDay}`} sub={fmt(stats.bestDayAmount)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By category */}
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <h3 className="text-sm font-semibold text-primary mb-3">Répartition par ligne</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.catChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}` : ""}>
                {stats.catChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v.toFixed(2) + " €"} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Payment split */}
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <h3 className="text-sm font-semibold text-primary mb-3">Espèces vs CB</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({ name, value }) => `${name}: ${value.toFixed(2)} €`}>
                <Cell fill="hsl(var(--primary))" />
                <Cell fill="hsl(var(--accent))" />
              </Pie>
              <Tooltip formatter={(v: number) => v.toFixed(2) + " €"} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 drivers */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-primary mb-3">Top 10 chauffeurs</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.driverTotals} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: number) => (v as number).toFixed(2) + " €"} />
            <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {/* Table */}
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-grid-header text-grid-header-foreground">
                <th className="border border-border px-3 py-1.5 text-left">#</th>
                <th className="border border-border px-3 py-1.5 text-left">Chauffeur</th>
                <th className="border border-border px-3 py-1.5 text-right">Total</th>
                <th className="border border-border px-3 py-1.5 text-right">% du CA</th>
                <th className="border border-border px-3 py-1.5 text-right">Non rendu</th>
              </tr>
            </thead>
            <tbody>
              {stats.driverTotals.map((d, i) => (
                <tr key={d.name} className="hover:bg-muted/50">
                  <td className="border border-border px-3 py-1 font-medium">{i + 1}</td>
                  <td className="border border-border px-3 py-1 font-medium">{d.name}</td>
                  <td className="border border-border px-3 py-1 text-right font-bold">{fmt(d.total)}</td>
                  <td className="border border-border px-3 py-1 text-right">{pct(d.total, stats.grandTotal)}%</td>
                  <td className={`border border-border px-3 py-1 text-right ${d.notReturned > 0 ? "text-destructive font-bold" : ""}`}>
                    {d.notReturned > 0 ? fmt(d.notReturned) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category breakdown table */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold text-primary mb-3">Détail par ligne</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-grid-header text-grid-header-foreground">
              <th className="border border-border px-3 py-1.5 text-left">Ligne</th>
              <th className="border border-border px-3 py-1.5 text-right">Montant</th>
              <th className="border border-border px-3 py-1.5 text-right">% du CA</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(cat => (
              <tr key={cat} className="hover:bg-muted/50">
                <td className="border border-border px-3 py-1 font-medium">{cat}</td>
                <td className="border border-border px-3 py-1 text-right font-bold">{fmt(stats.catTotals[cat])}</td>
                <td className="border border-border px-3 py-1 text-right">{pct(stats.catTotals[cat], stats.grandTotal)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-grid-header text-grid-header-foreground font-bold">
              <td className="border border-border px-3 py-1.5">TOTAL</td>
              <td className="border border-border px-3 py-1.5 text-right">{fmt(stats.grandTotal)}</td>
              <td className="border border-border px-3 py-1.5 text-right">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent, danger }: { label: string; value: string; sub?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "bg-primary text-primary-foreground border-primary" : danger ? "bg-destructive/10 border-destructive/30" : "bg-card border-border"}`}>
      <p className={`text-[10px] uppercase tracking-wider font-medium ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${danger && !accent ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className={`text-xs ${accent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}
