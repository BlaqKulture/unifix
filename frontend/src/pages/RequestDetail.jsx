// Request tracking page: details, photos, status history and role-based actions.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { useAuth, isRequester } from "../AuthContext";
import { api } from "../api";
import { useApi } from "../useApi";
import Timeline from "../components/Timeline";
import AuthImage from "../components/AuthImage";
import { Empty, Field, PRIORITIES, PriorityTag, Spinner, STATUS_META, StatusBadge, formatDate } from "../components/ui";
import { useToast } from "../components/Toast";

const OFFICER_ACTIONS = {
  assigned: [{ to: "in_progress", label: "Start work", primary: true }],
  in_progress: [
    { to: "completed", label: "Mark as completed", primary: true },
    { to: "on_hold", label: "Put on hold", needsComment: true },
  ],
  on_hold: [{ to: "in_progress", label: "Resume work", primary: true }],
};
const CLOSED = ["completed", "cancelled"];

function Panel({ title, children }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function StatusAction({ req, actions, onDone, noteLabel = "Note for the requester", noteHint = "Optional, except when putting a job on hold." }) {
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (a) => {
    if (a.needsComment && !comment.trim()) return setError("Add a short note explaining why.");
    setBusy(true);
    setError("");
    try {
      const d = await api.post(`/api/requests/${req.id}/status`, { status: a.to, comment: comment.trim() || undefined });
      toast(d.message);
      setComment("");
      onDone(d.request);
    } catch (e) {
      setError(e.details?.comment || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label={noteLabel} htmlFor="status-note" error={error} hint={noteHint}>
        <textarea id="status-note" rows={2} className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.to} disabled={busy} onClick={() => run(a)} className={a.primary ? "btn-primary" : a.danger ? "btn-danger" : "btn-ghost"}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminActions({ req, onDone, onDeleted }) {
  const toast = useToast();
  const officers = useApi("/api/officers");
  const categories = useApi("/api/categories");
  const [officerId, setOfficerId] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const call = async (fn) => {
    try {
      const d = await fn();
      toast(d.message);
      if (d.request) onDone(d.request);
      return d;
    } catch (e) {
      toast(Object.values(e.details || {})[0] || e.message, "error");
    }
  };

  const closed = CLOSED.includes(req.status);
  return (
    <>
      {!closed && (
        <Panel title={req.assigned_officer ? "Reassign officer" : "Assign an officer"}>
          <div className="space-y-3">
            <select aria-label="Officer" className="input" value={officerId} onChange={(e) => setOfficerId(e.target.value)}>
              <option value="">Choose a maintenance officer</option>
              {officers.data?.map((o) => (
                <option key={o.id} value={o.id} disabled={o.id === req.assigned_officer?.id}>
                  {o.full_name} · {o.department} · {o.open_jobs} open
                </option>
              ))}
            </select>
            <input className="input" placeholder="Instructions for the officer (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
            <button className="btn-primary w-full" disabled={!officerId}
              onClick={() => call(() => api.post(`/api/requests/${req.id}/assign`, { officer_id: Number(officerId), note: note || undefined }))
                .then((d) => d && (setOfficerId(""), setNote("")))}>
              {req.assigned_officer ? "Reassign" : "Assign"}
            </button>
          </div>
        </Panel>
      )}

      <Panel title="Override status">
        <div className="space-y-3">
          <select aria-label="New status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Choose a status</option>
            {["pending", "in_progress", "on_hold", "completed", "cancelled"].filter((s) => s !== req.status)
              .map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <input className="input" placeholder="Reason" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          <button className="btn-dark w-full" disabled={!status}
            onClick={() => call(() => api.post(`/api/requests/${req.id}/status`, { status, comment: comment || undefined }))
              .then((d) => d && (setStatus(""), setComment("")))}>
            Update status
          </button>
        </div>
      </Panel>

      <Panel title="Priority and category">
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Priority" className="input capitalize" value={req.priority}
            onChange={(e) => call(() => api.patch(`/api/requests/${req.id}`, { priority: e.target.value }))}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label="Category" className="input" value={req.category?.id}
            onChange={(e) => call(() => api.patch(`/api/requests/${req.id}`, { category_id: Number(e.target.value) }))}>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn-danger mt-4 w-full" onClick={() => {
          if (!confirmDelete) return setConfirmDelete(true);
          call(() => api.del(`/api/requests/${req.id}`)).then((d) => d && onDeleted());
        }}>
          {confirmDelete ? "Click again to permanently delete" : "Delete request"}
        </button>
      </Panel>
    </>
  );
}

function EditPending({ req, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: req.title, location: req.location, description: req.description, priority: req.priority });
  const [errors, setErrors] = useState({});
  if (!open) return <button className="btn-ghost w-full" onClick={() => setOpen(true)}>Edit details</button>;
  const save = async () => {
    try {
      const d = await api.patch(`/api/requests/${req.id}`, v);
      toast(d.message);
      onDone(d.request);
      setOpen(false);
    } catch (e) {
      setErrors(e.details || {});
      toast(e.message, "error");
    }
  };
  return (
    <div className="space-y-3">
      <Field label="Title" htmlFor="e-title" error={errors.title}><input id="e-title" className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
      <Field label="Location" htmlFor="e-loc" error={errors.location}><input id="e-loc" className="input" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} /></Field>
      <Field label="Priority" htmlFor="e-pri">
        <select id="e-pri" className="input capitalize" value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value })}>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="Description" htmlFor="e-desc" error={errors.description}><textarea id="e-desc" rows={4} className="input" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className="flex gap-2"><button className="btn-primary" onClick={save}>Save changes</button><button className="btn-ghost" onClick={() => setOpen(false)}>Discard</button></div>
    </div>
  );
}

