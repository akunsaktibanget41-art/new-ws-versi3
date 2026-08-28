import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, Circle, TrendingUp, Sparkles, CalendarDays, Flame, ArrowRightLeft, AlarmClock, Zap } from "lucide-react";
import { raportSummary, listTasks, listEntries, listAmaliyahItems, dashboardDigest } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const STATUS_META = {
  SELESAI: { label: "Selesai", icon: CheckCircle2, color: "text-emerald-700 bg-emerald-100" },
  DALAM_PROSES: { label: "Dalam Proses", icon: Clock, color: "text-amber-800 bg-amber-100" },
  TERKENDALA: { label: "Terkendala", icon: AlertTriangle, color: "text-red-700 bg-red-100" },
  BELUM_MULAI: { label: "Belum Mulai", icon: Circle, color: "text-slate-700 bg-slate-100" },
};

function StatCard({ label, value, sub, tone = "emerald", testId }) {
  const tones = {
    emerald: "border-emerald-200 bg-white",
    amber: "border-amber-200 bg-amber-50/50",
    red: "border-red-200 bg-red-50/50",
    slate: "border-slate-200 bg-slate-50/50",
  };
  return (
    <div data-testid={testId} className={`rounded-xl border p-5 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wider text-emerald-900/60">{label}</p>
      <p className="font-display mt-2 text-3xl font-bold text-emerald-950">{value}</p>
      {sub && <p className="mt-1 text-xs text-emerald-800/60">{sub}</p>}
    </div>
  );
}

function MiniCard({ icon: Icon, tone, label, value, sub, cta, ctaTo, testId }) {
  const tones = {
    emerald: "from-emerald-600 to-emerald-800 text-white",
    amber: "from-amber-500 to-orange-600 text-white",
    violet: "from-teal-600 to-emerald-800 text-white",
  };
  return (
    <div data-testid={testId} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-md shadow-emerald-900/10 ${tones[tone]}`}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15"><Icon size={16} /></div>
          <span className="text-[10px] uppercase tracking-widest opacity-70">{label}</span>
        </div>
        <p className="font-display mt-3 text-4xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs opacity-80">{sub}</p>
        {cta && ctaTo && (
          <Link to={ctaTo} className="mt-3 inline-block text-xs font-medium underline underline-offset-4 hover:opacity-100 opacity-90">
            {cta} →
          </Link>
        )}
      </div>
    </div>
  );
}

function DigestRow({ t, tone }) {
  const tones = {
    red: "border-red-200 bg-red-50/60 hover:bg-red-50",
    amber: "border-amber-200 bg-amber-50/60 hover:bg-amber-50",
    slate: "border-slate-200 bg-slate-50/40 hover:bg-slate-50",
  };
  const badge = { red: "bg-red-600 text-white", amber: "bg-amber-500 text-white", slate: "bg-slate-500 text-white" };
  return (
    <Link to="/tasks" className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 transition ${tones[tone]}`} data-testid="digest-item">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-emerald-950">{t.nama}</p>
        <p className="mt-0.5 text-[11px] text-emerald-800/70">
          {t.divisi_nama} · {t.penerima_nama} · <span className="uppercase">{(t.status || "").replaceAll("_", " ")}</span>
        </p>
      </div>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge[tone]}`}>{t.deadline || "-"}</span>
    </Link>
  );
}

