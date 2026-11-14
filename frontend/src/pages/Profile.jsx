// Profile page: update personal details and change password.
import { useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { validatePassword } from "../validation";
import { Field } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ full_name: user.full_name, phone: user.phone || "", department: user.department || "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [errors, setErrors] = useState({});

  const save = async (body, reset) => {
    try {
      const d = await api.put("/api/auth/me", body);
      setUser(d.user);
      toast(body.new_password ? "Password changed." : "Profile saved.");
      setErrors({});
      reset?.();
    } catch (e) {
      setErrors(e.details || {});
      toast(e.message, "error");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="mt-1 text-ink-soft">{user.email}</p>
      </div>
      <form className="panel space-y-4 p-5" noValidate onSubmit={(e) => {
        e.preventDefault();
        if (v.full_name.trim().length < 3) return setErrors({ full_name: "Enter your full name." });
        save(v);
      }}>
        <h2 className="text-lg font-bold">Details</h2>
        <Field label="Full name" htmlFor="p-name" error={errors.full_name}><input id="p-name" className="input" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="p-phone"><input id="p-phone" className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Department" htmlFor="p-dept"><input id="p-dept" className="input" value={v.department} onChange={(e) => setV({ ...v, department: e.target.value })} /></Field>
        </div>
        <button className="btn-primary">Save details</button>
      </form>
      <form className="panel space-y-4 p-5" noValidate onSubmit={(e) => {
        e.preventDefault();
        const err = validatePassword(pw.new_password);
        if (!pw.current_password) return setErrors({ current_password: "Enter your current password." });
        if (err) return setErrors({ new_password: err });
        save(pw, () => setPw({ current_password: "", new_password: "" }));
      }}>
        <h2 className="text-lg font-bold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" htmlFor="p-cur" error={errors.current_password}>
            <input id="p-cur" type="password" className="input" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          </Field>
          <Field label="New password" htmlFor="p-new" error={errors.new_password || errors.password} hint="8+ characters, letters and numbers">
            <input id="p-new" type="password" className="input" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </Field>
        </div>
        <button className="btn-dark">Change password</button>
      </form>
    </div>
  );
}
