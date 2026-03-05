import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Store } from "@tauri-apps/plugin-store";
import type { EncoderInfo, ExportConfig, OutputConfig, ResizeConfig, ScopeMode } from "../types/ytd.types";

interface ConfigState {
  encoders: EncoderInfo[];
  selectedEncoder: string;
  resize: ResizeConfig;
  output: OutputConfig;
  scopeMode: ScopeMode;
  scopeYtdId: string;
  exportConfig: ExportConfig;
  setEncoders: (encoders: EncoderInfo[]) => void;
  setSelectedEncoder: (encoder: string) => void;
  setResize: (config: Partial<ResizeConfig>) => void;
  setOutput: (config: Partial<OutputConfig>) => void;
  setScope: (mode: ScopeMode, ytdId?: string) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  syncToTauriStore: () => Promise<void>;
  loadFromTauriStore: () => Promise<void>;
}

const defaultState = {
  encoders: [
    {
      id: "internal" as const,
      label: "CodeWalker + SharpDX",
      detected: true,
      source: "Built-in"
    },
    {
      id: "magick" as const,
      label: "ImageMagick",
      detected: false,
      source: "magick.exe"
    },
    {
      id: "texconv" as const,
      label: "DirectXTex / texconv",
      detected: false,
      source: "texconv.exe"
    },
    {
      id: "nvtt" as const,
      label: "NVTT",
      detected: false,
      source: "nvtt_export.exe / nvcompress.exe / nvtt.dll"
    }
  ],
  selectedEncoder: "magick",
  resize: {
    mode: "custom" as const,
    width: 1024,
    height: 1024,
    keepAspectRatio: true,
    minFilterThreshold: "1024x1024",
    percentage: 50
  },
  output: {
    format: "DXT5",
    generateMipmaps: false,
    keepOriginalMipmaps: true,
    mipmapLevels: 1,
    maxQuality: false
  },
  scopeMode: "selected" as const,
  scopeYtdId: "",
  exportConfig: {
    mode: "suffix" as const,
    outputDir: "",
    createBackup: false,
    exportCsv: false
  }
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      setEncoders: (encoders) => set({ encoders }),
      setSelectedEncoder: (encoder) => set({ selectedEncoder: encoder }),
      setResize: (config) => set((state) => ({ resize: { ...state.resize, ...config } })),
      setOutput: (config) => set((state) => ({ output: { ...state.output, ...config } })),
      setScope: (mode, ytdId = "") => set({ scopeMode: mode, scopeYtdId: ytdId }),
      setExportConfig: (config) => set((state) => ({ exportConfig: { ...state.exportConfig, ...config } })),
      syncToTauriStore: async () => {
        try {
          const store = await Store.load("config.json", { autoSave: false, defaults: {} });
          const snapshot = get();
          await store.set("config", {
            selectedEncoder: snapshot.selectedEncoder,
            resize: snapshot.resize,
            output: snapshot.output,
            scopeMode: snapshot.scopeMode,
            scopeYtdId: snapshot.scopeYtdId,
            exportConfig: snapshot.exportConfig
          });
          await store.save();
        } catch {
          // Keep localStorage persistence as fallback when plugin store is unavailable.
        }
      },
      loadFromTauriStore: async () => {
        try {
          const store = await Store.load("config.json", { autoSave: false, defaults: {} });
          const config = (await store.get("config")) as Partial<ConfigState> | null;
          if (!config) {
            return;
          }
          set((state) => ({
            ...state,
            selectedEncoder: config.selectedEncoder ?? state.selectedEncoder,
            resize: { ...state.resize, ...(config.resize ?? {}) },
            output: { ...state.output, ...(config.output ?? {}) },
            scopeMode: config.scopeMode ?? state.scopeMode,
            scopeYtdId: config.scopeYtdId ?? state.scopeYtdId,
            exportConfig: { ...state.exportConfig, ...(config.exportConfig ?? {}) }
          }));
        } catch {
          // Fallback to persisted zustand localStorage snapshot.
        }
      }
    }),
    {
      name: "ytd-optimizer-config",
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<ConfigState>) ?? {};
        const persistedOutput = (persisted.output ?? {}) as Partial<OutputConfig>;
        return {
          ...currentState,
          ...persisted,
          output: {
            ...currentState.output,
            ...persistedOutput,
            keepOriginalMipmaps: persistedOutput.keepOriginalMipmaps ?? currentState.output.keepOriginalMipmaps,
            mipmapLevels: Math.max(1, persistedOutput.mipmapLevels ?? currentState.output.mipmapLevels)
          }
        } as ConfigState;
      },
      partialize: (state) => ({
        selectedEncoder: state.selectedEncoder,
        resize: state.resize,
        output: state.output,
        scopeMode: state.scopeMode,
        scopeYtdId: state.scopeYtdId,
        exportConfig: state.exportConfig
      })
    }
  )
);
