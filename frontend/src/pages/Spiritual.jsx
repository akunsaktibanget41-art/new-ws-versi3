import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Info, Plus, Trash2, X, GripVertical, Award, Sparkles, TrendingUp, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  listAmaliyahItems, createAmaliyahItem, updateAmaliyahItem, deleteAmaliyahItem,
  bulkDeleteAmaliyahItems, reorderAmaliyahItems, amaliyahStreak,
  listEntries, upsertEntry,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function fmt(d) { return d.toISOString().slice(0, 10); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

const BADGE_META = {
  7: { label: "Istiqamah 1 Pekan", color: "from-emerald-400 to-emerald-600", icon: Sparkles },
  14: { label: "Konsisten 2 Pekan", color: "from-teal-400 to-emerald-600", icon: Sparkles },
  30: { label: "Sebulan Penuh", color: "from-amber-400 to-orange-600", icon: Award },
  60: { label: "Dwibulan", color: "from-orange-400 to-red-500", icon: Award },
  100: { label: "Seratus Hari", color: "from-purple-400 to-fuchsia-600", icon: Award },
  180: { label: "Setengah Tahun", color: "from-blue-400 to-indigo-600", icon: Award },
  365: { label: "Setahun Penuh", color: "from-pink-500 to-rose-600", icon: Award },
};

export default function Spiritual() {
  const { user } = useAuth();
  const isSpv = user?.role === "spv";
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newTarget, setNewTarget] = useState("1x/hari");
  const [selected, setSelected] = useState([]);
  const [streak, setStreak] = useState({ current_streak: 0, longest_streak: 0, total_days: 0, badges: [], next_target: 7 });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const dim = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);
  const start = fmt(new Date(year, month, 1));
  const end = fmt(new Date(year, month, dim));
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  const load = async () => {
    const [it, en] = await Promise.all([listAmaliyahItems(), listEntries({ start, end })]);
    setItems(it); setEntries(en);
    amaliyahStreak().then(setStreak).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const entryMap = useMemo(() => {
    const m = new Map();
    entries.forEach((e) => m.set(`${e.item_id}::${e.tanggal}`, e));
    return m;
  }, [entries]);

  const toggle = async (item_id, day) => {
    const tanggal = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing = entryMap.get(`${item_id}::${tanggal}`);
    const newChecked = !existing?.checked;
    const others = entries.filter((e) => !(e.item_id === item_id && e.tanggal === tanggal));
    setEntries([...others, { id: existing?.id || `tmp`, item_id, tanggal, checked: newChecked }]);
    try {
      const saved = await upsertEntry({ item_id, tanggal, checked: newChecked });
      setEntries([...others, saved]);
      amaliyahStreak().then(setStreak).catch(() => {});
    } catch { toast.error("Gagal simpan"); load(); }
  };

  const addAmaliyah = async () => {
    if (!newNama.trim()) return toast.error("Nama wajib");
    try {
      await createAmaliyahItem({ nama: newNama.trim(), target_metrik: newTarget });
      setNewNama(""); setNewTarget("1x/hari"); setAddOpen(false);
      load(); toast.success("Amaliyah ditambahkan");
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  const updateItem = async (id, patch) => { await updateAmaliyahItem(id, patch); load(); };
  const removeItem = async (id) => {
    if (!window.confirm("Hapus amaliyah beserta seluruh histori?")) return;
    await deleteAmaliyahItem(id); load(); toast.success("Dihapus");
  };
  const bulkDelete = async () => {
    if (!window.confirm(`Hapus ${selected.length} amaliyah?`)) return;
    await bulkDeleteAmaliyahItems(selected);
    toast.success(`${selected.length} amaliyah dihapus`);
    setSelected([]); load();
  };

  const stats = items.map((it, idx) => {
    const count = days.reduce((acc, d) => {
      const p = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return acc + (entryMap.get(`${it.id}::${p}`)?.checked ? 1 : 0);
    }, 0);
    return { ...it, count, target: dim, pct: Math.round((count / dim) * 100), idx };
  });

  const totalChecked = stats.reduce((s, x) => s + x.count, 0);
  const targetTotal = items.length * dim || 1;
  const overallPct = Math.round((totalChecked / targetTotal) * 100);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((x) => x.id === active.id);
    const newIdx = items.findIndex((x) => x.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    try { await reorderAmaliyahItems(reordered.map((x) => x.id)); }
    catch { toast.error("Gagal urutkan"); load(); }
  };

  const monthName = cursor.toLocaleString("id-ID", { month: "long" });
  const allSelected = selected.length > 0 && selected.length === items.length;
  const toggleAll = () => setSelected(allSelected ? [] : items.map((i) => i.id));

  return (
    <div className="space-y-5">
      {/* Scoreboard */}
      <div className="grid gap-3 md:grid-cols-4">
        <ScoreCard icon={TrendingUp} label="Progress Bulan Ini" value={`${overallPct}%`} sub={`${totalChecked}/${targetTotal} check-in`} tone="emerald" testId="score-overall" />
        <ScoreCard icon={Flame} label="Streak Sekarang" value={streak.current_streak} sub="hari beruntun" tone="orange" testId="score-current-streak" />
        <ScoreCard icon={Target} label="Rekor Terpanjang" value={streak.longest_streak} sub={streak.next_target ? `Menuju ${streak.next_target} hari` : "Maksimal"} tone="violet" testId="score-longest-streak" />
        <ScoreCard icon={Award} label="Lencana Diraih" value={streak.badges.length} sub={`${Object.keys(BADGE_META).length} tersedia`} tone="amber" testId="score-badges" />
      </div>

      {/* Badges strip */}
      {streak.badges.length > 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-white p-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-emerald-800/60">Lencana Amal Anda</p>
          <div className="flex flex-wrap gap-2" data-testid="badges-strip">
            {streak.badges.map((b) => {
              const meta = BADGE_META[b];
              const Icon = meta.icon;
              return (
                <div key={b} data-testid={`badge-${b}`} className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${meta.color} px-3 py-1.5 text-xs font-semibold text-white shadow-sm`}>
                  <Icon size={13} /> {meta.label}
                </div>
              );
            })}
            {streak.next_target && (
              <div className="flex items-center gap-1 rounded-full border border-dashed border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <Target size={12} /> Lencana berikutnya: {streak.next_target} hari
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))} data-testid="prev-month"><ChevronLeft size={16} /></Button>
          <div className="min-w-[160px] rounded-lg border border-emerald-200 bg-white px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-emerald-800/60">Bulan</p>
            <p className="font-display text-base font-semibold text-emerald-950" data-testid="month-label">{monthName} {year}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))} data-testid="next-month"><ChevronRight size={16} /></Button>
        </div>
        {isSpv && (
          <div className="ml-auto flex items-center gap-2">
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" data-testid="add-amaliyah-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus size={14} /> Amaliyah Baru</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <p className="mb-2 text-xs font-semibold text-emerald-900">Tambah Amaliyah</p>
                <div className="space-y-2">
                  <Input placeholder="Nama (mis. Shalat Dhuha)" value={newNama} onChange={(e) => setNewNama(e.target.value)} data-testid="input-amaliyah-nama" />
                  <Input placeholder="Target (mis. 2 rakaat/hari)" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} data-testid="input-amaliyah-target" />
                  <Button size="sm" onClick={addAmaliyah} data-testid="submit-amaliyah" className="w-full bg-emerald-900 hover:bg-emerald-800">Simpan</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800/80">
        <Info size={14} className="mt-0.5 shrink-0 text-emerald-700" />
        <p>Klik cell tanggal untuk toggle. {isSpv && "Drag ikon ⋮⋮ untuk urutkan. Checkbox baris untuk hapus masal."} Data amaliyah privat per user.</p>
      </div>

      {/* Bulk toolbar */}
      {isSpv && selected.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 shadow-md" data-testid="amaliyah-bulk-toolbar">
          <span className="text-sm font-semibold text-amber-900">{selected.length} amaliyah terpilih</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={bulkDelete} className="bg-red-600 hover:bg-red-700 text-white" data-testid="bulk-delete-amaliyah"><Trash2 size={14} /> Hapus</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])} data-testid="bulk-cancel-amaliyah"><X size={14} /></Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-12 text-center">
          <p className="font-display text-lg text-emerald-900">Belum ada amaliyah</p>
          <p className="mt-2 text-sm text-emerald-800/60">{isSpv ? <>Klik <b>Amaliyah Baru</b> di atas untuk mulai melacak.</> : "SPV belum menambahkan amaliyah bersama."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-white p-3 md:p-4 thin-scroll overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <table className="min-w-full text-sm" data-testid="amaliyah-matrix">
              <thead>
                <tr>
                  {isSpv && <th className="p-2 w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} data-testid="select-all-amaliyah" /></th>}
                  {isSpv && <th className="p-2 w-6"></th>}
                  <th className="p-2 text-center text-xs font-semibold text-emerald-800/70 w-8">#</th>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left font-semibold text-emerald-900">Amaliyah</th>
                  {days.map((d) => {
                    const isToday = isCurrentMonth && today.getDate() === d;
                    const dow = new Date(year, month, d).getDay();
                    return (
                      <th key={d} className={`p-1 text-center text-[11px] font-medium ${dow === 0 ? "text-red-400/70" : "text-emerald-800/60"}`}>
                        <div className={`mx-auto grid h-6 w-6 place-items-center rounded ${isToday ? "bg-emerald-900 text-white" : ""}`}>{d}</div>
                        <div className="text-[9px]">{["A", "S", "S", "R", "K", "J", "S"][dow]}</div>
                      </th>
                    );
                  })}
                  <th className="p-2 text-center font-semibold text-emerald-900">Progress</th>
                </tr>
              </thead>
              <SortableContext items={stats.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {stats.map((it, idx) => (
                    <AmaliyahRow
                      key={it.id}
                      it={it}
                      idx={idx}
                      days={days}
                      year={year}
                      month={month}
                      entryMap={entryMap}
                      toggle={toggle}
                      updateItem={updateItem}
                      removeItem={removeItem}
                      isSpv={isSpv}
                      selected={selected}
                      setSelected={setSelected}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ icon: Icon, label, value, sub, tone, testId }) {
  const tones = {
    emerald: "from-emerald-600 to-emerald-800",
    orange: "from-amber-500 to-orange-600",
    violet: "from-teal-600 to-emerald-900",
    amber: "from-yellow-500 to-amber-600",
  };
  return (
    <div data-testid={testId} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md shadow-emerald-900/10 ${tones[tone]}`}>
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/15"><Icon size={13} /></div>
          <span className="text-[9px] uppercase tracking-widest opacity-70">{label}</span>
        </div>
        <p className="font-display mt-2 text-3xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-[11px] opacity-80">{sub}</p>
      </div>
    </div>
  );
}

function AmaliyahRow({ it, idx, days, year, month, entryMap, toggle, updateItem, removeItem, isSpv, selected, setSelected }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.id, disabled: !isSpv });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isSelected = selected.includes(it.id);
  const toggleSelect = () => setSelected(isSelected ? selected.filter((x) => x !== it.id) : [...selected, it.id]);

  const [editing, setEditing] = useState(false);
  const [nama, setNama] = useState(it.nama);
  const [target, setTarget] = useState(it.target_metrik);
  useEffect(() => { setNama(it.nama); setTarget(it.target_metrik); }, [it.nama, it.target_metrik]);
  const saveEdit = () => { updateItem(it.id, { nama, target_metrik: target, keterangan: it.keterangan }); setEditing(false); };

  return (
    <tr ref={setNodeRef} style={style} className="group border-t border-emerald-50 hover:bg-emerald-50/30" data-testid={`amaliyah-row-${it.id}`}>
      {isSpv && (
        <td className="p-2">
          <Checkbox checked={isSelected} onCheckedChange={toggleSelect} data-testid={`select-amaliyah-${it.id}`} />
        </td>
      )}
      {isSpv && (
        <td className="p-2 text-emerald-700/50 cursor-grab" {...attributes} {...listeners} data-testid={`drag-amaliyah-${it.id}`}>
          <GripVertical size={14} />
        </td>
      )}
      <td className="p-2 text-center text-xs font-mono text-emerald-800/60">{idx + 1}</td>
      <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 font-medium text-emerald-950 group-hover:bg-emerald-50/30">
        {editing && isSpv ? (
          <div className="space-y-1 min-w-[220px]">
            <Input value={nama} onChange={(e) => setNama(e.target.value)} className="h-7 text-sm" data-testid={`edit-nama-${it.id}`} />
            <Input value={target} onChange={(e) => setTarget(e.target.value)} className="h-6 text-[11px]" placeholder="Target" data-testid={`edit-target-${it.id}`} />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px]" onClick={saveEdit}>Simpan</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setNama(it.nama); setTarget(it.target_metrik); setEditing(false); }}>Batal</Button>
            </div>
          </div>
        ) : (
          <div className="min-w-[180px]">
            <div className="flex items-center gap-1">
              <span className="font-medium text-emerald-950">{it.nama}</span>
              {isSpv && (
                <>
                  <button onClick={() => setEditing(true)} className="rounded p-0.5 text-emerald-700 opacity-0 hover:bg-emerald-50 group-hover:opacity-100" data-testid={`edit-btn-${it.id}`}>✎</button>
                  <button onClick={() => removeItem(it.id)} className="rounded p-0.5 text-red-600 opacity-0 hover:bg-red-50 group-hover:opacity-100" data-testid={`delete-btn-${it.id}`}><Trash2 size={11} /></button>
                </>
              )}
            </div>
            <p className="text-[10px] text-emerald-700/60">{it.target_metrik}</p>
          </div>
        )}
      </td>
      {days.map((d) => {
        const p = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const e = entryMap.get(`${it.id}::${p}`);
        return (
          <td key={d} className="p-1 text-center">
            <button data-testid={`cell-${it.id}-${d}`} onClick={() => toggle(it.id, d)}
              className={`h-6 w-6 rounded transition ${e?.checked ? "bg-emerald-500 text-white shadow-sm" : "border border-emerald-200 bg-white hover:bg-emerald-50"}`}>
              {e?.checked ? "✓" : ""}
            </button>
          </td>
        );
      })}
      <td className="p-2 text-center">
        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          <Flame size={12} />{it.count}/{it.target}
        </div>
        <div className="mt-1 h-1 w-16 mx-auto overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${it.pct}%` }} />
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-emerald-800">{it.pct}%</p>
      </td>
    </tr>
  );
}
