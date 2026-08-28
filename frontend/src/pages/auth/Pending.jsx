import { useNavigate, useLocation } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function Pending() {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const email = user?.email || location.state?.email || "-";

  const goLogin = async () => {
    if (user) { await logout(); return; }
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-emerald-50 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <Clock size={26} />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-emerald-950">Menunggu Approval SPV</h1>
        <p className="mt-2 text-sm text-emerald-800/70">
          Akun <b>{email}</b> sudah terdaftar dan sedang menunggu diaktivasi oleh SPV.
          Silakan tunggu notifikasi atau hubungi supervisor Anda.
        </p>
        <div className="mt-6 flex gap-2">
          <button onClick={refreshUser} className="flex-1 rounded-md border border-emerald-200 px-4 py-2 text-sm text-emerald-900 hover:bg-emerald-50">
            Cek ulang
          </button>
          <button onClick={goLogin} data-testid="pending-logout" className="flex-1 rounded-md bg-emerald-900 px-4 py-2 text-sm text-white hover:bg-emerald-800">
            <LogOut size={14} className="inline" /> {user ? "Keluar" : "Kembali"}
          </button>
        </div>
      </div>
    </div>
  );
}
