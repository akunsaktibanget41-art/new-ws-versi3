import { useEffect, useState } from "react";
import {
  Loader2, FileDown, BookOpen, Landmark, Compass, Rocket, Gauge, Building2,
  Save, Trophy, AlertTriangle, Target as TargetIcon, ClipboardCheck, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { evaluationGet, evaluationUpsert, evaluasiPdfUrl } from "@/lib/api";

const LABEL_TEXT = { OFF_TRACK: "OFF TRACK", NEED_IMPROVEMENT: "NEED IMPROVEMENT", ON_TRACK: "ON TRACK", EXCELLENT: "ON TRACK", AT_RISK: "NEED IMPROVEMENT" };
const LABEL_CHIP = {
  OFF_TRACK: "bg-red-100 text-red-800 border-red-300",
  NEED_IMPROVEMENT: "bg-amber-100 text-amber-800 border-amber-300",
  ON_TRACK: "bg-emerald-100 text-emerald-800 border-emerald-300",
  EXCELLENT: "bg-emerald-100 text-emerald-800 border-emerald-300",
  AT_RISK: "bg-amber-100 text-amber-800 border-amber-300",
};
const ASPEK_LABEL = { FINANCIAL: "Financial", CUSTOMER: "Customer", INTERNAL: "Internal Process", LEARNING: "Learning & Growth" };
const ASPEK_ICON = { FINANCIAL: "text-emerald-700", CUSTOMER: "text-sky-700", INTERNAL: "text-amber-700", LEARNING: "text-violet-700" };

function Chip({ status, className = "" }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${LABEL_CHIP[status] || "bg-slate-100 text-slate-700 border-slate-300"} ${className}`}>{LABEL_TEXT[status] || status}</span>;
}

export default function EvaluasiTab({ periodId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try { setData(await evaluationGet(periodId)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;
  if (!data) return null;

  const overall = data.overall_okr || {};
  const stats = data.okr_stats || {};

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-900 to-teal-900 p-5 text-white">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"><ClipboardCheck size={20} /></div>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Rekap Evaluasi Raker</h3>
          <p className="text-xs text-emerald-100/80">Rangkuman Visi, BSC, OKR, Action Plan &amp; KPI beserta capaian — siap untuk rapat evaluasi.</p>
        </div>
        <a href={evaluasiPdfUrl(periodId)} target="_blank" rel="noreferrer" className="ml-auto" data-testid="evaluasi-export-pdf">
          <Button size="sm" className="border-0 bg-white text-emerald-900 hover:bg-emerald-50"><FileDown size={15} /> Export PDF</Button>
        </a>
      </div>

      {/* EXECUTIVE SUMMARY */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Compass} label="Capaian OKR" value={`${overall.avg || 0}%`} chip={overall.label} testId="eval-overall" />
        <SummaryCard icon={Gauge} label="Skor KPI Tim" value={`${data.kpi_final_score || 0}`} sub={`dari bobot ${data.kpi_total_bobot || 0}%`} testId="eval-kpi" />
        <SummaryCard icon={Landmark} label="Total OKR" value={stats.total || 0} sub={`${stats.on_track || 0} on-track · ${stats.off_track || 0} off-track`} testId="eval-okr-total" />
        <SummaryCard icon={Rocket} label="Proyek Strategis" value={(data.projects || []).length} sub="Action Plan" testId="eval-projects" />
      </div>

      {/* VISI & MISI */}
      {(data.vision?.visi || (data.vision?.misi || []).length > 0) && (
        <Section icon={BookOpen} title="Visi & Misi">
          {data.vision.visi && <p className="font-display text-base italic text-emerald-950">"{data.vision.visi}"</p>}
          {(data.vision.misi || []).length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-900">
              {data.vision.misi.map((m, i) => <li key={i}>{m}</li>)}
            </ol>
          )}
          {(data.vision.nilai || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.vision.nilai.map((n) => <span key={n} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">{n}</span>)}
            </div>
          )}
        </Section>
      )}

      {/* BSC */}
      {(data.bsc_goals || []).length > 0 && (
        <Section icon={Landmark} title="Balanced Scorecard">
          <div className="grid gap-3 md:grid-cols-2">
            {["FINANCIAL", "CUSTOMER", "INTERNAL", "LEARNING"].map((asp) => {
              const goals = (data.bsc_goals || []).filter((g) => g.aspek === asp);
              if (goals.length === 0) return null;
              return (
                <div key={asp} className="rounded-xl border border-emerald-100 p-3">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${ASPEK_ICON[asp]}`}>{ASPEK_LABEL[asp]}</p>
                  {goals.map((g) => (
                    <div key={g.id} className="mt-2">
                      <p className="text-sm font-medium text-emerald-950">{g.judul || "(tanpa judul)"}</p>
                      {(g.indikators || []).filter((ind) => ind.nama || ind.target || ind.realisasi).map((ind) => (
                        <div key={ind.id} className="mt-1 flex items-center justify-between text-xs text-emerald-800/80">
                          <span className="truncate">• {ind.nama || "(indikator)"}</span>
                          <span className="shrink-0 pl-2"><b className="text-emerald-900">{ind.realisasi || "-"}</b> / {ind.target || "-"}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* OKR per divisi + list */}
      {(data.okr_by_divisi || []).length > 0 && (
        <Section icon={Building2} title="Capaian OKR per Divisi">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.okr_by_divisi.map((d) => (
              <div key={d.nama} className="flex items-center gap-2 rounded-lg border border-emerald-100 p-3">
                <Building2 size={14} className="text-sky-700" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-emerald-950">{d.nama}</span>
                <span className="font-display text-lg font-bold text-emerald-900">{d.avg}%</span>
                <Chip status={d.label} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {(data.okr_list || []).length > 0 && (
        <Section icon={Compass} title={`Daftar OKR (${data.okr_list.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] uppercase text-emerald-800/60">
                <tr><th className="py-2">Objective</th><th className="py-2">Owner</th><th className="py-2">Divisi</th><th className="py-2 text-center">Capaian</th><th className="py-2 text-center">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {data.okr_list.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-2 text-emerald-950">{o.objective}</td>
                    <td className="py-2 pr-2 text-xs text-emerald-800/80">{o.owner_nama || "-"}{o.owner_jabatan ? <span className="block text-[10px] text-emerald-800/50">{o.owner_jabatan}</span> : null}</td>
                    <td className="py-2 pr-2 text-xs text-emerald-800/80">{o.divisi_nama || "-"}</td>
                    <td className="py-2 text-center font-bold text-emerald-900">{o.progress}%</td>
                    <td className="py-2 text-center"><Chip status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ACTION PLAN */}
      {(data.projects || []).length > 0 && (
        <Section icon={Rocket} title="Action Plan (Proyek Strategis)">
          <div className="space-y-2">
            {data.projects.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-emerald-950">{p.nama}</p>
                  <p className="text-[11px] text-emerald-800/60">{p.divisi_nama} · {p.selesai}/{p.total} task · {p.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${p.pct}%` }} /></div>
                  <span className="text-sm font-bold text-emerald-900">{p.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* KPI RANKING */}
      {(data.kpi_ranking || []).length > 0 && (
        <Section icon={Trophy} title="Peringkat KPI Individu">
          <div className="space-y-1.5">
            {data.kpi_ranking.map((r, i) => (
              <div key={r.anggota_id || i} className="flex items-center gap-3 rounded-lg border border-emerald-100 p-2.5">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i < 3 ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-emerald-950">{r.anggota_nama}</p>
                  <p className="text-[11px] text-emerald-800/60">{r.divisi_nama} · bobot {Math.round(r.bobot * 10) / 10}%</p>
                </div>
                <span className="font-display text-lg font-bold text-emerald-900">{Math.round(r.score * 10) / 10}%</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* At risk / off track quick list */}
      {((data.off_track_okrs || []).length > 0 || (data.at_risk_okrs || []).length > 0) && (
        <Section icon={AlertTriangle} title="Perlu Perhatian">
          <div className="grid gap-3 md:grid-cols-2">
            <RiskList title="Off Track" tone="red" items={data.off_track_okrs || []} />
            <RiskList title="Need Improvement" tone="amber" items={data.at_risk_okrs || []} />
          </div>
        </Section>
      )}

      {/* SPV NOTES */}
      <NotesEditor periodId={periodId} note={data.note || {}} onSaved={load} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, chip, testId }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4" data-testid={testId}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/60">{label}</p>
        <Icon size={16} className="text-emerald-700" />
      </div>
      <p className="font-display mt-1 text-3xl font-bold text-emerald-900">{value}</p>
      {chip ? <div className="mt-1"><Chip status={chip} /></div> : sub ? <p className="mt-1 text-xs text-emerald-800/60">{sub}</p> : null}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className="text-emerald-700" />
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">{title}</p>
      </div>
      {children}
    </div>
  );
}

function RiskList({ title, tone, items }) {
  const border = tone === "red" ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40";
  return (
    <div className={`rounded-xl border ${border} p-3`}>
      <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${tone === "red" ? "text-red-800" : "text-amber-800"}`}>{title}</p>
      {items.length === 0 ? <p className="text-xs italic text-emerald-800/50">Tidak ada.</p> : (
        <ul className="space-y-1">
          {items.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-xs text-emerald-950">
              <TargetIcon size={11} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate">{o.objective}</span>
              <b className="shrink-0">{o.progress}%</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotesEditor({ periodId, note, onSaved }) {
  const [summary, setSummary] = useState("");
  const [kesimpulan, setKesimpulan] = useState("NETRAL");
  const [highlights, setHighlights] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [nextFocus, setNextFocus] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSummary(note.summary || "");
    setKesimpulan(note.kesimpulan || "NETRAL");
    setHighlights(note.highlights || []);
    setImprovements(note.improvements || []);
    setNextFocus(note.next_focus || []);
  }, [note]);

  const save = async () => {
    setSaving(true);
    try {
      await evaluationUpsert(periodId, {
        summary, kesimpulan,
        highlights: highlights.filter((x) => x.trim()),
        improvements: improvements.filter((x) => x.trim()),
        next_focus: nextFocus.filter((x) => x.trim()),
      });
      toast.success("Catatan evaluasi tersimpan");
      onSaved?.();
    } catch { toast.error("Gagal menyimpan"); }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4" data-testid="evaluasi-notes">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck size={16} className="text-emerald-700" />
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Catatan &amp; Kesimpulan SPV</p>
      </div>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label className="text-xs">Kesimpulan Periode</Label>
            <Select value={kesimpulan} onValueChange={setKesimpulan}>
              <SelectTrigger data-testid="evaluasi-kesimpulan"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REWARD">Layak Reward</SelectItem>
                <SelectItem value="NETRAL">Netral</SelectItem>
                <SelectItem value="EVALUASI">Perlu Evaluasi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Ringkasan Eksekutif</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Ringkasan hasil periode untuk dibacakan saat raker…" data-testid="evaluasi-summary" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ListEditor label="Highlights" items={highlights} setItems={setHighlights} placeholder="Pencapaian menonjol" testId="highlights" />
          <ListEditor label="Perbaikan" items={improvements} setItems={setImprovements} placeholder="Area yang perlu diperbaiki" testId="improvements" />
          <ListEditor label="Fokus Berikutnya" items={nextFocus} setItems={setNextFocus} placeholder="Prioritas periode depan" testId="nextfocus" />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="evaluasi-save">
            <Save size={14} /> {saving ? "Menyimpan..." : "Simpan Catatan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ListEditor({ label, items, setItems, placeholder, testId }) {
  const upd = (i, v) => setItems(items.map((x, idx) => (idx === i ? v : x)));
  const add = () => setItems([...items, ""]);
  const del = (i) => setItems(items.filter((_, idx) => idx !== i));
  return (
    <div className="rounded-xl border border-emerald-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <button onClick={add} className="grid h-6 w-6 place-items-center rounded text-emerald-700 hover:bg-emerald-50" data-testid={`${testId}-add`}><Plus size={14} /></button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-[11px] italic text-emerald-800/40">Belum ada poin.</p>}
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input value={it} onChange={(e) => upd(i, e.target.value)} placeholder={placeholder} className="h-8 text-xs" data-testid={`${testId}-input`} />
            <button onClick={() => del(i)} className="grid h-7 w-7 shrink-0 place-items-center rounded text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
