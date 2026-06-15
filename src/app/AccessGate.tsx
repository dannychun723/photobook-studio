// Shown when no valid uid is present in the URL.
// ?admin=true  → admin panel (generate + manage private links)
// anything else → "private studio" locked screen

import { useState } from "react";
import {
  generateUid,
  getManagedUsers,
  addManagedUser,
  removeManagedUser,
  isAdminUrl,
  type ManagedUser,
} from "./userSession";

export function AccessGate() {
  return isAdminUrl() ? <AdminPanel /> : <LockedScreen />;
}

// ── Locked screen ─────────────────────────────────────────────────────────────

function LockedScreen() {
  return (
    <div className="flex h-full items-center justify-center" style={{ background: "#f5f4f0" }}>
      <div className="text-center max-w-sm px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(139,94,42,0.10)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#8b5e2a" strokeWidth="1.8"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#8b5e2a" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <h1
          className="text-[22px] font-semibold mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          Private Studio
        </h1>
        <p className="text-[14px] leading-relaxed" style={{ color: "#706c63" }}>
          This is a private photobook studio. You need your personal link to access your workspace.
        </p>
        <p className="mt-4 text-[12px]" style={{ color: "#a09c93" }}>
          Contact Daniel.F.Studio to receive your private link.
        </p>
      </div>
    </div>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────

function AdminPanel() {
  const [users, setUsers] = useState<ManagedUser[]>(getManagedUsers);
  const [newLabel, setNewLabel] = useState("");
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const origin = window.location.origin;

  const refresh = () => setUsers(getManagedUsers());

  const handleGenerate = () => {
    const uid = generateUid();
    addManagedUser({
      uid,
      label: newLabel.trim() || `Friend ${users.length + 1}`,
      createdAt: Date.now(),
    });
    setNewLabel("");
    refresh();
  };

  const copyUrl = async (uid: string) => {
    await navigator.clipboard.writeText(`${origin}/?uid=${uid}`);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const handleRemove = (uid: string) => {
    removeManagedUser(uid);
    refresh();
  };

  return (
    <div className="min-h-full overflow-y-auto p-8" style={{ background: "#f5f4f0" }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white"
            style={{ background: "#8b5e2a" }}
          >
            DF
          </span>
          <div>
            <h1
              className="text-[20px] font-semibold leading-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
            >
              Daniel.F.Studio — Access Manager
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "#706c63" }}>
              Generate a private link per friend. Each link opens a completely isolated photobook workspace.
            </p>
          </div>
        </div>

        {/* Generate form */}
        <div
          className="rounded-2xl border p-5 mb-6"
          style={{ background: "#fff", borderColor: "#e8e6e1" }}
        >
          <p className="text-[13px] font-semibold mb-3" style={{ color: "#1c1917" }}>
            Generate new private link
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Friend's name (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="flex-1 rounded-lg border px-3 py-2 text-[13px] focus:outline-none"
              style={{ borderColor: "#e8e6e1", color: "#1c1917" }}
            />
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors"
              style={{ background: "#8b5e2a" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7a5226"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#8b5e2a"; }}
            >
              Generate link
            </button>
          </div>
        </div>

        {/* Links list */}
        {users.length === 0 ? (
          <p className="text-center py-10 text-[13px]" style={{ color: "#a09c93" }}>
            No links yet — generate one above to share with a friend.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#a09c93" }}>
              {users.length} private {users.length === 1 ? "link" : "links"}
            </p>

            {[...users].reverse().map((user) => {
              const url = `${origin}/?uid=${user.uid}`;
              const isCopied = copiedUid === user.uid;
              return (
                <div
                  key={user.uid}
                  className="rounded-xl border flex items-center gap-3 px-4 py-3.5"
                  style={{ background: "#fff", borderColor: "#e8e6e1" }}
                >
                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: "#f5f4f0", color: "#8b5e2a" }}
                  >
                    {user.label.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "#1c1917" }}>
                      {user.label}
                    </p>
                    <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: "#a09c93" }}>
                      {url}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#c4bdb4" }}>
                      Created {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void copyUrl(user.uid)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors"
                      style={
                        isCopied
                          ? { borderColor: "#86efac", background: "#f0fdf4", color: "#166534" }
                          : { borderColor: "#e8e6e1", color: "#706c63" }
                      }
                    >
                      {isCopied ? "Copied!" : "Copy URL"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(url).then(() => window.open(url, "_blank"))}
                      className="rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors"
                      style={{ borderColor: "#e8e6e1", color: "#706c63" }}
                      title="Open in new tab"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(user.uid)}
                      className="rounded-lg border px-2 py-1.5 text-[12px] transition-colors"
                      style={{ borderColor: "#e8e6e1", color: "#c4bdb4" }}
                      title="Remove from list (does not delete their data)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div
          className="mt-8 rounded-xl border px-4 py-3.5 space-y-1.5"
          style={{ background: "#fdf8f0", borderColor: "#e8d9bc" }}
        >
          <p className="text-[12px] font-semibold" style={{ color: "#8b5e2a" }}>How it works</p>
          <p className="text-[12px]" style={{ color: "#706c63" }}>
            • Each link gives access to a <strong>completely private workspace</strong> — users never see each other's photobooks.
          </p>
          <p className="text-[12px]" style={{ color: "#706c63" }}>
            • Photos and books are stored <strong>in the user's browser</strong> (IndexedDB). Clearing browser data removes them.
          </p>
          <p className="text-[12px]" style={{ color: "#706c63" }}>
            • The link is the password — keep it private. Removing a link here doesn't delete the user's data.
          </p>
          <p className="text-[12px] mt-2 font-mono" style={{ color: "#a09c93" }}>
            Admin panel: {window.location.origin}/?admin=true
          </p>
        </div>

      </div>
    </div>
  );
}
