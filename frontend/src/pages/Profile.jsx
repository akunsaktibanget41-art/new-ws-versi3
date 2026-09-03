import { useEffect, useState } from "react";
import { UserCog, KeyRound, Save, Loader2, ShieldCheck, User as UserIcon, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, formatApiErr } from "@/lib/AuthContext";
import { updateProfile, listApiKeys, createApiKey, revokeApiKey } from "@/lib/api";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyName, setApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState("");
  const isGoogle = user?.auth_provider === "google";
  const isSpv = user?.role === "spv";

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    try { setApiKeys(await listApiKeys()); }
    catch (err) { toast.error(formatApiErr(err)); }
    finally { setLoadingKeys(false); }
  };

  useEffect(() => { if (isSpv) loadApiKeys(); }, [isSpv]);

  const submit = async (e) => {
    e.preventDefault();
    if (newPass && newPass !== confirmPass) return toast.error("Konfirmasi password baru tidak sama");
    if (newPass && newPass.length < 6) return toast.error("Password baru minimal 6 karakter");
    const payload = {};
    if (name.trim() && name.trim() !== user?.name) payload.name = name.trim();
    if (email.trim() && email.trim().toLowerCase() !== user?.email) payload.email = email.trim().toLowerCase();
    if (newPass) { payload.current_password = curPass; payload.new_password = newPass; }
    if (Object.keys(payload).length === 0) return toast.error("Tidak ada perubahan");
    setSaving(true);
    try {
      await updateProfile(payload);
      toast.success("Profil berhasil diperbarui");
      setCurPass(""); setNewPass(""); setConfirmPass("");
      await refreshUser();
    } catch (err) { toast.error(formatApiErr(err)); }
    finally { setSaving(false); }
  };

  const generateApiKey = async () => {
    if (!apiKeyName.trim()) return toast.error("Isi nama integrasi terlebih dahulu");
    setCreatingKey(true);
    try {
      const created = await createApiKey(apiKeyName.trim());
      setGeneratedKey(created.key);
      setApiKeyName("");
      setApiKeys((keys) => [{ ...created, key: undefined }, ...keys]);
      toast.success("API key berhasil dibuat");
    } catch (err) { toast.error(formatApiErr(err)); }
    finally { setCreatingKey(false); }
  };

  const copyApiKey = async () => {
    try { await navigator.clipboard.writeText(generatedKey); toast.success("API key disalin"); }
    catch { toast.error("Gagal menyalin API key"); }
  };

  const revoke = async (id) => {
    setRevokingKey(id);
    try {
      await revokeApiKey(id);
      setApiKeys((keys) => keys.map((key) => key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key));
      toast.success("API key dicabut");
    } catch (err) { toast.error(formatApiErr(err)); }
    finally { setRevokingKey(""); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="profile-page">
      <div className="rounded-2xl border border-emerald-100 bg-white p-5">
        <div className="flex items-center gap-3">
          {user?.picture ? <img src={user.picture} alt="" className="h-12 w-12 rounded-full object-cover" /> :
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-200 text-lg font-bold text-emerald-900">
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </div>}
          <div>
            <h2 className="font-display text-xl font-semibold text-emerald-950">Profil Saya</h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-emerald-800/60">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900" data-testid="profile-role">
                {user?.role === "spv" ? <ShieldCheck size={11} /> : <UserIcon size={11} />}
                {user?.role === "spv" ? "SPV / Admin" : "Anggota"}
              </span>
              <span className="uppercase">{user?.auth_provider || "local"}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserCog size={16} className="text-emerald-800" />
            <h3 className="font-display text-base font-semibold text-emerald-950">Informasi Akun</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-emerald-900">Nama Lengkap</label>
              <Input data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-900">Email</label>
              <Input data-testid="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {isGoogle && <p className="mt-1 text-[10px] text-emerald-700/60">Akun Google: mengganti email di sini tidak mengubah email Google Anda.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound size={16} className="text-emerald-800" />
            <h3 className="font-display text-base font-semibold text-emerald-950">Ubah Password</h3>
          </div>
          {isGoogle ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="profile-google-note">
              Akun Anda terdaftar via Google dan tidak punya password lokal. Jika butuh password email, minta SPV untuk reset lewat Manajemen User.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-emerald-900">Password Saat Ini</label>
                <Input data-testid="profile-current-password" type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="Wajib jika ganti password" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-emerald-900">Password Baru (min 6)</label>
                  <Input data-testid="profile-new-password" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-emerald-900">Konfirmasi Password Baru</label>
                  <Input data-testid="profile-confirm-password" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
                </div>
              </div>
              <p className="text-[10px] text-emerald-700/60">Kosongkan jika tidak ingin mengganti password. Sesi di perangkat lain akan dicabut setelah ganti password.</p>
            </div>
          )}
        </div>

        <Button type="submit" disabled={saving} data-testid="profile-submit" className="w-full bg-emerald-900 text-white hover:bg-emerald-800">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? " Menyimpan…" : " Simpan Perubahan"}
        </Button>
      </form>

      {isSpv && <section className="rounded-2xl border border-emerald-100 bg-white p-5" data-testid="api-keys-section">
        <div className="mb-1 flex items-center gap-2">
          <KeyRound size={16} className="text-emerald-800" />
          <h3 className="font-display text-base font-semibold text-emerald-950">API Key Integrasi</h3>
        </div>
        <p className="mb-4 text-xs text-emerald-800/65">Gunakan untuk integrasi eksternal melalui header <code>Authorization: Bearer &lt;API_KEY&gt;</code>. Key mengikuti akses SPV Anda.</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input data-testid="api-key-name" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="Contoh: Integrasi Website" maxLength={80} />
          <Button type="button" onClick={generateApiKey} disabled={creatingKey} data-testid="api-key-generate" className="bg-emerald-900 text-white hover:bg-emerald-800">
            {creatingKey ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Buat Key
          </Button>
        </div>

        {generatedKey && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="api-key-created">
          <p className="text-xs font-semibold text-amber-950">Simpan key ini sekarang. Nilainya tidak dapat dilihat lagi.</p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={generatedKey} className="bg-white font-mono text-xs" data-testid="api-key-value" />
            <Button type="button" size="icon" variant="outline" onClick={copyApiKey} aria-label="Salin API key"><Copy size={15} /></Button>
          </div>
        </div>}

        <div className="mt-4 space-y-2">
          {loadingKeys && <p className="text-xs text-emerald-800/60">Memuat API key...</p>}
          {!loadingKeys && apiKeys.length === 0 && <p className="text-xs text-emerald-800/60">Belum ada API key.</p>}
          {apiKeys.map((key) => <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 px-3 py-2" data-testid={`api-key-${key.id}`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-emerald-950">{key.name}</p>
              <p className="font-mono text-[11px] text-emerald-800/60">{key.prefix}... {key.revoked_at ? "- dicabut" : "- aktif"}</p>
            </div>
            {!key.revoked_at && <Button type="button" size="sm" variant="ghost" onClick={() => revoke(key.id)} disabled={revokingKey === key.id} className="text-red-700 hover:bg-red-50 hover:text-red-800">
              {revokingKey === key.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Cabut
            </Button>}
          </div>)}
        </div>
      </section>}
    </div>
  );
}
