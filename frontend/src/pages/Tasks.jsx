import { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, LayoutGrid, Table as TableIcon, Search, X, Users, Archive, ArchiveRestore, ArrowRightLeft, FileUp, BarChart3, Bookmark, ChevronDown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, formatApiErr } from "@/lib/AuthContext";
import {
  listTasks, createTask, updateTask, deleteTask, archiveTask, unarchiveTask, bulkDeleteTasks,
  bulkArchiveTasks, bulkUnarchiveTasks,
  listTaskLists, listTaskLabels, listDivisi, listAnggota, markSeenTasks, moveTask,
  importExcel, anggotaAnalytics, revisiTask,
} from "@/lib/api";
import KanbanBoard from "./tasks/KanbanBoard";
import TableView from "./tasks/TableView";
import {
  TaskDialog, MoveTaskDialog, BulkMoveDialog,
  DivisiManagerDialog, AnggotaManagerDialog,
} from "./tasks/dialogs";

const emptyForm = {
  nama: "", kategori: "PROJECT", status: "BELUM_MULAI",
  pemberi_tugas: "", penerima_tugas: "", penerima_tugas_id: null,
  tanggal_mulai: "", deadline: "",
  catatan_tim: "", divisi_id: null, list_id: null, label_ids: [],
  brief_link: "", hasil_link: "", hasil_catatan: "",
};

const PRESET_KEY = "qm_filter_presets_v1";

