import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createDivisi, updateDivisi, deleteDivisi,
  createTaskList, updateTaskList, deleteTaskList,
  createTaskLabel, updateTaskLabel, deleteTaskLabel,
  createKategori, updateKategori, deleteKategori,
  createAnggota, updateAnggota, deleteAnggota,
  moveTask, bulkMoveTasks,
} from "@/lib/api";
import { ColorPicker, KATEGORI_LABEL, TIPES } from "./shared";

const STATUS_LABELS = { BELUM_MULAI: "Belum Mulai", DALAM_PROSES: "Dalam Proses", SELESAI: "Selesai", TERKENDALA: "Terkendala", REVISI: "Revisi" };

// ============ TASK DIALOG ============
export function TaskDialog({ open, onOpenChange, form, setForm, onSubmit, editing, lists, labels, anggotaAll, divisiList, currentDivisiId, onNeedMoveConfirm, isSpv = true, myAnggotaId = null, editingTask = null, onRevisi = null }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const [revisiNote, setRevisiNote] = useState("");
  const toggleLabel = (id) => {
    const has = (form.label_ids || []).includes(id);
    setForm({ ...form, label_ids: has ? form.label_ids.filter((x) => x !== id) : [...(form.label_ids || []), id] });
  };
  const isRutin = form.kategori !== "PROJECT";

  // Delegation view: I'm pemberi (yg ngasih), tapi bukan penerima → read-only monitoring mode
  const isMonitorOnly = !isSpv && editingTask &&
    editingTask.pemberi_id === myAnggotaId &&
    editingTask.penerima_tugas_id !== myAnggotaId;
  // Only penerima (or SPV) may fill hasil_*; pemberi tidak boleh.
  const canFillHasil = isSpv || (editingTask && editingTask.penerima_tugas_id === myAnggotaId);
  const pemberiAnggota = editingTask?.pemberi_id ? anggotaAll.find((a) => a.id === editingTask.pemberi_id) : null;
  const canRevisi = editing && onRevisi && (isMonitorOnly || isSpv);

  const anggotaByDivisi = {};
  anggotaAll.forEach((a) => {
    const key = a.divisi_id || "none";
    if (!anggotaByDivisi[key]) anggotaByDivisi[key] = [];
    anggotaByDivisi[key].push(a);
  });

  const onPickPenerima = (val) => {
    if (val === "none") { setForm({ ...form, penerima_tugas_id: null }); return; }
    const a = anggotaAll.find((x) => x.id === val);
    if (!a) return;
    setForm({ ...form, penerima_tugas_id: a.id });
    const targetDivisi = form.divisi_id || currentDivisiId;
    if (a.divisi_id && a.divisi_id !== targetDivisi && editing && onNeedMoveConfirm) {
      onNeedMoveConfirm(a.divisi_id, a.nama);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="task-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? "Ubah Tugas" : "Tugas Baru"}
            {isMonitorOnly && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Monitor (read-only)</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Formulir membuat atau mengubah tugas, termasuk penerima, brief, dan hasil.</DialogDescription>
        </DialogHeader>
        {isMonitorOnly && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            Anda adalah <b>pemberi tugas</b>, bukan penerima. Anda hanya dapat memantau progress & melihat hasil. Hanya penerima (atau SPV) yang bisa mengubah tugas ini.
          </div>
        )}
        <fieldset disabled={isMonitorOnly} className={isMonitorOnly ? "opacity-90" : ""}>
        <div className="space-y-3">
          {editing && !isMonitorOnly && editingTask?.status === "REVISI" && editingTask?.revisi_catatan && (
            <div data-testid="revisi-banner" className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
              <p className="font-semibold">Revisi{pemberiAnggota ? ` dari ${pemberiAnggota.nama}` : ""}{editingTask.revisi_count > 1 ? ` (ke-${editingTask.revisi_count})` : ""}:</p>
              <p className="mt-1">{editingTask.revisi_catatan}</p>
              <p className="mt-1 text-[10px] text-red-700/70">Perbaiki hasil tugas, lalu ubah status kembali (misal Dalam Proses / Selesai).</p>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-emerald-900">Nama Tugas *</label>
            <Input data-testid="input-nama" value={form.nama} onChange={set("nama")} placeholder="contoh: Rekap konten pekan ini" />
          </div>
          <div>
            <label className="text-xs font-medium text-emerald-900">Tipe Tugas</label>
            <Select value={form.kategori} onValueChange={set("kategori")}>
              <SelectTrigger data-testid="select-tipe"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPES.map((k) => <SelectItem key={k} value={k}>{KATEGORI_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            {isRutin && (
              <p className="mt-1 text-[10px] text-emerald-700/70">
                Tugas rutin akan muncul di <b>Tugas Rutin Tracker</b>.
              </p>
            )}
          </div>
          {editing && (
            <div>
              <label className="text-xs font-medium text-emerald-900">Status Tugas</label>
              <Select value={form.status} onValueChange={set("status")}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isRutin && (
            <div>
              <label className="text-xs font-medium text-emerald-900">List</label>
              <Select value={form.list_id || "none"} onValueChange={(v) => setForm({ ...form, list_id: v === "none" ? null : v })}>
                <SelectTrigger data-testid="select-list"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa List</SelectItem>
                  {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isRutin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-emerald-900">Tanggal Mulai</label>
                <Input type="date" value={form.tanggal_mulai || ""} onChange={set("tanggal_mulai")} data-testid="input-mulai" />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-900">Deadline</label>
                <Input type="date" value={form.deadline || ""} onChange={set("deadline")} data-testid="input-deadline" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-emerald-900">Label</label>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-emerald-100 p-2">
              {labels.length === 0 && <span className="text-xs text-emerald-700/60">Belum ada label. Buka "Kelola Label".</span>}
              {labels.map((l) => {
                const active = (form.label_ids || []).includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    data-testid={`label-toggle-${l.id}`}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white transition ${active ? "ring-2 ring-offset-1 ring-emerald-900" : "opacity-60 hover:opacity-100"}`}
                    style={{ background: l.warna }}
                  >
                    {l.nama}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-emerald-900">Pemberi Tugas</label>
              <Input value={form.pemberi_tugas || ""} onChange={set("pemberi_tugas")} placeholder="opsional" />
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-900">Penerima Tugas (Anggota)</label>
              <Select value={form.penerima_tugas_id || "none"} onValueChange={onPickPenerima}>
                <SelectTrigger data-testid="select-penerima"><SelectValue placeholder="Pilih anggota..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">Tanpa penerima</SelectItem>
                  {divisiList.map((d) => {
                    const anggota = anggotaByDivisi[d.id] || [];
                    if (anggota.length === 0) return null;
                    return (
                      <SelectGroup key={d.id}>
                        <SelectLabel className="text-[10px] uppercase text-emerald-800/60">{d.nama}</SelectLabel>
                        {anggota.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: a.warna }} />
                            {a.nama}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-emerald-700/70">
                Bisa pilih anggota <b>lintas divisi</b>. Tugas tetap tampil di workspace Anda sebagai <b>monitor</b> (read-only); penerima yang mengerjakan &amp; mengisi hasil.
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-emerald-900">Catatan Tim</label>
            <Textarea rows={2} value={form.catatan_tim || ""} onChange={set("catatan_tim")} />
          </div>
          <div>
            <label className="text-xs font-medium text-emerald-900">Brief / Link Referensi <span className="text-emerald-700/50">(opsional)</span></label>
            <Input value={form.brief_link || ""} onChange={set("brief_link")} placeholder="https://docs.google.com/... (link brief eksternal)" data-testid="input-brief-link" />
          </div>
          {editing && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Hasil Tugas {canFillHasil ? <span className="text-[10px] font-normal normal-case text-emerald-700/70">(diisi oleh penerima)</span> : <span className="text-[10px] font-normal normal-case text-amber-700">(read-only — hanya penerima yang bisa isi)</span>}
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-emerald-900">Link Hasil</label>
                  <Input value={form.hasil_link || ""} onChange={set("hasil_link")} placeholder="https://drive.google.com/..." disabled={!canFillHasil} data-testid="input-hasil-link" />
                </div>
                <div>
                  <label className="text-xs font-medium text-emerald-900">Catatan Hasil</label>
                  <Textarea rows={2} value={form.hasil_catatan || ""} onChange={set("hasil_catatan")} placeholder="Catatan singkat hasil pengerjaan..." disabled={!canFillHasil} data-testid="input-hasil-catatan" />
                </div>
              </div>
            </div>
          )}
          {editing && isSpv && (
            <>
              <div>
                <label className="text-xs font-medium text-emerald-900">Catatan SPV <span className="text-emerald-700/50">(saat edit)</span></label>
                <Textarea rows={2} value={form.catatan_spv || ""} onChange={set("catatan_spv")} data-testid="input-catatan-spv" />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-900">Link Output / Dokumen (legacy)</label>
                <Input value={form.link_output || ""} onChange={set("link_output")} placeholder="https://..." data-testid="input-link" />
              </div>
            </>
          )}
        </div>
        </fieldset>
        {canRevisi && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3" data-testid="revisi-box">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-800">Review Hasil &amp; Minta Revisi</p>
            {editingTask?.revisi_catatan && (
              <p className="mb-2 text-[10px] text-red-700/70">
                Revisi terakhir{editingTask.revisi_count ? ` (total ${editingTask.revisi_count}x)` : ""}: {editingTask.revisi_catatan}
              </p>
            )}
            <Textarea rows={2} value={revisiNote} onChange={(e) => setRevisiNote(e.target.value)}
              placeholder="Tulis apa yang perlu direvisi penerima..." data-testid="input-revisi-catatan" />
            <Button onClick={() => { onRevisi(editingTask.id, revisiNote); setRevisiNote(""); }} disabled={!revisiNote.trim()}
              data-testid="submit-revisi" className="mt-2 bg-red-600 text-white hover:bg-red-700">
              Kirim Revisi (ubah status jadi REVISI)
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isMonitorOnly ? "Tutup" : "Batal"}</Button>
          {!isMonitorOnly && (
            <Button onClick={onSubmit} data-testid="submit-task" className="bg-emerald-900 hover:bg-emerald-800">
              {editing ? "Simpan Perubahan" : "Tambah Tugas"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MOVE TASK DIALOG (single) ============
export function MoveTaskDialog({ open, onOpenChange, task, divisiList, allListsMap, refreshLists, onMoved, anggotaAll = [] }) {
  const [targetDivisi, setTargetDivisi] = useState("");
  const [targetList, setTargetList] = useState("");
  const [targetPenerima, setTargetPenerima] = useState("keep");
  const [posisi, setPosisi] = useState(1);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);

  useEffect(() => {
    if (task) {
      setTargetDivisi(task.divisi_id || "");
      setTargetList("");
      setTargetPenerima("keep");
      setPosisi(1);
      setShowNewList(false);
    }
  }, [task]);

  const targetLists = allListsMap[targetDivisi] || [];

  const buatListBaru = async () => {
    if (!newListName.trim() || !targetDivisi) return toast.error("Nama list wajib");
    const l = await createTaskList({ nama: newListName.trim(), divisi_id: targetDivisi });
    setTargetList(l.id);
    setNewListName("");
    setShowNewList(false);
    await refreshLists();
    toast.success("List baru dibuat");
  };

  const pindahkan = async () => {
    if (!task) return;
    if (!targetDivisi) return toast.error("Pilih tim tujuan");
    try {
      const payload = {
        divisi_id: targetDivisi,
        list_id: targetList || null,
        urutan: Math.max(1, parseInt(posisi, 10) || 1),
      };
      if (targetPenerima && targetPenerima !== "keep") payload.penerima_tugas_id = targetPenerima;
      await moveTask(task.id, payload);
      const penerimaBaru = targetPenerima !== "keep" ? anggotaAll.find((a) => a.id === targetPenerima) : null;
      toast.success(penerimaBaru
        ? `Tugas dipindahkan ke ${penerimaBaru.nama}`
        : `Tugas dipindahkan ke ${divisiList.find((d) => d.id === targetDivisi)?.nama}`);
      onOpenChange(false);
      onMoved();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal memindahkan"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="move-dialog">
        <DialogHeader><DialogTitle className="font-display text-lg">Pindahkan Tugas</DialogTitle></DialogHeader>
        <p className="text-sm text-emerald-800/80"><b>{task?.nama}</b></p>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-emerald-800/70">PILIH TIM</label>
            <Select value={targetDivisi} onValueChange={(v) => { setTargetDivisi(v); setTargetList(""); }}>
              <SelectTrigger data-testid="move-select-divisi"><SelectValue placeholder="Pilih tim..." /></SelectTrigger>
              <SelectContent>
                {divisiList.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: d.warna }} />{d.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-emerald-800/70">PENERIMA BARU (OPSIONAL)</label>
            <Select value={targetPenerima} onValueChange={setTargetPenerima}>
              <SelectTrigger data-testid="move-select-penerima"><SelectValue placeholder="Tetap" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="keep">— Tetap (tidak berubah) —</SelectItem>
                {divisiList.map((d) => {
                  const arr = anggotaAll.filter((a) => a.divisi_id === d.id);
                  if (arr.length === 0) return null;
                  return (
                    <SelectGroup key={d.id}>
                      <SelectLabel className="text-[10px] uppercase text-emerald-800/60">{d.nama}</SelectLabel>
                      {arr.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: a.warna }} />{a.nama}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-emerald-700/60">
              Bisa pindah ke <b>perorangan lintas divisi</b> — tugas tetap tampil di workspace Anda sebagai monitor.
            </p>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-emerald-800/70">PILIH LIST TUJUAN</label>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <div>
                <p className="text-[10px] uppercase text-emerald-700/60">List</p>
                <Select value={targetList || "none"} onValueChange={(v) => setTargetList(v === "none" ? "" : v)} disabled={!targetDivisi}>
                  <SelectTrigger data-testid="move-select-list"><SelectValue placeholder="Pilih list..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa list</SelectItem>
                    {targetLists.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] uppercase text-emerald-700/60">Posisi</p>
                <Input type="number" min={1} value={posisi} onChange={(e) => setPosisi(e.target.value)} data-testid="move-posisi" />
              </div>
            </div>
          </div>
          {showNewList && (
            <div className="rounded-md border border-dashed border-emerald-300 bg-emerald-50/50 p-2">
              <div className="flex gap-2">
                <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nama list baru" data-testid="move-newlist-name" />
                <Button size="sm" onClick={buatListBaru} className="bg-emerald-700 hover:bg-emerald-800">Simpan</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewList(false)}><X size={14} /></Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button onClick={pindahkan} data-testid="move-submit" className="bg-emerald-600 text-white hover:bg-emerald-700">Pindahkan</Button>
          <Button variant="outline" onClick={() => setShowNewList(true)} data-testid="move-newlist-btn" className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100">Buat List</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ BULK MOVE DIALOG ============
export function BulkMoveDialog({ open, onOpenChange, taskIds, divisiList, allListsMap, onDone }) {
  const [targetDivisi, setTargetDivisi] = useState("");
  const [targetList, setTargetList] = useState("");
  const targetLists = allListsMap[targetDivisi] || [];

  const submit = async () => {
    if (!targetDivisi) return toast.error("Pilih tim tujuan");
    try {
      await bulkMoveTasks({ ids: taskIds, divisi_id: targetDivisi, list_id: targetList || null });
      toast.success(`${taskIds.length} tugas dipindahkan`);
      onOpenChange(false);
      onDone();
    } catch { toast.error("Gagal"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-lg">Pindahkan {taskIds.length} Tugas</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-emerald-800/70">PILIH TIM</label>
            <Select value={targetDivisi} onValueChange={(v) => { setTargetDivisi(v); setTargetList(""); }}>
              <SelectTrigger data-testid="bulk-move-divisi"><SelectValue placeholder="Pilih tim..." /></SelectTrigger>
              <SelectContent>
                {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-emerald-800/70">PILIH LIST TUJUAN</label>
            <Select value={targetList || "none"} onValueChange={(v) => setTargetList(v === "none" ? "" : v)} disabled={!targetDivisi}>
              <SelectTrigger data-testid="bulk-move-list"><SelectValue placeholder="Pilih list..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa list</SelectItem>
                {targetLists.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} data-testid="bulk-move-submit" className="bg-emerald-700 hover:bg-emerald-800">Pindahkan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ GENERIC ENTITY MANAGER ============
function GenericManager({ open, onOpenChange, title, items, onCreate, onUpdate, onDelete, colorful = true, extraCreateFields = null, hint = null }) {
  const [nama, setNama] = useState("");
  const [warna, setWarna] = useState("#10b981");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded border border-emerald-100 p-2">
              {colorful && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-6 w-6 rounded" style={{ background: it.warna }} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <ColorPicker value={it.warna} onChange={(c) => onUpdate(it, { warna: c })} />
                  </PopoverContent>
                </Popover>
              )}
              <Input className="flex-1" defaultValue={it.nama}
                onBlur={(e) => e.target.value !== it.nama && onUpdate(it, { nama: e.target.value })} />
              <button onClick={() => onDelete(it.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-xs text-emerald-800/60 py-4">Belum ada. Tambahkan di bawah.</p>}
          <div className="rounded-lg border border-dashed border-emerald-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {colorful && (
                <Popover>
                  <PopoverTrigger asChild><button className="h-8 w-8 rounded" style={{ background: warna }} /></PopoverTrigger>
                  <PopoverContent className="w-64 p-2"><ColorPicker value={warna} onChange={setWarna} /></PopoverContent>
                </Popover>
              )}
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama..." className="flex-1" />
              {extraCreateFields}
              <Button size="sm" onClick={() => { if (nama.trim()) { onCreate({ nama, warna }); setNama(""); } }} className="bg-emerald-900 hover:bg-emerald-800">
                <Plus size={13} /> Tambah
              </Button>
            </div>
            {hint && <p className="mt-2 text-[10px] text-emerald-700/70">{hint}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ KATEGORI MANAGER ============
export function KategoriManagerDialog({ open, onOpenChange, kategoriList, onChange }) {
  const create = async ({ nama, warna }) => { await createKategori({ nama: nama.trim(), warna }); onChange(); toast.success("Kategori ditambahkan"); };
  const update = async (it, patch) => { await updateKategori(it.id, { nama: patch.nama ?? it.nama, warna: patch.warna ?? it.warna }); onChange(); };
  const remove = async (id) => { if (!window.confirm("Hapus kategori dari semua tugas?")) return; await deleteKategori(id); onChange(); toast.success("Dihapus"); };
  return <GenericManager open={open} onOpenChange={onOpenChange} title="Kelola Kategori Tugas" items={kategoriList} onCreate={create} onUpdate={update} onDelete={remove} hint="Kategori bebas — misalnya Konten, Design, Meeting, Operasional." />;
}

// ============ DIVISI MANAGER ============
export function DivisiManagerDialog({ open, onOpenChange, divisiList, onChange }) {
  const create = async ({ nama, warna }) => { await createDivisi({ nama: nama.trim(), warna }); onChange(); toast.success("Tim ditambahkan"); };
  const update = async (it, patch) => { await updateDivisi(it.id, { nama: patch.nama ?? it.nama, warna: patch.warna ?? it.warna }); onChange(); };
  const remove = async (id) => {
    if (!window.confirm("Hapus tim ini? Tugas & list akan pindah ke tim pertama.")) return;
    try { await deleteDivisi(id); onChange(); toast.success("Tim dihapus"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  return <GenericManager open={open} onOpenChange={onOpenChange} title="Kelola Tim / Divisi" items={divisiList} onCreate={create} onUpdate={update} onDelete={remove} hint="Tim baru otomatis dapat 3 list default: Backlog, Dikerjakan, Selesai." />;
}

// ============ ANGGOTA MANAGER ============
export function AnggotaManagerDialog({ open, onOpenChange, anggotaList, divisiList, currentDivisiId, onChange }) {
  const [nama, setNama] = useState("");
  const [warna, setWarna] = useState("#0ea5e9");
  const [divisiId, setDivisiId] = useState(currentDivisiId);

  useEffect(() => { if (currentDivisiId) setDivisiId(currentDivisiId); }, [currentDivisiId]);

  const create = async () => {
    if (!nama.trim() || !divisiId) return toast.error("Nama & tim wajib");
    await createAnggota({ nama: nama.trim(), warna, divisi_id: divisiId });
    setNama(""); onChange(); toast.success("Anggota ditambahkan");
  };
  const update = async (id, patch) => { await updateAnggota(id, patch); onChange(); };
  const remove = async (id) => { if (!window.confirm("Hapus anggota ini?")) return; await deleteAnggota(id); onChange(); toast.success("Dihapus"); };

  const grouped = {};
  anggotaList.forEach((a) => { const k = a.divisi_id; if (!grouped[k]) grouped[k] = []; grouped[k].push(a); });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Kelola Anggota Tim</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {divisiList.map((d) => {
            const members = grouped[d.id] || [];
            return (
              <div key={d.id} className="rounded-lg border border-emerald-100 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.warna }} />
                  <span className="font-display text-sm font-semibold text-emerald-950">{d.nama}</span>
                  <span className="text-xs text-emerald-700/60">({members.length})</span>
                </div>
                <div className="space-y-1.5">
                  {members.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild><button className="h-5 w-5 rounded" style={{ background: a.warna }} /></PopoverTrigger>
                        <PopoverContent className="w-64 p-2"><ColorPicker value={a.warna} onChange={(c) => update(a.id, { nama: a.nama, warna: c, divisi_id: a.divisi_id })} /></PopoverContent>
                      </Popover>
                      <Input className="flex-1 h-8" defaultValue={a.nama}
                        onBlur={(e) => e.target.value !== a.nama && update(a.id, { nama: e.target.value, warna: a.warna, divisi_id: a.divisi_id })} />
                      <button onClick={() => remove(a.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                  {members.length === 0 && <p className="text-[11px] text-emerald-800/50">Belum ada anggota</p>}
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-dashed border-emerald-200 p-3">
            <p className="mb-2 text-xs font-semibold text-emerald-900">Tambah Anggota Baru</p>
            <div className="grid gap-2">
              <Select value={divisiId} onValueChange={setDivisiId}>
                <SelectTrigger data-testid="anggota-divisi-select"><SelectValue placeholder="Pilih tim..." /></SelectTrigger>
                <SelectContent>
                  {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild><button className="h-8 w-8 rounded" style={{ background: warna }} /></PopoverTrigger>
                  <PopoverContent className="w-64 p-2"><ColorPicker value={warna} onChange={setWarna} /></PopoverContent>
                </Popover>
                <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama anggota" className="flex-1" data-testid="input-anggota-nama" />
                <Button size="sm" onClick={create} data-testid="add-anggota-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus size={13} /> Tambah</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ LIST MANAGER ============
export function ListManagerDialog({ open, onOpenChange, lists, divisiId, onChange }) {
  const [nama, setNama] = useState("");
  const [warna, setWarna] = useState("#10b981");
  const [isDone, setIsDone] = useState(false);

  const create = async () => {
    if (!nama.trim()) return toast.error("Nama list wajib");
    await createTaskList({ nama, warna, is_done: isDone, divisi_id: divisiId });
    setNama(""); onChange(); toast.success("List ditambahkan");
  };
  const update = async (id, patch) => { await updateTaskList(id, patch); onChange(); };
  const remove = async (id) => { if (!window.confirm("Hapus list ini? Tugas di dalamnya tidak terhapus.")) return; await deleteTaskList(id); onChange(); toast.success("Dihapus"); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Kelola List (Kolom Kanban)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {lists.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded border border-emerald-100 p-2">
              <Popover>
                <PopoverTrigger asChild><button className="h-6 w-6 rounded" style={{ background: l.warna }} /></PopoverTrigger>
                <PopoverContent className="w-64 p-2"><ColorPicker value={l.warna} onChange={(c) => update(l.id, { nama: l.nama, warna: c, is_done: l.is_done, divisi_id: l.divisi_id })} /></PopoverContent>
              </Popover>
              <Input className="flex-1" defaultValue={l.nama}
                onBlur={(e) => e.target.value !== l.nama && update(l.id, { nama: e.target.value, warna: l.warna, is_done: l.is_done, divisi_id: l.divisi_id })} />
              <label className="flex items-center gap-1 text-[10px] text-emerald-800">
                <input type="checkbox" checked={l.is_done || false}
                  onChange={(e) => update(l.id, { nama: l.nama, warna: l.warna, is_done: e.target.checked, divisi_id: l.divisi_id })} /> Selesai
              </label>
              <button onClick={() => remove(l.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-emerald-200 p-3">
            <p className="mb-2 text-xs font-semibold text-emerald-900">Tambah List Baru</p>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild><button className="h-8 w-8 rounded" style={{ background: warna }} /></PopoverTrigger>
                <PopoverContent className="w-64 p-2"><ColorPicker value={warna} onChange={setWarna} /></PopoverContent>
              </Popover>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama list" className="flex-1" data-testid="input-list-nama" />
              <label className="flex items-center gap-1 text-xs text-emerald-800">
                <input type="checkbox" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} /> Selesai
              </label>
              <Button size="sm" onClick={create} data-testid="add-list-btn" className="bg-emerald-900 hover:bg-emerald-800">Tambah</Button>
            </div>
            <p className="mt-2 text-[10px] text-emerald-700/70">
              List "Selesai" otomatis mengubah status tugas menjadi SELESAI saat card di-drag ke sana.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ LABEL MANAGER ============
export function LabelManagerDialog({ open, onOpenChange, labels, onChange }) {
  const create = async ({ nama, warna }) => { await createTaskLabel({ nama: nama.trim(), warna }); onChange(); toast.success("Label ditambahkan"); };
  const update = async (it, patch) => { await updateTaskLabel(it.id, { nama: patch.nama ?? it.nama, warna: patch.warna ?? it.warna }); onChange(); };
  const remove = async (id) => { if (!window.confirm("Hapus label dari semua tugas?")) return; await deleteTaskLabel(id); onChange(); toast.success("Dihapus"); };
  return <GenericManager open={open} onOpenChange={onOpenChange} title="Kelola Label" items={labels} onCreate={create} onUpdate={update} onDelete={remove} />;
}
