import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, formatApiErr } from "@/lib/AuthContext";
import SanadLogo from "@/components/SanadLogo";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password minimal 6 karakter");
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      setDone(true);
      toast.success("Pendaftaran berhasil. Menunggu approval SPV.");
    } catch (err) {
      toast.error(formatApiErr(err));
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-emerald-50 grid place-items-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <UserPlus />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-emerald-950">Menunggu Approval</h2>
          <p className="mt-2 text-sm text-emerald-800/70">
            Akun <b>{email}</b> berhasil didaftarkan. SPV akan mengaktifkan akun Anda.
            Silakan tunggu notifikasi atau hubungi supervisor Anda.
          </p>
          <Button onClick={() => navigate("/login")} className="mt-5 bg-emerald-900 hover:bg-emerald-800 text-white">Kembali ke Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <SanadLogo size={100} variant="full" />
          <h1 className="mt-3 font-display text-xl font-bold text-emerald-950 tracking-tight">Daftar Akun</h1>
          <p className="text-xs text-emerald-800/70">Workspace Ruang Sanad · perlu di-approve SPV.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-xl space-y-3">
          <div>
            <label className="text-xs font-medium text-emerald-900">Nama Lengkap</label>
            <Input data-testid="register-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama tim Anda" />
          </div>
          <div>
            <label className="text-xs font-medium text-emerald-900">Email</label>
            <Input data-testid="register-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-emerald-900">Password (min 6 karakter)</label>
            <Input data-testid="register-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" data-testid="register-submit" disabled={submitting} className="w-full bg-emerald-900 hover:bg-emerald-800 text-white">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {submitting ? " Mendaftarkan…" : " Daftar"}
          </Button>
          <p className="text-center text-xs text-emerald-800/70">
            Sudah punya akun? <Link to="/login" className="font-semibold text-emerald-900 hover:underline">Masuk</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
