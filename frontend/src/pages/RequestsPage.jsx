// Request tracking list with search, filters, sorting, pagination and (admin) export.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, PlusCircle, Search } from "lucide-react";
import { useAuth, isRequester } from "../AuthContext";
import { api, qs } from "../api";
import { useApi } from "../useApi";
import RequestList from "../components/RequestList";
import { Empty, Pagination, PRIORITIES, Spinner, STATUS_META, STATUSES } from "../components/ui";
import { useToast } from "../components/Toast";

const FILTER_KEYS = ["q", "status", "priority", "category_id", "officer_id", "date_from", "date_to", "sort", "page"];

export default function RequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const admin = user.role === "admin";
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""]));
  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);

  const { data, loading, error } = useApi(`/api/requests${qs({ ...filters, per_page: 10 })}`);
  const categories = useApi("/api/categories");
  const officers = useApi(admin ? "/api/officers" : null);

  const update = (changes) => {
    const next = { ...filters, page: "", ...changes };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  };

  const exportFile = async (format) => {
    try {
      const { page, sort, ...rest } = filters;
      await api.download(`/api/reports/export${qs({ ...rest, format })}`, `service-requests.${format}`);
      toast(`${format.toUpperCase()} downloaded.`);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const title = admin ? "All requests" : user.role === "officer" ? "My jobs" : "My requests";
  const active = ["q", "status", "priority", "category_id", "officer_id", "date_from", "date_to"].some((k) => filters[k]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-ink-soft">Search, filter and open any request to see its full history.</p>
        </div>
        <div className="flex gap-2">
          {admin && <>
            <button className="btn-ghost" onClick={() => exportFile("csv")}><Download size={16} /> CSV</button>
            <button className="btn-ghost" onClick={() => exportFile("pdf")}><Download size={16} /> PDF</button>
          </>}
          {isRequester(user) && <Link to="/requests/new" className="btn-primary"><PlusCircle size={18} /> Report a problem</Link>}
        </div>
      </div>

      <div className="panel mb-4 space-y-3 p-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }} role="search">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input className="input pl-9" placeholder="Search by title, reference or location" aria-label="Search requests"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-dark">Search</button>
        </form>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:flex lg:flex-wrap">
          <select aria-label="Status" className="input lg:w-40" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            <option value="pending,assigned,in_progress,on_hold">All open</option>
          </select>
          <select aria-label="Priority" className="input lg:w-36" value={filters.priority} onChange={(e) => update({ priority: e.target.value })}>
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select aria-label="Category" className="input lg:w-48" value={filters.category_id} onChange={(e) => update({ category_id: e.target.value })}>
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {admin && (
            <select aria-label="Officer" className="input lg:w-44" value={filters.officer_id} onChange={(e) => update({ officer_id: e.target.value })}>
              <option value="">Any officer</option>
              {officers.data?.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
            </select>
          )}
          <input type="date" aria-label="From date" className="input lg:w-40" value={filters.date_from} onChange={(e) => update({ date_from: e.target.value })} />
          <input type="date" aria-label="To date" className="input lg:w-40" value={filters.date_to} onChange={(e) => update({ date_to: e.target.value })} />
          <select aria-label="Sort" className="input lg:w-40" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">Most urgent first</option>
          </select>
          {active && <button className="text-sm font-semibold text-teal hover:underline" onClick={() => setParams({})}>Clear filters</button>}
        </div>
      </div>

      {loading ? <Spinner /> : error ? (
        <Empty title="Couldn't load requests">{error.message}</Empty>
      ) : data.items.length === 0 ? (
        <Empty title={active ? "No requests match these filters" : "No requests yet"}>
          {active ? "Try a different search or clear the filters." : isRequester(user) ? <Link className="font-semibold text-teal hover:underline" to="/requests/new">Report your first problem</Link> : "Requests will appear here."}
        </Empty>
      ) : (
        <div className="space-y-4">
          <RequestList items={data.items} showRequester={!isRequester(user)} showOfficer={user.role !== "officer"} />
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => update({ page: String(p), q: filters.q })} />
        </div>
      )}
    </>
  );
}
