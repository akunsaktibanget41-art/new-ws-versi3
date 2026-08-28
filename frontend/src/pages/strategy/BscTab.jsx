import { useEffect, useState } from "react";
import { Plus, Trash2, DollarSign, Users2, Cog, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bscList, bscCreate, bscUpdate, bscDelete } from "@/lib/api";

const ASPEK = [
  { key: "FINANCIAL", label: "Financial", icon: DollarSign, tone: "border-emerald-300 bg-emerald-50" },
  { key: "CUSTOMER", label: "Customer", icon: Users2, tone: "border-sky-300 bg-sky-50" },
  { key: "INTERNAL", label: "Internal Process", icon: Cog, tone: "border-amber-300 bg-amber-50" },
  { key: "LEARNING", label: "Learning & Growth", icon: GraduationCap, tone: "border-violet-300 bg-violet-50" },
];

export default function BscTab({ periodId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDlg, setOpenDlg] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try { setRows(await bscList(periodId)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const onAdd = (aspek) => { setEditRow({ aspek }); setOpenDlg(true); };
  const onEdit = (row) => { setEditRow(row); setOpenDlg(true); };
  const onDel = async (id) => {
    if (!confirm("Hapus target ini?")) return;
    await bscDelete(id); toast.success("Terhapus"); load();
  };

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Balanced Scorecard</p>
        <p className="text-sm text-emerald-950">Target tahunan berdasarkan 4 aspek. Tambah item per aspek.</p>
      </div>

      {ASPEK.map((a) => {
        const Icon = a.icon;
        const items = rows.filter((r) => r.aspek === a.key);
        return (
          <div key={a.key} className={`rounded-2xl border ${a.tone} p-4`} data-testid={`bsc-aspek-${a.key.toLowerCase()}`}>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white shadow-sm">
                <Icon size={16} className="text-emerald-800" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-emerald-950">{a.label} Aspect</p>
                <p className="text-[11px] text-emerald-800/60">{items.length} target</p>
              </div>
              <Button size="sm" className="ml-auto bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => onAdd(a.key)} data-testid={`bsc-add-${a.key.toLowerCase()}`}>
                <Plus size={14} /> Tambah
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="p-4 text-center text-sm italic text-emerald-800/50 rounded-lg border border-dashed border-emerald-200 bg-white/50">Belum ada target.</p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-emerald-950">{it.nama}</p>
                      <p className="text-[11px] text-emerald-800/60">Target: <b className="text-emerald-900">{it.target || "-"}</b>{it.achieved ? ` · Realisasi: ${it.achieved}` : ""}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => onEdit(it)} data-testid="bsc-edit">Edit</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:bg-red-50" onClick={() => onDel(it.id)} data-testid="bsc-delete">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <BscDialog open={openDlg} onOpenChange={setOpenDlg} row={editRow} periodId={periodId} onSaved={load} />
    </div>
  );
}

function BscDialog({ open, onOpenChange, row, periodId, onSaved }) {
  const [nama, setNama] = useState("");
  const [target, setTarget] = useState("");
  const [achieved, setAchieved] = useState("");
  const [aspek, setAspek] = useState("FINANCIAL");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNama(row?.nama || "");
    setTarget(row?.target || "");
    setAchieved(row?.achieved || "");
    setAspek(row?.aspek || "FINANCIAL");
  }, [open, row]);

  const save = async () => {
    if (!nama.trim()) { toast.error("Nama target wajib"); return; }
    setSaving(true);
    try {
      if (row?.id) await bscUpdate(row.id, { nama, target, achieved, aspek });
      else await bscCreate({ period_id: periodId, aspek, nama, target, achieved, urutan: 0 });
      toast.success("Tersimpan");
      onOpenChange(false);
      onSaved?.();
    } catch { toast.error("Gagal simpan"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{row?.id ? "Edit" : "Tambah"} Target BSC</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Aspek</Label>
            <Select value={aspek} onValueChange={setAspek}>
              <SelectTrigger data-testid="bsc-form-aspek"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPEK.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nama target</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Peningkatan Net Profit Margin" data-testid="bsc-form-nama" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Target</Label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="cth: 25%" data-testid="bsc-form-target" />
            </div>
            <div>
              <Label className="text-xs">Realisasi (opsional)</Label>
              <Input value={achieved} onChange={(e) => setAchieved(e.target.value)} placeholder="cth: 20%" data-testid="bsc-form-achieved" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="bsc-form-save">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
