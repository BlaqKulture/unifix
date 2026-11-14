// Small fetch wrapper for the UniFix API.
// The JWT is kept in localStorage and sent as a Bearer token.

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const TOKEN_KEY = "unifix_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, { body, form, raw } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized(data.error);
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.details);
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, body) => request("POST", p, { body }),
  put: (p, body) => request("PUT", p, { body }),
  patch: (p, body) => request("PATCH", p, { body }),
  del: (p) => request("DELETE", p),
  upload: (p, files) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request("POST", p, { form });
  },
  blob: async (p) => (await request("GET", p, { raw: true })).blob(),
  download: async (p, fallbackName) => {
    const res = await request("GET", p, { raw: true });
    const cd = res.headers.get("Content-Disposition") || "";
    const name = cd.match(/filename="?([^"]+)"?/)?.[1] || fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const qs = (params) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") s.set(k, v);
  });
  const str = s.toString();
  return str ? `?${str}` : "";
};
