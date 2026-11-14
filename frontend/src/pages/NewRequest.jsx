// Service request submission form with photo evidence upload.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import { validateRequest, MAX_FILES, MAX_FILE_MB } from "../validation";
import { Field, PRIORITIES } from "../components/ui";
import { useToast } from "../components/Toast";

const PRIORITY_HELP = {
  low: "Can wait a week",
  medium: "Within a few days",
  high: "Disrupting work or study",
  urgent: "Dangerous or no service",
};

export function RequestForm({ categories, onSubmit, busy, submitLabel = "Submit request" }) {
  const [values, setValues] = useState({ title: "", category_id: "", location: "", priority: "medium", description: "" });
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateRequest(values, files);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const serverErrors = await onSubmit({ ...values, category_id: Number(values.category_id) }, files);
    if (serverErrors) setErrors(serverErrors);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="What's wrong?" htmlFor="title" error={errors.title} hint="A short title, e.g. “Socket sparking in room B12”">
        <input id="title" className={`input ${errors.title ? "input-error" : ""}`} value={values.title} onChange={set("title")} maxLength={150} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type of problem" htmlFor="category_id" error={errors.category_id}>
          <select id="category_id" className={`input ${errors.category_id ? "input-error" : ""}`} value={values.category_id} onChange={set("category_id")}>
            <option value="">Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Where is it?" htmlFor="location" error={errors.location} hint="Building, floor and room">
          <input id="location" className={`input ${errors.location ? "input-error" : ""}`} value={values.location} onChange={set("location")} />
        </Field>
      </div>

      <fieldset>
        <legend className="label">How urgent is it?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIORITIES.map((p) => (
            <label key={p} className={`cursor-pointer rounded-md border px-3 py-2 ${values.priority === p ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink-soft"}`}>
              <input type="radio" name="priority" value={p} checked={values.priority === p} onChange={set("priority")} className="sr-only" />
              <span className="block text-sm font-semibold capitalize">{p}</span>
              <span className={`block text-xs ${values.priority === p ? "text-white/70" : "text-ink-soft"}`}>{PRIORITY_HELP[p]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Describe the problem" htmlFor="description" error={errors.description} hint="When did it start? What have you noticed?">
        <textarea id="description" rows={5} className={`input ${errors.description ? "input-error" : ""}`} value={values.description} onChange={set("description")} maxLength={2000} />
      </Field>

      <Field label="Photos (optional)" error={errors.files} hint={`Up to ${MAX_FILES} images, ${MAX_FILE_MB} MB each. A photo helps the officer bring the right tools.`}>
        <div className="flex flex-wrap gap-3">
          {previews.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt={files[i]?.name} className="h-24 w-24 rounded-md border border-line object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white" aria-label={`Remove ${files[i]?.name}`}>
                <X size={12} />
              </button>
            </div>
          ))}
          {files.length < MAX_FILES && (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line bg-white text-xs text-ink-soft hover:border-ink-soft">
              <ImagePlus size={22} /> Add photo
              <input type="file" accept="image/*" multiple className="sr-only" aria-label="Add photos"
                onChange={(e) => { setFiles([...files, ...Array.from(e.target.files)]); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </Field>

      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <button className="btn-primary px-6" disabled={busy}>{busy ? "Submitting…" : submitLabel}</button>
      </div>
    </form>
  );
}

export default function NewRequest() {
  const navigate = useNavigate();
  const toast = useToast();
  const categories = useApi("/api/categories");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (values, files) => {
    setBusy(true);
    try {
      const { request, message } = await api.post("/api/requests", values);
      if (files.length) {
        try {
          await api.upload(`/api/requests/${request.id}/attachments`, files);
        } catch (e) {
          toast(`Request saved, but photos failed to upload: ${e.message}`, "error");
        }
      }
      toast(message);
      navigate(`/requests/${request.id}`);
    } catch (e) {
      toast(e.message, "error");
      return e.details;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Report a problem</h1>
      <p className="mb-6 mt-1 text-ink-soft">Works &amp; Services will review it and assign a maintenance officer. You'll be notified at each step.</p>
      <div className="panel p-5 sm:p-7">
        <RequestForm categories={categories.data || []} onSubmit={onSubmit} busy={busy} />
      </div>
    </div>
  );
}
