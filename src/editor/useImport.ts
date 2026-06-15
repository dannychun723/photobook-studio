import { useCallback, useRef, useState } from "react";
import { importPhotos, type ImportProgress } from "../images/importPhotos";

export interface ImportUiState {
  running: boolean;
  done: number;
  total: number;
  /** Set after a run finishes with failures; null otherwise. Dismissible. */
  failures: ImportProgress["failed"] | null;
}

const IDLE: ImportUiState = { running: false, done: 0, total: 0, failures: null };

export function useImport(projectId: string): {
  importState: ImportUiState;
  importFiles: (files: File[]) => Promise<void>;
  dismissFailures: () => void;
} {
  const [importState, setImportState] = useState<ImportUiState>(IDLE);
  const lastUpdate = useRef(0);
  const runningRef = useRef(false);

  const importFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || runningRef.current) return;
      runningRef.current = true;
      setImportState({ running: true, done: 0, total: files.length, failures: null });
      let failed: ImportProgress["failed"] = [];
      try {
        await importPhotos(projectId, files, (p) => {
          failed = p.failed;
          // The worker pool reports per file; throttle to ~8 UI updates/s so a
          // 300-photo import does not re-render the tray pathologically.
          const now = performance.now();
          if (p.done < p.total && now - lastUpdate.current < 120) return;
          lastUpdate.current = now;
          setImportState({ running: true, done: p.done, total: p.total, failures: null });
        });
      } finally {
        runningRef.current = false;
        setImportState({ ...IDLE, failures: failed.length > 0 ? failed : null });
      }
    },
    [projectId],
  );

  const dismissFailures = useCallback(() => {
    setImportState((s) => ({ ...s, failures: null }));
  }, []);

  return { importState, importFiles, dismissFailures };
}
