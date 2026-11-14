// The job-card status track: every status change with who made it and why.
import { STATUS_META, formatDate } from "./ui";

export default function Timeline({ logs }) {
  return (
    <ol className="relative">
      {logs.map((log, i) => {
        const meta = STATUS_META[log.new_status] || {};
        const last = i === logs.length - 1;
        return (
          <li key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute left-[9px] top-5 h-full w-[2px] bg-line" aria-hidden />}
            <span className={`relative mt-1 h-5 w-5 shrink-0 rounded-full border-[3px] border-white ring-2 ${last ? "ring-ink" : "ring-line"} ${meta.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {meta.label || log.new_status}
                {log.old_status && <span className="font-normal text-ink-soft"> from {STATUS_META[log.old_status]?.label.toLowerCase()}</span>}
              </p>
              {log.comment && <p className="mt-0.5 text-[15px]">{log.comment}</p>}
              <p className="mt-0.5 text-sm text-ink-soft">
                {log.changed_by?.full_name} · {formatDate(log.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
