// Administrator: activity log (audit trail) of important actions.
import { useState } from "react";
import { qs } from "../../api";
import { useApi } from "../../useApi";
import { Empty, Pagination, Spinner, formatDate } from "../../components/ui";

const ACTIONS = [
  ["", "All activity"],
  ["auth.", "Logins and logouts"],
  ["request.", "Request changes"],
  ["user.", "User management"],
  ["category.", "Categories"],
  ["report.", "Report exports"],
  ["attachment.", "Photo uploads"],
];

const DESCRIBE = {
  "auth.login": "Logged in",
  "auth.logout": "Logged out",
  "auth.login_failed": "Failed login attempt",
  "user.register": "Registered an account",
  "user.create": "Created a user",
  "user.update": "Updated a user",
  "user.update_profile": "Updated own profile",
  "request.create": "Submitted a request",
  "request.update": "Edited a request",
  "request.assign": "Assigned a request",
  "request.status": "Changed request status",
  "request.delete": "Deleted a request",
  "category.create": "Added a category",
  "category.update": "Updated a category",
  "category.delete": "Deleted a category",
  "report.export": "Exported a report",
  "attachment.upload": "Uploaded photos",
};

export default function AuditLog() {
  const [f, setF] = useState({ action: "", q: "", page: 1 });
  const [search, setSearch] = useState("");
  const { data, loading } = useApi(`/api/audit-logs${qs({ ...f, per_page: 15 })}`);

  return (
    <>
      <h1 className="text-3xl font-bold">Activity log</h1>
      <p className="mb-6 mt-1 text-ink-soft">Who did what, and when. Entries cannot be edited or deleted.</p>
      <div className="panel mb-4 flex flex-wrap gap-2 p-4">
        <select aria-label="Activity type" className="input w-56" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value, page: 1 })}>
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <form className="flex-1" onSubmit={(e) => { e.preventDefault(); setF({ ...f, q: search, page: 1 }); }}>
          <input className="input" placeholder="Search by person or detail" aria-label="Search activity" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>
      {loading && !data ? <Spinner /> : !data?.items.length ? <Empty title="No activity found" /> : (
        <div className="space-y-4">
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Who</th>
                  <th className="px-4 py-3 font-semibold">What</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold">IP address</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className="border-b border-line/70 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-2.5">{a.user?.full_name || <span className="text-ink-soft">Unknown</span>}</td>
                    <td className={`px-4 py-2.5 font-semibold ${a.action === "auth.login_failed" ? "text-alert" : ""}`}>{DESCRIBE[a.action] || a.action}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-ink-soft" title={a.details}>{a.details || "—"}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{a.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => setF({ ...f, page: p })} />
        </div>
      )}
    </>
  );
}
