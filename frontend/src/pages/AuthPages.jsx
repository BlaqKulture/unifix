// Login and registration pages.
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { validateLogin, validateRegister } from "../validation";
import { Field } from "../components/ui";
import { useToast } from "../components/Toast";

const DEMO = [
  { role: "Student", email: "student@unifix.edu.ng", password: "Student1234" },
  { role: "Staff", email: "staff@unifix.edu.ng", password: "Staff1234" },
  { role: "Officer", email: "officer1@unifix.edu.ng", password: "Officer1234" },
  { role: "Admin", email: "admin@unifix.edu.ng", password: "Admin1234" },
];

function AuthShell({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="font-display text-2xl font-extrabold" style={{ fontStretch: "80%" }}>UniFix</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-5xl font-extrabold leading-[1.02]" style={{ fontStretch: "78%" }}>
            Report it once. Watch it get fixed.
          </h1>
          <p className="mt-5 text-lg text-white/75">
            Faulty sockets, leaking pipes, dead Wi‑Fi, broken chairs. Send the problem to Works &amp; Services
            and follow every step until the job is done.
          </p>
        </div>
        {/* A sample job card, showing what tracking looks like */}
        <div className="w-full max-w-sm rounded-lg bg-white p-5 text-ink shadow-2xl">
          <div className="flex items-baseline justify-between">
            <span className="ref text-sm text-ink-soft">SR-2026-00014</span>
            <span className="text-xs font-semibold text-[#175a56]">In progress</span>
          </div>
          <p className="mt-1 font-semibold">Leaking pipe under washroom sink</p>
          <p className="text-sm text-ink-soft">Hall 1, 2nd floor</p>
          <div className="mt-4 flex items-center">
            {["Submitted", "Assigned", "In progress", "Done"].map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-start">
                <div className="flex w-full items-center">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${i < 3 ? "bg-teal" : "border-2 border-line bg-white"}`} />
                  {i < 3 && <span className={`h-[2px] flex-1 ${i < 2 ? "bg-teal" : "bg-line"}`} />}
                </div>
                <span className="mt-1.5 text-[11px] text-ink-soft">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-9 w-9" />
            <span className="font-display text-2xl font-extrabold" style={{ fontStretch: "80%" }}>UniFix</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

export function LoginPage() {
  const { user, login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateLogin(values);
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login(values.email.trim(), values.password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold">Log in</h2>
      <p className="mt-1 text-ink-soft">Use your university email address.</p>
      {(formError || sessionMessage) && (
        <p role="alert" className="mt-5 rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-sm text-alert">
          {formError || sessionMessage}
        </p>
      )}
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className={`input ${errors.email ? "input-error" : ""}`}
            value={values.email} onChange={set("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" className={`input ${errors.password ? "input-error" : ""}`}
            value={values.password} onChange={set("password")} />
        </Field>
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="mt-5 text-sm text-ink-soft">
        New here? <Link to="/register" className="font-semibold text-teal hover:underline">Create an account</Link>
      </p>

      <div className="mt-10 border-t border-line pt-5">
        <p className="text-sm font-semibold">Try a demo account</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DEMO.map((d) => (
            <button key={d.role} type="button" className="btn-ghost px-2 py-1.5 text-xs"
              onClick={() => { setValues({ email: d.email, password: d.password }); setErrors({}); }}>
              {d.role}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    full_name: "", email: "", role: "student", department: "", phone: "", password: "", confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateRegister(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { confirm, ...body } = values;
      await register({ ...body, email: body.email.trim() });
      toast("Your account is ready. Welcome to UniFix.");
      navigate("/", { replace: true });
    } catch (err) {
      setErrors({ ...err.details, form: Object.keys(err.details).length ? "" : err.message });
    } finally {
      setBusy(false);
    }
  };

  const input = (k, props = {}) => (
    <input id={k} className={`input ${errors[k] ? "input-error" : ""}`} value={values[k]} onChange={set(k)} {...props} />
  );

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold">Create an account</h2>
      <p className="mt-1 text-ink-soft">For students and staff. Maintenance officers get accounts from the administrator.</p>
      {errors.form && <p role="alert" className="mt-5 rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-sm text-alert">{errors.form}</p>}
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Full name" htmlFor="full_name" error={errors.full_name}>{input("full_name", { autoComplete: "name" })}</Field>
        <Field label="Email" htmlFor="email" error={errors.email}>{input("email", { type: "email", autoComplete: "email" })}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="I am a" htmlFor="role">
            <select id="role" className="input" value={values.role} onChange={set("role")}>
              <option value="student">Student</option>
              <option value="staff">Staff member</option>
            </select>
          </Field>
          <Field label="Phone (optional)" htmlFor="phone" error={errors.phone}>{input("phone", { type: "tel" })}</Field>
        </div>
        <Field label="Department or faculty (optional)" htmlFor="department">{input("department")}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" error={errors.password} hint="8+ characters, letters and numbers">
            {input("password", { type: "password", autoComplete: "new-password" })}
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
            {input("confirm", { type: "password", autoComplete: "new-password" })}
          </Field>
        </div>
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="mt-5 text-sm text-ink-soft">
        Already have an account? <Link to="/login" className="font-semibold text-teal hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
