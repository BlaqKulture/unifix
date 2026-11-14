// App shell: role-specific sidebar navigation, notification bell, and page outlet.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, ClipboardList, FileBarChart, History, LayoutDashboard, LogOut, Menu,
  PlusCircle, Tags, UserCircle, Users, Wrench, X,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { timeAgo } from "./ui";

const NAV = {
  requester: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/requests/new", label: "Report a problem", icon: PlusCircle },
    { to: "/requests", label: "My requests", icon: ClipboardList, end: true },
  ],
  officer: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/requests", label: "My jobs", icon: Wrench, end: true },
  ],
  admin: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/requests", label: "All requests", icon: ClipboardList, end: true },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/categories", label: "Categories", icon: Tags },
    { to: "/admin/reports", label: "Reports", icon: FileBarChart },
    { to: "/admin/audit", label: "Activity log", icon: History },
  ],
};

const ROLE_LABEL = { student: "Student", staff: "Staff", officer: "Maintenance officer", admin: "Administrator" };

function Logo({ light }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className={`font-display text-xl font-extrabold ${light ? "text-white" : "text-ink"}`} style={{ fontStretch: "80%" }}>
        UniFix
      </span>
    </Link>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread_count: 0 });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = () => api.get("/api/notifications?per_page=8").then(setData).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // poll for new notifications every 30 s
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openNote = async (n) => {
    if (!n.is_read) await api.post(`/api/notifications/${n.id}/read`).catch(() => {});
    setOpen(false);
    load();
    if (n.request_id) navigate(`/requests/${n.request_id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }} className="relative rounded-md p-2 hover:bg-black/5"
        aria-label={`Notifications, ${data.unread_count} unread`}>
        <Bell size={20} />
        {data.unread_count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1 text-[11px] font-bold text-white">
            {data.unread_count > 9 ? "9+" : data.unread_count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-lg border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {data.unread_count > 0 && (
              <button className="text-sm font-semibold text-teal hover:underline"
                onClick={() => api.post("/api/notifications/read-all").then(load)}>
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-soft">You're all caught up.</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openNote(n)}
                  className={`flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left text-sm hover:bg-paper ${n.is_read ? "text-ink-soft" : ""}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-hivis-deep"}`} />
                  <span>
                    <span className={n.is_read ? "" : "font-semibold"}>{n.message}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  const items = NAV[user.role === "admin" ? "admin" : user.role === "officer" ? "officer" : "requester"];

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-[15px] font-medium transition-colors ${
              isActive ? "border-hivis bg-white/10 text-white" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"}`}>
          <Icon size={18} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-white/10 pt-4">
      <NavLink to="/profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-white/80 hover:bg-white/5 hover:text-white">
        <UserCircle size={30} strokeWidth={1.5} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{user.full_name}</span>
          <span className="block text-xs text-white/60">{ROLE_LABEL[user.role]}</span>
        </span>
      </NavLink>
      <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
        <LogOut size={18} /> Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <div className="hidden w-64 shrink-0 bg-ink lg:block">
        <aside className="sticky top-0 flex h-screen flex-col gap-8 p-5">
          <Logo light />
          {nav}
          {account}
        </aside>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col gap-8 bg-ink p-5">
            <div className="flex items-center justify-between">
              <Logo light />
              <button onClick={() => setMenuOpen(false)} className="text-white" aria-label="Close menu"><X /></button>
            </div>
            {nav}
            {account}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-2 hover:bg-black/5 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
            <span className="lg:hidden"><Logo /></span>
            <span className="hidden text-sm text-ink-soft lg:block">Campus maintenance requests</span>
          </div>
          <NotificationBell />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
