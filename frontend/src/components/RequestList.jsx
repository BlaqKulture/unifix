// Request rows: a table on wide screens, stacked rows on phones.
import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { PriorityTag, StatusBadge, timeAgo } from "./ui";

export default function RequestList({ items, showRequester, showOfficer }) {
  return (
    <div className="panel overflow-hidden">
      <table className="hidden w-full text-left text-[15px] md:table">
        <thead className="border-b border-line bg-paper text-sm text-ink-soft">
          <tr>
            <th className="px-4 py-3 font-semibold">Request</th>
            <th className="px-4 py-3 font-semibold">Category</th>
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            {showRequester && <th className="px-4 py-3 font-semibold">Reported by</th>}
            {showOfficer && <th className="px-4 py-3 font-semibold">Officer</th>}
            <th className="px-4 py-3 font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-paper/70">
              <td className="max-w-xs px-4 py-3">
                <Link to={`/requests/${r.id}`} className="group block">
                  <span className="ref block text-xs text-ink-soft">{r.reference}</span>
                  <span className="block truncate font-semibold group-hover:text-teal group-hover:underline">{r.title}</span>
                  <span className="flex items-center gap-2 truncate text-sm text-ink-soft">
                    {r.location}
                    {r.attachment_count > 0 && <Camera size={13} aria-label={`${r.attachment_count} photos`} />}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">{r.category?.name}</td>
              <td className="px-4 py-3"><PriorityTag priority={r.priority} /></td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              {showRequester && <td className="px-4 py-3 text-sm">{r.requester?.full_name}</td>}
              {showOfficer && <td className="px-4 py-3 text-sm">{r.assigned_officer?.full_name || <span className="text-ink-soft">Not assigned</span>}</td>}
              <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-soft">{timeAgo(r.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {items.map((r) => (
          <li key={r.id}>
            <Link to={`/requests/${r.id}`} className="block px-4 py-3 hover:bg-paper">
              <div className="flex items-center justify-between gap-2">
                <span className="ref text-xs text-ink-soft">{r.reference}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 font-semibold">{r.title}</p>
              <div className="mt-1 flex items-center justify-between text-sm text-ink-soft">
                <span className="truncate">{r.location}</span>
                <PriorityTag priority={r.priority} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
