import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, formatApiErr } from "@/lib/AuthContext";
import SanadLogo from "@/components/SanadLogo";

export default function Login() {
  const { login, logout, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.status === "approved") navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await login(email.trim().toLowerCase(), password);
      if (r.status === "pending") {
        navigate("/pending", { state: { email: r.user?.email || email } });
        return;
      }
      toast.success("Login berhasil");
      navigate("/");
    } catch (err) {
      toast.error(formatApiErr(err));
    } finally { setSubmitting(false); }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (loading) return <FullSplash />;

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Nabawi dome-inspired background */}
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: "radial-gradient(1200px 600px at 50% -100px, #10b98122, transparent), radial-gradient(600px 400px at 90% 100%, #0f766e22, transparent)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-b-full bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <SanadLogo size={120} variant="full" />
          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-emerald-800/70">Workspace · Amal • Kerja • Raport</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-900/5">
          <h2 className="font-display text-xl font-semibold text-emerald-950">Masuk ke Workspace</h2>
          <p className="mt-1 text-sm text-emerald-800/70">Bismillah, mari lanjutkan pekerjaan & amal harianmu.</p>

          {user && user.status === "pending" && (
            <div data-testid="pending-banner" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Kamu masuk sebagai <b>{user.email}</b> yang masih <b>menunggu approval SPV</b>.{" "}
              <button type="button" onClick={logout} data-testid="switch-account-btn" className="font-semibold underline hover:text-amber-950">
                Keluar &amp; ganti akun
              </button>
            </div>
          )}

          <button
            onClick={googleLogin}
            data-testid="google-login-btn"
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-50"
          >
            <GoogleIcon /> Masuk dengan Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-emerald-800/40">
            <div className="h-px flex-1 bg-emerald-100" />
            <span>atau email & password</span>
            <div className="h-px flex-1 bg-emerald-100" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-emerald-900">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
                <Input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-9" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-emerald-900">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
                <Input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="pl-9" placeholder="••••••••" />
              </div>
            </div>
            <Button type="submit" data-testid="login-submit" disabled={submitting}
              className="w-full bg-emerald-900 text-white hover:bg-emerald-800">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {submitting ? " Memproses…" : " Masuk"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-emerald-800/70">
            Belum punya akun? <Link to="/register" data-testid="link-register" className="font-semibold text-emerald-900 hover:underline">Daftar disini</Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-emerald-900/50 italic">
          "Fokus pada niat, ikhlaskan usaha. Raport hanyalah cermin, bukan hakim."
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function FullSplash() {
  return (
    <div className="min-h-screen grid place-items-center bg-emerald-50">
      <Loader2 className="animate-spin text-emerald-800" size={28} />
    </div>
  );
}
