import { useAppStore } from "./store";
import { Sidebar } from "./Sidebar";
import { ProjectsHome } from "../library/ProjectsHome";
import { EditorShell } from "../editor/EditorShell";

export default function App() {
  const view = useAppStore((s) => s.view);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  return (
    <div className="flex h-full overflow-hidden">
      {view !== "editor" && <Sidebar />}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {view === "editor" && currentProjectId ? (
          <EditorShell key={currentProjectId} projectId={currentProjectId} />
        ) : (
          <ProjectsHome />
        )}
      </main>
    </div>
  );
}
