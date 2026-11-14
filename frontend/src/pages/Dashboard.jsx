// Role-based dashboards: requester, maintenance officer, administrator.
import { useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { useApi } from "../useApi";
import StatusStrip from "../components/StatusStrip";
import RequestList from "../components/RequestList";
import { Empty, PriorityTag, Spinner, timeAgo } from "../components/ui";
import { useToast } from "../components/Toast";

const firstName = (n) => n.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").split(" ")[0];

function Greeting({ user, children, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Hello, {firstName(user.full_name)}</h1>
        <p className="mt-1 text-ink-soft">{children}</p>
      </div>
      {action}
    </div>
  );
}

function RequesterDashboard({ user }) {
  const stats = useApi("/api/requests/stats");
  const recent = useApi("/api/requests?per_page=5");
  return (
    <>
      <Greeting user={user} action={<Link to="/requests/new" className="btn-primary"><PlusCircle size={18} /> Report a problem</Link>}>
        {stats.data ? `You have ${stats.data.open} open request${stats.data.open === 1 ? "" : "s"}.` : " "}
      </Greeting>
      {stats.data && <StatusStrip byStatus={stats.data.by_status} total={stats.data.total} />}
      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Your latest requests</h2>
        <Link to="/requests" className="text-sm font-semibold text-teal hover:underline">See all</Link>
      </div>
      {recent.loading ? <Spinner /> : recent.data?.items.length ? (
        <RequestList items={recent.data.items} showOfficer />
      ) : (
        <Empty title="You haven't reported anything yet">
          Spotted a fault? <Link to="/requests/new" className="font-semibold text-teal hover:underline">Report it here</Link> and track it until it's fixed.
        </Empty>
      )}
    </>
  );
}

function OfficerDashboard({ user }) {
  const stats = useApi("/api/requests/stats");
  const active = useApi("/api/requests?status=assigned,in_progress,on_hold&sort=priority&per_page=20");
  return (
    <>
      <Greeting user={user}>
        {stats.data ? `${stats.data.open} job${stats.data.open === 1 ? "" : "s"} need your attention, most urgent first.` : " "}
      </Greeting>
      {stats.data && <StatusStrip byStatus={stats.data.by_status} total={stats.data.total} />}
      <h2 className="mb-3 mt-8 text-xl font-bold">Active jobs</h2>
      {active.loading ? <Spinner /> : active.data?.items.length ? (
        <RequestList items={active.data.items} showRequester />
      ) : (
        <Empty title="No active jobs">New assignments will appear here and in your notifications.</Empty>
      )}
    </>
  );
}

function AdminDashboard({ user }) {
  const toast = useToast();
  const summary = useApi("/api/reports/summary");
  const pending = useApi("/api/requests?status=pending&sort=priority&per_page=6");
  const officers = useApi("/api/officers");
  const [choice, setChoice] = useState({});

  const assign = async (req) => {
    const officer_id = choice[req.id];
    if (!officer_id) return toast("Choose an officer first.", "error");
    try {
      const d = await api.post(`/api/requests/${req.id}/assign`, { officer_id: Number(officer_id) });
      toast(d.message);
      pending.reload(); officers.reload(); summary.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const s = summary.data;
  return (
    <>
      <Greeting user={user} action={<Link to="/admin/reports" className="btn-ghost">View reports</Link>}>
        {s ? `${s.by_status.pending} request${s.by_status.pending === 1 ? " is" : "s are"} waiting for an officer.` : " "}
      </Greeting>
      {s && <StatusStrip byStatus={s.by_status} total={s.total} />}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="mb-3 text-xl font-bold">Waiting for assignment</h2>
          {pending.loading ? <Spinner /> : pending.data?.items.length ? (
            <ul className="panel divide-y divide-line">
              {pending.data.items.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/requests/${r.id}`} className="min-w-0 flex-1 group">
                    <span className="ref text-xs text-ink-soft">{r.reference} · {timeAgo(r.created_at)}</span>
                    <span className="block truncate font-semibold group-hover:text-teal group-hover:underline">{r.title}</span>
                    <span className="flex items-center gap-3 text-sm text-ink-soft">
                      <span className="truncate">{r.category?.name} · {r.location}</span>
                      <PriorityTag priority={r.priority} />
                    </span>
                  </Link>
                  <div className="flex gap-2">
                    <select aria-label={`Officer for ${r.reference}`} className="input w-44 py-1.5 text-sm"
                      value={choice[r.id] || ""} onChange={(e) => setChoice({ ...choice, [r.id]: e.target.value })}>
                      <option value="">Choose officer</option>
                      {officers.data?.map((o) => <option key={o.id} value={o.id}>{o.full_name} ({o.open_jobs})</option>)}
                    </select>
                    <button className="btn-dark py-1.5" onClick={() => assign(r)}>Assign</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing waiting">Every request has an officer.</Empty>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-xl font-bold">Officer workload</h2>
          <ul className="panel divide-y divide-line">
            {officers.data?.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-semibold">{o.full_name}</span>
                  <span className="text-sm text-ink-soft">{o.department}</span>
                </span>
                <span className="text-right">
                  <span className="ref block text-xl">{o.open_jobs}</span>
                  <span className="text-xs text-ink-soft">open jobs</span>
                </span>
              </li>
            ))}
          </ul>
          {s?.avg_resolution_hours != null && (
            <p className="mt-4 text-sm text-ink-soft">
              Completed requests take <strong className="text-ink">{s.avg_resolution_hours} hours</strong> on average from report to fix.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === "admin") return <AdminDashboard user={user} />;
  if (user.role === "officer") return <OfficerDashboard user={user} />;
  return <RequesterDashboard user={user} />;
}
