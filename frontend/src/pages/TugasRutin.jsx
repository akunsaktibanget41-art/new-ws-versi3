import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Info } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { listTasks, listTodoEntries, upsertTodoEntry } from "@/lib/api";

// ISO week number (Mon-first)
function isoWeek(d) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Return array of ISO weeks (with year) covering the given month.
// A "pekan" only counts if the week has at least one operational day (Mon-Sat) inside the month.
// Sundays are excluded — they are not operational.
function weeksInMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const results = [];
  const seen = new Set();
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // skip Sunday (non-operational)
    const w = isoWeek(d);
    const y = weekYear(new Date(d));
    const key = `${y}-W${w}`;
    if (!seen.has(key)) {
      seen.add(key);
      // Compute operational range (Mon-Sat) for this week that intersects the month
      const monday = new Date(d);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // back to Monday
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);
      const rangeStart = monday < first ? first : monday;
      const rangeEnd = saturday > last ? last : saturday;
      // If range end is Sunday (0) — clamp back to Saturday
      if (rangeEnd.getDay() === 0) rangeEnd.setDate(rangeEnd.getDate() - 1);
      const startLabel = `${String(rangeStart.getDate()).padStart(2, "0")}/${String(rangeStart.getMonth() + 1).padStart(2, "0")}`;
      const endLabel = `${String(rangeEnd.getDate()).padStart(2, "0")}/${String(rangeEnd.getMonth() + 1).padStart(2, "0")}`;
      results.push({ week: w, year: y, label: `W${w}`, range: `${startLabel}–${endLabel}` });
    }
  }
  return results;
}

function weekYear(d) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  return target.getFullYear();
}

export default function TugasRutin() {
  const [tab, setTab] = useState("HARIAN");
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  useEffect(() => {
    setLoading(true);
    listTasks({ kategori: tab }).then(setTasks).finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    let start, end;
    if (tab === "HARIAN") {
      start = fmtDate(new Date(year, month, 1));
      end = fmtDate(new Date(year, month, daysInMonth));
    } else if (tab === "MINGGUAN") {
      // Query entire year of weeks to keep it simple
      start = `${year}-W01`;
      end = `${year}-W53`;
    } else {
      start = `${year}-01`;
      end = `${year}-12`;
    }
    listTodoEntries({ start, end }).then(setEntries);
  }, [tab, year, month, daysInMonth]);

  const entryMap = useMemo(() => {
    const m = new Map();
    entries.forEach((e) => m.set(`${e.task_id}::${e.period}`, e));
    return m;
  }, [entries]);

  const toggle = async (task_id, period) => {
    const existing = entryMap.get(`${task_id}::${period}`);
    const newChecked = !existing?.checked;
    const others = entries.filter((e) => !(e.task_id === task_id && e.period === period));
    setEntries([...others, { id: existing?.id || `tmp-${Math.random()}`, task_id, period, checked: newChecked }]);
    try {
      const saved = await upsertTodoEntry({ task_id, period, checked: newChecked });
      setEntries([...others, saved]);
    } catch { toast.error("Gagal simpan"); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="flex items-start gap-2 text-xs text-emerald-800/80">
          <Info size={14} className="mt-0.5 shrink-0 text-emerald-700" />
          <p>
            Tugas dengan kategori <b>Harian, Mingguan, Bulanan</b> muncul di sini. Tim tinggal ceklis setiap periode.
            Persentase harian dihitung <b>Senin–Sabtu</b> (Ahad libur).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-emerald-50" data-testid="rutin-tabs">
            <TabsTrigger value="HARIAN" data-testid="tab-harian">Harian</TabsTrigger>
            <TabsTrigger value="MINGGUAN" data-testid="tab-mingguan">Mingguan</TabsTrigger>
            <TabsTrigger value="BULANAN" data-testid="tab-bulanan">Bulanan</TabsTrigger>
          </TabsList>
        </Tabs>
        <PeriodNavigator tab={tab} cursor={cursor} setCursor={setCursor} />
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-emerald-800/60">Memuat...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 p-12 text-center">
          <p className="font-display text-lg text-emerald-900">Belum ada todo rutin {tab.toLowerCase()}</p>
          <p className="mt-2 text-sm text-emerald-800/60">
            Buat tugas baru di halaman <Link to="/tasks" className="font-semibold text-emerald-700 underline">Tugas</Link> dengan kategori <b>{tab}</b>.
          </p>
        </div>
      ) : tab === "HARIAN" ? (
        <HarianMatrix tasks={tasks} year={year} month={month} daysInMonth={daysInMonth} entryMap={entryMap} onToggle={toggle} />
      ) : tab === "MINGGUAN" ? (
        <MingguanMatrix tasks={tasks} year={year} month={month} entryMap={entryMap} onToggle={toggle} />
      ) : (
        <BulananMatrix tasks={tasks} year={year} entryMap={entryMap} onToggle={toggle} />
      )}
    </div>
  );
}

