import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listIncomingNotifications, markNotificationsSeen } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function NotificationBell() {
  const { user } = useAuth();
  const [data, setData] = useState({ count: 0, items: [] });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const refresh = () => listIncomingNotifications().then(setData).catch(() => {});

  useEffect(() => {
    if (!user) return;
    refresh();
    const id = setInterval(refresh, 20000);
    const handler = () => refresh();
    window.addEventListener("qm:refresh-unread", handler);
    return () => { clearInterval(id); window.removeEventListener("qm:refresh-unread", handler); };
    // eslint-disable-next-line
  }, [user]);

  const markAll = async () => { await markNotificationsSeen(); refresh(); };
  const openTasks = async () => { await markAll(); setOpen(false); navigate("/tasks"); };

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
      <PopoverContent align="end" className="w-80 p-0" data-testid="notif-panel">
        <div className="flex items-center justify-between border-b border-emerald-100 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-950">Tugas Baru untuk Anda</p>
          {data.count > 0 && (
            <button onClick={markAll} data-testid="notif-mark-all" className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:underline">
              <CheckCheck size={11} /> Tandai dibaca
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto" data-testid="notif-list">
          {data.items.length === 0 ? (
            <div className="p-5 text-center text-xs text-emerald-800/50">
              <Inbox size={18} className="mx-auto mb-1 text-emerald-300" />
              Tidak ada tugas baru dari tim lain.
            </div>
          ) : (
            data.items.map((n) => (
              <button key={n.id} onClick={openTasks} data-testid={`notif-item-${n.id}`}
                className="block w-full border-b border-emerald-50 px-3 py-2 text-left transition hover:bg-emerald-50">
                <p className="text-xs font-medium text-emerald-950">{n.nama}</p>
                <p className="mt-0.5 text-[10px] text-emerald-800/60">
                  dari <b>{n.pemberi_nama || "SPV"}</b>{n.divisi_nama ? ` · ${n.divisi_nama}` : ""}
                </p>
              </button>
            ))
          )}
        </div>
        {data.count > 0 && (
          <button onClick={openTasks} data-testid="notif-open-tasks"
            className="w-full rounded-b-xl bg-emerald-50 px-3 py-2 text-center text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100">
            Buka menu Tugas
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
