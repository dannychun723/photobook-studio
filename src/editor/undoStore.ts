// Per-spread undo/redo store.
// updateSpread() in spreadOps.ts calls push() before every mutation.
// EditorShell calls undo()/redo() directly on db.spreads to bypass the snapshot path.

import { create } from "zustand";
import type { Spread } from "../model/types";

const MAX_DEPTH = 50;

interface SpreadStack {
  past: Spread[];    // oldest→newest; undo pops from the end
  future: Spread[];  // newest→oldest; redo pops from the front
}

interface UndoState {
  stacks: Record<string, SpreadStack>;
  push: (spreadId: string, snapshot: Spread) => void;
  undo: (spreadId: string, current: Spread) => Spread | null;
  redo: (spreadId: string, current: Spread) => Spread | null;
  clearSpread: (spreadId: string) => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  stacks: {},

  push(spreadId, snapshot) {
    set(({ stacks }) => {
      const prev = stacks[spreadId] ?? { past: [], future: [] };
      return {
        stacks: {
          ...stacks,
          [spreadId]: {
            past: [...prev.past, snapshot].slice(-MAX_DEPTH),
            future: [], // new action always clears redo history
          },
        },
      };
    });
  },

  undo(spreadId, current) {
    const stack = get().stacks[spreadId];
    if (!stack?.past.length) return null;
    const target = stack.past[stack.past.length - 1];
    set(({ stacks }) => ({
      stacks: {
        ...stacks,
        [spreadId]: {
          past: stack.past.slice(0, -1),
          future: [current, ...stack.future].slice(0, MAX_DEPTH),
        },
      },
    }));
    return target;
  },

  redo(spreadId, current) {
    const stack = get().stacks[spreadId];
    if (!stack?.future.length) return null;
    const [target, ...remaining] = stack.future;
    set(({ stacks }) => ({
      stacks: {
        ...stacks,
        [spreadId]: {
          past: [...stack.past, current].slice(-MAX_DEPTH),
          future: remaining,
        },
      },
    }));
    return target;
  },

  clearSpread(spreadId) {
    set(({ stacks }) => {
      const { [spreadId]: _, ...rest } = stacks;
      return { stacks: rest };
    });
  },
}));
