import { useEffect, useMemo, useState } from "react";
import { Loader2, GanttChart, Circle } from "lucide-react";
import { projectsList } from "@/lib/api";

export default function LinimasaTab({ periodId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    projectsList(periodId).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [periodId]);

  const range = useMemo(() => {
    const dates = rows.flatMap((r) => [r.start_effective, r.end_effective]).filter(Boolean);
    if (dates.length === 0) return null;
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    return { min, max };
  }, [rows]);

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-10 text-center text-sm italic text-emerald-800/60">Belum ada proyek untuk periode ini.</div>;
  }

  // Compute total days for bar positioning
  let totalDays = 30;
  let startTs = new Date();
  if (range) {
    startTs = new Date(range.min);
    const endTs = new Date(range.max);
    totalDays = Math.max(1, Math.ceil((endTs - startTs) / 86400000) + 1);
  }

  // Generate month markers
  const months = [];
  if (range) {
    const cur = new Date(range.min);
    cur.setDate(1);
    const end = new Date(range.max);
    while (cur <= end) {
      const offsetDays = Math.max(0, Math.ceil((cur - startTs) / 86400000));
      months.push({ label: cur.toLocaleDateString("id-ID", { month: "short", year: "numeric" }), offset: (offsetDays / totalDays) * 100 });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="flex items-center gap-2">
          <GanttChart size={18} className="text-emerald-800" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Linimasa Proyek</p>
            <p className="text-sm text-emerald-950">Peta jadwal proyek — mudah lihat proyek mana yang tumpang tindih.</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-emerald-100 bg-white p-4">
        <div className="min-w-[720px]">
          {/* Month header */}
          <div className="relative mb-2 h-6 border-b border-emerald-100">
            {months.map((m, i) => (
              <span key={i} className="absolute top-0 text-[10px] text-emerald-800/60" style={{ left: `${m.offset}%` }}>
                {m.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {rows.map((r) => {
              if (!r.start_effective || !r.end_effective) {
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <p className="w-56 shrink-0 truncate text-sm font-medium text-emerald-950">{r.nama}</p>
                    <div className="flex-1 rounded border border-dashed border-slate-200 p-1 text-center text-[10px] italic text-slate-500">
                      Belum ada jadwal — tambahkan tanggal atau tautkan task.
                    </div>
                  </div>
                );
              }
              const s = new Date(r.start_effective);
              const e = new Date(r.end_effective);
              const startOffset = Math.max(0, Math.ceil((s - startTs) / 86400000));
              const dur = Math.max(1, Math.ceil((e - s) / 86400000) + 1);
              const leftPct = (startOffset / totalDays) * 100;
              const widthPct = (dur / totalDays) * 100;
              const st = r.summary?.status || "BELUM_MULAI";
              const barColor = st === "SELESAI" ? "bg-emerald-500" : st === "TERLAMBAT" ? "bg-red-500" : st === "BERJALAN" ? "bg-sky-500" : "bg-slate-400";
              return (
                <div key={r.id} className="flex items-center gap-3" data-testid="timeline-row">
                  <p className="w-56 shrink-0 truncate text-sm font-medium text-emerald-950" title={r.nama}>{r.nama}</p>
                  <div className="relative h-8 flex-1 rounded bg-emerald-50/40">
                    <div className={`absolute top-1 h-6 rounded ${barColor} shadow-sm`} style={{ left: `${leftPct}%`, width: `${Math.max(2, widthPct)}%` }}>
                      <span className="block truncate px-2 text-[10px] leading-6 text-white">
                        {r.start_effective} → {r.end_effective}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 border-t border-emerald-50 pt-3 text-[11px] text-emerald-800/70">
            <span className="flex items-center gap-1"><Circle className="fill-sky-500 text-sky-500" size={10} /> Berjalan</span>
            <span className="flex items-center gap-1"><Circle className="fill-emerald-500 text-emerald-500" size={10} /> Semua Tugas Selesai</span>
            <span className="flex items-center gap-1"><Circle className="fill-red-500 text-red-500" size={10} /> Ada Tugas Terlambat</span>
            <span className="flex items-center gap-1"><Circle className="fill-slate-400 text-slate-400" size={10} /> Belum Mulai</span>
          </div>
        </div>
      </div>
    </div>
  );
}
