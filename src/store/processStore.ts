import { create } from "zustand";
import type { ProcessLogItem, ProcessingProgress } from "../types/ytd.types";

type ProcessStatus = "idle" | "processing" | "success" | "error";

interface ProcessState {
  status: ProcessStatus;
  currentLogLine: string;
  expanded: boolean;
  pausedAutoScroll: boolean;
  globalProgress: number;
  ytdProgress: Record<string, number>;
  progress: ProcessingProgress | null;
  logs: ProcessLogItem[];
  setStatus: (status: ProcessStatus) => void;
  setExpanded: (expanded: boolean) => void;
  setPausedAutoScroll: (paused: boolean) => void;
  setCurrentLogLine: (line: string) => void;
  updateProgress: (progress: ProcessingProgress) => void;
  addLog: (level: ProcessLogItem["level"], message: string) => void;
  clearLogs: () => void;
  resetProgress: () => void;
}

const ts = () => new Date().toLocaleTimeString("pt-BR", { hour12: false });

export const useProcessStore = create<ProcessState>((set, get) => ({
  status: "idle",
  currentLogLine: "",
  expanded: false,
  pausedAutoScroll: false,
  globalProgress: 0,
  ytdProgress: {},
  progress: null,
  logs: [],
  setStatus: (status) => set({ status }),
  setExpanded: (expanded) => set({ expanded }),
  setPausedAutoScroll: (pausedAutoScroll) => set({ pausedAutoScroll }),
  setCurrentLogLine: (currentLogLine) => set({ currentLogLine }),
  updateProgress: (progress) => {
    const ratio = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    set((state) => ({
      progress,
      globalProgress: ratio,
      ytdProgress: {
        ...state.ytdProgress,
        [progress.ytd]: ratio
      }
    }));
  },
  addLog: (level, message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: ProcessLogItem = { id, timestamp: ts(), level, message };
    set({ logs: [...get().logs, item] });
  },
  clearLogs: () => set({ logs: [] }),
  resetProgress: () =>
    set({
      progress: null,
      currentLogLine: "",
      globalProgress: 0,
      ytdProgress: {}
    })
}));
