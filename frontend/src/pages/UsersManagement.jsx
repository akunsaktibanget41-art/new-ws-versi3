import { useEffect, useState } from "react";
import { UserCheck, UserX, Trash2, Users, Clock, CheckCircle2, XCircle, Search, ShieldCheck, User, Link2, KeyRound, UserPlus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { listUsers, updateUserAcc, deleteUserAcc, listAnggota, listDivisi, createUserAcc, resetUserPassword, setDivisiHead } from "@/lib/api";
import { useAuth, formatApiErr } from "@/lib/AuthContext";

const STATUS_META = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-900 border-amber-300", icon: Clock },
  approved: { label: "Aktif", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Ditolak", cls: "bg-red-100 text-red-900 border-red-300", icon: XCircle },
};

export default function UsersManagement() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState([]);
  const [anggota, setAnggota] = useState([]);
  const [divisi, setDivisi] = useState([]);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "anggota", anggota_id: null });
  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [u, a, d] = await Promise.all([listUsers(), listAnggota(), listDivisi()]);
      setUsers(u); setAnggota(a); setDivisi(d);
    } catch (e) { toast.error(formatApiErr(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const divisiMap = Object.fromEntries(divisi.map((d) => [d.id, d]));
  const anggotaMap = Object.fromEntries(anggota.map((a) => [a.id, a]));

  const filtered = users.filter((u) => {
    if (tab !== "all" && u.status !== tab) return false;
    if (search && !(`${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const counts = {
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
  };

  const setStatus = async (u, status) => {
    try { await updateUserAcc(u.user_id, { status }); toast.success(`${u.email}: ${status}`); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };
  const setRole = async (u, role) => {
    try { await updateUserAcc(u.user_id, { role }); toast.success(`${u.email} → ${role.toUpperCase()}`); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };
  const setAnggotaLink = async (u, anggota_id) => {
    try { await updateUserAcc(u.user_id, { anggota_id: anggota_id || null }); toast.success("Link anggota tersimpan"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };
  const toggleHead = async (u, ang, div) => {
    const makeHead = div.head_anggota_id !== u.anggota_id;
    try {
      await setDivisiHead(div.id, makeHead ? u.anggota_id : null);
      toast.success(makeHead ? `${u.name || u.email} menjadi Head ${div.nama}` : `Head ${div.nama} dilepas`);
      load();
    } catch (e) { toast.error(formatApiErr(e)); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Hapus user ${u.email} permanen?`)) return;
    try { await deleteUserAcc(u.user_id); toast.success("User dihapus"); load(); }
    catch (e) { toast.error(formatApiErr(e)); }
  };

  const submitAdd = async () => {
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 6)
      return toast.error("Lengkapi nama, email, dan password (min 6 karakter)");
    try {
      await createUserAcc({ ...addForm, name: addForm.name.trim(), email: addForm.email.trim().toLowerCase() });
      toast.success(`User ${addForm.email} dibuat & langsung aktif`);
      setAddOpen(false);
      setAddForm({ name: "", email: "", password: "", role: "anggota", anggota_id: null });
      load();
    } catch (e) { toast.error(formatApiErr(e)); }
  };

  const submitReset = async () => {
    if (newPass.length < 6) return toast.error("Password minimal 6 karakter");
    try {
      await resetUserPassword(resetTarget.user_id, newPass);
      toast.success(`Password ${resetTarget.email} direset — semua sesinya dicabut`);
      setResetTarget(null); setNewPass("");
    } catch (e) { toast.error(formatApiErr(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-900 text-white"><Users size={20} /></div>
          <div>
            <h3 className="font-display text-lg font-semibold text-emerald-950">Manajemen User & Role</h3>
            <p className="text-xs text-emerald-800/60">Approve pendaftar, atur role SPV / Anggota, link ke anggota tim, atau hapus akun.</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-1 text-xs">
            <TabButton active={tab === "pending"} onClick={() => setTab("pending")} label="Menunggu" count={counts.pending} tone="amber" testId="tab-pending" />
            <TabButton active={tab === "approved"} onClick={() => setTab("approved")} label="Aktif" count={counts.approved} tone="emerald" testId="tab-approved" />
            <TabButton active={tab === "rejected"} onClick={() => setTab("rejected")} label="Ditolak" count={counts.rejected} tone="red" testId="tab-rejected" />
            <TabButton active={tab === "all"} onClick={() => setTab("all")} label="Semua" count={users.length} tone="slate" testId="tab-all" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
            <Input data-testid="user-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / email…" className="h-9 pl-9" />
          </div>
          <Button onClick={() => setAddOpen(true)} data-testid="open-add-user" className="h-9 bg-emerald-900 text-white hover:bg-emerald-800">
            <UserPlus size={14} /> Tambah User
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white overflow-x-auto">
        {loading ? (
          <p className="p-12 text-center text-sm text-emerald-800/60">Memuat…</p>
        ) : filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-emerald-800/60">Tidak ada user pada kategori ini.</p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-emerald-50 text-left text-xs uppercase text-emerald-800/70">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Link Anggota (Tim)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {filtered.map((u) => {
                const meta = STATUS_META[u.status] || STATUS_META.pending;
                const Icon = meta.icon;
                const isMe = u.user_id === current?.user_id;
                const linkedAng = u.anggota_id ? anggotaMap[u.anggota_id] : null;
                const linkedDiv = linkedAng ? divisiMap[linkedAng.divisi_id] : null;
                return (
                  <tr key={u.user_id} data-testid={`user-row-${u.user_id}`} className="hover:bg-emerald-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.picture ? <img src={u.picture} alt="" className="h-8 w-8 rounded-full" /> :
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-900">{(u.name || u.email)[0]?.toUpperCase()}</div>}
                        <div>
                          <p className="font-medium text-emerald-950">{u.name || "-"}</p>
                          {isMe && <p className="text-[10px] text-emerald-700">(Anda)</p>}
                          <p className="text-[10px] uppercase text-slate-500">{u.auth_provider || "local"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-emerald-900">{u.email}</td>
                    <td className="px-4 py-3">
                      <Select value={u.role} onValueChange={(v) => setRole(u, v)} disabled={isMe && u.role === "spv"}>
                        <SelectTrigger className="h-8 w-32 text-xs" data-testid={`role-select-${u.user_id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spv"><ShieldCheck size={12} className="inline mr-1" /> SPV</SelectItem>
                          <SelectItem value="anggota"><User size={12} className="inline mr-1" /> Anggota</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={u.anggota_id || "none"} onValueChange={(v) => setAnggotaLink(u, v === "none" ? null : v)}>
                        <SelectTrigger className="h-8 w-52 text-xs" data-testid={`anggota-select-${u.user_id}`}>
                          <Link2 size={11} className="mr-1 text-emerald-700" />
                          <SelectValue placeholder="Belum di-link" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="none">— Tidak di-link —</SelectItem>
                          {divisi.map((d) => {
                            const inDiv = anggota.filter((a) => a.divisi_id === d.id);
                            if (inDiv.length === 0) return null;
                            return (
                              <div key={d.id}>
                                <div className="px-2 py-1 text-[10px] uppercase text-emerald-700/60">{d.nama}</div>
                                {inDiv.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>
                                ))}
                              </div>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {linkedAng && linkedDiv && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-[10px] text-emerald-700">→ {linkedDiv.nama}</p>
                          <button
                            onClick={() => toggleHead(u, linkedAng, linkedDiv)}
                            data-testid={`head-toggle-${u.user_id}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                              linkedDiv.head_anggota_id === u.anggota_id
                                ? "border-amber-300 bg-amber-100 text-amber-900"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            title="Head divisi bisa memonitor tugas & progres 1 divisinya (read-only)"
                          >
                            <Star size={10} className={linkedDiv.head_anggota_id === u.anggota_id ? "fill-amber-500 text-amber-500" : ""} />
                            {linkedDiv.head_anggota_id === u.anggota_id ? "Head Divisi" : "Jadikan Head"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
                        <Icon size={12} /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {u.status !== "approved" && (
                          <Button size="sm" onClick={() => setStatus(u, "approved")} data-testid={`approve-${u.user_id}`} className="bg-emerald-700 hover:bg-emerald-800 text-white h-8">
                            <UserCheck size={12} /> Approve
                          </Button>
                        )}
                        {u.status !== "rejected" && !isMe && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(u, "rejected")} data-testid={`reject-${u.user_id}`} className="h-8">
                            <UserX size={12} /> Tolak
                          </Button>
                        )}
                        {u.status === "approved" && !isMe && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(u, "pending")} className="h-8">
                            <Clock size={12} /> Nonaktifkan
                          </Button>
                        )}
                        {!isMe && (
                          <Button size="sm" variant="outline" onClick={() => { setResetTarget(u); setNewPass(""); }} data-testid={`reset-pass-${u.user_id}`} className="h-8" title="Reset password user ini">
                            <KeyRound size={12} />
                          </Button>
                        )}
                        {!isMe && (
                          <Button size="sm" onClick={() => remove(u)} data-testid={`delete-${u.user_id}`} className="bg-red-600 hover:bg-red-700 text-white h-8">
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAddOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" data-testid="add-user-dialog">
            <h3 className="font-display text-lg font-semibold text-emerald-950">Tambah User Manual</h3>
            <p className="mt-1 text-xs text-emerald-800/60">User langsung aktif (approved) tanpa perlu register & approval.</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-emerald-900">Nama Lengkap</label>
                <Input data-testid="add-user-name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-900">Email</label>
                <Input data-testid="add-user-email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-900">Password (min 6 karakter)</label>
                <Input data-testid="add-user-password" type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-900">Role</label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                  <SelectTrigger data-testid="add-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anggota">Anggota</SelectItem>
                    <SelectItem value="spv">SPV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-900">Link Anggota Tim (opsional)</label>
                <Select value={addForm.anggota_id || "none"} onValueChange={(v) => setAddForm({ ...addForm, anggota_id: v === "none" ? null : v })}>
                  <SelectTrigger data-testid="add-user-anggota"><SelectValue placeholder="Belum di-link" /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">— Tidak di-link —</SelectItem>
                    {anggota.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
              <Button onClick={submitAdd} data-testid="add-user-submit" className="bg-emerald-900 hover:bg-emerald-800 text-white">Buat User</Button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setResetTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" data-testid="reset-pass-dialog">
            <h3 className="font-display text-lg font-semibold text-emerald-950">Reset Password</h3>
            <p className="mt-1 text-xs text-emerald-800/60">User: <b>{resetTarget.email}</b>. Semua sesi aktifnya akan dicabut.</p>
            <div className="mt-3">
              <label className="text-xs font-medium text-emerald-900">Password Baru (min 6 karakter)</label>
              <Input data-testid="reset-pass-input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetTarget(null)}>Batal</Button>
              <Button onClick={submitReset} data-testid="reset-pass-submit" className="bg-emerald-900 hover:bg-emerald-800 text-white">Reset Password</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, count, tone, testId }) {
  const tones = {
    amber: active ? "bg-amber-500 text-white" : "text-amber-800 hover:bg-amber-50",
    emerald: active ? "bg-emerald-800 text-white" : "text-emerald-800 hover:bg-emerald-50",
    red: active ? "bg-red-600 text-white" : "text-red-700 hover:bg-red-50",
    slate: active ? "bg-slate-700 text-white" : "text-slate-700 hover:bg-slate-100",
  };
  return (
    <button onClick={onClick} data-testid={testId}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${tones[tone]}`}>
      {label} <span className={`ml-1 rounded px-1 text-[10px] ${active ? "bg-white/20" : "bg-black/5"}`}>{count}</span>
    </button>
  );
}
