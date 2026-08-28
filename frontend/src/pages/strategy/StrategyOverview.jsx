import { useEffect, useState } from "react";
import { strategyDashboard, visionGet } from "@/lib/api";
import { BookOpen, Landmark, Compass, Gauge, Rocket, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

function Metric({ icon: Icon, label, value, sub, tone = "emerald", testId }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
    gold: "border-amber-200 bg-amber-50/50 text-amber-900",
    red: "border-red-200 bg-red-50/50 text-red-900",
    slate: "border-slate-200 bg-slate-50/50 text-slate-900",
    violet: "border-violet-200 bg-violet-50/50 text-violet-900",
  };
  return (
    <div data-testid={testId} className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <Icon size={16} />
      </div>
      <p className="font-display mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  );
}

export default function StrategyOverview({ periodId, period }) {
  const [data, setData] = useState(null);
  const [vision, setVision] = useState(null);

  useEffect(() => {
    if (!periodId) return;
    strategyDashboard(periodId).then(setData).catch(() => setData({}));
    visionGet(periodId).then(setVision).catch(() => setVision(null));
  }, [periodId]);

  if (!periodId) return null;

  const d = data || {};
  const hasVision = vision && (vision.visi || (vision.misi || []).length > 0);

  return (
    <div className="space-y-4">
      {/* VISION BANNER */}
      {hasVision ? (
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-amber-700" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Visi Perusahaan</p>
          </div>
          {vision.visi && <p className="mt-2 font-display text-lg italic text-emerald-950">"{vision.visi}"</p>}
          {(vision.nilai || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {vision.nilai.map((n) => (
                <span key={n} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">{n}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-700" />
            <p className="text-sm font-semibold text-amber-900">Visi &amp; Misi belum diisi</p>
          </div>
          <p className="mt-1 text-xs text-amber-800/80">Fondasi strategi belum lengkap. Isi Visi &amp; Misi terlebih dahulu di tab pertama.</p>
        </div>
      )}

      {/* METRIC CARDS */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Landmark} label="BSC Target" value={d.bsc_count || 0} sub="Balanced Scorecard items" testId="ov-bsc" />
        <Metric icon={Compass} label="OKR Objectives" value={d.okr_count || 0} sub={`Rata-rata progres ${d.okr_avg_progress || 0}%`} tone="gold" testId="ov-okr" />
        <Metric icon={Gauge} label="KPI Items" value={d.kpi_count || 0} sub={`Skor tim ${d.kpi_final_score || 0} / ${d.kpi_total_bobot || 0}`} testId="ov-kpi" />
        <Metric icon={Rocket} label="Proyek Strategis" value={d.project_count || 0} sub={`${d.project_selesai || 0} selesai · ${d.project_terlambat || 0} terlambat`} tone={d.project_terlambat > 0 ? "red" : "emerald"} testId="ov-projects" />
      </div>

      {/* FLOW / PANDUAN */}
      <div className="rounded-2xl border border-emerald-100 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Alur Eksekusi Strategi (BSC × OKR)</p>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          {[
            { label: "Visi & Misi", desc: "Jangkar strategi", tone: "amber" },
            { label: "BSC", desc: "Target tahunan 4 aspek", tone: "emerald" },
            { label: "OKR", desc: "Objective quarterly (linked to BSC)", tone: "emerald" },
            { label: "KPI", desc: "Indikator individu", tone: "emerald" },
            { label: "Action Plan", desc: "Proyek → tasks", tone: "emerald" },
            { label: "Komitmen", desc: "Surat kesepakatan PDF", tone: "gold" },
          ].map((s, i, arr) => (
            <div key={s.label} className="flex flex-col">
              <div className={`rounded-lg border p-3 ${s.tone === "amber" ? "border-amber-200 bg-amber-50/60" : s.tone === "gold" ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
                <p className="font-display text-sm font-semibold text-emerald-950">{s.label}</p>
                <p className="text-[10px] text-emerald-800/60">{s.desc}</p>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight size={12} className="mx-auto mt-1 text-emerald-500 md:rotate-0 rotate-90" />
              )}
            </div>
          ))}
        </div>

        <ol className="mt-5 space-y-2 text-sm text-emerald-950">
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> <b>Visi &amp; Misi</b> — jangkar. Setiap BSC / OKR sebaiknya diturunkan dari sini.</li>
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> <b>BSC</b> — target tahunan 4 aspek (Financial, Customer, Internal Process, Learning). Peta jalan multi-tahun.</li>
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> <b>OKR</b> — kuartal/siklus. Setiap Objective <b>di-selaraskan</b> ke satu target BSC via dropdown (BSC → OKR alignment).</li>
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> <b>KPI</b> — indikator individu (bobot, target, aktual). Bisa di-link ke OKR sebagai anchor.</li>
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> <b>Action Plan</b> — proyek strategis terhubung ke tasks (progress otomatis).</li>
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> <b>Komitmen</b> — cetak Surat Kesepakatan Target per divisi (Visi + BSC + OKR + KPI + tanda tangan tim).</li>
        </ol>
        {period && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
            Periode aktif: <b>{period.nama}</b> · {period.start} → {period.end} · siklus tiap {period.siklus_bulan} bulan.
          </p>
        )}
      </div>
    </div>
  );
}
