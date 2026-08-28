import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Loader2, User2, Users2, ChevronDown, ChevronUp, Building2,
  Edit3, Target as TargetIcon, TrendingUp, TrendingDown, Pencil, Check, X,
  ListChecks, CalendarClock, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  okrList, okrCreate, okrUpdate, okrDelete, krCreate, krUpdate, krDelete,
  initiativeCreate, initiativeUpdate, initiativeDelete,
  listAnggota, listDivisi, bscList, updateDivisi,
} from "@/lib/api";

const LEVELS = [
  { key: "ALL", label: "Semua Level" },
  { key: "COMPANY", label: "Company" },
  { key: "DIVISI", label: "Divisi" },
  { key: "INDIVIDU", label: "Individu" },
];
const LEVEL_LABEL = { COMPANY: "Company (Perusahaan)", DIVISI: "Divisi", INDIVIDU: "Individu" };
const LEVEL_TONE = { COMPANY: "border-emerald-200 bg-emerald-50/50", DIVISI: "border-sky-200 bg-sky-50/50", INDIVIDU: "border-amber-200 bg-amber-50/50" };

export const okrLabel = (p) => (p < 51 ? "OFF_TRACK" : p <= 70 ? "NEED_IMPROVEMENT" : "ON_TRACK");
const LABEL_TEXT = { OFF_TRACK: "OFF TRACK", NEED_IMPROVEMENT: "NEED IMPROVEMENT", ON_TRACK: "ON TRACK" };
const LABEL_CHIP = {
  OFF_TRACK: "bg-red-100 text-red-800 border-red-300",
  NEED_IMPROVEMENT: "bg-amber-100 text-amber-800 border-amber-300",
  ON_TRACK: "bg-emerald-100 text-emerald-800 border-emerald-300",
};
const LABEL_BAR = { OFF_TRACK: "bg-red-500", NEED_IMPROVEMENT: "bg-amber-500", ON_TRACK: "bg-emerald-600" };