function DeadlineDigest() {
  const [d, setD] = useState(null);
  useEffect(() => { dashboardDigest().then(setD).catch(() => setD({ counts: {}, overdue: [], today: [], upcoming: [], stagnant: [] })); }, []);
  if (!d) return null;
  const empty = (d.counts.overdue + d.counts.today + d.counts.upcoming + d.counts.stagnant) === 0;

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 md:p-6" data-testid="spv-deadline-digest">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-900 text-white">
          <AlarmClock size={16} />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-emerald-950">Ringkasan Deadline Harian</h3>
          <p className="text-[11px] text-emerald-800/60">Digest SPV — task overdue, deadline hari ini, 3 hari ke depan, & task stagnan.</p>
        </div>
        <Link to="/monitoring" className="ml-auto text-xs font-medium text-emerald-800 hover:text-emerald-950">
          Buka Monitoring →
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <DigestChip icon={AlertTriangle} label="Overdue" value={d.counts.overdue} tone="red" testId="digest-overdue" />
        <DigestChip icon={Clock} label="Hari Ini" value={d.counts.today} tone="amber" testId="digest-today" />
        <DigestChip icon={CalendarDays} label="3 Hari Depan" value={d.counts.upcoming} tone="emerald" testId="digest-upcoming" />
        <DigestChip icon={Zap} label="Stagnan (>3h)" value={d.counts.stagnant} tone="slate" testId="digest-stagnant" />
      </div>

      {empty ? (
        <p className="mt-4 rounded-lg border border-dashed border-emerald-200 p-6 text-center text-sm text-emerald-800/60 italic">
          Alhamdulillah, tidak ada task yang butuh perhatian.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-800">Butuh Aksi Sekarang</p>
            <div className="space-y-1.5">
              {d.overdue.slice(0, 4).map((t) => <DigestRow key={t.id} t={t} tone="red" />)}
              {d.today.slice(0, 3).map((t) => <DigestRow key={t.id} t={t} tone="amber" />)}
              {d.overdue.length + d.today.length === 0 && <p className="text-xs text-emerald-800/50 italic">Tidak ada.</p>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-800">Perhatian Berikutnya</p>
            <div className="space-y-1.5">
              {d.upcoming.slice(0, 3).map((t) => <DigestRow key={t.id} t={t} tone="slate" />)}
              {d.stagnant.slice(0, 3).map((t) => <DigestRow key={t.id} t={t} tone="slate" />)}
              {d.upcoming.length + d.stagnant.length === 0 && <p className="text-xs text-emerald-800/50 italic">Tidak ada.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DigestChip({ icon: Icon, label, value, tone, testId }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  };
  return (
    <div data-testid={testId} className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
        <Icon size={14} />
      </div>
      <p className="font-display mt-1 text-2xl font-bold">{value ?? 0}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [movedCount, setMovedCount] = useState(0);
  const [amalStreak, setAmalStreak] = useState({ pct: 0, days: 0, target: 0 });

  useEffect(() => {
    raportSummary().then(setSummary).catch(() => {});
    listTasks().then((rows) => {
      setTasks(rows.slice(0, 6));
      const today = new Date().toISOString().slice(0, 10);
      const t = rows.filter((r) => r.deadline === today && r.status !== "SELESAI").length;
      const m = rows.filter((r) => r.moved_at).length;
      setTodayCount(t); setMovedCount(m);
    }).catch(() => {});

    (async () => {
      try {
        const items = await listAmaliyahItems();
        const end = new Date();
        const start = new Date(); start.setDate(end.getDate() - 6);
        const s = start.toISOString().slice(0, 10);
        const e = end.toISOString().slice(0, 10);
        const entries = await listEntries({ start: s, end: e });
        const done = entries.filter((x) => x.checked).length;
        const target = items.length * 7;
        setAmalStreak({ pct: target ? Math.round((done / target) * 100) : 0, days: done, target });
      } catch {}
    })();
  }, []);

  const task = summary?.task || {};
  const amal = summary?.amaliyah || {};
  const combined = summary?.combined_score ?? 0;
  const greeting = new Date().getHours() < 11 ? "Selamat pagi" : new Date().getHours() < 15 ? "Selamat siang" : new Date().getHours() < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="textured-emerald relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-800">
              <Sparkles size={16} />
              <span className="text-xs uppercase tracking-widest">Assalamu'alaikum</span>
            </div>
            <h1 className="font-display mt-2 text-3xl font-bold text-emerald-950 md:text-4xl">
              {greeting}, {user?.name?.split(" ")[0] || "Sahabat"}.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-900/70">
              Kelola tugas harian, mingguan hingga project. Catat amaliyah pagi & petang. Lihat raport untuk rekomendasi <span className="font-semibold text-emerald-800">reward</span> atau <span className="font-semibold text-emerald-800">evaluasi</span>.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5" data-testid="hero-combined-score">
            <p className="text-xs uppercase tracking-widest text-emerald-800/70">Skor Gabungan</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold text-emerald-900">{combined}</span>
              <span className="text-lg text-emerald-700">/100</span>
            </div>
            <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${combined}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* SPV DIGEST */}
      {user?.role === "spv" && <DeadlineDigest />}

      {/* Mini overview cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="mini-overview">
        <MiniCard testId="card-today-tasks" icon={CalendarDays} tone="emerald" label="Hari Ini" value={todayCount}
          sub={todayCount === 0 ? "Tidak ada deadline hari ini." : `${todayCount} tugas jatuh tempo hari ini`}
          cta="Buka Tugas" ctaTo="/tasks" />
        <MiniCard testId="card-amaliyah-streak" icon={Flame} tone="amber" label="Streak Amaliyah" value={`${amalStreak.pct}%`}
          sub={`${amalStreak.days}/${amalStreak.target} check-in (7 hari)`} cta="Isi Amaliyah" ctaTo="/spiritual" />
        <MiniCard testId="card-recent-moves" icon={ArrowRightLeft} tone="violet" label="Pemindahan Baru" value={movedCount}
          sub={movedCount === 0 ? "Tidak ada pemindahan baru." : `${movedCount} task baru dipindah antar tim`}
          cta="Lihat" ctaTo="/tasks" />
      </section>

      {/* Task grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-emerald-950">Ringkasan Tugas</h3>
          <Link to="/tasks" className="text-sm font-medium text-emerald-700 hover:text-emerald-900" data-testid="link-tasks">
            Lihat semua →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Tugas" value={task.total || 0} sub={`${task.score || 0}% selesai`} testId="stat-total-tasks" />
          <StatCard label="Selesai" value={task.selesai || 0} tone="emerald" testId="stat-selesai" />
          <StatCard label="Dalam Proses" value={task.dalam_proses || 0} tone="amber" testId="stat-dalam-proses" />
          <StatCard label="Overdue" value={task.overdue || 0} sub={`${task.terkendala || 0} terkendala`} tone="red" testId="stat-overdue" />
        </div>
      </section>

      {/* Amaliyah + Recent tasks */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-white p-6 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-emerald-950">Amaliyah 30 Hari</h3>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div className="mt-4">
            <div className="font-display text-4xl font-bold text-emerald-900" data-testid="amaliyah-score">
              {amal.score || 0}%
            </div>
            <p className="mt-1 text-sm text-emerald-800/70">
              {amal.total_entries || 0} check-in dari {amal.target || 0} target
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${amal.score || 0}%` }} />
            </div>
            <Link to="/spiritual" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-900">
              Isi amaliyah hari ini →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold text-emerald-950">Tugas Terbaru</h3>
          <ul className="mt-4 divide-y divide-emerald-50">
            {tasks.length === 0 && (
              <li className="py-8 text-center text-sm text-emerald-800/60">Belum ada tugas. Yuk buat yang pertama!</li>
            )}
            {tasks.map((t) => {
              const meta = STATUS_META[t.status] || STATUS_META.BELUM_MULAI;
              const Icon = meta.icon;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-full ${meta.color}`}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-emerald-950">{t.nama}</p>
                    <p className="text-xs text-emerald-800/60">
                      {t.kategori} · {meta.label}
                      {t.deadline ? ` · deadline ${t.deadline}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
