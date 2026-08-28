import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { strategyCreatePeriod } from "@/lib/api";
import { toast } from "sonner";

const PRESET_SIKLUS = [
  { label: "2 bulanan (Siklus)", val: 2 },
  { label: "3 bulanan (Kuartal)", val: 3 },
  { label: "6 bulanan (Semester)", val: 6 },
  { label: "12 bulanan (Tahun)", val: 12 },
];

function addMonthsIso(iso, m) {
  const d = new Date(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
  target.setDate(target.getDate() - 1); // last day of the previous month
  return target.toISOString().slice(0, 10);
}

export default function PeriodDialog({ open, onOpenChange, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [nama, setNama] = useState("");
  const [siklus, setSiklus] = useState(3);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addMonthsIso(today, 3));
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const changeSiklus = (val) => {
    setSiklus(val);
    setEnd(addMonthsIso(start, val));
  };
  const changeStart = (val) => {
    setStart(val);
    setEnd(addMonthsIso(val, siklus));
  };

  const save = async () => {
    if (!nama.trim()) { toast.error("Nama periode wajib diisi"); return; }
    setSaving(true);
    try {
      await strategyCreatePeriod({ nama: nama.trim(), start, end, siklus_bulan: Number(siklus), active });
      toast.success("Periode dibuat");
      onOpenChange(false);
      // reset
      setNama(""); setActive(true);
      onSaved?.();
    } catch (e) {
      toast.error("Gagal simpan");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Buat periode baru</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nama periode</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Q1 2026 atau Siklus Jan–Feb 2026" data-testid="period-name-input" />
          </div>
          <div>
            <Label className="text-xs">Panjang siklus</Label>
            <Select value={String(siklus)} onValueChange={(v) => changeSiklus(Number(v))}>
              <SelectTrigger data-testid="period-siklus-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESET_SIKLUS.map((p) => <SelectItem key={p.val} value={String(p.val)}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Mulai</Label>
              <Input type="date" value={start} onChange={(e) => changeStart(e.target.value)} data-testid="period-start" />
            </div>
            <div>
              <Label className="text-xs">Selesai</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="period-end" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded border border-emerald-100 p-2">
            <Switch checked={active} onCheckedChange={setActive} data-testid="period-active-switch" />
            <span className="text-sm text-emerald-950">Jadikan periode aktif</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} data-testid="period-save-btn" className="bg-emerald-900 text-white hover:bg-emerald-800">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
