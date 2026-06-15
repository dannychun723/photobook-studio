// User session management for private-URL workspace isolation.
// Each user accesses the app via a unique ?uid=... URL parameter.
// The uid is the "password" — it namespaces a completely private IndexedDB database.
// In local dev mode the uid requirement is bypassed so localhost works as before.

const SESSION_KEY = "pb_session_uid";
const ADMIN_STORE_KEY = "pb_admin_users";

const UID_PATTERN = /^[a-z0-9_-]{6,64}$/i;

// Read uid from ?uid= param, fall back to sessionStorage for same-tab reloads.
// Returns null if no valid uid found (triggers AccessGate in production).
export function readUserId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const urlUid = params.get("uid");

  if (urlUid && UID_PATTERN.test(urlUid)) {
    sessionStorage.setItem(SESSION_KEY, urlUid);
    return urlUid;
  }

  return sessionStorage.getItem(SESSION_KEY);
}

// Maps uid → IndexedDB database name.
// Dev mode (no uid) uses the legacy name so existing local data is preserved.
export function getDatabaseName(uid: string | null): string {
  return uid ? `pb_${uid}` : "photobook-studio";
}

// True if the current URL is the admin panel (?admin=true)
export function isAdminUrl(): boolean {
  return new URLSearchParams(window.location.search).get("admin") === "true";
}

// ── Link management (admin only, stored in localStorage) ──────────────────────

export interface ManagedUser {
  uid: string;
  label: string;
  createdAt: number;
}

export function generateUid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getManagedUsers(): ManagedUser[] {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_STORE_KEY) ?? "[]") as ManagedUser[];
  } catch {
    return [];
  }
}

export function addManagedUser(user: ManagedUser): void {
  const list = getManagedUsers();
  list.push(user);
  localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(list));
}

export function removeManagedUser(uid: string): void {
  const list = getManagedUsers().filter((u) => u.uid !== uid);
  localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(list));
}
