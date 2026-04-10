import { useMemo, useState } from "react";
import { MonthData, CATEGORIES, getCellKey, getDaysInMonth, MONTH_NAMES } from "@/lib/types";
import { loadAllMonths } from "@/lib/storage";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Props {
  currentData: MonthData;
  drivers: string[];
}

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#8b5cf6", "#dc2626", "#0891b2", "#d97706", "#4f46e5"];

export default function StatsPanel({ currentData, archives, drivers }: Props) {
  const [tab, setTab] = useState<"ligne" | "conducteur" | "jour" | "mois" | "paiement">("ligne");

  const daysInMonth = getDaysInMonth(currentData.year, currentData.month);

  // Stats par ligne (catégorie)
  const statsByLine = useMemo(() => {
    return CATEGORIES.map((cat) => {
      let especes = 0, cb = 0;
      drivers.forEach((driver) => {
        const dd = currentData.drivers[driver];
        if (!dd) return;
        for (let d = 1; d <= daysInMonth; d++) {
          especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
        }
      });
      return { name: cat, Espèces: Math.round(especes * 100) / 100, CB: Math.round(cb * 100) / 100, Total: Math.round((especes + cb) * 100) / 100 };
    });
  }, [currentData, drivers, daysInMonth]);

  // Stats par conducteur
  const statsByDriver = useMemo(() => {
    return drivers.map((driver) => {
      let especes = 0, cb = 0;
      const dd = currentData.drivers[driver];
      if (dd) {
        for (let d = 1; d <= daysInMonth; d++) {
          CATEGORIES.forEach((cat) => {
            especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
          });
        }
      }
      return { name: driver, Espèces: Math.round(especes * 100) / 100, CB: Math.round(cb * 100) / 100, Total: Math.round((especes + cb) * 100) / 100 };
    }).filter((d) => d.Total > 0).sort((a, b) => b.Total - a.Total);
  }, [currentData, drivers, daysInMonth]);

  // Stats par jour
  const statsByDay = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
      let especes = 0, cb = 0;
      drivers.forEach((driver) => {
        const dd = currentData.drivers[driver];
        if (!dd) return;
        CATEGORIES.forEach((cat) => {
          especes += dd.days[day]?.[getCellKey(cat, "especes")] || 0;
          cb += dd.days[day]?.[getCellKey(cat, "cb")] || 0;
        });
      });
      return { name: `${day}`, Espèces: Math.round(especes * 100) / 100, CB: Math.round(cb * 100) / 100, Total: Math.round((especes + cb) * 100) / 100 };
    });
  }, [currentData, drivers, daysInMonth]);

  // Stats par mois (archives)
  const statsByMonth = useMemo(() => {
    const allMonths = [...archives.map((a) => a.data), currentData];
    return allMonths.map((md) => {
      const dim = getDaysInMonth(md.year, md.month);
      let especes = 0, cb = 0;
      Object.values(md.drivers).forEach((dd) => {
        for (let d = 1; d <= dim; d++) {
          CATEGORIES.forEach((cat) => {
            especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
            cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
          });
        }
      });
      return {
        name: `${MONTH_NAMES[md.month].slice(0, 3)} ${md.year}`,
        Espèces: Math.round(especes * 100) / 100,
        CB: Math.round(cb * 100) / 100,
        Total: Math.round((especes + cb) * 100) / 100,
        sort: md.year * 100 + md.month,
      };
    }).sort((a, b) => a.sort - b.sort);
  }, [currentData, archives]);

  // Stats Espèces vs CB
  const statsByPayment = useMemo(() => {
    let especes = 0, cb = 0;
    drivers.forEach((driver) => {
      const dd = currentData.drivers[driver];
      if (!dd) return;
      for (let d = 1; d <= daysInMonth; d++) {
        CATEGORIES.forEach((cat) => {
          especes += dd.days[d]?.[getCellKey(cat, "especes")] || 0;
          cb += dd.days[d]?.[getCellKey(cat, "cb")] || 0;
        });
      }
    });
    return [
      { name: "Espèces", value: Math.round(especes * 100) / 100 },
      { name: "CB", value: Math.round(cb * 100) / 100 },
    ];
  }, [currentData, drivers, daysInMonth]);

  const tabs = [
    { key: "ligne" as const, label: "Par Ligne" },
    { key: "conducteur" as const, label: "Par Conducteur" },
    { key: "jour" as const, label: "Par Jour" },
    { key: "mois" as const, label: "Par Mois" },
    { key: "paiement" as const, label: "Espèces / CB" },
  ];

  const fmt = (v: number) => v ? v.toFixed(2) + " €" : "";

  const renderBarChart = (chartData: { name: string; Espèces: number; CB: number; Total: number }[], height = 350) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip formatter={(v: number) => v.toFixed(2) + " €"} />
        <Legend />
        <Bar dataKey="Espèces" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="CB" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderTable = (tableData: { name: string; Espèces: number; CB: number; Total: number }[]) => (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-grid-header text-grid-header-foreground">
            <th className="border border-border px-3 py-1.5 text-left">Nom</th>
            <th className="border border-border px-3 py-1.5 text-right">Espèces</th>
            <th className="border border-border px-3 py-1.5 text-right">CB</th>
            <th className="border border-border px-3 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row) => (
            <tr key={row.name} className="hover:bg-muted/50">
              <td className="border border-border px-3 py-1 font-medium text-foreground">{row.name}</td>
              <td className="border border-border px-3 py-1 text-right">{fmt(row.Espèces)}</td>
              <td className="border border-border px-3 py-1 text-right">{fmt(row.CB)}</td>
              <td className="border border-border px-3 py-1 text-right font-bold">{fmt(row.Total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-grid-header text-grid-header-foreground font-bold">
            <td className="border border-border px-3 py-1.5">TOTAL</td>
            <td className="border border-border px-3 py-1.5 text-right">{fmt(tableData.reduce((s, r) => s + r.Espèces, 0))}</td>
            <td className="border border-border px-3 py-1.5 text-right">{fmt(tableData.reduce((s, r) => s + r.CB, 0))}</td>
            <td className="border border-border px-3 py-1.5 text-right">{fmt(tableData.reduce((s, r) => s + r.Total, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-primary mb-4">
        📈 Statistiques — {MONTH_NAMES[currentData.month]} {currentData.year}
      </h2>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "ligne" && (
        <div>
          {renderBarChart(statsByLine)}
          {renderTable(statsByLine)}
        </div>
      )}

      {tab === "conducteur" && (
        <div>
          {renderBarChart(statsByDriver, 400)}
          {renderTable(statsByDriver)}
        </div>
      )}

      {tab === "jour" && (
        <div>
          {renderBarChart(statsByDay, 300)}
          {renderTable(statsByDay)}
        </div>
      )}

      {tab === "mois" && (
        <div>
          {statsByMonth.length > 1 ? (
            <>
              {renderBarChart(statsByMonth)}
              {renderTable(statsByMonth)}
            </>
          ) : (
            <p className="text-muted-foreground text-sm italic">
              Archivez plusieurs mois pour voir l'évolution mensuelle.
            </p>
          )}
        </div>
      )}

      {tab === "paiement" && (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statsByPayment}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value.toFixed(2)} €`}
                dataKey="value"
              >
                {statsByPayment.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v.toFixed(2) + " €"} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 flex gap-8 text-sm">
            <div><span className="font-semibold">Espèces :</span> {fmt(statsByPayment[0].value)}</div>
            <div><span className="font-semibold">CB :</span> {fmt(statsByPayment[1].value)}</div>
            <div><span className="font-bold">Total :</span> {fmt(statsByPayment[0].value + statsByPayment[1].value)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