function LabelChip({ pct, className = "" }) {
  const l = okrLabel(pct);
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${LABEL_CHIP[l]} ${className}`}>{LABEL_TEXT[l]}</span>;
}

export default function OkrTab({ periodId }) {
  const [objs, setObjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anggotaList, setAnggotaList] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [bscListRows, setBscListRows] = useState([]);
  const [openDlg, setOpenDlg] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [levelFilter, setLevelFilter] = useState("ALL");

  const load = async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const [o, a, d, b] = await Promise.all([okrList(periodId), listAnggota(), listDivisi(), bscList(periodId)]);
      setObjs(o); setAnggotaList(a); setDivisiList(d); setBscListRows(b);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodId]);

  const byLevel = useMemo(() => {
    const g = { COMPANY: [], DIVISI: [], INDIVIDU: [] };
    objs.forEach((o) => { (g[o.level] || g.DIVISI).push(o); });
    return g;
  }, [objs]);

  const overall = useMemo(() => {
    if (objs.length === 0) return 0;
    return Math.round((objs.reduce((s, o) => s + (o.progress || 0), 0) / objs.length) * 10) / 10;
  }, [objs]);

  const perDivisi = useMemo(() => {
    const m = new Map();
    byLevel.DIVISI.forEach((o) => {
      const key = o.divisi?.id || "none";
      const nama = o.divisi?.nama || "Tanpa divisi";
      if (!m.has(key)) m.set(key, { id: o.divisi?.id, nama, sum: 0, n: 0 });
      const e = m.get(key); e.sum += o.progress || 0; e.n += 1;
    });
    return Array.from(m.values()).map((e) => ({ ...e, avg: Math.round((e.sum / e.n) * 10) / 10 })).sort((a, b) => b.avg - a.avg);
  }, [byLevel]);

  const del = async (id) => {
    if (!confirm("Hapus objective ini beserta semua key result & inisiatif?")) return;
    await okrDelete(id); toast.success("Terhapus"); load();
  };
  const renameDivisi = async (id, nama) => {
    try { await updateDivisi(id, { nama }); toast.success("Nama divisi diperbarui"); load(); }
    catch { toast.error("Gagal ubah nama divisi"); }
  };

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  const showLevels = levelFilter === "ALL" ? ["COMPANY", "DIVISI", "INDIVIDU"] : [levelFilter];

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-white p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">OKR</p>
          <p className="text-sm text-emerald-950">Objectives &amp; Key Results — SPV menetapkan <b>owner</b> &amp; jabatan tiap objective.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-emerald-200">
            {LEVELS.map((l) => (
              <button key={l.key} onClick={() => setLevelFilter(l.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${levelFilter === l.key ? "bg-emerald-900 text-white" : "bg-white text-emerald-800 hover:bg-emerald-50"}`}
                data-testid={`okr-level-${l.key.toLowerCase()}`}>
                {l.label}
              </button>
            ))}
          </div>
          <Button size="sm" className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => { setEditRow(null); setOpenDlg(true); }} data-testid="okr-create-btn">
            <Plus size={14} /> Tambah Objective
          </Button>
        </div>
      </div>

      {/* Achievement summary */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-4" data-testid="okr-achievement-summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/60">Capaian OKR Keseluruhan</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-display text-4xl font-bold text-emerald-900" data-testid="okr-overall-pct">{overall}%</span>
              <LabelChip pct={overall} />
            </div>
          </div>
          <div className="hidden h-12 w-px bg-emerald-100 sm:block" />
          <div className="w-full min-w-0 sm:flex-1">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/60">Capaian per Divisi</p>
            {perDivisi.length === 0 ? (
              <p className="text-xs italic text-emerald-800/50">Belum ada OKR level divisi.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {perDivisi.map((d) => (
                  <div key={d.id || d.nama} className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-emerald-100 bg-white px-2.5 py-1.5" data-testid="okr-divisi-chip">
                    <Building2 size={12} className="shrink-0 text-sky-700" />
                    <span className="text-xs font-medium text-emerald-950">{d.nama}</span>
                    <span className="text-xs font-bold text-emerald-900">{d.avg}%</span>
                    <LabelChip pct={d.avg} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Level sections */}
      {showLevels.map((lvlKey) => {
        const items = byLevel[lvlKey] || [];
        if (lvlKey === "DIVISI" && (levelFilter === "DIVISI" || levelFilter === "ALL")) {
          return (
            <DivisiLevelSection key={lvlKey} items={items} anggotaList={anggotaList} divisiList={divisiList}
              onEdit={(o) => { setEditRow(o); setOpenDlg(true); }} onDelete={del} onReload={load} onRename={renameDivisi} />
          );
        }
        return (
          <div key={lvlKey} className={`rounded-2xl border ${LEVEL_TONE[lvlKey]} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <p className="font-display text-lg font-semibold text-emerald-950">{LEVEL_LABEL[lvlKey]}</p>
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-emerald-200 bg-white/50 p-4 text-center text-sm italic text-emerald-800/50">Belum ada objective di level ini.</p>
            ) : (
              <div className="space-y-3">
                {items.map((o) => <OkrCard key={o.id} obj={o} anggotaList={anggotaList} onEdit={() => { setEditRow(o); setOpenDlg(true); }} onDelete={() => del(o.id)} onReload={load} />)}
              </div>
            )}
          </div>
        );
      })}

      <OkrDialog open={openDlg} onOpenChange={setOpenDlg} row={editRow} periodId={periodId} anggotaList={anggotaList} divisiList={divisiList} bscListRows={bscListRows} onSaved={load} />
    </div>
  );
}

function DivisiLevelSection({ items, anggotaList, divisiList, onEdit, onDelete, onReload, onRename }) {
  const groups = useMemo(() => {
    const m = new Map();
    items.forEach((o) => {
      const key = o.divisi?.id || "none";
      if (!m.has(key)) m.set(key, { id: o.divisi?.id, nama: o.divisi?.nama || "Tanpa divisi", items: [] });
      m.get(key).items.push(o);
    });
    return Array.from(m.values());
  }, [items]);

  return (
    <div className={`rounded-2xl border ${LEVEL_TONE.DIVISI} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <p className="font-display text-lg font-semibold text-emerald-950">Divisi</p>
        <Badge variant="outline" className="text-xs">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-emerald-200 bg-white/50 p-4 text-center text-sm italic text-emerald-800/50">Belum ada objective level divisi.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const avg = Math.round((g.items.reduce((s, o) => s + (o.progress || 0), 0) / g.items.length) * 10) / 10;
            return (
              <div key={g.id || g.nama} className="rounded-xl border border-sky-100 bg-white/70 p-3">
                <DivisiHeader group={g} avg={avg} onRename={onRename} />
                <div className="mt-3 space-y-3">
                  {g.items.map((o) => <OkrCard key={o.id} obj={o} anggotaList={anggotaList} onEdit={() => onEdit(o)} onDelete={() => onDelete(o.id)} onReload={onReload} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DivisiHeader({ group, avg, onRename }) {
  const [editing, setEditing] = useState(false);
  const [nama, setNama] = useState(group.nama);
  useEffect(() => setNama(group.nama), [group.nama]);
  const save = () => { if (nama.trim() && nama !== group.nama && group.id) onRename(group.id, nama.trim()); setEditing(false); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Building2 size={16} className="text-sky-700" />
      {editing ? (
        <div className="flex items-center gap-1">
          <Input value={nama} onChange={(e) => setNama(e.target.value)} className="h-8 w-48 text-sm" data-testid="okr-divisi-rename-input" />
          <button onClick={save} className="grid h-7 w-7 place-items-center rounded bg-emerald-600 text-white" data-testid="okr-divisi-rename-save"><Check size={14} /></button>
          <button onClick={() => { setEditing(false); setNama(group.nama); }} className="grid h-7 w-7 place-items-center rounded bg-slate-200 text-slate-700"><X size={14} /></button>
        </div>
      ) : (
        <>
          <p className="font-display text-base font-semibold text-emerald-950">{group.nama}</p>
          {group.id && (
            <button onClick={() => setEditing(true)} className="grid h-6 w-6 place-items-center rounded text-emerald-800/50 hover:bg-emerald-50 hover:text-emerald-800" title="Ubah nama divisi" data-testid="okr-divisi-rename">
              <Pencil size={12} />
            </button>
          )}
        </>
      )}
      <span className="ml-auto flex items-center gap-2">
        <span className="font-display text-lg font-bold text-emerald-900">{avg}%</span>
        <LabelChip pct={avg} />
      </span>
    </div>
  );
}

function OkrCard({ obj, anggotaList, onEdit, onDelete, onReload }) {
  const [expanded, setExpanded] = useState(true);
  const [addingKr, setAddingKr] = useState(false);
  const [kr, setKr] = useState({ nama: "", polaritas: "MAX", baseline: "", target: "", actual: "" });

  const addKr = async () => {
    if (!kr.nama.trim()) { toast.error("Nama KR wajib"); return; }
    try {
      await krCreate(obj.id, { ...kr, urutan: (obj.key_results || []).length });
      setKr({ nama: "", polaritas: "MAX", baseline: "", target: "", actual: "" }); setAddingKr(false);
      toast.success("Key Result ditambahkan"); onReload();
    } catch { toast.error("Gagal simpan KR"); }
  };
  const updKr = async (krRow, field, val) => {
    try { await krUpdate(obj.id, krRow.id, { [field]: val }); onReload(); }
    catch { toast.error("Gagal update"); }
  };
  const delKr = async (kid) => { if (!confirm("Hapus key result ini?")) return; await krDelete(obj.id, kid); onReload(); };

  const label = obj.label || okrLabel(obj.progress || 0);

  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-4" data-testid="okr-card">
      <div className="flex items-start gap-3">
        <button onClick={() => setExpanded(!expanded)} className="mt-1 grid h-6 w-6 place-items-center rounded text-emerald-700 hover:bg-emerald-50">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-950">{obj.objective}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-800/70">
            {obj.bsc_target && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900" title={obj.bsc_target.nama}>
                <TargetIcon size={10} /> BSC: <b>{(obj.bsc_target.nama || "").slice(0, 28)}</b>
              </span>
            )}
            {obj.divisi && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800"><Building2 size={10} /> {obj.divisi.nama}</span>
            )}
            {obj.owner ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900" data-testid="okr-owner-badge">
                <User2 size={10} /> {obj.owner.nama}{obj.owner_jabatan ? <span className="font-normal text-emerald-800/70"> — {obj.owner_jabatan}</span> : null}
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Belum ada owner</span>
            )}
            {(obj.supporters || []).length > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800"><Users2 size={10} /> +{obj.supporters.length} supporter</span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-100">
              <div className={`h-full rounded-full ${LABEL_BAR[label]}`} style={{ width: `${Math.min(100, obj.progress || 0)}%` }} />
            </div>
            <p className="text-xs font-bold text-emerald-900">{obj.progress || 0}%</p>
            <LabelChip pct={obj.progress || 0} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onEdit} data-testid="okr-edit"><Edit3 size={12} /> Edit</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50" onClick={onDelete} data-testid="okr-delete"><Trash2 size={12} /> Hapus</Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-emerald-50 pt-3">
          {/* KEY RESULTS */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Key Results</p>
            {(obj.key_results || []).length === 0 ? (
              <p className="text-xs italic text-emerald-800/50">Belum ada key result.</p>
            ) : (
              <div className="space-y-2">
                {obj.key_results.map((k) => <KrRow key={k.id} kr={k} onUpd={updKr} onDel={() => delKr(k.id)} />)}
              </div>
            )}
            {addingKr ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
                <Input value={kr.nama} onChange={(e) => setKr({ ...kr, nama: e.target.value })} placeholder="Nama Key Result" className="h-9 text-sm" data-testid="kr-new-nama" />
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div><Label className="text-[10px]">Polaritas</Label>
                    <Select value={kr.polaritas} onValueChange={(v) => setKr({ ...kr, polaritas: v })}>
                      <SelectTrigger className="h-8 text-xs" data-testid="kr-new-polaritas"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MAX">Maksimalkan</SelectItem>
                        <SelectItem value="MIN">Minimalkan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Baseline</Label><Input value={kr.baseline} onChange={(e) => setKr({ ...kr, baseline: e.target.value })} placeholder="opsional" className="h-8 text-xs" data-testid="kr-new-baseline" /></div>
                  <div><Label className="text-[10px]">Target</Label><Input value={kr.target} onChange={(e) => setKr({ ...kr, target: e.target.value })} className="h-8 text-xs" data-testid="kr-new-target" /></div>
                  <div><Label className="text-[10px]">Realisasi</Label><Input value={kr.actual} onChange={(e) => setKr({ ...kr, actual: e.target.value })} className="h-8 text-xs" data-testid="kr-new-actual" /></div>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setAddingKr(false)} className="h-8">Batal</Button>
                  <Button size="sm" onClick={addKr} className="h-8 bg-emerald-900 text-white hover:bg-emerald-800" data-testid="kr-add-save">Simpan KR</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setAddingKr(true)} data-testid="kr-add-btn"><Plus size={12} /> Tambah KR</Button>
            )}
          </div>

          {/* INITIATIVES */}
          <InitiativeSection obj={obj} anggotaList={anggotaList} onReload={onReload} />
        </div>
      )}
    </div>
  );
}

function KrRow({ kr, onUpd, onDel }) {
  const pct = kr.pct;
  const label = pct == null ? null : okrLabel(pct);
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2" data-testid="kr-row">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-0">
          <TargetIcon size={12} className="shrink-0 text-emerald-700" />
          <Input defaultValue={kr.nama} onBlur={(e) => e.target.value !== kr.nama && onUpd(kr, "nama", e.target.value)} className="h-8 min-w-0 flex-1 text-xs" data-testid="kr-nama" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {pct != null && (
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-xs font-bold text-emerald-900">{pct}%</span>
              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${LABEL_CHIP[label]}`}>{LABEL_TEXT[label]}</span>
            </span>
          )}
          <button onClick={onDel} className="grid h-7 w-7 shrink-0 place-items-center rounded text-red-600 hover:bg-red-50" data-testid="kr-delete"><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-[9px] uppercase text-emerald-800/50">Polaritas</Label>
          <Select value={kr.polaritas || "MAX"} onValueChange={(v) => onUpd(kr, "polaritas", v)}>
            <SelectTrigger className="h-7 text-xs" data-testid="kr-polaritas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MAX"><span className="flex items-center gap-1"><TrendingUp size={11} /> Maksimalkan</span></SelectItem>
              <SelectItem value="MIN"><span className="flex items-center gap-1"><TrendingDown size={11} /> Minimalkan</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[9px] uppercase text-emerald-800/50">Baseline</Label>
          <Input defaultValue={kr.baseline} onBlur={(e) => e.target.value !== (kr.baseline || "") && onUpd(kr, "baseline", e.target.value)} placeholder="—" className="h-7 text-xs" data-testid="kr-baseline" />
        </div>
        <div>
          <Label className="text-[9px] uppercase text-emerald-800/50">Target</Label>
          <Input defaultValue={kr.target} onBlur={(e) => e.target.value !== (kr.target || "") && onUpd(kr, "target", e.target.value)} className="h-7 border-amber-200 bg-amber-50 text-xs" data-testid="kr-target" />
        </div>
        <div>
          <Label className="text-[9px] uppercase text-emerald-800/50">Realisasi</Label>
          <Input defaultValue={kr.actual} onBlur={(e) => e.target.value !== (kr.actual || "") && onUpd(kr, "actual", e.target.value)} className="h-7 border-emerald-200 bg-emerald-50 text-xs" data-testid="kr-actual" />
        </div>
      </div>
    </div>
  );
}

function InitiativeSection({ obj, anggotaList, onReload }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nama: "", kr_id: "", pic_id: "", deadline: "" });
  const krMap = useMemo(() => Object.fromEntries((obj.key_results || []).map((k) => [k.id, k.nama])), [obj.key_results]);

  const add = async () => {
    if (!form.nama.trim()) { toast.error("Nama inisiatif wajib"); return; }
    try {
      await initiativeCreate(obj.id, { nama: form.nama, kr_id: form.kr_id || null, pic_id: form.pic_id || null, deadline: form.deadline || null });
      setForm({ nama: "", kr_id: "", pic_id: "", deadline: "" }); setAdding(false);
      toast.success("Inisiatif ditambahkan"); onReload();
    } catch { toast.error("Gagal tambah inisiatif"); }
  };
  const toggle = async (it) => {
    try { await initiativeUpdate(obj.id, it.id, { status: it.status === "SELESAI" ? "BELUM" : "SELESAI" }); onReload(); }
    catch { toast.error("Gagal update status"); }
  };
  const del = async (it) => { if (!confirm("Hapus inisiatif?")) return; await initiativeDelete(obj.id, it.id); onReload(); };

  const inits = obj.initiatives || [];
  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/30 p-2.5">
      <div className="flex items-center gap-2">
        <ListChecks size={13} className="text-sky-700" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800">Inisiatif ({inits.length})</p>
        <Button size="sm" variant="outline" className="ml-auto h-6 border-sky-200 px-2 text-[10px] text-sky-700 hover:bg-sky-50" onClick={() => setAdding(!adding)} data-testid="initiative-add-btn">
          <Plus size={11} /> Inisiatif
        </Button>
      </div>

      {inits.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {inits.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 rounded-md border border-sky-100 bg-white p-2" data-testid="initiative-row">
              <Checkbox checked={it.status === "SELESAI"} onCheckedChange={() => toggle(it)} data-testid="initiative-status" />
              <span className={`text-xs font-medium ${it.status === "SELESAI" ? "text-emerald-700 line-through" : "text-emerald-950"}`}>{it.nama}</span>
              {it.kr_id && krMap[it.kr_id] && <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700"><Flag size={9} /> {krMap[it.kr_id].slice(0, 24)}</span>}
              {it.pic && <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"><User2 size={9} /> {it.pic.nama}</span>}
              {it.deadline && <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"><CalendarClock size={9} /> {it.deadline}</span>}
              <button onClick={() => del(it)} className="ml-auto grid h-6 w-6 place-items-center rounded text-red-500 hover:bg-red-50" data-testid="initiative-delete"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2 rounded-md border border-sky-200 bg-white p-2">
          <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama inisiatif (cth: Bikin campaign IG)" className="h-8 text-xs" data-testid="initiative-nama" />
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={form.kr_id || "__none__"} onValueChange={(v) => setForm({ ...form, kr_id: v === "__none__" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs" data-testid="initiative-kr"><SelectValue placeholder="Terkait KR" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tanpa KR —</SelectItem>
                {(obj.key_results || []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama.slice(0, 40)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.pic_id || "__none__"} onValueChange={(v) => setForm({ ...form, pic_id: v === "__none__" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs" data-testid="initiative-pic"><SelectValue placeholder="Penanggung jawab" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tanpa PIC —</SelectItem>
                {anggotaList.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="h-8 text-xs" data-testid="initiative-deadline" />
          </div>
          <div className="mt-2 flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-7">Batal</Button>
            <Button size="sm" onClick={add} className="h-7 bg-sky-700 text-white hover:bg-sky-800" data-testid="initiative-save">Simpan</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OkrDialog({ open, onOpenChange, row, periodId, anggotaList, divisiList, bscListRows, onSaved }) {
  const [level, setLevel] = useState("DIVISI");
  const [divisiId, setDivisiId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerJabatan, setOwnerJabatan] = useState("");
  const [supporterIds, setSupporterIds] = useState([]);
  const [objective, setObjective] = useState("");
  const [bscTargetId, setBscTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLevel(row?.level || "DIVISI");
    setDivisiId(row?.divisi_id || "");
    setOwnerId(row?.owner_id || "");
    setOwnerJabatan(row?.owner_jabatan || "");
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
        owner_jabatan: ownerId ? (ownerJabatan || null) : null,
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row?.id ? "Edit" : "Tambah"} Objective</DialogTitle>
          <DialogDescription className="text-xs">SPV menetapkan owner &amp; jabatan. Setiap OKR sebaiknya diturunkan dari target BSC.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Level</Label>
            <Select value={level} onValueChange={(v) => { setLevel(v); if (v === "COMPANY") setDivisiId(""); }}>
              <SelectTrigger data-testid="okr-form-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Company (Perusahaan)</SelectItem>
                <SelectItem value="DIVISI">Divisi</SelectItem>
                <SelectItem value="INDIVIDU">Individu</SelectItem>
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
            <Label className="text-xs flex items-center gap-1"><TargetIcon size={12} /> Selaraskan dengan Goal BSC</Label>
            <Select value={bscTargetId || "__none__"} onValueChange={(v) => setBscTargetId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="okr-form-bsc"><SelectValue placeholder="Pilih goal BSC (disarankan)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tanpa alignment BSC —</SelectItem>
                {bscListRows.length === 0 && <SelectItem value="__empty__" disabled>Belum ada goal BSC. Isi di tab BSC dulu.</SelectItem>}
                {bscListRows.map((b) => <SelectItem key={b.id} value={b.id}>[{ASPEK_LABEL[b.aspek] || b.aspek}] {(b.judul || "(tanpa judul)").slice(0, 50)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Objective</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="cth: Peningkatan Efisiensi Operasional" data-testid="okr-form-objective" />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><User2 size={12} /> Owner (PIC) OKR</Label>
            <Select value={ownerId || "__none__"} onValueChange={(v) => setOwnerId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="okr-form-owner"><SelectValue placeholder="Pilih owner…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— tanpa owner —</SelectItem>
                {filteredAnggota.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {ownerId && (
            <div>
              <Label className="text-xs">Jabatan Owner</Label>
              <Input value={ownerJabatan} onChange={(e) => setOwnerJabatan(e.target.value)} placeholder="cth: Kepala Divisi Marketing" data-testid="okr-form-jabatan" />
              <p className="mt-1 text-[11px] text-emerald-700">Jabatan ini akan tampil di kartu OKR pada anggota yang dipilih.</p>
            </div>
          )}

          <div>
            <Label className="text-xs flex items-center gap-1"><Users2 size={12} /> Supporter (opsional)</Label>
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
  const toggle = (id) => setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const filtered = anggotaList.filter((a) => a.id !== excludeId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 w-full justify-start text-xs" data-testid="okr-form-supporters">
          {selectedIds.length > 0 ? `${selectedIds.length} supporter dipilih` : "Pilih supporter (opsional)"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? <p className="p-2 text-xs text-emerald-800/50">Belum ada anggota.</p> : filtered.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-emerald-50">
              <Checkbox checked={selectedIds.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
              <span className="text-sm text-emerald-950">{a.nama}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
