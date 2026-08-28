import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Rocket, Users2, DollarSign, Link2, Unlink, Building2, User2, Edit3, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { projectsList, projectCreate, projectUpdate, projectDelete, projectLinkTasks, projectUnlinkTask, listAnggota, listDivisi, listTasks } from "@/lib/api";

const STATUS_STYLE = {
  SELESAI: "bg-emerald-100 text-emerald-900 border-emerald-300",
  BERJALAN: "bg-sky-100 text-sky-900 border-sky-300",
  TERLAMBAT: "bg-red-100 text-red-900 border-red-300",
  BELUM_MULAI: "bg-slate-100 text-slate-800 border-slate-200",
};

export default function ActionPlanTab({ periodId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anggotaList, setAnggotaList] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [tasksList, setTasksList] = useState([]);
  const [openDlg, setOpenDlg] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const [p, a, d, t] = await Promise.all([projectsList(periodId), listAnggota(), listDivisi(), listTasks()]);
      setRows(p); setAnggotaList(a); setDivisiList(d); setTasksList(t);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const del = async (id) => {
    if (!confirm("Hapus proyek strategis ini?")) return;
    await projectDelete(id); toast.success("Terhapus"); load();
  };

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-white p-4">
        <Rocket size={18} className="text-emerald-800" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Action Plan</p>
          <p className="text-sm text-emerald-950">
            Proyek strategis yang <b>terhubung</b> ke Tugas di menu Tugas — progress otomatis dihitung dari status task.
          </p>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => { setEditRow(null); setOpenDlg(true); }} data-testid="proj-add-btn">
            <Plus size={14} /> Proyek baru
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <p className="text-sm italic text-emerald-800/60">Belum ada proyek strategis.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => <ProjectCard key={p.id} project={p} tasksList={tasksList} onEdit={() => { setEditRow(p); setOpenDlg(true); }} onDelete={() => del(p.id)} onReload={load} />)}
        </div>
      )}

      <ProjectDialog open={openDlg} onOpenChange={setOpenDlg} row={editRow} periodId={periodId} anggotaList={anggotaList} divisiList={divisiList} onSaved={load} />
    </div>
  );
}

