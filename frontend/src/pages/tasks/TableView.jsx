import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Trash2, ArrowRightLeft, Archive, ArchiveRestore, MoreVertical, Pencil, GripVertical, Repeat, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TIPES } from "./shared";
import { reorderTasks, createTaskList, updateTaskList, deleteTaskList, createTaskLabel, updateTaskLabel, deleteTaskLabel, createAnggota } from "@/lib/api";
import { toast } from "sonner";

const STATUS_LABELS = { BELUM_MULAI: "Belum Mulai", DALAM_PROSES: "Dalam Proses", SELESAI: "Selesai", TERKENDALA: "Terkendala", REVISI: "Revisi" };
const STATUS_COLORS = { BELUM_MULAI: "bg-slate-100 text-slate-700", DALAM_PROSES: "bg-amber-100 text-amber-800", SELESAI: "bg-emerald-100 text-emerald-800", TERKENDALA: "bg-orange-100 text-orange-800", REVISI: "bg-red-100 text-red-700" };

export default function TableView({
  tasks, lists, labels, anggotaAll, divisiList, currentDivisiId,
  selectedIds, setSelectedIds,
  onSaveCell, onEdit, onMove, onArchive, onUnarchive, onDelete, onReorderLocal, arsipMode,
  refreshLists, refreshLabels, refreshAnggota, isSpv = true,
}) {
  const listMap = Object.fromEntries(lists.map((l) => [l.id, l]));
  const labelMap = Object.fromEntries(labels.map((l) => [l.id, l]));
  const anggotaMap = Object.fromEntries(anggotaAll.map((a) => [a.id, a]));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const anySelected = selectedIds.length > 0;
  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;

  const onDragEnd = async (evt) => {
    if (!evt.over || evt.active.id === evt.over.id) return;
    const oldIdx = tasks.findIndex((t) => t.id === evt.active.id);
    const newIdx = tasks.findIndex((t) => t.id === evt.over.id);
    const reordered = arrayMove(tasks, oldIdx, newIdx);
    onReorderLocal(reordered);
    try { await reorderTasks(reordered.map((t) => t.id)); }
    catch { toast.error("Gagal simpan urutan"); }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white" data-testid="task-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-sm">
            <thead className="bg-emerald-50 text-left">
              <tr>
                <th className="w-12 p-3">
                  {anySelected ? (
                    <input type="checkbox" checked={allSelected}
                      onChange={(e) => setSelectedIds(e.target.checked ? tasks.map((t) => t.id) : [])}
                      data-testid="select-all-checkbox" className="h-4 w-4 cursor-pointer" />
                  ) : <span className="text-[11px] font-semibold text-emerald-900/70">No</span>}
                </th>
                <th className="p-3 font-semibold text-emerald-900">Nama Tugas</th>
                <th className="p-3 font-semibold text-emerald-900">Tipe</th>
                <th className="p-3 font-semibold text-emerald-900">
                  <ColumnHeader label="Status" items={lists} refresh={refreshLists}
                    onCreate={async (nama) => { await createTaskList({ nama, divisi_id: currentDivisiId }); }}
                    onUpdate={async (item, patch) => { await updateTaskList(item.id, { ...item, ...patch }); }}
                    onDelete={async (id) => { await deleteTaskList(id); }} />
                </th>
                <th className="p-3 font-semibold text-emerald-900">
                  <ColumnHeader label="Penerima" items={anggotaAll.filter((a) => a.divisi_id === currentDivisiId)} refresh={refreshAnggota}
                    onCreate={isSpv ? async (nama) => { await createAnggota({ nama, divisi_id: currentDivisiId }); } : null} />
                </th>
                <th className="p-3 font-semibold text-emerald-900">
                  <ColumnHeader label="Label" items={labels} refresh={refreshLabels}
                    onCreate={async (nama) => { await createTaskLabel({ nama, warna: "#f59e0b" }); }}
                    onUpdate={async (item, patch) => { await updateTaskLabel(item.id, { ...item, ...patch }); }}
                    onDelete={async (id) => { await deleteTaskLabel(id); }} />
                </th>
                <th className="w-32 p-3 font-semibold text-emerald-900">Mulai</th>
                <th className="w-32 p-3 font-semibold text-emerald-900">Deadline</th>
                <th className="w-48 p-3 font-semibold text-emerald-900">Hasil Tugas</th>
              </tr>
            </thead>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {tasks.map((t, idx) => (
                  <Row key={t.id} task={t} idx={idx + 1} lists={lists} labels={labels} labelMap={labelMap} listMap={listMap}
                    anggotaAll={anggotaAll} anggotaMap={anggotaMap} divisiList={divisiList} currentDivisiId={currentDivisiId}
                    selected={selectedIds.includes(t.id)} anySelected={anySelected}
                    onToggleSelect={() => toggleSelect(t.id)} onSaveCell={onSaveCell}
                    onEdit={onEdit} onMove={onMove} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete}
                    arsipMode={arsipMode} isSpv={isSpv}
                    refreshLists={refreshLists} refreshLabels={refreshLabels} refreshAnggota={refreshAnggota} />
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-sm text-emerald-800/60">Tidak ada tugas.</td></tr>
                )}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </div>
    </DndContext>
  );
}

