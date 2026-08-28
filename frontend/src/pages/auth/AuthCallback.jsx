import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { authGoogleSession } from "@/lib/api";
import { useAuth, formatApiErr } from "@/lib/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const r = await authGoogleSession(sessionId);
        // Clear hash
        window.history.replaceState(null, "", window.location.pathname);
        setUser(r.user);
        if (r.status === "pending") navigate("/pending", { replace: true });
        else navigate("/", { replace: true });
      } catch (err) {
        setError(formatApiErr(err));
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen grid place-items-center bg-emerald-50 p-4">
      <div className="text-center">
        {error ? (
          <>
            <ShieldAlert size={40} className="mx-auto text-red-500" />
            <h2 className="mt-3 font-display text-xl font-semibold text-red-900">Gagal masuk dengan Google</h2>
            <p className="mt-1 text-sm text-red-800/80">{error}</p>
            <button onClick={() => navigate("/login")} className="mt-4 rounded-md bg-emerald-900 px-4 py-2 text-sm text-white hover:bg-emerald-800">Coba lagi</button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto animate-spin text-emerald-800" size={36} />
            <p className="mt-3 text-sm text-emerald-800/70">Memverifikasi sesi Google…</p>
          </>
        )}
      </div>
    </div>
  );
}