function ProjectCard({ project: p, tasksList, onEdit, onDelete, onReload }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [pickIds, setPickIds] = useState([]);

  const linked = p.tasks || [];
  const s = p.summary || {};
  const anggaran = new Intl.NumberFormat("id-ID").format(p.anggaran || 0);

  const availableTasks = tasksList.filter((t) => !(p.task_ids || []).includes(t.id));

  const openLink = () => { setPickIds([]); setLinkOpen(true); };
  const doLink = async () => {
    if (pickIds.length === 0) { toast.error("Pilih minimal 1 tugas"); return; }
    try { await projectLinkTasks(p.id, pickIds); toast.success("Task ditautkan"); setLinkOpen(false); onReload(); }
    catch { toast.error("Gagal tautkan"); }
  };
  const unlink = async (tid) => {
    if (!confirm("Lepaskan task dari proyek?")) return;
    try { await projectUnlinkTask(p.id, [tid]); onReload(); }
    catch { toast.error("Gagal lepas"); }
  };

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4" data-testid="project-card">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-semibold text-emerald-950">{p.nama}</p>
            <Badge className={`${STATUS_STYLE[s.status] || STATUS_STYLE.BELUM_MULAI} border text-[10px] font-bold`}>{s.status || "BELUM_MULAI"}</Badge>
          </div>
          {p.outcome && <p className="mt-1 text-sm text-emerald-800/80"><b>Target Outcome:</b> {p.outcome}</p>}
          {p.omtm && <p className="text-sm text-emerald-800/80"><b>OMTM:</b> {p.omtm}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {p.divisi && <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-sky-800"><Building2 size={10} /> {p.divisi.nama}</span>}
            {p.owner && <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900"><User2 size={10} /> {p.owner.nama}</span>}
            {(p.tim || []).length > 0 && <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800"><Users2 size={10} /> Tim {p.tim.length}</span>}
            {p.anggaran > 0 && <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900"><DollarSign size={10} /> Rp {anggaran}</span>}
            {p.start_effective && p.end_effective && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{p.start_effective} → {p.end_effective}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openLink} data-testid="proj-link"><Link2 size={12} /> Tautkan Task</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onEdit} data-testid="proj-edit"><Edit3 size={12} /> Edit</Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={onDelete} data-testid="proj-delete"><Trash2 size={14} /></Button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-emerald-800/70">Progress dari <b>{s.total || 0}</b> task tertaut</span>
          <span className="font-bold text-emerald-900">{s.pct || 0}% ({s.selesai || 0}/{s.total || 0})</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
          <div className={`h-full rounded-full ${s.status === "TERLAMBAT" ? "bg-red-500" : "bg-emerald-600"}`} style={{ width: `${Math.min(100, s.pct || 0)}%` }} />
        </div>
      </div>

      {linked.length > 0 && (
        <div className="mt-3 border-t border-emerald-50 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Task Tertaut ({linked.length})</p>
          <div className="grid gap-1 md:grid-cols-2">
            {linked.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded border border-emerald-50 bg-emerald-50/30 p-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{t.nama}</span>
                <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${t.status === "SELESAI" ? "bg-emerald-500 text-white" : t.status === "TERKENDALA" ? "bg-red-500 text-white" : "bg-slate-400 text-white"}`}>{t.status}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => unlink(t.id)} title="Lepas"><Unlink size={11} /></Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tautkan task ke proyek</DialogTitle>
            <DialogDescription className="text-xs">Pilih task dari menu Tugas. Progress proyek otomatis mengikuti status task.</DialogDescription>
          </DialogHeader>
          {availableTasks.length === 0 ? (
            <p className="p-4 text-sm italic text-emerald-800/60">Semua task sudah tertaut atau belum ada task.</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto rounded border p-2">
              {availableTasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded p-1.5 hover:bg-emerald-50 cursor-pointer">
                  <Checkbox checked={pickIds.includes(t.id)} onCheckedChange={() => setPickIds(pickIds.includes(t.id) ? pickIds.filter((x) => x !== t.id) : [...pickIds, t.id])} />
                  <span className="min-w-0 flex-1 truncate text-sm text-emerald-950">{t.nama}</span>
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>Batal</Button>
            <Button onClick={doLink} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="link-tasks-confirm">
              <Check size={14} /> Tautkan ({pickIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDialog({ open, onOpenChange, row, periodId, anggotaList, divisiList, onSaved }) {
  const [nama, setNama] = useState("");
  const [outcome, setOutcome] = useState("");
  const [omtm, setOmtm] = useState("");
  const [anggaran, setAnggaran] = useState("0");
  const [divisiId, setDivisiId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [timIds, setTimIds] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNama(row?.nama || "");
    setOutcome(row?.outcome || "");
    setOmtm(row?.omtm || "");
    setAnggaran(String(row?.anggaran || 0));
    setDivisiId(row?.divisi_id || "");
    setOwnerId(row?.owner_id || "");
    setTimIds(row?.tim_ids || []);
    setStart(row?.start || "");
    setEnd(row?.end || "");
  }, [open, row]);

  const save = async () => {
    if (!nama.trim()) { toast.error("Nama wajib"); return; }
    setSaving(true);
    try {
      const payload = {
        period_id: periodId, nama, outcome, omtm,
        anggaran: Number(anggaran || 0),
        divisi_id: divisiId || null, owner_id: ownerId || null,
        tim_ids: timIds, start: start || null, end: end || null,
      };
      if (row?.id) await projectUpdate(row.id, payload);
      else await projectCreate(payload);
      toast.success("Tersimpan");
      onOpenChange(false);
      onSaved?.();
    } catch { toast.error("Gagal simpan"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{row?.id ? "Edit" : "Tambah"} Proyek Strategis</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nama proyek</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth: Implementasi Sistem Otomasi Penjualan &amp; CRM" data-testid="proj-form-nama" />
          </div>
          <div>
            <Label className="text-xs">Target Outcome</Label>
            <Textarea rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Hasil yang diharapkan…" data-testid="proj-form-outcome" />
          </div>
          <div>
            <Label className="text-xs">OMTM (One Metric That Matters)</Label>
            <Input value={omtm} onChange={(e) => setOmtm(e.target.value)} placeholder="cth: Lead/Leads Terkonversi Bulanan" data-testid="proj-form-omtm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Divisi</Label>
              <Select value={divisiId || "__none__"} onValueChange={(v) => setDivisiId(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="proj-form-divisi"><SelectValue placeholder="Pilih divisi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— tidak spesifik —</SelectItem>
                  {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Owner (PIC)</Label>
              <Select value={ownerId || "__none__"} onValueChange={(v) => setOwnerId(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="proj-form-owner"><SelectValue placeholder="Pilih owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— tanpa owner —</SelectItem>
                  {anggotaList.filter((a) => !divisiId || a.divisi_id === divisiId).map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Tim (anggota terlibat)</Label>
            <TimPicker anggotaList={anggotaList} selectedIds={timIds} setSelectedIds={setTimIds} excludeId={ownerId} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Anggaran (Rp)</Label>
              <Input type="number" value={anggaran} onChange={(e) => setAnggaran(e.target.value)} data-testid="proj-form-anggaran" />
            </div>
            <div>
              <Label className="text-xs">Mulai</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="proj-form-start" />
            </div>
            <div>
              <Label className="text-xs">Selesai</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="proj-form-end" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="proj-form-save">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimPicker({ anggotaList, selectedIds, setSelectedIds, excludeId }) {
  const [open, setOpen] = useState(false);
  const filtered = anggotaList.filter((a) => a.id !== excludeId);
  const toggle = (id) => setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-xs h-10" data-testid="proj-form-tim">
          {selectedIds.length > 0 ? `${selectedIds.length} anggota dipilih` : "Pilih anggota tim (opsional)"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((a) => (
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