function ColumnHeader({ label, items, onCreate, onUpdate, onDelete, refresh }) {
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState("");
  const submit = async () => {
    if (!nama.trim()) return;
    try { await onCreate(nama.trim()); setNama(""); refresh(); toast.success(`${label} ditambahkan`); }
    catch { toast.error("Gagal"); }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 hover:text-emerald-700" data-testid={`col-header-${label.toLowerCase()}`}>
          {label} <Plus size={11} className="opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="mb-1 text-[10px] uppercase font-semibold text-emerald-800/60">Kelola {label}</p>
        <div className="max-h-48 space-y-0.5 overflow-auto">
          {items.map((it) => (
            <div key={it.id} className="group flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-emerald-50">
              {it.warna && <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.warna }} />}
              {onUpdate ? (
                <Input className="h-6 flex-1 border-transparent bg-transparent px-1 text-xs hover:border-emerald-200" defaultValue={it.nama}
                  onBlur={(e) => e.target.value !== it.nama && onUpdate(it, { nama: e.target.value }).then(refresh)} />
              ) : (
                <span className="flex-1 text-emerald-900">{it.nama}</span>
              )}
              {onDelete && (
                <button onClick={async () => { if (window.confirm(`Hapus "${it.nama}"?`)) { await onDelete(it.id); refresh(); toast.success("Dihapus"); } }}
                  className="rounded p-0.5 text-red-500 opacity-0 hover:bg-red-50 group-hover:opacity-100"><Trash2 size={11} /></button>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="px-1.5 py-2 text-[10px] italic text-emerald-800/50">Belum ada.</p>}
        </div>
        <div className="mt-2 flex gap-1 border-t border-emerald-100 pt-2">
          {onCreate ? (
            <>
              <Input className="h-7 flex-1 text-xs" placeholder={`+ ${label} baru`} value={nama} onChange={(e) => setNama(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} data-testid={`col-header-input-${label.toLowerCase()}`} />
              <Button size="sm" onClick={submit} className="h-7 bg-emerald-700 px-2 hover:bg-emerald-800"><Plus size={12} /></Button>
            </>
          ) : <p className="px-1 py-0.5 text-[10px] italic text-emerald-800/50">Hanya SPV yang bisa menambah.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ task, idx, lists, labels, labelMap, listMap, anggotaAll, anggotaMap, divisiList, currentDivisiId, selected, anySelected, onToggleSelect, onSaveCell, onEdit, onMove, onArchive, onUnarchive, onDelete, arsipMode, isSpv = true, refreshLists, refreshLabels, refreshAnggota }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isRutin = task.kategori !== "PROJECT";
  const isMoved = !!task.moved_at;
  const isDelegasi = task.pemberi_id && task.penerima_tugas_id && task.pemberi_id !== task.penerima_tugas_id;
  const anggota = task.penerima_tugas_id ? anggotaMap[task.penerima_tugas_id] : null;
  const pemberiAnggota = task.pemberi_id ? anggotaMap[task.pemberi_id] : null;

  return (
    <tr ref={setNodeRef} style={style}
      className={`group border-t border-emerald-50 transition hover:bg-emerald-50/40 ${selected ? "bg-amber-50/60" : ""} ${isMoved ? "border-l-4 border-l-red-400" : ""}`}
      data-testid={`task-row-${task.id}`}>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <button {...attributes} {...listeners} className="cursor-grab text-emerald-700/40 hover:text-emerald-700 active:cursor-grabbing" data-testid={`row-drag-${task.id}`}><GripVertical size={14} /></button>
          <button onClick={onToggleSelect} data-testid={`row-check-${task.id}`}
            className={`flex h-5 w-5 items-center justify-center rounded transition ${
              selected ? "bg-emerald-900 text-white" : anySelected ? "border border-emerald-400 bg-white" : "text-xs text-emerald-900/60 hover:border hover:border-emerald-400 hover:bg-white"
            }`}>{selected ? <Check size={12} /> : (anySelected ? "" : idx)}</button>
        </div>
      </td>

      <td className="max-w-[300px] p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <button onClick={() => onEdit(task)} className="block w-full truncate text-left font-medium text-emerald-950 hover:text-emerald-700 hover:underline" data-testid={`row-nama-${task.id}`}>{task.nama}</button>
            {(isMoved || isDelegasi || task.brief_link || task.status === "REVISI") && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {isMoved && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">BARU</span>}
                {task.status === "REVISI" && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white" data-testid={`row-revisi-${task.id}`}
                    title={task.revisi_catatan || ""}>REVISI{task.revisi_count > 1 ? ` #${task.revisi_count}` : ""}</span>
                )}
                {isDelegasi && pemberiAnggota && (
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700" data-testid={`row-delegasi-${task.id}`}>Dari {pemberiAnggota.nama}</span>
                )}
                {task.brief_link && (
                  <a href={task.brief_link} target="_blank" rel="noopener noreferrer" data-testid={`row-brief-${task.id}`}
                    className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 hover:bg-emerald-200">Brief ↗</a>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0 opacity-0 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded p-1 text-emerald-700 hover:bg-emerald-100" data-testid={`row-menu-${task.id}`}><MoreVertical size={13} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(task)}><Pencil size={12} /> Ubah</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(task)}><ArrowRightLeft size={12} /> Pindahkan</DropdownMenuItem>
                {arsipMode ? <DropdownMenuItem onClick={() => onUnarchive(task.id)}><ArchiveRestore size={12} /> Kembalikan</DropdownMenuItem>
                  : <DropdownMenuItem onClick={() => onArchive(task.id)}><Archive size={12} /> Arsipkan</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600 focus:text-red-700"><Trash2 size={12} /> Hapus</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </td>

      <td className="p-2"><CellSelectSimple value={task.kategori} options={TIPES.map((t) => ({ id: t, nama: t }))} onChange={(v) => onSaveCell(task.id, { kategori: v })} testId={`row-tipe-${task.id}`} /></td>

      <td className="p-2">
        {isRutin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-semibold text-purple-800">
            <Repeat size={10} /> On Tracker
          </span>
        ) : task.list_id && !listMap[task.list_id] ? (
          // List milik divisi lain (delegasi) → tampilkan status sebagai badge statis
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[task.status] || STATUS_COLORS.BELUM_MULAI}`} data-testid={`row-status-${task.id}`}>
            {STATUS_LABELS[task.status] || task.status}
          </span>
        ) : (
          <CellSelectWithAdd value={task.list_id} options={lists} onChange={(v) => onSaveCell(task.id, { list_id: v })}
            onAddInline={async (nama) => { await createTaskList({ nama, divisi_id: currentDivisiId }); refreshLists(); }} testId={`row-list-${task.id}`} placeholder="—" />
        )}
      </td>

      <td className="p-2">
        <CellSelectAnggota value={task.penerima_tugas_id} anggotaAll={anggotaAll} divisiList={divisiList} onChange={(v) => onSaveCell(task.id, { penerima_tugas_id: v })}
          onAddInline={isSpv ? async (nama) => { await createAnggota({ nama, divisi_id: currentDivisiId }); refreshAnggota(); } : null} testId={`row-penerima-${task.id}`} current={anggota} />
      </td>

      <td className="p-2">
        <LabelCell task={task} labels={labels} labelMap={labelMap} onSaveCell={onSaveCell} onAddInline={async (nama) => { await createTaskLabel({ nama, warna: "#f59e0b" }); refreshLabels(); }} />
      </td>

      <td className="p-2">
        <input type="date" defaultValue={task.tanggal_mulai || ""}
          onBlur={(e) => e.target.value !== (task.tanggal_mulai || "") && onSaveCell(task.id, { tanggal_mulai: e.target.value || null })}
          className="w-full rounded border-transparent bg-transparent px-2 py-1 text-xs text-emerald-900 hover:border-emerald-200 focus:border-emerald-400 focus:outline-none"
          data-testid={`row-mulai-${task.id}`} />
      </td>
      <td className="p-2">
        <input type="date" defaultValue={task.deadline || ""}
          onBlur={(e) => e.target.value !== (task.deadline || "") && onSaveCell(task.id, { deadline: e.target.value || null })}
          className="w-full rounded border-transparent bg-transparent px-2 py-1 text-xs text-emerald-900 hover:border-emerald-200 focus:border-emerald-400 focus:outline-none"
          data-testid={`row-deadline-${task.id}`} />
      </td>
      <td className="max-w-[220px] p-2" data-testid={`row-hasil-${task.id}`}>
        {task.hasil_link ? (
          <a href={task.hasil_link} target="_blank" rel="noopener noreferrer" data-testid={`row-hasil-link-${task.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200">
            Link ↗
          </a>
        ) : null}
        {task.hasil_catatan ? (
          <p className="mt-1 line-clamp-2 break-words text-[10px] text-emerald-800/70">{task.hasil_catatan}</p>
        ) : null}
        {!task.hasil_link && !task.hasil_catatan && <span className="text-xs text-emerald-800/30">—</span>}
      </td>
    </tr>
  );
}

function CellSelectSimple({ value, options, onChange, testId }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full rounded px-2 py-1 text-left text-xs text-emerald-900 hover:bg-emerald-50" data-testid={testId}>
          {cur?.nama || "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {options.map((o) => (
          <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-emerald-50">
            <span className="flex-1">{o.nama}</span>
            {value === o.id && <Check size={12} className="text-emerald-700" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CellSelectWithAdd({ value, options, onChange, onAddInline, testId, placeholder }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState("");
  const cur = options.find((o) => o.id === value);
  const submit = async () => {
    if (!nama.trim()) return;
    await onAddInline(nama.trim());
    setNama(""); setAdding(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full rounded px-2 py-1 text-left text-xs text-emerald-900 hover:bg-emerald-50" data-testid={testId}>
          {cur ? (
            <span className="inline-flex items-center gap-1">
              {cur.warna && <span className="h-2 w-2 rounded-full" style={{ background: cur.warna }} />}{cur.nama}
            </span>
          ) : <span className="text-emerald-800/40">{placeholder || "—"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <button onClick={() => { onChange(null); setOpen(false); }} className="flex w-full items-center rounded px-2 py-1 text-left text-xs italic text-emerald-700/70 hover:bg-emerald-50">Kosongkan</button>
        <div className="max-h-48 overflow-auto">
          {options.map((o) => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-emerald-50">
              {o.warna && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.warna }} />}
              <span className="flex-1">{o.nama}</span>
              {value === o.id && <Check size={12} className="text-emerald-700" />}
            </button>
          ))}
        </div>
        <div className="mt-1 border-t border-emerald-100 pt-1">
          {adding ? (
            <div className="flex gap-1 p-1">
              <Input autoFocus className="h-6 text-xs" value={nama} onChange={(e) => setNama(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Nama baru..." />
              <button onClick={submit} className="rounded bg-emerald-700 px-1.5 text-white hover:bg-emerald-800"><Check size={11} /></button>
              <button onClick={() => setAdding(false)} className="rounded px-1.5 text-slate-500 hover:bg-slate-50"><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-emerald-700 hover:bg-emerald-50">
              <Plus size={11} /> Buat baru
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CellSelectAnggota({ value, anggotaAll, divisiList, onChange, onAddInline, testId, current }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState("");
  const submit = async () => { if (!nama.trim()) return; await onAddInline(nama.trim()); setNama(""); setAdding(false); };
  const grouped = {}; anggotaAll.forEach((a) => { const k = a.divisi_id; if (!grouped[k]) grouped[k] = []; grouped[k].push(a); });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full rounded px-2 py-1 text-left text-xs text-emerald-900 hover:bg-emerald-50" data-testid={testId}>
          {current ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: current.warna }} />{current.nama}
            </span>
          ) : <span className="text-emerald-800/40">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <button onClick={() => { onChange(null); setOpen(false); }} className="flex w-full items-center rounded px-2 py-1 text-left text-xs italic text-emerald-700/70 hover:bg-emerald-50">Kosongkan</button>
        <div className="max-h-56 overflow-auto">
          {divisiList.map((d) => {
            const arr = grouped[d.id] || [];
            if (arr.length === 0) return null;
            return (
              <div key={d.id}>
                <p className="mt-1 px-2 text-[9px] uppercase font-semibold text-emerald-800/50">{d.nama}</p>
                {arr.map((a) => (
                  <button key={a.id} onClick={() => { onChange(a.id); setOpen(false); }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-emerald-50">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.warna }} />
                    <span className="flex-1">{a.nama}</span>
                    {value === a.id && <Check size={12} className="text-emerald-700" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-1 border-t border-emerald-100 pt-1">
          {adding ? (
            <div className="flex gap-1 p-1">
              <Input autoFocus className="h-6 text-xs" value={nama} onChange={(e) => setNama(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Nama anggota baru..." />
              <button onClick={submit} className="rounded bg-emerald-700 px-1.5 text-white hover:bg-emerald-800"><Check size={11} /></button>
              <button onClick={() => setAdding(false)} className="rounded px-1.5 text-slate-500 hover:bg-slate-50"><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-emerald-700 hover:bg-emerald-50">
              <Plus size={11} /> Tambah anggota (tim aktif)
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LabelCell({ task, labels, labelMap, onSaveCell, onAddInline }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState("");
  const submit = async () => { if (!nama.trim()) return; await onAddInline(nama.trim()); setNama(""); setAdding(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex min-h-[28px] w-full flex-wrap items-center gap-1 rounded px-2 py-1 text-left hover:bg-emerald-50" data-testid={`row-label-${task.id}`}>
          {(task.label_ids || []).length === 0 ? <span className="text-xs text-emerald-800/40">+ Label</span>
            : (task.label_ids || []).map((id) => {
                const lb = labelMap[id]; if (!lb) return null;
                return <span key={id} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: lb.warna }}>{lb.nama}</span>;
              })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="max-h-48 space-y-0.5 overflow-auto">
          {labels.map((l) => {
            const active = (task.label_ids || []).includes(l.id);
            return (
              <button key={l.id}
                onClick={() => {
                  const cur = task.label_ids || [];
                  onSaveCell(task.id, { label_ids: active ? cur.filter((x) => x !== l.id) : [...cur, l.id] });
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-emerald-50">
                <span className="h-3 w-3 rounded" style={{ background: l.warna }} />
                <span className="flex-1">{l.nama}</span>
                {active && <Check size={12} className="text-emerald-700" />}
              </button>
            );
          })}
          {labels.length === 0 && <p className="px-2 py-1 text-[10px] italic text-emerald-800/50">Belum ada label.</p>}
        </div>
        <div className="mt-1 border-t border-emerald-100 pt-1">
          {adding ? (
            <div className="flex gap-1 p-1">
              <Input autoFocus className="h-6 text-xs" value={nama} onChange={(e) => setNama(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Label baru..." />
              <button onClick={submit} className="rounded bg-emerald-700 px-1.5 text-white hover:bg-emerald-800"><Check size={11} /></button>
              <button onClick={() => setAdding(false)} className="rounded px-1.5 text-slate-500 hover:bg-slate-50"><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-emerald-700 hover:bg-emerald-50">
              <Plus size={11} /> Buat label baru
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
