// Client-side form validation. Mirrors the API rules so users get
// instant feedback; the server still validates everything.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/;

export function validateLogin({ email, password }) {
  const e = {};
  if (!email?.trim()) e.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
  if (!password) e.password = "Enter your password.";
  return e;
}

export function validatePassword(password) {
  if (!password) return "Choose a password.";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Use at least 8 characters with letters and numbers.";
  return null;
}

export function validateRegister(v) {
  const e = {};
  if (!v.full_name?.trim() || v.full_name.trim().length < 3) e.full_name = "Enter your full name.";
  if (!v.email?.trim()) e.email = "Enter your email address.";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address.";
  const pw = validatePassword(v.password);
  if (pw) e.password = pw;
  if (v.password && v.confirm !== v.password) e.confirm = "Passwords do not match.";
  return e;
}

export const MAX_FILES = 5;
export const MAX_FILE_MB = 3;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateRequest(v, files = []) {
  const e = {};
  if (!v.title?.trim() || v.title.trim().length < 5) e.title = "Give the problem a short title (at least 5 characters).";
  else if (v.title.length > 150) e.title = "Keep the title under 150 characters.";
  if (!v.category_id) e.category_id = "Choose the type of problem.";
  if (!v.location?.trim() || v.location.trim().length < 2) e.location = "Say where the problem is.";
  if (!v.description?.trim() || v.description.trim().length < 10)
    e.description = "Describe the problem in at least 10 characters.";
  if (files.length > MAX_FILES) e.files = `Attach at most ${MAX_FILES} photos.`;
  const bad = files.find((f) => !IMAGE_TYPES.includes(f.type));
  if (bad) e.files = `${bad.name} is not a JPG, PNG, WEBP or GIF image.`;
  const big = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
  if (big) e.files = `${big.name} is larger than ${MAX_FILE_MB} MB.`;
  return e;
}