export default function Tasks() {
  const outlet = useOutletContext();
  const { user } = useAuth();
  const isSpv = user?.role === "spv";
  const myAnggotaId = user?.anggota_id || null;
  const [divisiList, setDivisiList] = useState([]);
  const [divisiId, setDivisiId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [labels, setLabels] = useState([]);
  const [anggotaAll, setAnggotaAll] = useState([]);
  const [allListsMap, setAllListsMap] = useState({});
  const [arsipMode, setArsipMode] = useState(false);
  const [view, setView] = useState("board");
  const [filter, setFilter] = useState({ search: "", list_id: "ALL", label_id: "ALL", penerima_id: "ALL" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY) || "{}"); } catch { return {}; }
  });

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTaskState, setMoveTaskState] = useState(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [divisiMgrOpen, setDivisiMgrOpen] = useState(false);
  const [anggotaMgrOpen, setAnggotaMgrOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const anggotaMap = useMemo(() => Object.fromEntries(anggotaAll.map((a) => [a.id, a])), [anggotaAll]);
  const myDivisiId = myAnggotaId ? anggotaMap[myAnggotaId]?.divisi_id : null;
  const visibleDivisi = isSpv ? divisiList : divisiList.filter((d) => d.id === myDivisiId);

  useEffect(() => {
    (async () => {
      const [d, lb, ag] = await Promise.all([listDivisi(), listTaskLabels(), listAnggota()]);
      setDivisiList(d); setLabels(lb); setAnggotaAll(ag);
      const myAng = user?.anggota_id ? ag.find((a) => a.id === user.anggota_id) : null;
      const firstDiv = (user?.role === "spv" ? null : myAng?.divisi_id) || d[0]?.id;
      if (!divisiId && firstDiv) setDivisiId(firstDiv);
    })();
    // eslint-disable-next-line
  }, []);

  const refreshAllListsMap = async () => {
    const all = await listTaskLists();
    const map = {};
    all.forEach((l) => { const k = l.divisi_id || "none"; if (!map[k]) map[k] = []; map[k].push(l); });
    setAllListsMap(map);
  };

  useEffect(() => {
    if (!divisiId) return;
    (async () => {
      const [t, l] = await Promise.all([
        listTasks({ divisi_id: divisiId, archived: arsipMode }),
        listTaskLists({ divisi_id: divisiId }),
      ]);
      setTasks(t); setLists(l); setSelectedIds([]);
      if (!arsipMode) { await markSeenTasks(divisiId); outlet?.refreshUnread?.(); }
    })();
    refreshAllListsMap();
    // eslint-disable-next-line
  }, [divisiId, arsipMode]);

  const refresh = async () => {
    if (!divisiId) return;
    const [t, l] = await Promise.all([
      listTasks({ divisi_id: divisiId, archived: arsipMode }),
      listTaskLists({ divisi_id: divisiId }),
    ]);
    setTasks(t); setLists(l); refreshAllListsMap();
    outlet?.refreshUnread?.();
  };
  const refreshDivisi = async () => {
    const d = await listDivisi(); setDivisiList(d);
    if (!d.find((x) => x.id === divisiId) && d.length > 0) setDivisiId(myDivisiId || d[0].id);
  };
  const refreshLabels = async () => setLabels(await listTaskLabels());
  const refreshAnggota = async () => setAnggotaAll(await listAnggota());
  const refreshLists = async () => { setLists(await listTaskLists({ divisi_id: divisiId })); refreshAllListsMap(); };

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filter.search && !t.nama?.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.list_id !== "ALL" && (t.list_id || "no-list") !== filter.list_id) return false;
    if (filter.label_id !== "ALL" && !(t.label_ids || []).includes(filter.label_id)) return false;
    if (filter.penerima_id !== "ALL" && t.penerima_tugas_id !== filter.penerima_id) return false;
    return true;
  }), [tasks, filter]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, divisi_id: divisiId, list_id: lists[0]?.id || null }); setTaskDialogOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...emptyForm, ...t, tanggal_mulai: t.tanggal_mulai || "", deadline: t.deadline || "", label_ids: t.label_ids || [] }); setTaskDialogOpen(true); };
  const openMove = (t) => { setMoveTaskState(t); setMoveOpen(true); };

  const submit = async () => {
    if (!form.nama.trim()) return toast.error("Nama tugas wajib diisi");
    try {
      const payload = { ...form };
      if (!payload.tanggal_mulai) payload.tanggal_mulai = null;
      if (!payload.deadline) payload.deadline = null;
      if (editing) { await updateTask(editing.id, payload); toast.success("Tugas diperbarui"); }
      else {
        delete payload.catatan_spv; delete payload.link_output;
        await createTask(payload);
        toast.success("Tugas baru masuk ke workspace Anda");
        // Backend memaksa tugas ke divisi pembuat — pindah ke board sendiri agar terlihat
        if (myDivisiId && divisiId !== myDivisiId) { setDivisiId(myDivisiId); setTaskDialogOpen(false); return; }
      }
      setTaskDialogOpen(false); refresh();
    } catch (e) { toast.error(formatApiErr(e)); }
  };

  const saveCell = async (id, patch) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    try { await updateTask(id, patch); } catch (e) { toast.error(formatApiErr(e)); refresh(); }
  };

  const submitRevisi = async (taskId, catatan) => {
    try {
      await revisiTask(taskId, catatan);
      toast.success("Revisi dikirim — penerima akan melihat catatanmu");
      setTaskDialogOpen(false);
      refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal kirim revisi"); }
  };

  const archive = async (id) => { await archiveTask(id); toast.success("Diarsipkan"); refresh(); };
  const unarchive = async (id) => { await unarchiveTask(id); toast.success("Dikembalikan"); refresh(); };
  const remove = async (id) => { if (!window.confirm("Hapus tugas ini permanen?")) return; await deleteTask(id); toast.success("Dihapus"); refresh(); };
  const bulkRemove = async () => { if (!window.confirm(`Hapus ${selectedIds.length} tugas?`)) return; await bulkDeleteTasks(selectedIds); toast.success(`${selectedIds.length} dihapus`); setSelectedIds([]); refresh(); };
  const bulkArchive = async () => { await bulkArchiveTasks(selectedIds); toast.success(`${selectedIds.length} diarsipkan`); setSelectedIds([]); refresh(); };
  const bulkUnarchive = async () => { await bulkUnarchiveTasks(selectedIds); toast.success(`${selectedIds.length} dikembalikan`); setSelectedIds([]); refresh(); };

  const onDragEndTask = async (taskId, overId) => {
    const task = tasks.find((t) => t.id === taskId); if (!task) return;
    let newListId = overId; if (newListId === "no-list") newListId = null;
    if (newListId === task.list_id) return;
    const targetList = lists.find((l) => l.id === newListId);
    // Selalu sinkronkan status saat pindah kolom — agar workspace pemberi tugas
    // (yang mungkin tidak punya list ini) tetap melihat status terbaru.
    const patch = { list_id: newListId };
    if (targetList) {
      patch.status = targetList.is_done ? "SELESAI" : (targetList.urutan <= 1 ? "BELUM_MULAI" : "DALAM_PROSES");
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    try {
      await updateTask(taskId, patch);
      if (targetList?.is_done && !arsipMode) toast.success(`Selesai! ${task.nama}`, { action: { label: "Arsipkan", onClick: () => archive(taskId) } });
    } catch { toast.error("Gagal"); refresh(); }
  };

  const onReorderLocal = (r) => setTasks(r);
  const outletUnread = outlet?.unread?.by_divisi || {};
  const filterActive = filter.search || filter.list_id !== "ALL" || filter.label_id !== "ALL" || filter.penerima_id !== "ALL";
  const filteredAnggotaCurrent = anggotaAll.filter((a) => a.divisi_id === divisiId);

  const savePreset = () => {
    const name = window.prompt("Nama preset:", "");
    if (!name?.trim()) return;
    const next = { ...presets, [name.trim()]: filter };
    setPresets(next); localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    toast.success(`Preset "${name}" tersimpan`);
  };
  const applyPreset = (name) => { setFilter(presets[name]); toast.success(`Preset "${name}" dimuat`); };
  const deletePreset = (name) => {
    const next = { ...presets }; delete next[name];
    setPresets(next); localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      {/* Divisi Selector */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white p-2" data-testid="divisi-selector">
        <Users size={16} className="mx-2 text-emerald-700" />
        <div className="flex flex-wrap gap-1">
          {visibleDivisi.map((d) => {
            const count = outletUnread[d.id] || 0;
            return (
              <button key={d.id} onClick={() => setDivisiId(d.id)} data-testid={`divisi-tab-${d.id}`}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${divisiId === d.id ? "bg-emerald-900 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"}`}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: d.warna }} />
                {d.nama}
                {count > 0 && divisiId !== d.id && (
                  <span data-testid={`divisi-badge-${d.id}`} className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0 text-[9px] font-bold text-white">{count}</span>
                )}
              </button>
            );
          })}
          {isSpv && (
            <button onClick={() => setDivisiMgrOpen(true)} data-testid="open-divisi-mgr" className="rounded-lg border border-dashed border-emerald-300 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"><Plus size={12} className="inline" /> Tim</button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAnalyticsOpen(true)} data-testid="open-analytics" className="text-emerald-800 hover:bg-emerald-50"><BarChart3 size={14} /> Analytics</Button>
          {isSpv && (
            <Button size="sm" variant="ghost" onClick={() => setAnggotaMgrOpen(true)} data-testid="open-anggota-mgr" className="text-emerald-800 hover:bg-emerald-50"><UserPlus size={14} /> Anggota</Button>
          )}
        </div>
      </div>

      {/* Simplified toolbar: search + filter dropdown + preset + view + tugas baru */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white p-2">
        <Tabs value={arsipMode ? "arsip" : "aktif"} onValueChange={(v) => setArsipMode(v === "arsip")}>
          <TabsList className="bg-emerald-50">
            <TabsTrigger value="aktif" data-testid="tab-aktif">Aktif</TabsTrigger>
            <TabsTrigger value="arsip" data-testid="tab-arsip"><Archive size={12} className="mr-1" />Arsip</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative min-w-[180px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
          <Input data-testid="filter-search" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Cari nama tugas..." className="h-9 pl-9" />
        </div>

        {/* Consolidated Filter Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="open-filter" className="relative">
              Filter {filterActive && <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500" />}
              <ChevronDown size={12} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <p className="mb-2 text-[10px] uppercase font-semibold text-emerald-800/60">Filter Tugas</p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-emerald-800/70">Status</label>
                <MiniSelect value={filter.list_id} onChange={(v) => setFilter({ ...filter, list_id: v })} options={[{ id: "ALL", nama: "Semua" }, ...lists, { id: "no-list", nama: "Tanpa status" }]} testId="filter-list" />
              </div>
              <div>
                <label className="text-[10px] text-emerald-800/70">Label</label>
                <MiniSelect value={filter.label_id} onChange={(v) => setFilter({ ...filter, label_id: v })} options={[{ id: "ALL", nama: "Semua" }, ...labels]} testId="filter-label" />
              </div>
              <div>
                <label className="text-[10px] text-emerald-800/70">Penerima</label>
                <MiniSelect value={filter.penerima_id} onChange={(v) => setFilter({ ...filter, penerima_id: v })} options={[{ id: "ALL", nama: "Semua" }, ...filteredAnggotaCurrent]} testId="filter-penerima" />
              </div>
              {filterActive && (
                <Button size="sm" variant="ghost" onClick={() => setFilter({ search: "", list_id: "ALL", label_id: "ALL", penerima_id: "ALL" })} className="w-full text-xs" data-testid="filter-reset"><X size={12} /> Reset</Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Preset chips + save */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="open-presets"><Bookmark size={12} /> Preset<ChevronDown size={11} /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <p className="mb-1 text-[10px] uppercase font-semibold text-emerald-800/60">Preset Filter</p>
            <div className="max-h-40 space-y-0.5 overflow-auto">
              {Object.keys(presets).length === 0 && <p className="px-2 py-1 text-[10px] italic text-emerald-800/50">Belum ada preset.</p>}
              {Object.keys(presets).map((n) => (
                <div key={n} className="group flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-emerald-50">
                  <button onClick={() => applyPreset(n)} className="flex-1 text-left text-emerald-900" data-testid={`preset-${n}`}>{n}</button>
                  <button onClick={() => deletePreset(n)} className="rounded p-0.5 text-red-500 opacity-0 hover:bg-red-50 group-hover:opacity-100"><X size={11} /></button>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={savePreset} disabled={!filterActive} data-testid="save-preset" className="mt-2 w-full bg-emerald-700 text-xs hover:bg-emerald-800">
              <Plus size={12} /> Simpan filter saat ini
            </Button>
          </PopoverContent>
        </Popover>

        <div className="flex rounded-lg border border-emerald-200 bg-white p-1">
          <button data-testid="view-board" onClick={() => setView("board")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${view === "board" ? "bg-emerald-900 text-white" : "text-emerald-800"}`}><LayoutGrid size={13} /> Kanban</button>
          <button data-testid="view-table" onClick={() => setView("table")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${view === "table" ? "bg-emerald-900 text-white" : "text-emerald-800"}`}><TableIcon size={13} /> Tabel</button>
        </div>

        <Button onClick={openNew} data-testid="add-task-button" className="bg-emerald-900 text-white hover:bg-emerald-800 h-9"><Plus size={16} /> Tugas Baru</Button>
      </div>

      {/* Bulk Toolbar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 shadow-md" data-testid="bulk-toolbar">
          <span className="text-sm font-semibold text-amber-900">{selectedIds.length} tugas terpilih</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setBulkMoveOpen(true)} variant="outline" data-testid="bulk-move-open"><ArrowRightLeft size={14} /> Pindahkan</Button>
            {arsipMode ? <Button size="sm" onClick={bulkUnarchive} variant="outline" data-testid="bulk-unarchive"><ArchiveRestore size={14} /> Kembalikan</Button>
              : <Button size="sm" onClick={bulkArchive} variant="outline" data-testid="bulk-archive"><Archive size={14} /> Arsipkan</Button>}
            <Button size="sm" onClick={bulkRemove} className="bg-red-600 hover:bg-red-700 text-white" data-testid="bulk-delete"><Trash2 size={14} /> Hapus</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} data-testid="bulk-cancel"><X size={14} /></Button>
          </div>
        </div>
      )}

      {/* Main */}
      {view === "board" ? (
        <KanbanBoard lists={lists} tasks={filtered} labels={labels} anggotaMap={anggotaMap} arsipMode={arsipMode} divisiId={divisiId}
          selectedIds={selectedIds} setSelectedIds={setSelectedIds}
          onEdit={openEdit} onMove={openMove} onArchive={archive} onUnarchive={unarchive} onDelete={remove}
          onDragEndTask={onDragEndTask} onListsChanged={refreshLists} />
      ) : (
        <TableView tasks={filtered} lists={lists} labels={labels} anggotaAll={anggotaAll} divisiList={divisiList} currentDivisiId={divisiId}
          selectedIds={selectedIds} setSelectedIds={setSelectedIds}
          onSaveCell={saveCell} onEdit={openEdit} onMove={openMove} onArchive={archive} onUnarchive={unarchive} onDelete={remove}
          onReorderLocal={onReorderLocal} arsipMode={arsipMode} isSpv={isSpv}
          refreshLists={refreshLists} refreshLabels={refreshLabels} refreshAnggota={refreshAnggota} />
      )}

      <TaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} form={form} setForm={setForm} onSubmit={submit} editing={!!editing}
        lists={lists} labels={labels} anggotaAll={anggotaAll} divisiList={divisiList} currentDivisiId={divisiId}
        isSpv={isSpv} myAnggotaId={myAnggotaId} editingTask={editing} onRevisi={submitRevisi}
        onNeedMoveConfirm={(targetDivisiId, anggotaNama) => {
          if (!editing) return;
          const nama = divisiList.find((d) => d.id === targetDivisiId)?.nama;
          if (window.confirm(`Anggota "${anggotaNama}" ada di tim "${nama}". Pindahkan tugas ke sana?`)) {
            moveTask(editing.id, { divisi_id: targetDivisiId }).then(refresh);
          }
        }} />
      <MoveTaskDialog open={moveOpen} onOpenChange={setMoveOpen} task={moveTaskState} divisiList={divisiList} allListsMap={allListsMap} refreshLists={refreshAllListsMap} onMoved={refresh} anggotaAll={anggotaAll} />
      <BulkMoveDialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen} taskIds={selectedIds} divisiList={divisiList} allListsMap={allListsMap} onDone={() => { setSelectedIds([]); refresh(); }} />
      <DivisiManagerDialog open={divisiMgrOpen} onOpenChange={setDivisiMgrOpen} divisiList={divisiList} onChange={refreshDivisi} />
      <AnggotaManagerDialog open={anggotaMgrOpen} onOpenChange={setAnggotaMgrOpen} anggotaList={anggotaAll} divisiList={divisiList} currentDivisiId={divisiId} onChange={refreshAnggota} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => { refreshDivisi(); refresh(); }} />
      <AnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} divisiId={divisiId} divisiName={divisiList.find((d) => d.id === divisiId)?.nama} />
    </div>
  );
}

function MiniSelect({ value, onChange, options, testId }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
      className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs text-emerald-900 focus:border-emerald-400 focus:outline-none">
      {options.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
    </select>
  );
}

function ImportDialog({ open, onOpenChange, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef();

  if (!open) return null;
  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await importExcel(file);
      setResult(r);
      toast.success(`Impor selesai: ${r.imported_tasks} tugas, ${r.imported_amaliyah} amaliyah`);
      onDone();
    } catch (e) { toast.error("Gagal impor: " + (e?.response?.data?.detail || e.message)); }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-emerald-950">Impor dari Excel</h3>
          <button onClick={() => onOpenChange(false)} className="rounded p-1 hover:bg-emerald-50"><X size={16} /></button>
        </div>
        <p className="text-xs text-emerald-800/70 mb-3">Upload file .xlsx workspace tim. Sheet tugas & amaliyah dideteksi otomatis.</p>
        <label onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center transition hover:border-emerald-400">
          <FileUp size={28} className="mb-2 text-emerald-700" />
          <p className="text-sm font-medium text-emerald-950">{file ? file.name : "Klik untuk pilih .xlsx"}</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0]); setResult(null); }} className="hidden" data-testid="file-input" />
        </label>
        {result && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <b>Berhasil!</b> {result.imported_tasks} tugas + {result.imported_amaliyah} amaliyah diimpor.
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={upload} disabled={!file || uploading} data-testid="upload-button" className="bg-emerald-900 hover:bg-emerald-800">
            {uploading ? "Memproses..." : "Impor Sekarang"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsDialog({ open, onOpenChange, divisiId, divisiName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!open || !divisiId) return;
    setLoading(true);
    anggotaAnalytics({ divisi_id: divisiId, month }).then(setData).finally(() => setLoading(false));
  }, [open, divisiId, month]);

  if (!open) return null;
  const max = Math.max(1, ...(data?.anggota || []).map((a) => a.total));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-emerald-950">Leaderboard Anggota</h3>
            <p className="text-xs text-emerald-800/60">Tim: <b>{divisiName}</b></p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-emerald-200 px-2 py-1 text-xs" data-testid="analytics-month" />
            <button onClick={() => onOpenChange(false)} className="rounded p-1 hover:bg-emerald-50"><X size={16} /></button>
          </div>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-emerald-800/60">Menghitung...</p>
          : (data?.anggota || []).length === 0 ? <p className="p-8 text-center text-sm text-emerald-800/60">Belum ada anggota atau data bulan ini.</p>
          : (
            <div className="space-y-2" data-testid="analytics-list">
              {(data?.anggota || []).map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-emerald-100 p-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full font-bold text-white" style={{ background: a.warna }}>{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-950">{a.nama}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(a.total / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-display text-lg font-bold text-emerald-900">{a.total}</p><p className="text-[10px] text-emerald-800/60">Total</p></div>
                    <div><p className="font-display text-lg font-bold text-emerald-700">{a.selesai}</p><p className="text-[10px] text-emerald-800/60">Selesai</p></div>
                    <div><p className="font-display text-lg font-bold text-red-600">{a.terkendala}</p><p className="text-[10px] text-emerald-800/60">Kendala</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
