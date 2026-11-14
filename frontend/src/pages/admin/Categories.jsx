// Administrator: manage request categories.
import { useState } from "react";
import { api } from "../../api";
import { useApi } from "../../useApi";
import { Field, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";

export default function Categories() {
  const toast = useToast();
  const { data, loading, reload } = useApi("/api/categories?include_inactive=true");
  const [v, setV] = useState({ name: "", description: "" });
  const [error, setError] = useState("");

  const call = async (fn) => {
    try {
      const d = await fn();
      toast(d.message);
      reload();
      return true;
    } catch (e) {
      toast(e.message === "Validation failed" ? Object.values(e.details)[0] : e.message, "error");
      return false;
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (v.name.trim().length < 2) return setError("Enter a category name.");
    setError("");
    if (await call(() => api.post("/api/categories", v))) setV({ name: "", description: "" });
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold">Categories</h1>
      <p className="mb-6 mt-1 text-ink-soft">The types of problem people can choose when they report something.</p>

      <form onSubmit={add} noValidate className="panel mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Field label="Name" htmlFor="c-name" error={error}><input id="c-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Description" htmlFor="c-desc"><input id="c-desc" className="input" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <button className="btn-primary">Add category</button>
      </form>

      {loading && !data ? <Spinner /> : (
        <ul className="panel divide-y divide-line">
          {data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${c.is_active ? "" : "text-ink-soft line-through"}`}>{c.name}</p>
                <p className="text-sm text-ink-soft">{c.description}</p>
              </div>
              <button className="btn-ghost py-1.5 text-xs" onClick={() => call(() => api.patch(`/api/categories/${c.id}`, { is_active: !c.is_active }))}>
                {c.is_active ? "Hide from form" : "Show on form"}
              </button>
              <button className="btn-danger py-1.5 text-xs" onClick={() => call(() => api.del(`/api/categories/${c.id}`))}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