function PeriodNavigator({ tab, cursor, setCursor }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const goPrev = () => {
    if (tab === "BULANAN") setCursor(new Date(year - 1, month, 1));
    else setCursor(new Date(year, month - 1, 1));
  };
  const goNext = () => {
    if (tab === "BULANAN") setCursor(new Date(year + 1, month, 1));
    else setCursor(new Date(year, month + 1, 1));
  };
  const label =
    tab === "BULANAN"
      ? `Tahun ${year}`
      : `${cursor.toLocaleString("id-ID", { month: "long" })} ${year}`;
  return (
    <div className="flex items-center gap-2">
      <button onClick={goPrev} className="rounded-md border border-emerald-200 bg-white p-2 hover:bg-emerald-50" data-testid="rutin-prev">
        <ChevronLeft size={16} />
      </button>
      <div className="min-w-[180px] rounded-lg border border-emerald-200 bg-white px-4 py-2 text-center">
        <p className="font-display text-sm font-semibold text-emerald-950" data-testid="rutin-period-label">{label}</p>
      </div>
      <button onClick={goNext} className="rounded-md border border-emerald-200 bg-white p-2 hover:bg-emerald-50" data-testid="rutin-next">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function Cell({ checked, onClick, disabled, testId, size = "md" }) {
  const sz = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      data-testid={testId}
      className={`${sz} rounded transition ${
        disabled ? "cursor-not-allowed bg-slate-100 opacity-50"
        : checked ? "bg-emerald-500 text-white shadow-sm"
        : "border border-emerald-200 bg-white hover:bg-emerald-50"
      }`}
    >
      {checked && !disabled ? "✓" : ""}
    </button>
  );
}

function StatBar({ pct, count, total }) {
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-end gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          <Flame size={12} /> {count}/{total}
        </span>
        <span className="font-display text-sm font-bold text-emerald-900">{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HarianMatrix({ tasks, year, month, daysInMonth, entryMap, onToggle }) {
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const workingDays = days.filter((d) => new Date(year, month, d).getDay() !== 0);
  const stats = tasks.map((t) => {
    const checkedCount = workingDays.reduce((acc, d) => {
      const period = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return acc + (entryMap.get(`${t.id}::${period}`)?.checked ? 1 : 0);
    }, 0);
    const target = workingDays.length;
    return { ...t, checkedCount, target, pct: Math.round((checkedCount / target) * 100) };
  });

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4 md:p-6 thin-scroll overflow-x-auto">
      <table className="min-w-full text-sm" data-testid="harian-matrix">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white p-2 text-left font-semibold text-emerald-900">Todo Harian</th>
            {days.map((d) => {
              const dow = new Date(year, month, d).getDay();
              const isAhad = dow === 0;
              const isToday = isCurrentMonth && today.getDate() === d;
              return (
                <th key={d} className={`p-1 text-center text-[11px] ${isAhad ? "text-red-400/70" : "text-emerald-800/60"}`}>
                  <div className={`mx-auto grid h-6 w-6 place-items-center rounded ${isToday ? "bg-emerald-900 text-white" : ""}`}>{d}</div>
                  <div className="text-[9px]">{["A", "S", "S", "R", "K", "J", "S"][dow]}</div>
                </th>
              );
            })}
            <th className="p-2 text-right font-semibold text-emerald-900">Progress</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((t) => (
            <tr key={t.id} className="border-t border-emerald-50">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 font-medium text-emerald-950">
                <div className="min-w-[180px]">{t.nama}</div>
              </td>
              {days.map((d) => {
                const dow = new Date(year, month, d).getDay();
                const period = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const e = entryMap.get(`${t.id}::${period}`);
                return (
                  <td key={d} className="p-1 text-center">
                    <Cell checked={!!e?.checked} onClick={() => onToggle(t.id, period)} disabled={dow === 0} testId={`harian-cell-${t.id}-${d}`} />
                  </td>
                );
              })}
              <td className="p-2 text-right"><StatBar pct={t.pct} count={t.checkedCount} total={t.target} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MingguanMatrix({ tasks, year, month, entryMap, onToggle }) {
  const weeks = useMemo(() => weeksInMonth(year, month), [year, month]);
  const today = new Date();
  const currentWeek = isoWeek(today);
  const currentWeekYear = weekYear(today);

  const stats = tasks.map((t) => {
    const count = weeks.reduce((acc, w) => {
      const period = `${w.year}-W${String(w.week).padStart(2, "0")}`;
      return acc + (entryMap.get(`${t.id}::${period}`)?.checked ? 1 : 0);
    }, 0);
    const target = weeks.length || 1;
    return { ...t, count, target, pct: Math.round((count / target) * 100) };
  });

  const monthName = new Date(year, month, 1).toLocaleString("id-ID", { month: "long" });

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-emerald-800/60">Pekan operasional (Sen–Sab) di bulan</p>
        <p className="font-display text-sm font-semibold text-emerald-950">{monthName} {year}</p>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{weeks.length} pekan</span>
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="min-w-full text-sm" data-testid="mingguan-matrix">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white p-2 text-left font-semibold text-emerald-900">Todo Mingguan</th>
              {weeks.map((w, i) => {
                const isCurrent = w.year === currentWeekYear && w.week === currentWeek;
                return (
                  <th key={`${w.year}-${w.week}`} className="p-1 text-center text-[10px] text-emerald-800/60 min-w-[56px]">
                    <div className={`mx-auto grid h-7 w-14 place-items-center rounded ${isCurrent ? "bg-emerald-900 text-white" : ""}`}>W{w.week}</div>
                    <div className="mt-0.5 text-[9px] text-emerald-700/60">Pekan {i + 1}</div>
                    <div className="text-[9px] text-emerald-700/50">{w.range}</div>
                    <div className="text-[8px] uppercase tracking-wider text-emerald-700/40">Sen–Sab</div>
                  </th>
                );
              })}
              <th className="p-2 text-right font-semibold text-emerald-900">Progress</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((t) => (
              <tr key={t.id} className="border-t border-emerald-50">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 font-medium text-emerald-950">
                  <div className="min-w-[180px]">{t.nama}</div>
                </td>
                {weeks.map((w) => {
                  const period = `${w.year}-W${String(w.week).padStart(2, "0")}`;
                  const e = entryMap.get(`${t.id}::${period}`);
                  return (
                    <td key={`${w.year}-${w.week}`} className="p-1 text-center">
                      <Cell checked={!!e?.checked} onClick={() => onToggle(t.id, period)} testId={`mingguan-cell-${t.id}-${w.week}`} />
                    </td>
                  );
                })}
                <td className="p-2 text-right"><StatBar pct={t.pct} count={t.count} total={t.target} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulananMatrix({ tasks, year, entryMap, onToggle }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const isCurrentYear = today.getFullYear() === year;
  const stats = tasks.map((t) => {
    const count = months.reduce((acc, m) => {
      const period = `${year}-${String(m).padStart(2, "0")}`;
      return acc + (entryMap.get(`${t.id}::${period}`)?.checked ? 1 : 0);
    }, 0);
    return { ...t, count, target: 12, pct: Math.round((count / 12) * 100) };
  });

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4 md:p-6 thin-scroll overflow-x-auto">
      <table className="min-w-full text-sm" data-testid="bulanan-matrix">
        <thead>
          <tr>
            <th className="p-2 text-left font-semibold text-emerald-900">Todo Bulanan</th>
            {months.map((m) => (
              <th key={m} className="p-2 text-center text-xs font-semibold text-emerald-800/70">
                <span className={`inline-grid h-7 w-9 place-items-center rounded ${isCurrentYear && m === currentMonth ? "bg-emerald-900 text-white" : ""}`}>{monthLabels[m - 1]}</span>
              </th>
            ))}
            <th className="p-2 text-right font-semibold text-emerald-900">Progress</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((t) => (
            <tr key={t.id} className="border-t border-emerald-50">
              <td className="whitespace-nowrap p-2 font-medium text-emerald-950">{t.nama}</td>
              {months.map((m) => {
                const period = `${year}-${String(m).padStart(2, "0")}`;
                const e = entryMap.get(`${t.id}::${period}`);
                return (
                  <td key={m} className="p-2 text-center">
                    <Cell checked={!!e?.checked} onClick={() => onToggle(t.id, period)} testId={`bulanan-cell-${t.id}-${m}`} />
                  </td>
                );
              })}
              <td className="p-2 text-right"><StatBar pct={t.pct} count={t.count} total={t.target} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
