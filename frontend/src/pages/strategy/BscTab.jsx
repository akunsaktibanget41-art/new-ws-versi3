import { useEffect, useState } from "react";
import { Plus, Trash2, DollarSign, Users2, Cog, GraduationCap, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bscList, bscCreate, bscUpdate, bscDelete } from "@/lib/api";

const ASPEK = [
  {
    key: "FINANCIAL", label: "Financial", icon: DollarSign,
    desc: "Mengukur pencapaian keuntungan, pertumbuhan pendapatan, dan nilai ekonomi perusahaan.",
    head: "text-emerald-900", ring: "border-emerald-100",
  },
  {
    key: "CUSTOMER", label: "Customer", icon: Users2,
    desc: "Mengukur tingkat kepuasan, loyalitas, dan pangsa pasar yang diperoleh perusahaan dari target konsumennya.",
    head: "text-sky-900", ring: "border-sky-100",
  },
  {
    key: "INTERNAL", label: "Internal Process", icon: Cog,
    desc: "Mengukur efektivitas & efisiensi proses bisnis internal serta kualitas operasional perusahaan.",
    head: "text-amber-900", ring: "border-amber-100",
  },
  {
    key: "LEARNING", label: "Learning & Growth", icon: GraduationCap,
    desc: "Mengukur kemampuan berinovasi, pengembangan SDM, budaya, dan pertumbuhan organisasi.",
    head: "text-violet-900", ring: "border-violet-100",
  },
];

export default function BscTab({ periodId }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try { setGoals(await bscList(periodId)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const addGoal = async (aspek) => {
    try {
      await bscCreate({ period_id: periodId, aspek, judul: "", indikators: [], urutan: goals.filter((g) => g.aspek === aspek).length });
      load();
    } catch { toast.error("Gagal menambah goal"); }
  };

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Balanced Scorecard</p>
        <p className="text-sm text-emerald-950">Sasaran strategis tahunan dalam 4 perspektif. Tiap goal berisi indikator KPI dengan target &amp; realisasi.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {ASPEK.map((a) => {
          const Icon = a.icon;
          const items = goals.filter((g) => g.aspek === a.key);
          return (
            <div key={a.key} className={`rounded-2xl border ${a.ring} bg-white p-4 shadow-sm`} data-testid={`bsc-aspek-${a.key.toLowerCase()}`}>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50">
                  <Icon size={18} className="text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-display text-lg font-semibold ${a.head}`}>{a.label} Aspect</p>
                  <p className="text-xs leading-snug text-emerald-800/60">{a.desc}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 border-orange-200 text-orange-600 hover:bg-orange-50"
                  onClick={() => addGoal(a.key)} data-testid={`bsc-add-goal-${a.key.toLowerCase()}`}>
                  <Plus size={14} /> Tambah Goal
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center text-sm italic text-emerald-800/50">
                    Belum ada goal. Klik "Tambah Goal".
                  </p>
                ) : items.map((g, i) => <GoalCard key={g.id} goal={g} index={i + 1} onReload={load} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalCard({ goal, index, onReload }) {
  const [judul, setJudul] = useState(goal.judul || "");
  const [inds, setInds] = useState(goal.indikators || []);

  useEffect(() => { setJudul(goal.judul || ""); setInds(goal.indikators || []); }, [goal.id]); // eslint-disable-line

  const save = async (patch) => {
    try {
      const r = await bscUpdate(goal.id, patch);
      if (patch.indikators && r?.indikators) setInds(r.indikators);
    } catch { toast.error("Gagal menyimpan"); }
  };
  const saveJudul = () => { if (judul !== goal.judul) save({ judul }); };
  const addInd = () => { const next = [...inds, { nama: "", target: "", realisasi: "" }]; setInds(next); save({ indikators: next }); };
  const updInd = (i, field, val) => setInds(inds.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)));
  const delInd = (i) => { const next = inds.filter((_, idx) => idx !== i); setInds(next); save({ indikators: next }); };
  const delGoal = async () => {
    if (!confirm("Hapus goal ini?")) return;
    await bscDelete(goal.id); toast.success("Goal dihapus"); onReload();
  };

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3" data-testid="bsc-goal">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Goal #{index}</span>
        <button onClick={delGoal} className="text-xs font-medium text-emerald-800/60 hover:text-red-600" data-testid="bsc-goal-delete">Hapus</button>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/60">Judul Sasaran Strategis</p>
      <Input value={judul} onChange={(e) => setJudul(e.target.value)} onBlur={saveJudul} placeholder="cth: Pertumbuhan Revenue Tahunan"
        className="mt-1 bg-white" data-testid="bsc-goal-judul" />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/60">Indikator KPI ({inds.length})</p>
        <Button size="sm" variant="outline" className="h-7 border-orange-200 px-2 text-[11px] text-orange-600 hover:bg-orange-50"
          onClick={addInd} data-testid="bsc-add-indikator">
          <Plus size={12} /> Tambah KPI
        </Button>
      </div>

      <div className="mt-2 space-y-2">
        {inds.length === 0 ? (
          <p className="text-center text-[11px] italic text-emerald-800/40">Belum ada indikator.</p>
        ) : inds.map((ind, i) => (
          <div key={ind.id || i} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-white p-2" data-testid="bsc-indikator-row">
            <Input value={ind.nama} onChange={(e) => updInd(i, "nama", e.target.value)} onBlur={() => save({ indikators: inds })}
              placeholder="Nama indikator (cth: Total Omset)" className="h-9 min-w-[140px] flex-1 text-sm" data-testid="bsc-ind-nama" />
            <Input value={ind.target} onChange={(e) => updInd(i, "target", e.target.value)} onBlur={() => save({ indikators: inds })}
              placeholder="Target" className="h-9 w-24 border-amber-200 bg-amber-50 text-center text-sm" data-testid="bsc-ind-target" />
            <Input value={ind.realisasi} onChange={(e) => updInd(i, "realisasi", e.target.value)} onBlur={() => save({ indikators: inds })}
              placeholder="Realisasi" className="h-9 w-24 border-emerald-200 bg-emerald-50 text-center text-sm" data-testid="bsc-ind-realisasi" />
            <button onClick={() => delInd(i)} className="grid h-8 w-8 place-items-center rounded text-emerald-800/50 hover:bg-red-50 hover:text-red-600" data-testid="bsc-ind-delete">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
