import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";
import { LayoutDashboard, ListTodo, HeartHandshake, Award, Menu, X, Repeat, Activity, Users, LogOut, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { unreadTasks } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import GlobalSearch from "@/components/GlobalSearch";
import SanadLogo from "@/components/SanadLogo";

const BASE_NAV = [
  { to: "/", label: "Beranda", icon: LayoutDashboard, testId: "nav-dashboard", end: true },
  { to: "/tasks", label: "Tugas", icon: ListTodo, testId: "nav-tasks", badgeKey: "tasks" },
  { to: "/tugas-rutin", label: "Tugas Rutin Tracker", icon: Repeat, testId: "nav-tugas-rutin" },
  { to: "/spiritual", label: "Spiritual Tracker", icon: HeartHandshake, testId: "nav-spiritual" },
];

const SPV_NAV = [
  { to: "/raport", label: "Raport", icon: Award, testId: "nav-raport", spvOnly: true },
  { to: "/monitoring", label: "Monitoring SPV", icon: Activity, testId: "nav-monitoring", spvOnly: true },
  { to: "/strategy", label: "Strategi & Eksekusi", icon: Target, testId: "nav-strategy", spvOnly: true },
  { to: "/users", label: "Manajemen User", icon: Users, testId: "nav-users", spvOnly: true },
];

function navFor(user) {
  if (user?.role === "spv") return [...BASE_NAV, ...SPV_NAV];
  if (user?.can_monitor) return [...BASE_NAV, { to: "/monitoring", label: "Monitoring Tim", icon: Activity, testId: "nav-monitoring" }];
  return BASE_NAV;
}

function SidebarBody({ onNavigate, unreadTotal, user, onLogout }) {
  const nav = navFor(user);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 px-2">
        <div className="flex items-center gap-3">
          <SanadLogo size={44} variant="mark" />
          <div>
            <h1 className="font-display text-xl font-bold leading-tight tracking-[0.14em]" style={{ color: "#0f4f47" }}>
              WORKSPACE
            </h1>
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-800/60">Amal • Kerja • Raport</p>
          </div>
        </div>
      </div>

      <div className="mb-4 px-1" data-testid="sidebar-search">
        <GlobalSearch />
      </div>

      <nav className="flex flex-col gap-1" data-testid="sidebar-nav">
        {nav.map(({ to, label, icon: Icon, testId, end, badgeKey, spvOnly }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-testid={testId}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-emerald-900 text-white shadow-sm"
                  : "text-emerald-950/70 hover:bg-emerald-100/70 hover:text-emerald-950"
              )
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            <span className="flex-1">{label}</span>
            {spvOnly && <ShieldCheck size={12} className="text-emerald-500" />}
            {badgeKey === "tasks" && unreadTotal > 0 && (
              <span data-testid="nav-tasks-badge" className="grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        {user && (
          <div className="rounded-xl border border-emerald-100 bg-white/70 p-3">
            <div className="flex items-center gap-2">
              {user.picture ? <img src={user.picture} alt="" className="h-9 w-9 rounded-full object-cover" /> :
                <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-200 text-sm font-bold text-emerald-900">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-emerald-950" data-testid="current-user-name">{user.name || user.email}</p>
                <p className="truncate text-[11px] text-emerald-800/60">
                  {user.role === "spv" ? "SPV / Admin" : "Anggota"} · {user.email}
                </p>
              </div>
            </div>
            <NavLink to="/profile" onClick={onNavigate} data-testid="nav-profile" className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-emerald-200 px-2 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50">
              <Users size={12} /> Profil Saya
            </NavLink>
            <button onClick={onLogout} data-testid="logout-btn" className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-emerald-200 px-2 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50">
              <LogOut size={12} /> Keluar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState({ total: 0, by_divisi: {} });
  const location = useLocation();
  const { user, logout } = useAuth();
  const fullNav = navFor(user);
  const current = fullNav.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))) || fullNav[0];

  const refreshUnread = () => unreadTasks().then(setUnread).catch(() => {});

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 15000);
    const handler = () => refreshUnread();
    window.addEventListener("qm:refresh-unread", handler);
    return () => { clearInterval(id); window.removeEventListener("qm:refresh-unread", handler); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-emerald-100 bg-[#f1f5f4] p-5 md:block">
        <SidebarBody unreadTotal={unread.total} user={user} onLogout={logout} />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-emerald-100 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <SanadLogo size={30} variant="mark" />
          <span className="font-display text-sm font-bold tracking-[0.12em]" style={{ color: "#0f4f47" }}>WORKSPACE</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button data-testid="mobile-menu-toggle" onClick={() => setMobileOpen((v) => !v)} className="rounded-md p-2 text-emerald-900 hover:bg-emerald-100">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-[#f1f5f4] p-5 overflow-y-auto">
            <SidebarBody onNavigate={() => setMobileOpen(false)} unreadTotal={unread.total} user={user} onLogout={logout} />
          </aside>
        </div>
      )}

      <main className="md:ml-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
          <div className="mb-6 hidden md:flex md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-700/60">Workspace</p>
              <h2 className="font-display text-3xl font-bold text-emerald-950 md:text-4xl" data-testid="page-title">
                {current.label}
              </h2>
            </div>
            <NotificationBell />
          </div>
          <Outlet context={{ unread, refreshUnread }} />
        </div>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}
