import { DndContext, PointerSensor, useSensor, useSensors, closestCorners, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { MoreVertical, Pencil, Archive, Trash2, ArchiveRestore, ArrowRightLeft, Plus, Calendar, Check, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createTaskList } from "@/lib/api";
import { toast } from "sonner";

export default function KanbanBoard({
  lists, tasks, labels, arsipMode, divisiId,
  anggotaMap = {}, kategoriMap = {},
  selectedIds = [], setSelectedIds,
  onEdit, onArchive, onUnarchive, onDelete, onMove, onDragEndTask, onListsChanged,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [active, setActive] = useState(null);

  // Filter out rutin tasks from kanban (they belong to Rutin Tracker)
  const projectTasks = tasks.filter((t) => t.kategori === "PROJECT");
  const rutinCount = tasks.length - projectTasks.length;

  const byList = {};
  lists.forEach((l) => (byList[l.id] = []));
  byList["no-list"] = [];
  // Fallback untuk tugas delegasi yang list_id-nya milik divisi lain:
  // kelompokkan berdasarkan status agar tetap muncul di kolom yang sesuai.
  const sortedLists = [...lists].sort((a, b) => a.urutan - b.urutan);
  const firstList = sortedLists.find((l) => !l.is_done);
  const doneList = sortedLists.find((l) => l.is_done);
  const midList = sortedLists.find((l) => !l.is_done && l.id !== firstList?.id) || firstList;
  const statusToList = (status) => {
    if (status === "SELESAI") return doneList?.id;
    if (status === "BELUM_MULAI") return firstList?.id;
    return midList?.id; // DALAM_PROSES / REVISI / TERKENDALA
  };
  projectTasks.forEach((t) => {
    let key = t.list_id && byList[t.list_id] ? t.list_id : null;
    if (!key && t.list_id) key = statusToList(t.status); // list milik divisi lain
    if (!key || !byList[key]) key = "no-list";
    byList[key].push(t);
  });

  const onDragStart = (evt) => setActive(projectTasks.find((t) => t.id === evt.active.id));
  const onDragEnd = async (evt) => {
    setActive(null);
    if (!evt.over || !evt.active) return;
    await onDragEndTask(evt.active.id, evt.over.id);
  };

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const anySelected = selectedIds.length > 0;

  return (
    <>
      {rutinCount > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800/80">
          <b>{rutinCount}</b> tugas rutin ada di <a href="/tugas-rutin" className="font-semibold text-emerald-700 underline">Tugas Rutin Tracker</a>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 thin-scroll" data-testid="task-board">
          {lists.map((list) => (
            <Column key={list.id} list={list} tasks={byList[list.id] || []} labels={labels} anggotaMap={anggotaMap} kategoriMap={kategoriMap}
              arsipMode={arsipMode} anySelected={anySelected} selectedIds={selectedIds} toggleSelect={toggleSelect}
              onEdit={onEdit} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} onMove={onMove} />
          ))}
          {(byList["no-list"]?.length || 0) > 0 && (
            <Column list={{ id: "no-list", nama: "Tanpa List", warna: "#94a3b8" }} tasks={byList["no-list"] || []} labels={labels} anggotaMap={anggotaMap} kategoriMap={kategoriMap}
              arsipMode={arsipMode} anySelected={anySelected} selectedIds={selectedIds} toggleSelect={toggleSelect}
              onEdit={onEdit} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} onMove={onMove} />
          )}
          <AddListColumn divisiId={divisiId} onCreated={onListsChanged} />
        </div>
        <DragOverlay>{active ? <Card task={active} labels={labels} anggotaMap={anggotaMap} kategoriMap={kategoriMap} dragging /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function Column({ list, tasks, labels, anggotaMap, kategoriMap, arsipMode, anySelected, selectedIds, toggleSelect, onEdit, onArchive, onUnarchive, onDelete, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id });
  return (
    <div ref={setNodeRef}
      className={`flex w-80 shrink-0 flex-col rounded-xl border p-3 transition ${isOver ? "border-emerald-400 bg-emerald-50/70" : "border-emerald-100 bg-white"}`}
      data-testid={`kanban-column-${list.id}`}>
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: list.warna }} />
          <span className="font-display text-sm font-semibold text-emerald-950">{list.nama}</span>
        </div>
        <span className="text-xs text-emerald-800/60">{tasks.length}</span>
      </div>
      <div className="flex min-h-[60px] flex-col gap-2">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} labels={labels} anggotaMap={anggotaMap} kategoriMap={kategoriMap} arsipMode={arsipMode}
            selected={selectedIds.includes(t.id)} anySelected={anySelected} toggleSelect={toggleSelect}
            onEdit={onEdit} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} onMove={onMove} />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-md border border-dashed border-emerald-200 p-3 text-center text-xs text-emerald-800/40">Kosong</p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ task, labels, anggotaMap, kategoriMap, arsipMode, selected, anySelected, toggleSelect, onEdit, onArchive, onUnarchive, onDelete, onMove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: selected });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card task={task} labels={labels} anggotaMap={anggotaMap} kategoriMap={kategoriMap} arsipMode={arsipMode}
        selected={selected} anySelected={anySelected} toggleSelect={toggleSelect}
        onEdit={onEdit} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} onMove={onMove} />
    </div>
  );
}

