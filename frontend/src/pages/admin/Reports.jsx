// Administrator: summary reports with charts, and CSV / PDF export.
import { useState } from "react";
import { Download } from "lucide-react";
import { api, qs } from "../../api";
import { useApi } from "../../useApi";
import { Spinner, STATUS_META, STATUSES } from "../../components/ui";
import { useToast } from "../../components/Toast";

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-2.5 rounded-full bg-paper">
            <span className={`block h-full rounded-full ${r.cls || "bg-teal"}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="ref text-right">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Requests received per day over the last 14 days">
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 text-xs font-semibold group-hover:block">{d.count}</span>
            <span className="rounded-t bg-ink" style={{ height: `${Math.max((d.count / max) * 100, d.count ? 6 : 2)}%`, opacity: d.count ? 1 : 0.15 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-soft">
        <span>{new Date(days[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function Reports() {
  const toast = useToast();
  const { data, loading } = useApi("/api/reports/summary");
  const categories = useApi("/api/categories?include_inactive=true");
  const [f, setF] = useState({ status: "", category_id: "", date_from: "", date_to: "" });

  const exportFile = async (format) => {
    try {
      await api.download(`/api/reports/export${qs({ ...f, format })}`, `service-requests.${format}`);
      toast(`${format.toUpperCase()} report downloaded.`);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (loading || !data) return <Spinner />;
  const open = data.by_status.pending + data.by_status.assigned + data.by_status.in_progress + data.by_status.on_hold;
  const rate = data.total ? Math.round((data.by_status.completed / data.total) * 100) : 0;

  return (
    <>
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="mb-6 mt-1 text-ink-soft">How maintenance requests are flowing, and how quickly they get fixed.</p>

      <dl className="panel mb-6 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        {[
          ["Total requests", data.total],
          ["Still open", open],
          ["Completion rate", `${rate}%`],
          ["Average time to fix", data.avg_resolution_hours != null ? `${data.avg_resolution_hours} h` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="p-5">
            <dt className="text-sm text-ink-soft">{k}</dt>
            <dd className="ref mt-1 text-3xl">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-4 text-lg font-bold">Requests received, last 14 days</h2>
          <DailyChart days={data.per_day} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 text-lg font-bold">By status</h2>
          <Bars rows={STATUSES.map((s) => ({ label: STATUS_META[s].label, value: data.by_status[s], cls: STATUS_META[s].dot }))} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 text-lg font-bold">By category</h2>
          <Bars rows={data.by_category.map((c) => ({ label: c.category, value: c.count }))} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 text-lg font-bold">Officer performance</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-ink-soft">
              <tr><th className="pb-2 font-semibold">Officer</th><th className="pb-2 text-right font-semibold">Open</th><th className="pb-2 text-right font-semibold">Done</th><th className="pb-2 text-right font-semibold">Avg. hours</th></tr>
            </thead>
            <tbody>
              {data.officer_performance.map((o) => (
                <tr key={o.officer.id} className="border-t border-line">
                  <td className="py-2 font-semibold">{o.officer.full_name}</td>
                  <td className="ref py-2 text-right">{o.open}</td>
                  <td className="ref py-2 text-right">{o.completed}</td>
                  <td className="ref py-2 text-right">{o.avg_hours_to_complete ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="text-lg font-bold">Export requests</h2>
        <p className="mb-4 text-sm text-ink-soft">Download a spreadsheet (CSV) or printable PDF. Leave filters empty to include everything.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto_auto]">
          <select aria-label="Status" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select aria-label="Category" className="input" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" aria-label="From date" className="input" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
          <input type="date" aria-label="To date" className="input" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
          <button className="btn-dark" onClick={() => exportFile("csv")}><Download size={16} /> CSV</button>
          <button className="btn-primary" onClick={() => exportFile("pdf")}><Download size={16} /> PDF</button>
        </div>
      </section>
    </>
  );
}
