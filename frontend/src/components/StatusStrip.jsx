// A segmented bar that shows how requests are spread across statuses.
import { Link } from "react-router-dom";
import { STATUS_META, STATUSES } from "./ui";

export default function StatusStrip({ byStatus = {}, total = 0, linkBase = "/requests" }) {
  const shown = STATUSES.filter((s) => byStatus[s] > 0);
  return (
    <div className="panel p-5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        {shown.map((s) => (
          <span key={s} className={STATUS_META[s].dot} style={{ width: `${(byStatus[s] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((s) => (
          <li key={s}>
            <Link to={`${linkBase}?status=${s}`} className="group block">
              <span className="flex items-center gap-2 text-sm text-ink-soft group-hover:text-ink">
                <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} /> {STATUS_META[s].label}
              </span>
              <span className="ref text-2xl">{byStatus[s] ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
