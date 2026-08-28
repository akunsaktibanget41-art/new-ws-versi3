import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ListTodo, HeartHandshake, Users2, X, Loader2 } from "lucide-react";
import { globalSearch } from "@/lib/api";

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ tasks: [], amaliyah: [], anggota: [], divisi: [] });
  const timerRef = useRef();
  const containerRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    if (!q || q.trim().length < 2) { setData({ tasks: [], amaliyah: [], anggota: [], divisi: [] }); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(true);
      globalSearch(q.trim()).then(setData).catch(() => {}).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const total = data.tasks.length + data.amaliyah.length + data.anggota.length + data.divisi.length;

  const go = (path) => { setOpen(false); setQ(""); navigate(path); };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
        <input
          data-testid="global-search-input"
          type="text"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder="Cari tugas, amaliyah, anggota…"
          className="w-full rounded-lg border border-emerald-200 bg-white pl-9 pr-8 py-2 text-sm text-emerald-950 placeholder:text-emerald-800/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-emerald-50">
            <X size={13} className="text-emerald-700/60" />
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div data-testid="search-dropdown" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[400px] overflow-y-auto rounded-xl border border-emerald-100 bg-white shadow-2xl">
          {loading ? (
            <div className="grid place-items-center py-6"><Loader2 size={16} className="animate-spin text-emerald-700" /></div>
          ) : total === 0 ? (
            <p className="p-4 text-center text-xs italic text-emerald-800/50">Tidak ada hasil untuk "{q}"</p>
          ) : (
            <div className="py-1">
              {data.tasks.length > 0 && (
                <Section label="Tugas" icon={ListTodo}>
                  {data.tasks.map((t) => (
                    <button key={t.id} onClick={() => go("/tasks")} data-testid={`search-task-${t.id}`}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-emerald-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-emerald-950">{t.nama}</p>
                        <p className="text-[10px] text-emerald-800/60">{t.divisi_nama} · {t.status}{t.deadline ? ` · ${t.deadline}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </Section>
              )}
              {data.amaliyah.length > 0 && (
                <Section label="Amaliyah" icon={HeartHandshake}>
                  {data.amaliyah.map((a) => (
                    <button key={a.id} onClick={() => go("/spiritual")} data-testid={`search-amal-${a.id}`}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-emerald-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-emerald-950">{a.nama}</p>
                        <p className="text-[10px] text-emerald-800/60">Target: {a.target_metrik}</p>
                      </div>
                    </button>
                  ))}
                </Section>
              )}
              {data.anggota.length > 0 && (
                <Section label="Anggota" icon={Users2}>
                  {data.anggota.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: a.warna || "#0ea5e9" }}>
                        {a.nama?.[0]?.toUpperCase()}
                      </div>
                      <p className="truncate text-sm text-emerald-950">{a.nama}</p>
                    </div>
                  ))}
                </Section>
              )}
              {data.divisi.length > 0 && (
                <Section label="Tim / Divisi" icon={Users2}>
                  {data.divisi.map((d) => (
                    <button key={d.id} onClick={() => go("/tasks")} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-emerald-50">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.warna }} />
                      <p className="truncate text-sm text-emerald-950">{d.nama}</p>
                    </button>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-emerald-700/60">
        <Icon size={11} /> {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
