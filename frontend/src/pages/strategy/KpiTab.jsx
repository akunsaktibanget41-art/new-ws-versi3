import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Gauge, TrendingUp, TrendingDown, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { kpiList, kpiCreate, kpiUpdate, kpiDelete, listAnggota, okrList } from "@/lib/api";

const STATUS_STYLE = {
  EXCELLENT: "bg-emerald-100 text-emerald-900 border-emerald-300",
  ON_TRACK: "bg-amber-100 text-amber-900 border-amber-300",
  AT_RISK: "bg-orange-100 text-orange-900 border-orange-300",
  OFF_TRACK: "bg-red-100 text-red-900 border-red-300",
};
const STATUS_LABEL = { EXCELLENT: "EXCELLENT", ON_TRACK: "ON TRACK", AT_RISK: "AT RISK", OFF_TRACK: "OFF TRACK" };

export default function KpiTab({ periodId }) {
  const [data, setData] = useState({ items: [], total_bobot: 0, final_score: 0 });
  const [loading, setLoading] = useState(true);
  const [anggotaList, setAnggotaList] = useState([]);
  const [okrs, setOkrs] = useState([]);
  const [openDlg, setOpenDlg] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const [k, a, o] = await Promise.all([kpiList(periodId), listAnggota(), okrList(periodId)]);
      setData(k); setAnggotaList(a); setOkrs(o);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const del = async (id) => {
    if (!confirm("Hapus KPI ini?")) return;
    await kpiDelete(id); toast.success("Terhapus"); load();
  };

  const update = async (row, field, val) => {
    try {
      await kpiUpdate(row.id, { [field]: field === "aktual" || field === "target" || field === "bobot" ? Number(val) : val });
      load();
    } catch { toast.error("Gagal update"); }
  };

  // Group by anggota
  const byAnggota = useMemo(() => {
    const g = new Map();
    data.items.forEach((k) => {
      if (!g.has(k.anggota_id)) g.set(k.anggota_id, { anggota_id: k.anggota_id, anggota_nama: k.anggota_nama, divisi_nama: k.divisi_nama, items: [], bobot: 0, score: 0 });
      const grp = g.get(k.anggota_id);
      grp.items.push(k);
      grp.bobot += Number(k.bobot || 0);
      grp.score += Number(k.weighted_score || 0);
    });
    return Array.from(g.values());
  }, [data]);

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-white p-4">
        <Gauge size={18} className="text-emerald-800" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Dashboard KPI</p>
          <p className="text-sm text-emerald-950">
            Idealnya setiap peran memiliki 3–5 KPI terfokus. Bobot total idealnya = <b>100%</b>. Saat ini: <b>{data.total_bobot}%</b>
          </p>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => { setEditRow(null); setOpenDlg(true); }} data-testid="kpi-add-btn">
            <Plus size={14} /> Tambah KPI
          </Button>
        </div>
      </div>

      {/* Per-anggota card summary */}
      {byAnggota.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <p className="text-sm italic text-emerald-800/60">Belum ada KPI. Klik "Tambah KPI" untuk mulai.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {byAnggota.map((g) => {
            const bobotOk = g.bobot === 100;
            return (
              <div key={g.anggota_id} className={`rounded-xl border p-4 ${bobotOk ? "border-emerald-200 bg-white" : "border-amber-200 bg-amber-50/40"}`}>
                <p className="font-medium text-emerald-950">{g.anggota_nama}</p>
                <p className="text-[11px] text-emerald-800/70">{g.divisi_nama} · {g.items.length} KPI</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-emerald-900">{g.score.toFixed(1)}%</span>
                  <span className="text-xs text-emerald-800/60">/ {g.bobot}% bobot</span>
                </div>
                {!bobotOk && <p className="mt-1 text-[10px] text-amber-800">⚠ Bobot belum 100%</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-emerald-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-emerald-900">
              <tr className="text-left text-xs">
                <th className="p-3 font-semibold">Anggota</th>
                <th className="p-3 font-semibold">Indikator KPI</th>
                <th className="p-3 font-semibold">OKR</th>
                <th className="p-3 font-semibold text-center">Polaritas</th>
                <th className="p-3 font-semibold text-center">Bobot</th>
                <th className="p-3 font-semibold text-center">Target</th>
                <th className="p-3 font-semibold text-center">Aktual</th>
                <th className="p-3 font-semibold text-center">Skor</th>
                <th className="p-3 font-semibold text-center">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {data.items.map((k) => (
                <tr key={k.id} className="hover:bg-emerald-50/40" data-testid="kpi-row">
                  <td className="p-3">
                    <p className="font-medium text-emerald-950">{k.anggota_nama}</p>
                    <p className="text-[10px] text-emerald-800/60">{k.divisi_nama}</p>
                  </td>
                  <td className="p-3">{k.indikator}</td>
                  <td className="p-3 text-xs text-emerald-800/70 max-w-[180px] truncate" title={k.okr_label || ""}>{k.okr_label || <span className="italic">—</span>}</td>
                  <td className="p-3 text-center">
                    {k.polaritas === "MAX" ? <TrendingUp size={14} className="mx-auto text-emerald-700" /> : <TrendingDown size={14} className="mx-auto text-emerald-700" />}
                  </td>
                  <td className="p-3 text-center">
                    <Input type="number" defaultValue={k.bobot} onBlur={(e) => Number(e.target.value) !== Number(k.bobot) && update(k, "bobot", e.target.value)} className="mx-auto h-8 w-16 text-center text-xs" data-testid="kpi-bobot" />
                  </td>
                  <td className="p-3 text-center">
                    <Input type="number" defaultValue={k.target} onBlur={(e) => Number(e.target.value) !== Number(k.target) && update(k, "target", e.target.value)} className="mx-auto h-8 w-20 text-center text-xs" data-testid="kpi-target" />
                  </td>
                  <td className="p-3 text-center">
                    <Input type="number" defaultValue={k.aktual} onBlur={(e) => Number(e.target.value) !== Number(k.aktual) && update(k, "aktual", e.target.value)} className="mx-auto h-8 w-20 text-center text-xs" data-testid="kpi-aktual" />
                  </td>
                  <td className="p-3 text-center font-semibold text-emerald-900">{k.weighted_score}%</td>
                  <td className="p-3 text-center">
                    <Badge className={`${STATUS_STYLE[k.status]} border text-[10px] font-bold`}>{STATUS_LABEL[k.status]}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => del(k.id)} data-testid="kpi-delete">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <KpiDialog open={openDlg} onOpenChange={setOpenDlg} row={editRow} periodId={periodId} anggotaList={anggotaList} okrs={okrs} onSaved={load} />
    </div>
  );
}

function KpiDialog({ open, onOpenChange, row, periodId, anggotaList, okrs, onSaved }) {
  const [anggotaId, setAnggotaId] = useState("");
  const [indikator, setIndikator] = useState("");
  const [polaritas, setPolaritas] = useState("MAX");
  const [bobot, setBobot] = useState("");
  const [target, setTarget] = useState("");
  const [aktual, setAktual] = useState("0");
  const [okrId, setOkrId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnggotaId(row?.anggota_id || "");
    setIndikator(row?.indikator || "");
    setPolaritas(row?.polaritas || "MAX");
    setBobot(String(row?.bobot ?? ""));
    setTarget(String(row?.target ?? ""));
    setAktual(String(row?.aktual ?? "0"));
    setOkrId(row?.okr_id || "");
  }, [open, row]);

  const save = async () => {
    if (!anggotaId) { toast.error("Pilih anggota"); return; }
    if (!indikator.trim()) { toast.error("Indikator wajib"); return; }
    setSaving(true);
    try {
      const payload = {
        period_id: periodId, anggota_id: anggotaId, indikator, polaritas,
        bobot: Number(bobot || 0), target: Number(target || 0), aktual: Number(aktual || 0),
        okr_id: okrId || null, urutan: 0,
      };
      if (row?.id) await kpiUpdate(row.id, payload);
      else await kpiCreate(payload);
      toast.success("Tersimpan");
      onOpenChange(false);
      onSaved?.();
    } catch { toast.error("Gagal simpan"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{row?.id ? "Edit" : "Tambah"} KPI</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Anggota</Label>
            <Select value={anggotaId} onValueChange={setAnggotaId}>
              <SelectTrigger data-testid="kpi-form-anggota"><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
              <SelectContent>
                {anggotaList.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Indikator KPI</Label>
            <Input value={indikator} onChange={(e) => setIndikator(e.target.value)} placeholder="cth: Pencapaian Omset Penjualan" data-testid="kpi-form-indikator" />
          </div>
          <div>
            <Label className="text-xs">Kaitan dengan OKR (opsional)</Label>
            <Select value={okrId || "__none__"} onValueChange={(v) => setOkrId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="kpi-form-okr"><SelectValue placeholder="Pilih OKR terkait" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tidak dikaitkan —</SelectItem>
                {okrs.map((o) => <SelectItem key={o.id} value={o.id}>{o.objective.slice(0, 50)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Polaritas</Label>
              <Select value={polaritas} onValueChange={setPolaritas}>
                <SelectTrigger data-testid="kpi-form-polaritas"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAX">Maksimalkan (lebih besar → lebih baik)</SelectItem>
                  <SelectItem value="MIN">Minimalkan (lebih kecil → lebih baik)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Bobot (%)</Label>
              <Input type="number" value={bobot} onChange={(e) => setBobot(e.target.value)} data-testid="kpi-form-bobot" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Target</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="kpi-form-target" />
            </div>
            <div>
              <Label className="text-xs">Aktual</Label>
              <Input type="number" value={aktual} onChange={(e) => setAktual(e.target.value)} data-testid="kpi-form-aktual" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="kpi-form-save">
            <Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
