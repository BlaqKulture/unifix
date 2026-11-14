// Small shared UI pieces: status badge, priority tag, form field,
// pagination, empty state, spinner and date helpers.
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export const STATUS_META = {
  pending: { label: "Pending", cls: "bg-[#fdf6dc] text-[#7a5d00]", dot: "bg-[#d9a90f]" },
  assigned: { label: "Assigned", cls: "bg-[#e6eefb] text-[#1d4f91]", dot: "bg-[#2f6bc4]" },
  in_progress: { label: "In progress", cls: "bg-[#e2f2f0] text-[#175a56]", dot: "bg-[#1f6f6b]" },
  on_hold: { label: "On hold", cls: "bg-[#fdeedc] text-[#8a4300]", dot: "bg-[#d9731a]" },
  completed: { label: "Completed", cls: "bg-[#e3f4e7] text-[#1e6b34]", dot: "bg-[#2e8b4a]" },
  cancelled: { label: "Cancelled", cls: "bg-[#eceff0] text-[#525e60]", dot: "bg-[#8b9799]" },
};
export const STATUSES = Object.keys(STATUS_META);
export const PRIORITIES = ["low", "medium", "high", "urgent"];

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: "bg-gray-100 text-gray-700", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}

const PRIORITY_CLS = {
  low: "text-ink-soft",
  medium: "text-ink",
  high: "text-[#8a4300] font-semibold",
  urgent: "text-alert font-bold",
};

export function PriorityTag({ priority }) {
  const bars = PRIORITIES.indexOf(priority) + 1;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm capitalize ${PRIORITY_CLS[priority] || ""}`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`w-[3px] rounded-sm ${i <= bars ? "bg-current" : "bg-line"}`} style={{ height: 3 + i * 2 }} />
        ))}
      </span>
      {priority}
    </span>
  );
}

export function Field({ label, error, hint, htmlFor, children }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="label">{label}</label>}
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-alert">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-sm text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return <p className="text-sm text-ink-soft">{total ?? 0} result{total === 1 ? "" : "s"}</p>;
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-ink-soft">Page {page} of {pages} · {total} results</p>
      <div className="flex gap-2">
        <button className="btn-ghost px-2.5" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <button className="btn-ghost px-2.5" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center gap-2 py-10 text-ink-soft" role="status">
      <Loader2 className="animate-spin" size={18} /> {label}…
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export const formatDate = (iso, withTime = true) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

export const timeAgo = (iso) => {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d > 1 ? "s" : ""} ago` : formatDate(iso, false);
};
