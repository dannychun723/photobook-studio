import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { AccessGate } from "./app/AccessGate";
import { readUserId, getDatabaseName, isAdminUrl } from "./app/userSession";
import { initDatabase } from "./db/db";

// Admin panel (?admin=true) is always shown as-is — no database needed.
// In dev mode (localhost), any other URL bypasses the uid check so
// existing local data in "photobook-studio" is preserved.
const isAdmin = isAdminUrl();
const uid = readUserId();
const isDev = import.meta.env.DEV;
const hasAccess = !isAdmin && (uid !== null || isDev);

if (hasAccess) {
  initDatabase(getDatabaseName(uid));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {hasAccess ? <App /> : <AccessGate />}
  </StrictMode>,
);
