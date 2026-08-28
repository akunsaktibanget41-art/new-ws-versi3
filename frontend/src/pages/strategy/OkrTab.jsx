import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, User2, Users2, ChevronDown, ChevronUp, Building2, Edit3, Target as TargetIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { okrList, okrCreate, okrUpdate, okrDelete, krCreate, krUpdate, krDelete, listAnggota, listDivisi, bscList } from "@/lib/api";

const LEVELS = [
  { key: "COMPANY", label: "Company (Perusahaan)", tone: "border-emerald-300 bg-emerald-50" },
  { key: "DIVISI", label: "Divisi", tone: "border-sky-300 bg-sky-50" },
  { key: "INDIVIDU", label: "Individu", tone: "border-amber-300 bg-amber-50" },
];

export default function OkrTab({ periodId }) {
  const [objs, setObjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anggotaList, setAnggotaList] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [bscListRows, setBscListRows] = useState([]);
  const [openDlg, setOpenDlg] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [filterOwner, setFilterOwner] = useState("ALL");

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const [o, a, d, b] = await Promise.all([okrList(periodId), listAnggota(), listDivisi(), bscList(periodId)]);
      setObjs(o); setAnggotaList(a); setDivisiList(d); setBscListRows(b);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const filteredObjs = useMemo(() => {
    if (filterOwner === "ALL") return objs;
    if (filterOwner === "NONE") return objs.filter((o) => !o.owner_id);
    return objs.filter((o) => o.owner_id === filterOwner || (o.supporter_ids || []).includes(filterOwner));
  }, [objs, filterOwner]);

  // Group by level
  const byLevel = useMemo(() => {
    const g = { COMPANY: [], DIVISI: [], INDIVIDU: [] };
    filteredObjs.forEach((o) => { (g[o.level] || g.DIVISI).push(o); });
    return g;
  }, [filteredObjs]);

  const del = async (id) => {
    if (!confirm("Hapus objective ini beserta semua key result?")) return;
    await okrDelete(id); toast.success("Terhapus"); load();
  };

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">OKR</p>
          <p className="text-sm text-emerald-950">Objectives &amp; Key Results — SPV memilih siapa <b>owner</b> tiap objective secara dinamis.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="h-9 w-56 text-xs" data-testid="okr-filter-owner">
              <SelectValue placeholder="Filter anggota…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua anggota</SelectItem>
              <SelectItem value="NONE">Tanpa owner (belum di-assign)</SelectItem>
              {anggotaList.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => { setEditRow(null); setOpenDlg(true); }} data-testid="okr-create-btn">
            <Plus size={14} /> Tambah Objective
          </Button>
        </div>
      </div>

      {LEVELS.map((lvl) => {
        const items = byLevel[lvl.key] || [];
        if (items.length === 0 && filterOwner !== "ALL") return null;
        return (
          <div key={lvl.key} className={`rounded-2xl border ${lvl.tone} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <p className="font-display text-lg font-semibold text-emerald-950">{lvl.label}</p>
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-emerald-200 bg-white/50 p-4 text-center text-sm italic text-emerald-800/50">
                Belum ada objective di level ini.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((o) => (
                  <OkrCard key={o.id} obj={o} anggotaList={anggotaList} divisiList={divisiList} onEdit={() => { setEditRow(o); setOpenDlg(true); }} onDelete={() => del(o.id)} onReload={load} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <OkrDialog open={openDlg} onOpenChange={setOpenDlg} row={editRow} periodId={periodId} anggotaList={anggotaList} divisiList={divisiList} bscListRows={bscListRows} onSaved={load} />
    </div>
  );
}

function OkrCard({ obj, anggotaList, divisiList, onEdit, onDelete, onReload }) {
  const [expanded, setExpanded] = useState(true);
  const [addingKr, setAddingKr] = useState(false);
  const [krNama, setKrNama] = useState("");
  const [krTarget, setKrTarget] = useState("");
  const [krActual, setKrActual] = useState("");

  const addKr = async () => {
    if (!krNama.trim()) { toast.error("Nama KR wajib"); return; }
    try {
      await krCreate(obj.id, { nama: krNama, target: krTarget, actual: krActual, urutan: 0 });
      setKrNama(""); setKrTarget(""); setKrActual(""); setAddingKr(false);
      toast.success("Key Result ditambahkan"); onReload();
    } catch { toast.error("Gagal simpan KR"); }
  };
  const updKr = async (kr, field, val) => {
    try { await krUpdate(obj.id, kr.id, { [field]: val }); onReload(); }
    catch { toast.error("Gagal update"); }
  };
  const delKr = async (kid) => {
    if (!confirm("Hapus key result ini?")) return;
    await krDelete(obj.id, kid); onReload();
  };

  const progressColor = obj.progress >= 100 ? "bg-emerald-600" : obj.progress >= 70 ? "bg-emerald-500" : obj.progress >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4" data-testid="okr-card">
      <div className="flex items-start gap-3">
        <button onClick={() => setExpanded(!expanded)} className="mt-1 grid h-6 w-6 place-items-center rounded text-emerald-700 hover:bg-emerald-50">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-950">{obj.objective}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-emerald-800/70">
            {obj.bsc_target && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900" title={obj.bsc_target.nama}>
                <TargetIcon size={10} /> BSC: <b>{(obj.bsc_target.nama || "").slice(0, 30)}</b>
              </span>
            )}
            {obj.level === "DIVISI" && obj.divisi && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800">
                <Building2 size={10} /> {obj.divisi.nama}
              </span>
            )}
            {obj.owner ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900">
                <User2 size={10} /> Owner: <b>{obj.owner.nama}</b>
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Belum ada owner</span>
            )}
            {(obj.supporters || []).length > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                <Users2 size={10} /> +{obj.supporters.length} supporter
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-100">
              <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${Math.min(100, obj.progress || 0)}%` }} />
            </div>
            <p className="text-xs font-bold text-emerald-900">{obj.progress || 0}%</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onEdit} data-testid="okr-edit"><Edit3 size={12} /> Edit</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50" onClick={onDelete} data-testid="okr-delete"><Trash2 size={12} /> Hapus</Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-emerald-50 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Key Results</p>
          {(obj.key_results || []).length === 0 ? (
            <p className="text-xs italic text-emerald-800/50">Belum ada key result.</p>
          ) : (
            <div className="space-y-1.5">
              {obj.key_results.map((kr) => (
                <div key={kr.id} className="flex items-center gap-2 rounded border border-emerald-50 bg-emerald-50/40 p-2 text-sm">
                  <TargetIcon size={12} className="text-emerald-700" />
                  <Input defaultValue={kr.nama} onBlur={(e) => e.target.value !== kr.nama && updKr(kr, "nama", e.target.value)} className="h-7 flex-1 text-xs" data-testid="kr-nama" />
                  <Input defaultValue={kr.target} onBlur={(e) => e.target.value !== kr.target && updKr(kr, "target", e.target.value)} placeholder="Target" className="h-7 w-24 text-xs" data-testid="kr-target" />
                  <Input defaultValue={kr.actual} onBlur={(e) => e.target.value !== kr.actual && updKr(kr, "actual", e.target.value)} placeholder="Aktual" className="h-7 w-24 text-xs" data-testid="kr-actual" />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" onClick={() => delKr(kr.id)} data-testid="kr-delete"><Trash2 size={12} /></Button>
                </div>
              ))}
            </div>
          )}
          {addingKr ? (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Input value={krNama} onChange={(e) => setKrNama(e.target.value)} placeholder="Nama KR" className="h-8 flex-1 text-xs" data-testid="kr-new-nama" />
              <Input value={krTarget} onChange={(e) => setKrTarget(e.target.value)} placeholder="Target" className="h-8 w-24 text-xs" data-testid="kr-new-target" />
              <Input value={krActual} onChange={(e) => setKrActual(e.target.value)} placeholder="Aktual" className="h-8 w-24 text-xs" data-testid="kr-new-actual" />
              <Button size="sm" onClick={addKr} className="h-8 bg-emerald-900 text-white hover:bg-emerald-800" data-testid="kr-add-save">Simpan</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingKr(false)} className="h-8">Batal</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setAddingKr(true)} data-testid="kr-add-btn">
              <Plus size={12} /> Tambah KR
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OkrDialog({ open, onOpenChange, row, periodId, anggotaList, divisiList, bscListRows, onSaved }) {
  const [level, setLevel] = useState("DIVISI");
  const [divisiId, setDivisiId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [supporterIds, setSupporterIds] = useState([]);
  const [objective, setObjective] = useState("");
  const [bscTargetId, setBscTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLevel(row?.level || "DIVISI");
    setDivisiId(row?.divisi_id || "");
    setOwnerId(row?.owner_id || "");
    setSupporterIds(row?.supporter_ids || []);
    setObjective(row?.objective || "");
    setBscTargetId(row?.bsc_target_id || "");
  }, [open, row]);

  const filteredAnggota = anggotaList.filter((a) => !divisiId || level !== "DIVISI" || a.divisi_id === divisiId);

  const save = async () => {
    if (!objective.trim()) { toast.error("Objective wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        period_id: periodId, level, objective,
        divisi_id: level !== "COMPANY" ? (divisiId || null) : null,
        owner_id: ownerId || null,
        supporter_ids: supporterIds,
        bsc_target_id: bscTargetId || null,
        urutan: 0,
      };
      if (row?.id) await okrUpdate(row.id, payload);
      else await okrCreate(payload);
      toast.success("Tersimpan");
      onOpenChange(false);
      onSaved?.();
    } catch { toast.error("Gagal simpan"); }
    setSaving(false);
  };

  const ASPEK_LABEL = { FINANCIAL: "Financial", CUSTOMER: "Customer", INTERNAL: "Internal", LEARNING: "Learning" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row?.id ? "Edit" : "Tambah"} Objective</DialogTitle>
          <DialogDescription className="text-xs">Selaraskan OKR dengan target BSC (Balanced Scorecard). SPV pilih owner secara dinamis; anggota lain bisa jadi supporter.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Level</Label>
            <Select value={level} onValueChange={(v) => { setLevel(v); if (v === "COMPANY") setDivisiId(""); }}>
              <SelectTrigger data-testid="okr-form-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {level !== "COMPANY" && (
            <div>
              <Label className="text-xs">Divisi</Label>
              <Select value={divisiId || ""} onValueChange={setDivisiId}>
                <SelectTrigger data-testid="okr-form-divisi"><SelectValue placeholder="Pilih divisi" /></SelectTrigger>
                <SelectContent>
                  {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs flex items-center gap-1"><TargetIcon size={12} /> Selaraskan dengan target BSC</Label>
            <Select value={bscTargetId || "__none__"} onValueChange={(v) => setBscTargetId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="okr-form-bsc"><SelectValue placeholder="Pilih target BSC (opsional tapi disarankan)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tanpa alignment BSC —</SelectItem>
                {bscListRows.length === 0 && <SelectItem value="__empty__" disabled>Belum ada BSC target. Isi di tab BSC dulu.</SelectItem>}
                {bscListRows.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    [{ASPEK_LABEL[b.aspek] || b.aspek}] {b.nama.slice(0, 60)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-emerald-700">Setiap OKR sebaiknya diturunkan dari BSC target — biar strategi eksekusi terhubung.</p>
          </div>

          <div>
            <Label className="text-xs">Objective</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="cth: Peningkatan Efisiensi Operasional Perusahaan" data-testid="okr-form-objective" />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><User2 size={12} /> Owner (PIC) — anggota yang pegang OKR</Label>
            <Select value={ownerId || "__none__"} onValueChange={(v) => setOwnerId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="okr-form-owner"><SelectValue placeholder="Pilih owner…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tanpa owner (nanti dulu) —</SelectItem>
                {filteredAnggota.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {ownerId && <p className="mt-1 text-[11px] text-emerald-700">✓ Anggota yang di-assign akan lihat OKR ini di dashboard mereka.</p>}
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><Users2 size={12} /> Supporter (anggota pendukung eksekusi)</Label>
            <SupporterMultiSelect anggotaList={anggotaList} selectedIds={supporterIds} setSelectedIds={setSupporterIds} excludeId={ownerId} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="okr-form-save">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupporterMultiSelect({ anggotaList, selectedIds, setSelectedIds, excludeId }) {
  const [open, setOpen] = useState(false);
  const toggle = (id) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  const filtered = anggotaList.filter((a) => a.id !== excludeId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-xs h-10" data-testid="okr-form-supporters">
          {selectedIds.length > 0 ? `${selectedIds.length} supporter dipilih` : "Pilih supporter (opsional)"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? <p className="p-2 text-xs text-emerald-800/50">Belum ada anggota.</p> : filtered.map((a) => (
            <label key={a.id} className="flex items-center gap-2 rounded p-1.5 hover:bg-emerald-50 cursor-pointer">
              <Checkbox checked={selectedIds.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
              <span className="text-sm text-emerald-950">{a.nama}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
