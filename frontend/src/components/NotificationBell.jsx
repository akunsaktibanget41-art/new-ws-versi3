import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Inbox, CalendarClock, AlertTriangle, UserCheck, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notificationsFeed, markNotificationsSeen } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const URG = {
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-800 border-red-300", icon: AlertTriangle },
  today: { label: "Hari ini", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: CalendarClock },
  besok: { label: "Besok", cls: "bg-sky-100 text-sky-800 border-sky-300", icon: CalendarClock },
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [data, setData] = useState({ count: 0, delegated: [], reminders: [], approvals: 0, role: "anggota" });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const refresh = () => notificationsFeed().then(setData).catch(() => {});

  useEffect(() => {
    if (!user) return;
    refresh();
    const id = setInterval(refresh, 20000);
    const handler = () => refresh();
    window.addEventListener("qm:refresh-unread", handler);
    return () => { clearInterval(id); window.removeEventListener("qm:refresh-unread", handler); };
    // eslint-disable-next-line
  }, [user]);

  const markAll = async () => { try { await markNotificationsSeen(); } catch {} refresh(); };
  const goTasks = async () => { await markAll(); setOpen(false); navigate("/tasks"); };
  const goUsers = () => { setOpen(false); navigate("/users"); };

  const empty = data.delegated.length === 0 && data.reminders.length === 0 && !data.approvals;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button data-testid="notif-bell" className="relative rounded-full border border-emerald-200 bg-white p-2 text-emerald-800 transition hover:bg-emerald-50">
          <Bell size={16} />
          {data.count > 0 && (
            <span data-testid="notif-badge" className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {data.count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" data-testid="notif-panel">
        <div className="flex items-center justify-between border-b border-emerald-100 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-950">Notifikasi</p>
          {data.delegated.length > 0 && (
            <button onClick={markAll} data-testid="notif-mark-all" className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:underline">
              <CheckCheck size={11} /> Tandai delegasi dibaca
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto" data-testid="notif-list">
          {empty ? (
            <div className="p-6 text-center text-xs text-emerald-800/50">
              <Inbox size={18} className="mx-auto mb-1 text-emerald-300" />
              Tidak ada notifikasi. Alhamdulillah.
            </div>
          ) : (
            <>
              {/* Approval user baru (SPV) */}
              {data.approvals > 0 && (
                <button onClick={goUsers} data-testid="notif-approvals"
                  className="flex w-full items-center gap-2 border-b border-emerald-50 bg-amber-50/50 px-3 py-2.5 text-left hover:bg-amber-50">
                  <UserCheck size={15} className="text-amber-700" />
                  <span className="text-xs font-medium text-amber-900">{data.approvals} pendaftar menunggu persetujuan</span>
                </button>
              )}

              {/* Reminder deadline */}
              {data.reminders.length > 0 && (
                <div>
                  <p className="bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">
                    Reminder Deadline ({data.reminders.length})
                  </p>
                  {data.reminders.map((r) => {
                    const u = URG[r.urgensi] || URG.besok;
                    const Icon = u.icon;
                    return (
                      <button key={r.id} onClick={goTasks} data-testid={`notif-reminder-${r.id}`}
                        className="block w-full border-b border-emerald-50 px-3 py-2 text-left transition hover:bg-emerald-50">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-emerald-950">{r.nama}</p>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${u.cls}`}>
                            <Icon size={9} /> {u.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-emerald-800/60">
                          {r.deadline}{data.role !== "anggota" ? ` · ${r.penerima_nama}` : ""}{r.divisi_nama ? ` · ${r.divisi_nama}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Delegasi baru */}
              {data.delegated.length > 0 && (
                <div>
                  <p className="bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">
                    Tugas Baru untuk Anda ({data.delegated.length})
                  </p>
                  {data.delegated.map((n) => (
                    <button key={n.id} onClick={goTasks} data-testid={`notif-item-${n.id}`}
                      className="flex w-full items-center gap-2 border-b border-emerald-50 px-3 py-2 text-left transition hover:bg-emerald-50">
                      <Send size={13} className="shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-emerald-950">{n.nama}</p>
                        <p className="mt-0.5 text-[10px] text-emerald-800/60">dari <b>{n.pemberi_nama || "SPV"}</b>{n.divisi_nama ? ` · ${n.divisi_nama}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!empty && (
          <button onClick={goTasks} data-testid="notif-open-tasks"
            className="w-full rounded-b-xl bg-emerald-50 px-3 py-2 text-center text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100">
            Buka menu Tugas
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
