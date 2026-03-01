/* global __ADMIN_SALT__, __ADMIN_HASH__ */
export function sanitize(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, 500);
}

export function formatNum(n) {
  return (n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function promptPassword(msg = "Enter admin password:") {
  const pw = prompt(msg);
  return pw;
}

 
export async function checkPassword(pw) {
  if (!pw) return false;
  const encoded = new TextEncoder().encode(__ADMIN_SALT__ + pw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === __ADMIN_HASH__;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function hashName(name) {
  const encoded = new TextEncoder().encode(
    __ADMIN_SALT__ + name.trim().toLowerCase(),
  );
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function resolveUser(travelers, tokenStore) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("u");
  if (!token) return null;
  const entry = tokenStore?.[token];
  if (!entry || !entry.active) return null;
  for (const t of travelers) {
    const h = await hashName(t.name);
    if (h === token) {
      localStorage.setItem("currentUser", t.name);
      return t.name;
    }
  }
  return null;
}