function Card({ task, labels, anggotaMap, kategoriMap, arsipMode, selected, anySelected, toggleSelect, onEdit, onArchive, onUnarchive, onDelete, onMove, dragging }) {
  const taskLabels = (task.label_ids || []).map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  const anggota = task.penerima_tugas_id ? anggotaMap[task.penerima_tugas_id] : null;
  const kategori = task.kategori_id ? kategoriMap[task.kategori_id] : null;
  const isMoved = !!task.moved_at;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      className={`group relative rounded-lg border bg-white p-3 shadow-sm transition ${
        selected ? "border-amber-400 ring-2 ring-amber-300" :
        isMoved ? "border-red-200 ring-1 ring-red-100" :
        "border-emerald-100"
      } ${dragging ? "shadow-2xl scale-105" : "hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"}`}>
      {isMoved && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[8px] font-bold text-white">!</span>}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {toggleSelect && (
            <div onPointerDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => toggleSelect(task.id)}
                data-testid={`card-check-${task.id}`}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition ${
                  selected ? "bg-emerald-900 text-white" :
                  anySelected ? "border border-emerald-400 bg-white" :
                  "border border-transparent opacity-0 group-hover:border-emerald-300 group-hover:opacity-100"
                }`}
              >
                {selected && <Check size={10} />}
              </button>
            </div>
          )}
          <p className="text-sm font-semibold text-emerald-950">{task.nama}</p>
        </div>
        {onEdit && (
          <div onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded p-1 text-emerald-700 opacity-0 hover:bg-emerald-50 group-hover:opacity-100" data-testid={`card-menu-${task.id}`}>
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(task)}><Pencil size={12} /> Ubah</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(task)}><ArrowRightLeft size={12} /> Pindahkan Tugas</DropdownMenuItem>
                {arsipMode
                  ? <DropdownMenuItem onClick={() => onUnarchive(task.id)}><ArchiveRestore size={12} /> Kembalikan</DropdownMenuItem>
                  : <DropdownMenuItem onClick={() => onArchive(task.id)}><Archive size={12} /> Arsipkan</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600 focus:text-red-700"><Trash2 size={12} /> Hapus</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {taskLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {taskLabels.map((l) => (
            <span key={l.id} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: l.warna }}>{l.nama}</span>
          ))}
        </div>
      )}
      {task.pemberi_id && task.penerima_tugas_id && task.pemberi_id !== task.penerima_tugas_id && anggotaMap[task.pemberi_id] && (
        <p className="mt-1.5 text-[10px] font-medium text-sky-700" data-testid={`card-delegasi-${task.id}`}>
          ↔ Delegasi dari {anggotaMap[task.pemberi_id].nama}
        </p>
      )}
      {task.status === "REVISI" && (
        <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1" data-testid={`card-revisi-${task.id}`}>
          <p className="text-[10px] font-bold text-red-700">REVISI{task.revisi_count > 1 ? ` #${task.revisi_count}` : ""}</p>
          {task.revisi_catatan && <p className="line-clamp-2 text-[10px] text-red-700/80">{task.revisi_catatan}</p>}
        </div>
      )}
      {task.hasil_link && (
        <a href={task.hasil_link} target="_blank" rel="noopener noreferrer" data-testid={`card-hasil-${task.id}`}
          className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200"
          onPointerDown={(e) => e.stopPropagation()}>
          Hasil ↗
        </a>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {kategori && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: kategori.warna }}>{kategori.nama}</span>}
        {task.deadline && (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <Calendar size={9} className="mr-0.5 inline" />{task.deadline}
          </span>
        )}
        {anggota && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-1" style={{ background: anggota.warna }}>
            <User size={9} />{anggota.nama}
          </span>
        )}
      </div>
      {task.catatan_tim && <p className="mt-2 line-clamp-2 text-xs text-emerald-800/70">{task.catatan_tim}</p>}
    </div>
  );
}

function AddListColumn({ divisiId, onCreated }) {
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState("");

  const submit = async () => {
    if (!nama.trim()) { setAdding(false); return; }
    try { await createTaskList({ nama: nama.trim(), divisi_id: divisiId }); setNama(""); setAdding(false); onCreated(); toast.success("List baru ditambahkan"); }
    catch { toast.error("Gagal"); }
  };

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} data-testid="add-list-column-btn"
        className="flex w-72 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-white/40 p-4 text-sm font-medium text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50">
        <Plus size={16} /> Tambah List
      </button>
    );
  }
  return (
    <div className="flex w-80 shrink-0 flex-col gap-2 rounded-xl border border-emerald-300 bg-white p-3">
      <Input autoFocus value={nama} onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Nama list..." data-testid="add-list-column-input" />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} className="flex-1 bg-emerald-900 hover:bg-emerald-800">Simpan</Button>
        <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNama(""); }}>Batal</Button>
      </div>
    </div>
  );
}
