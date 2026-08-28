import { useEffect, useState } from "react";
import { AlertTriangle, Clock, TrendingUp, Users2, Activity, Flame, CalendarClock, Loader2, User2, CheckCircle2, CalendarPlus, ChevronRight, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  monitoringDeadline, monitoringWorkload, monitoringCompliance, monitoringStagnant, monitoringDivProgress,
  monitoringUser, listDivisi, listAnggota, updateTask, monitoringHeatmap,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function Monitoring() {
  const { user } = useAuth();
  const isHead = user?.role !== "spv" && !!user?.can_monitor;
  const headDivisiId = user?.head_divisi_id;
  const headDivisiNama = user?.head_divisi_nama;
  const [tab, setTab] = useState("deadline");
  const [divisiList, setDivisiList] = useState([]);
  const [divisiId, setDivisiId] = useState("");

  useEffect(() => { listDivisi().then(setDivisiList).catch(() => {}); }, []);
  useEffect(() => { if (isHead && headDivisiId) setDivisiId(headDivisiId); }, [isHead, headDivisiId]);

  const visibleDivisi = isHead ? divisiList.filter((d) => d.id === headDivisiId) : divisiList;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-900 to-emerald-950 p-5 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"><Activity size={20} /></div>
          <div>
            <h3 className="font-display text-lg font-semibold">{isHead ? "Monitoring Tim (Head Divisi)" : "Monitoring SPV"}</h3>
            <p className="text-xs text-emerald-100/80">
              {isHead
                ? `Pantau tugas, beban kerja & progres divisi ${headDivisiNama || "Anda"} (read-only).`
                : "Cockpit tim & individu — deadline, beban kerja, kepatuhan amaliyah, task stagnan."}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isHead ? (
              <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs" data-testid="monitoring-head-divisi">
                Divisi: <b>{headDivisiNama || "-"}</b>
              </span>
            ) : (
              <>
                <label className="text-xs text-emerald-100/80">Filter tim:</label>
                <Select value={divisiId || "ALL"} onValueChange={(v) => setDivisiId(v === "ALL" ? "" : v)}>
                  <SelectTrigger className="h-8 w-40 text-xs bg-white/10 border-white/20 text-white" data-testid="monitoring-divisi">
                    <SelectValue placeholder="Semua Tim" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Tim</SelectItem>
                    {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-emerald-50 flex-wrap h-auto p-1">
          <TabsTrigger value="deadline" data-testid="tab-deadline" className="gap-1"><CalendarClock size={14} /> Deadline Radar</TabsTrigger>
          <TabsTrigger value="workload" data-testid="tab-workload" className="gap-1"><Users2 size={14} /> Beban Kerja</TabsTrigger>
          <TabsTrigger value="heatmap" data-testid="tab-heatmap" className="gap-1"><Grid3x3 size={14} /> Heatmap Beban</TabsTrigger>
          {!isHead && <TabsTrigger value="compliance" data-testid="tab-compliance" className="gap-1"><Flame size={14} /> Kepatuhan Amaliyah</TabsTrigger>}
          <TabsTrigger value="stagnant" data-testid="tab-stagnant" className="gap-1"><Clock size={14} /> Task Stagnan</TabsTrigger>
          <TabsTrigger value="divprogress" data-testid="tab-divprogress" className="gap-1"><TrendingUp size={14} /> Progres Divisi</TabsTrigger>
          <TabsTrigger value="peruser" data-testid="tab-peruser" className="gap-1"><User2 size={14} /> Per Anggota</TabsTrigger>
        </TabsList>

        <TabsContent value="deadline"><DeadlineRadar divisiId={divisiId} /></TabsContent>
        <TabsContent value="workload"><WorkloadView divisiId={divisiId} /></TabsContent>
        <TabsContent value="heatmap"><HeatmapView /></TabsContent>
        {!isHead && <TabsContent value="compliance"><ComplianceView /></TabsContent>}
        <TabsContent value="stagnant"><StagnantView /></TabsContent>
        <TabsContent value="divprogress"><DivProgressView /></TabsContent>
        <TabsContent value="peruser"><PerUserView divisiList={visibleDivisi} initialDivisiId={divisiId} lockDivisiId={isHead ? headDivisiId : null} /></TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingBox() {
  return <div className="grid place-items-center rounded-xl border border-emerald-100 bg-white p-12"><Loader2 className="animate-spin text-emerald-800" size={24} /></div>;
}

function EmptyBox({ label }) {
  return <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-8 text-center text-sm text-emerald-800/60">{label}</div>;
}

/* ============= TASK ACTIONS (deadline radar & individu) ============= */
async function markSelesai(taskId, onDone) {
  try {
    await updateTask(taskId, { status: "SELESAI" });
    toast.success("Task ditandai selesai");
    onDone?.();
  } catch { toast.error("Gagal update task"); }
}

async function bumpDeadline(task, days, onDone) {
  try {
    const base = task.deadline ? new Date(task.deadline) : new Date();
    base.setDate(base.getDate() + days);
    const newDeadline = base.toISOString().slice(0, 10);
    await updateTask(task.id, { deadline: newDeadline });
    toast.success(`Deadline diundur ke ${newDeadline}`);
    onDone?.();
  } catch { toast.error("Gagal update deadline"); }
}

function TaskCard({ t, tone = "emerald", onAction, showActions = true }) {
  const { user } = useAuth();
  const isHeadRO = user?.role !== "spv" && !!user?.can_monitor;
  const tones = {
    red: "border-red-200 bg-red-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    emerald: "border-emerald-200 bg-emerald-50/40",
  };
  const badge = tone === "red" ? "bg-red-600 text-white" : tone === "amber" ? "bg-amber-500 text-white" : "bg-emerald-700 text-white";

  const reason = tone === "red" ? "Terkena radar OVERDUE — deadline terlewat" : tone === "amber" ? "Deadline HARI INI — butuh follow-up" : "Deadline mendekati (≤3 hari)";

  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`} data-testid="deadline-task-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-emerald-950">{t.nama}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{t.deadline}</span>
      </div>
      <p className="mt-1 text-xs text-emerald-800/70">
        {t.divisi_nama} · {t.penerima_nama} · <span className="uppercase">{t.status}</span>
      </p>
      <p className="mt-1.5 text-[11px] italic text-emerald-800/60">⚠ {reason}</p>
      {showActions && !isHeadRO && (
        <div className="mt-2 flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-900 hover:bg-emerald-100"
            onClick={() => markSelesai(t.id, onAction)} data-testid="action-selesai">
            <CheckCircle2 size={12} /> Selesai
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-900 hover:bg-emerald-100"
            onClick={() => bumpDeadline(t, 3, onAction)} data-testid="action-bump-3">
            <CalendarPlus size={12} /> +3 hari
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-900 hover:bg-emerald-100"
            onClick={() => bumpDeadline(t, 7, onAction)} data-testid="action-bump-7">
            <CalendarPlus size={12} /> +7 hari
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============= DEADLINE RADAR ============= */
function DeadlineRadar({ divisiId }) {
  const [data, setData] = useState(null);
  const load = () => {
    setData(null);
    monitoringDeadline(divisiId ? { divisi_id: divisiId } : {}).then(setData).catch(() => setData({ overdue: [], today: [], upcoming: [], summary: {} }));
  };
  useEffect(load, [divisiId]);
  if (!data) return <LoadingBox />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={AlertTriangle} label="Overdue" value={data.summary.overdue} tone="red" testId="metric-overdue" />
        <MetricCard icon={Clock} label="Hari Ini" value={data.summary.today} tone="amber" testId="metric-today" />
        <MetricCard icon={CalendarClock} label="3 Hari Depan" value={data.summary.upcoming} tone="emerald" testId="metric-upcoming" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="Overdue" tone="red" items={data.overdue} onAction={load} />
        <Column title="Deadline Hari Ini" tone="amber" items={data.today} onAction={load} />
        <Column title="3 Hari Kedepan" tone="emerald" items={data.upcoming} onAction={load} />
      </div>
    </div>
  );
}

function Column({ title, tone, items, onAction }) {
  const borders = { red: "border-red-200", amber: "border-amber-200", emerald: "border-emerald-200" };
  const heads = { red: "text-red-800", amber: "text-amber-800", emerald: "text-emerald-800" };
  return (
    <div className={`rounded-xl border ${borders[tone]} bg-white p-3`}>
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${heads[tone]}`}>
        {title} <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-700">{items.length}</span>
      </h4>
      {items.length === 0 ? <p className="p-6 text-center text-xs text-emerald-800/50 italic">Kosong. Alhamdulillah.</p>
        : <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{items.map((t) => <TaskCard key={t.id} t={t} tone={tone} onAction={onAction} />)}</div>}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone, testId }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div data-testid={testId} className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
        <Icon size={16} />
      </div>
      <p className="font-display mt-1 text-3xl font-bold">{value ?? 0}</p>
    </div>
  );
}

/* ============= WORKLOAD ============= */
function WorkloadView({ divisiId }) {
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); monitoringWorkload(divisiId ? { divisi_id: divisiId } : {}).then(setData).catch(() => setData({ anggota: [], max: 1 })); }, [divisiId]);
  if (!data) return <LoadingBox />;
  if (data.anggota.length === 0) return <EmptyBox label="Belum ada anggota di tim ini." />;

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4" data-testid="workload-list">
      <div className="space-y-2">
        {data.anggota.map((a) => {
          const pct = (a.aktif / data.max) * 100;
          const overload = a.aktif > (data.max * 0.7) && a.aktif >= 5;
          return (
            <div key={a.id} className={`rounded-lg border p-3 ${overload ? "border-red-200 bg-red-50/40" : "border-emerald-100 bg-white"}`}>
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full font-bold text-white text-sm" style={{ background: a.warna || "#0ea5e9" }}>
                  {a.nama?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-950 truncate">{a.nama} <span className="text-xs text-emerald-800/60">· {a.divisi_nama}</span></p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                    <div className={`h-full rounded-full ${overload ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                  <Cell val={a.aktif} label="Aktif" strong />
                  <Cell val={a.proses} label="Proses" tone="amber" />
                  <Cell val={a.kendala} label="Kendala" tone="red" />
                  <Cell val={a.overdue} label="Overdue" tone="red" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ val, label, tone, strong }) {
  const c = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-800" : "text-emerald-900";
  return <div><p className={`font-display ${strong ? "text-lg" : "text-sm"} font-bold ${c}`}>{val}</p><p className="text-[10px] text-emerald-800/60">{label}</p></div>;
}

/* ============= COMPLIANCE ============= */
function ComplianceView() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  useEffect(() => { setData(null); monitoringCompliance({ days }).then(setData).catch(() => setData({ items: [], overall_pct: 0 })); }, [days]);
  if (!data) return <LoadingBox />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-800/60">Konsistensi Amaliyah</p>
          <p className="font-display text-3xl font-bold text-emerald-900">{data.overall_pct}%</p>
          <p className="text-xs text-emerald-800/60">{data.start} → {data.end}</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32 h-9 text-xs" data-testid="compliance-days"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 hari</SelectItem>
            <SelectItem value="14">14 hari</SelectItem>
            <SelectItem value="30">30 hari</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        {data.items.length === 0 ? <EmptyBox label="Belum ada amaliyah." /> : (
          <div className="space-y-2" data-testid="compliance-list">
            {data.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border border-emerald-100 p-3">
                <Flame size={18} className={it.pct >= 80 ? "text-emerald-600" : it.pct >= 50 ? "text-amber-600" : "text-red-500"} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-950 truncate">{it.nama}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, it.pct)}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-emerald-900">{it.pct}%</p>
                  <p className="text-[10px] text-emerald-800/60">{it.done}/{it.target}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============= STAGNANT ============= */
function StagnantView() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(3);
  useEffect(() => { setData(null); monitoringStagnant({ days }).then(setData).catch(() => setData({ tasks: [] })); }, [days]);
  if (!data) return <LoadingBox />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-800/60">Task Tanpa Update</p>
          <p className="font-display text-3xl font-bold text-emerald-900">{data.tasks.length}</p>
          <p className="text-xs text-emerald-800/60">Belum diubah &gt; {days} hari</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32 h-9 text-xs" data-testid="stagnant-days"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">&gt; 1 hari</SelectItem>
            <SelectItem value="3">&gt; 3 hari</SelectItem>
            <SelectItem value="7">&gt; 7 hari</SelectItem>
            <SelectItem value="14">&gt; 14 hari</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        {data.tasks.length === 0 ? <EmptyBox label="Tidak ada task stagnan. Tim aktif!" /> : (
          <div className="space-y-2" data-testid="stagnant-list">
            {data.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-100 text-amber-800">
                  <Clock size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-950 truncate">{t.nama}</p>
                  <p className="text-xs text-emerald-800/60">{t.divisi_nama} · {t.penerima_nama} · <span className="uppercase">{t.status}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-amber-800">{t.hari_diam}h</p>
                  <p className="text-[10px] text-emerald-800/60">diam</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============= DIV PROGRESS ============= */
function DivProgressView() {
  const [data, setData] = useState(null);
  useEffect(() => { monitoringDivProgress().then(setData).catch(() => setData({ divisi: [] })); }, []);
  if (!data) return <LoadingBox />;
  if (data.divisi.length === 0) return <EmptyBox label="Belum ada divisi." />;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.divisi.map((d) => (
        <div key={d.id} className="rounded-xl border border-emerald-100 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: d.warna }} />
            <p className="font-display font-semibold text-emerald-950">{d.nama}</p>
            <span className="ml-auto font-display text-xl font-bold text-emerald-900">{d.pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${d.pct}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            <div><p className="font-display text-base font-bold text-emerald-900">{d.total}</p><p className="text-[10px] text-emerald-800/60">Total</p></div>
            <div><p className="font-display text-base font-bold text-emerald-700">{d.selesai}</p><p className="text-[10px] text-emerald-800/60">Selesai</p></div>
            <div><p className="font-display text-base font-bold text-amber-700">{d.overdue}</p><p className="text-[10px] text-emerald-800/60">Overdue</p></div>
            <div><p className="font-display text-base font-bold text-red-600">{d.terkendala}</p><p className="text-[10px] text-emerald-800/60">Kendala</p></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============= PER USER ============= */
function PerUserView({ divisiList, initialDivisiId, lockDivisiId }) {
  const [anggotaList, setAnggotaList] = useState([]);
  const [divisiId, setDivisiId] = useState(lockDivisiId || initialDivisiId || "ALL");
  const [anggotaId, setAnggotaId] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => { listAnggota().then(setAnggotaList).catch(() => {}); }, []);
  useEffect(() => { setDivisiId(lockDivisiId || initialDivisiId || "ALL"); }, [initialDivisiId, lockDivisiId]);

  const filtered = anggotaList.filter((a) => divisiId === "ALL" || a.divisi_id === divisiId);

  const load = () => {
    if (!anggotaId) { setData(null); return; }
    setData(null);
    monitoringUser(anggotaId, { days: 7 }).then(setData).catch(() => setData({ error: true }));
  };
  useEffect(load, [anggotaId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <User2 size={16} className="text-emerald-800" />
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Monitoring per Anggota</p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!lockDivisiId && (
              <Select value={divisiId} onValueChange={(v) => { setDivisiId(v); setAnggotaId(""); }}>
                <SelectTrigger className="h-9 w-40 text-xs" data-testid="peruser-divisi">
                  <SelectValue placeholder="Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Divisi</SelectItem>
                  {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={anggotaId} onValueChange={setAnggotaId}>
              <SelectTrigger className="h-9 w-56 text-xs" data-testid="peruser-anggota">
                <SelectValue placeholder="Pilih anggota…" />
              </SelectTrigger>
              <SelectContent>
                {filtered.length === 0 && <SelectItem value="__empty__" disabled>Tidak ada anggota</SelectItem>}
                {filtered.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!anggotaId && <EmptyBox label="Pilih anggota untuk melihat rincian." />}
      {anggotaId && !data && <LoadingBox />}
      {anggotaId && data && data.error && <EmptyBox label="Data anggota tidak ditemukan." />}
      {anggotaId && data && data.anggota && (
        <div className="space-y-4" data-testid="peruser-detail">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full font-bold text-white text-lg" style={{ background: data.anggota.warna || data.anggota.divisi_warna || "#059669" }}>
                {data.anggota.nama?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-emerald-950">{data.anggota.nama}</p>
                <p className="text-xs text-emerald-800/70">Divisi: <span className="font-medium">{data.anggota.divisi_nama}</span></p>
              </div>
              <div className="ml-auto grid grid-cols-4 gap-3 text-center">
                <MiniStat label="Aktif" value={data.workload.aktif} />
                <MiniStat label="Selesai" value={data.workload.selesai} tone="emerald" />
                <MiniStat label="Kendala" value={data.workload.kendala} tone="red" />
                <MiniStat label="Overdue" value={data.deadline.summary.overdue} tone="red" />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-emerald-800/70">Progres tugas</span>
                <span className="font-semibold text-emerald-900">{data.workload.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${data.workload.pct}%` }} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Column title="Overdue" tone="red" items={data.deadline.overdue} onAction={load} />
            <Column title="Deadline Hari Ini" tone="amber" items={data.deadline.today} onAction={load} />
            <Column title="3 Hari Kedepan" tone="emerald" items={data.deadline.upcoming} onAction={load} />
          </div>

          {/* Stagnant */}
          <div className="rounded-xl border border-emerald-100 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={14} className="text-amber-700" />
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Task Stagnan (&gt;3 hari)</p>
              <span className="ml-auto text-xs text-emerald-800/60">{data.stagnant.length} task</span>
            </div>
            {data.stagnant.length === 0 ? <p className="p-4 text-center text-xs italic text-emerald-800/50">Tidak ada task stagnan.</p> :
              <div className="space-y-2">
                {data.stagnant.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/30 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-emerald-950">{t.nama}</p>
                      <p className="text-[11px] text-emerald-800/60">{t.divisi_nama} · <span className="uppercase">{t.status}</span></p>
                    </div>
                    <p className="text-xs font-bold text-amber-800">{t.hari_diam}h diam</p>
                    {!lockDivisiId && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => markSelesai(t.id, load)}>
                        <CheckCircle2 size={12} /> Selesai
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => bumpDeadline(t, 7, load)}>
                        <CalendarPlus size={12} /> +7h
                      </Button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </div>

          {/* Amaliyah */}
          <div className="rounded-xl border border-emerald-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Flame size={14} className="text-emerald-700" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Kepatuhan Amaliyah (7 hari)</p>
              <span className="ml-auto font-display text-xl font-bold text-emerald-900">{data.amaliyah.overall_pct}%</span>
            </div>
            {!data.amaliyah.linked ? (
              <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Anggota belum di-link ke user login — data amaliyah tidak tersedia.
              </p>
            ) : data.amaliyah.items.length === 0 ? <p className="text-xs italic text-emerald-800/50">Belum ada amaliyah.</p> : (
              <div className="space-y-2">
                {data.amaliyah.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3">
                    <p className="w-40 truncate text-sm text-emerald-950">{it.nama}</p>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, it.pct)}%` }} />
                    </div>
                    <p className="w-20 text-right text-xs text-emerald-900"><b>{it.pct}%</b> · {it.done}/{it.target}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const c = tone === "red" ? "text-red-700" : tone === "emerald" ? "text-emerald-700" : "text-emerald-900";
  return (
    <div>
      <p className={`font-display text-xl font-bold ${c}`}>{value ?? 0}</p>
      <p className="text-[10px] uppercase tracking-wider text-emerald-800/60">{label}</p>
    </div>
  );
}

/* ============= HEATMAP BEBAN (divisi × status) ============= */
const HEAT_COLS = [
  { key: "BELUM_MULAI", label: "Belum Mulai", rgb: "100,116,139" },
  { key: "DALAM_PROSES", label: "Proses", rgb: "217,119,6" },
  { key: "TERKENDALA", label: "Kendala", rgb: "220,38,38" },
  { key: "SELESAI", label: "Selesai", rgb: "5,150,105" },
  { key: "OVERDUE", label: "Overdue", rgb: "225,29,72" },
];

function heatBg(val, max, rgb) {
  if (!val) return "transparent";
  const alpha = 0.14 + 0.86 * (val / (max || 1));
  return `rgba(${rgb},${Math.min(1, alpha).toFixed(2)})`;
}

function HeatmapView() {
  const [data, setData] = useState(null);
  useEffect(() => { monitoringHeatmap().then(setData).catch(() => setData({ divisi: [], statuses: [], max: 1, totals: {} })); }, []);
  if (!data) return <LoadingBox />;
  if (data.divisi.length === 0) return <EmptyBox label="Belum ada divisi." />;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="flex items-center gap-2">
          <Grid3x3 size={16} className="text-emerald-800" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Peta Beban Tim</p>
            <p className="text-xs text-emerald-800/60">Distribusi tugas per divisi × status. Warna makin pekat = makin banyak tugas.</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-emerald-100 bg-white p-2">
        <table className="w-full min-w-[640px] border-separate" style={{ borderSpacing: "4px" }}>
          <thead>
            <tr>
              <th className="p-2 text-left text-[11px] font-semibold uppercase tracking-wider text-emerald-800/60">Divisi</th>
              {HEAT_COLS.map((c) => (
                <th key={c.key} className="p-2 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: `rgb(${c.rgb})` }} data-testid={`heatmap-col-${c.key.toLowerCase()}`}>{c.label}</th>
              ))}
              <th className="p-2 text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-800/60">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.divisi.map((d) => (
              <tr key={d.id} data-testid="heatmap-row">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: d.warna }} />
                    <span className="text-sm font-medium text-emerald-950">{d.nama}</span>
                  </div>
                </td>
                {HEAT_COLS.map((c) => {
                  const val = d.cells?.[c.key] || 0;
                  const bg = heatBg(val, data.max, c.rgb);
                  const dark = val && val / (data.max || 1) > 0.5;
                  return (
                    <td key={c.key} className="rounded-lg p-3 text-center font-display text-lg font-bold transition-colors"
                      style={{ background: bg, color: dark ? "#fff" : val ? `rgb(${c.rgb})` : "#cbd5e1" }} data-testid="heatmap-cell">
                      {val || "·"}
                    </td>
                  );
                })}
                <td className="p-3 text-center font-display text-lg font-bold text-emerald-900">{d.total}</td>
              </tr>
            ))}
            <tr>
              <td className="p-2 text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Total</td>
              {HEAT_COLS.map((c) => (
                <td key={c.key} className="p-2 text-center text-sm font-bold text-emerald-900">{data.totals?.[c.key] ?? 0}</td>
              ))}
              <td className="p-2 text-center text-sm font-bold text-emerald-900">{data.totals?.total ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
