import { create } from "zustand";

// No router library: two views and two ids are the whole navigation state.
export type View = "home" | "editor";

interface AppState {
  view: View;
  currentProjectId: string | null;
  activeSpreadId: string | null;
  openProject: (projectId: string) => void;
  goHome: () => void;
  setActiveSpreadId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "home",
  currentProjectId: null,
  activeSpreadId: null,
  openProject: (projectId) => set({ view: "editor", currentProjectId: projectId, activeSpreadId: null }),
  goHome: () => set({ view: "home", currentProjectId: null, activeSpreadId: null }),
  setActiveSpreadId: (id) => set({ activeSpreadId: id }),
}));
