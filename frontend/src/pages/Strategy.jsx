import { useEffect, useMemo, useState } from "react";
import { Target, LayoutDashboard, Landmark, Compass, Gauge, Rocket, GanttChart, Plus, Loader2, Settings2, BookOpen, FileSignature } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  strategyListPeriods, strategyActivePeriod, strategyCreatePeriod,
  strategyActivatePeriod, strategyDeletePeriod, strategyDashboard,
} from "@/lib/api";
import { toast } from "sonner";
import PeriodDialog from "@/pages/strategy/PeriodDialog";
import VisiMisiTab from "@/pages/strategy/VisiMisiTab";
import BscTab from "@/pages/strategy/BscTab";
import OkrTab from "@/pages/strategy/OkrTab";
import KpiTab from "@/pages/strategy/KpiTab";
import ActionPlanTab from "@/pages/strategy/ActionPlanTab";
import LinimasaTab from "@/pages/strategy/LinimasaTab";
import KomitmenTab from "@/pages/strategy/KomitmenTab";
import StrategyOverview from "@/pages/strategy/StrategyOverview";

export default function Strategy() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [openPeriod, setOpenPeriod] = useState(false);
  const [tab, setTab] = useState("beranda");
  const [loading, setLoading] = useState(true);

  const activePeriod = useMemo(() => periods.find((p) => p.id === periodId), [periods, periodId]);

  const loadPeriods = async () => {
    setLoading(true);
    try {
      const [list, active] = await Promise.all([strategyListPeriods(), strategyActivePeriod().catch(() => null)]);
      setPeriods(list);
      if (!periodId) {
        setPeriodId(active?.id || list[0]?.id || "");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadPeriods(); /* eslint-disable-next-line */ }, []);

  const activate = async (id) => {
    try { await strategyActivatePeriod(id); toast.success("Periode aktif diubah"); loadPeriods(); }
    catch { toast.error("Gagal aktifkan"); }
  };
  const removePeriod = async (id) => {
    if (!confirm("Hapus periode ini beserta semua BSC/OKR/KPI/Proyek di dalamnya?")) return;
    try { await strategyDeletePeriod(id); toast.success("Periode dihapus"); setPeriodId(""); loadPeriods(); }
    catch { toast.error("Gagal hapus"); }
  };

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-5 text-white md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
            <Target size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold md:text-2xl">Strategi &amp; Eksekusi</h1>
            <p className="text-xs text-emerald-100/80">
              Balanced Scorecard · OKR · KPI · Action Plan · Linimasa. Semua metrik strategis tim dalam satu tempat.
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Period selector */}
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1">
              <span className="text-[10px] uppercase tracking-wider text-emerald-100/80">Periode</span>
              <Select value={periodId || ""} onValueChange={setPeriodId}>
                <SelectTrigger className="h-8 min-w-[180px] border-0 bg-transparent text-xs text-white focus:ring-0" data-testid="strategy-period-select">
                  <SelectValue placeholder="Pilih periode…" />
                </SelectTrigger>
                <SelectContent>
                  {periods.length === 0 && <SelectItem value="__empty__" disabled>Belum ada periode</SelectItem>}
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama} {p.active ? " · aktif" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" variant="secondary" className="h-8 bg-white/15 text-white hover:bg-white/25 border-0"
              onClick={() => setOpenPeriod(true)} data-testid="strategy-create-period-btn">
              <Plus size={14} /> Periode baru
            </Button>
            {activePeriod && !activePeriod.active && (
              <Button size="sm" variant="secondary" className="h-8 bg-amber-500 text-white hover:bg-amber-600 border-0"
                onClick={() => activate(activePeriod.id)} data-testid="strategy-activate-period">
                <Settings2 size={14} /> Jadikan aktif
              </Button>
            )}
            {activePeriod && (
              <Button size="sm" variant="ghost" className="h-8 text-red-100 hover:bg-red-500/30"
                onClick={() => removePeriod(activePeriod.id)} data-testid="strategy-delete-period">
                Hapus periode
              </Button>
            )}
          </div>
        </div>

        {activePeriod && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-emerald-100/80">
            <span><b className="text-white">{activePeriod.nama}</b></span>
            <span>· {activePeriod.start} → {activePeriod.end}</span>
            <span>· Siklus tiap {activePeriod.siklus_bulan} bulan</span>
            {activePeriod.active && <span className="rounded-full bg-emerald-400/30 px-2 py-0.5 font-semibold uppercase">PERIODE AKTIF</span>}
          </div>
        )}
      </div>

      {/* Empty state */}
      {periods.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <Compass className="mx-auto text-emerald-800/50" size={40} />
          <p className="mt-3 font-display text-lg font-semibold text-emerald-950">Belum ada periode strategi</p>
          <p className="mt-1 text-sm text-emerald-800/60">
            Mulai dengan membuat periode strategi (contoh: Q1 2026 atau Siklus Jan–Feb 2026).
          </p>
          <Button className="mt-4 bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => setOpenPeriod(true)}>
            <Plus size={16} /> Buat periode pertama
          </Button>
        </div>
      )}

      {loading && (
        <div className="grid place-items-center rounded-2xl border border-emerald-100 bg-white p-12"><Loader2 className="animate-spin text-emerald-800" size={24} /></div>
      )}

      {/* MAIN TABS */}
      {!loading && periodId && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-emerald-50 flex-wrap h-auto p-1">
            <TabsTrigger value="beranda" data-testid="strategy-tab-beranda" className="gap-1"><LayoutDashboard size={14} /> Beranda</TabsTrigger>
            <TabsTrigger value="visi" data-testid="strategy-tab-visi" className="gap-1"><BookOpen size={14} /> Visi &amp; Misi</TabsTrigger>
            <TabsTrigger value="bsc" data-testid="strategy-tab-bsc" className="gap-1"><Landmark size={14} /> BSC</TabsTrigger>
            <TabsTrigger value="okr" data-testid="strategy-tab-okr" className="gap-1"><Compass size={14} /> OKR</TabsTrigger>
            <TabsTrigger value="kpi" data-testid="strategy-tab-kpi" className="gap-1"><Gauge size={14} /> KPI</TabsTrigger>
            <TabsTrigger value="action" data-testid="strategy-tab-action" className="gap-1"><Rocket size={14} /> Action Plan</TabsTrigger>
            <TabsTrigger value="linimasa" data-testid="strategy-tab-linimasa" className="gap-1"><GanttChart size={14} /> Linimasa</TabsTrigger>
            <TabsTrigger value="komitmen" data-testid="strategy-tab-komitmen" className="gap-1"><FileSignature size={14} /> Komitmen</TabsTrigger>
          </TabsList>

          <TabsContent value="beranda"><StrategyOverview periodId={periodId} period={activePeriod} /></TabsContent>
          <TabsContent value="visi"><VisiMisiTab periodId={periodId} /></TabsContent>
          <TabsContent value="bsc"><BscTab periodId={periodId} /></TabsContent>
          <TabsContent value="okr"><OkrTab periodId={periodId} /></TabsContent>
          <TabsContent value="kpi"><KpiTab periodId={periodId} /></TabsContent>
          <TabsContent value="action"><ActionPlanTab periodId={periodId} /></TabsContent>
          <TabsContent value="linimasa"><LinimasaTab periodId={periodId} /></TabsContent>
          <TabsContent value="komitmen"><KomitmenTab periodId={periodId} /></TabsContent>
        </Tabs>
      )}

      <PeriodDialog open={openPeriod} onOpenChange={setOpenPeriod} onSaved={loadPeriods} />
    </div>
  );
}
