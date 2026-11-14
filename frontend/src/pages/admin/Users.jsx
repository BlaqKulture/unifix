// Administrator: manage users (create, change role, activate/deactivate).
import { useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { api, qs } from "../../api";
import { useApi } from "../../useApi";
import { validatePassword } from "../../validation";
import { Empty, Field, Pagination, Spinner, formatDate } from "../../components/ui";
import { useToast } from "../../components/Toast";

const ROLES = ["student", "staff", "officer", "admin"];
const ROLE_LABEL = { student: "Student", staff: "Staff", officer: "Officer", admin: "Administrator" };

function NewUserForm({ onCreated, onClose }) {
  const toast = useToast();
  const [v, setV] = useState({ full_name: "", email: "", role: "officer", department: "", phone: "", password: "" });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (v.full_name.trim().length < 3) errs.full_name = "Enter the person's full name.";
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(v.email.trim())) errs.email = "Enter a valid email address.";
    const pw = validatePassword(v.password);
    if (pw) errs.password = pw;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const d = await api.post("/api/users", v);
      toast(`${d.user.full_name} can now log in as ${ROLE_LABEL[d.user.role].toLowerCase()}.`);
      onCreated();
    } catch (err) {
      setErrors(err.details || {});
      toast(err.message, "error");
    }
  };
  return (
    <form onSubmit={submit} noValidate className="panel mb-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Add a user</h2>
        <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Full name" htmlFor="nu-name" error={errors.full_name}><input id="nu-name" className="input" value={v.full_name} onChange={set("full_name")} /></Field>
        <Field label="Email" htmlFor="nu-email" error={errors.email}><input id="nu-email" type="email" className="input" value={v.email} onChange={set("email")} /></Field>
        <Field label="Role" htmlFor="nu-role">
          <select id="nu-role" className="input" value={v.role} onChange={set("role")}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </Field>
        <Field label="Department or unit" htmlFor="nu-dept"><input id="nu-dept" className="input" value={v.department} onChange={set("department")} /></Field>
        <Field label="Phone" htmlFor="nu-phone"><input id="nu-phone" className="input" value={v.phone} onChange={set("phone")} /></Field>
        <Field label="Temporary password" htmlFor="nu-pw" error={errors.password}><input id="nu-pw" className="input" value={v.password} onChange={set("password")} /></Field>
      </div>
      <button className="btn-primary mt-5">Create user</button>
    </form>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ q: "", role: "", page: 1 });
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const { data, loading, reload } = useApi(`/api/users${qs({ ...filters, per_page: 10 })}`);

  const patch = async (u, body) => {
    try {
      const d = await api.patch(`/api/users/${u.id}`, body);
      toast(d.message);
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-ink-soft">Create officer accounts, change roles and deactivate people who have left.</p>
        </div>
        {!adding && <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={18} /> Add user</button>}
      </div>
      {adding && <NewUserForm onClose={() => setAdding(false)} onCreated={() => { setAdding(false); reload(); }} />}

      <div className="panel mb-4 flex flex-wrap gap-2 p-4">
        <form className="relative min-w-60 flex-1" onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, q: search, page: 1 }); }}>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input pl-9" placeholder="Search by name, email or department" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select aria-label="Role" className="input w-44" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {loading && !data ? <Spinner /> : !data?.items.length ? <Empty title="No users match">Try another search.</Empty> : (
        <div className="space-y-4">
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead className="border-b border-line bg-paper text-sm text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className={`border-b border-line/70 last:border-0 ${u.is_active ? "" : "text-ink-soft"}`}>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{u.full_name}</span>
                      <span className="text-sm text-ink-soft">{u.email}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.department || "—"}</td>
                    <td className="px-4 py-3">
                      <select aria-label={`Role for ${u.full_name}`} className="input w-40 py-1.5 text-sm" value={u.role}
                        disabled={u.id === me.id} onChange={(e) => patch(u, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(u.created_at, false)}</td>
                    <td className="px-4 py-3">
                      {u.id === me.id ? <span className="text-sm text-ink-soft">You</span> : (
                        <button className={u.is_active ? "btn-danger py-1.5 text-xs" : "btn-ghost py-1.5 text-xs"}
                          onClick={() => patch(u, { is_active: !u.is_active })}>
                          {u.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => setFilters({ ...filters, page: p })} />
        </div>
      )}
    </>
  );
}