function AddPhotos({ req, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const left = 5 - req.attachments.length;
  if (left <= 0) return null;
  const upload = async (files) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const d = await api.upload(`/api/requests/${req.id}/attachments`, files.slice(0, left));
      toast(d.message);
      onDone();
    } catch (e) {
      toast(e.details?.files || e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className={`btn-ghost cursor-pointer ${busy ? "opacity-60" : ""}`}>
      <ImagePlus size={16} /> {busy ? "Uploading…" : "Add photos"}
      <input type="file" accept="image/*" multiple className="sr-only" disabled={busy}
        onChange={(e) => { upload(Array.from(e.target.files)); e.target.value = ""; }} />
    </label>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload, setData } = useApi(`/api/requests/${id}`);
  const update = (request) => setData({ request });

  if (loading && !data) return <Spinner />;
  if (error) return <Empty title="Request not found">It may have been deleted, or it isn't one you can view. <Link to="/requests" className="font-semibold text-teal hover:underline">Back to requests</Link></Empty>;

  const req = data.request;
  const closed = CLOSED.includes(req.status);
  const mine = req.assigned_officer?.id === user.id;
  const officerActions = user.role === "officer" && mine ? OFFICER_ACTIONS[req.status] : null;
  const canCancel = isRequester(user) && req.status === "pending";
  const canAddPhotos = !closed && (user.role === "admin" || mine || (isRequester(user) && req.requester?.id === user.id));

  return (
    <>
      <Link to="/requests" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Back to requests
      </Link>

      <header className="mb-6 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ref rounded bg-ink px-2 py-0.5 text-sm text-hivis">{req.reference}</span>
          <StatusBadge status={req.status} />
          <PriorityTag priority={req.priority} />
        </div>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{req.title}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt className="text-ink-soft">Location</dt><dd className="font-semibold">{req.location}</dd></div>
          <div><dt className="text-ink-soft">Category</dt><dd className="font-semibold">{req.category?.name}</dd></div>
          <div><dt className="text-ink-soft">Reported by</dt><dd className="font-semibold">{req.requester?.full_name}</dd></div>
          <div><dt className="text-ink-soft">Officer</dt><dd className="font-semibold">{req.assigned_officer?.full_name || "Not assigned yet"}</dd></div>
          <div><dt className="text-ink-soft">Reported</dt><dd>{formatDate(req.created_at)}</dd></div>
          {req.completed_at && <div><dt className="text-ink-soft">Completed</dt><dd>{formatDate(req.completed_at)}</dd></div>}
        </dl>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-2 text-lg font-bold">Description</h2>
            <p className="max-w-prose whitespace-pre-line">{req.description}</p>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Photos</h2>
              {canAddPhotos && <AddPhotos req={req} onDone={reload} />}
            </div>
            {req.attachments.length ? (
              <div className="flex flex-wrap gap-3">
                {req.attachments.map((a) => (
                  <AuthImage key={a.id} src={a.url} alt={a.filename} className="h-32 w-32 rounded-md border border-line object-cover" />
                ))}
              </div>
            ) : <p className="text-sm text-ink-soft">No photos attached.</p>}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold">Progress</h2>
            <Timeline logs={req.logs} />
          </section>
        </div>

        <aside className="space-y-4">
          {officerActions && (
            <Panel title="Update this job"><StatusAction req={req} actions={officerActions} onDone={update} /></Panel>
          )}
          {canCancel && (
            <Panel title="Change your request">
              <div className="space-y-4">
                <EditPending req={req} onDone={update} />
                <StatusAction req={req} onDone={update} noteLabel="Reason for cancelling" noteHint="Only needed if you want to cancel this request."
                  actions={[{ to: "cancelled", label: "Cancel request", danger: true, needsComment: true }]} />
              </div>
            </Panel>
          )}
          {user.role === "admin" && (
            <AdminActions req={req} onDone={update} onDeleted={() => navigate("/requests")} />
          )}
          {isRequester(user) && !canCancel && !closed && (
            <p className="panel p-4 text-sm text-ink-soft">
              {req.assigned_officer?.full_name} is handling this. You'll get a notification when the status changes.
            </p>
          )}
          {closed && user.role !== "admin" && (
            <p className="panel p-4 text-sm text-ink-soft">This request is {STATUS_META[req.status].label.toLowerCase()} and can no longer be changed.</p>
          )}
        </aside>
      </div>
    </>
  );
}
