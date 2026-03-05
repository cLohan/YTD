import { create } from "zustand";
import type { TextureItem, YtdFileItem } from "../types/ytd.types";

interface YtdState {
  ytds: YtdFileItem[];
  history: Array<{ ytds: YtdFileItem[]; selectedTextureId: string | null }>;
  filter: string;
  selectedTextureId: string | null;
  exclusions: string[];
  globalExclusions: boolean;
  setYtds: (ytds: YtdFileItem[]) => void;
  addYtds: (ytds: YtdFileItem[]) => void;
  checkpoint: () => void;
  removeYtd: (ytdId: string) => void;
  undo: () => void;
  canUndo: () => boolean;
  reorderYtd: (from: number, to: number) => void;
  setFilter: (value: string) => void;
  setSelectedTexture: (id: string | null) => void;
  toggleYtdChecked: (ytdId: string, checked: boolean) => void;
  toggleTextureChecked: (ytdId: string, textureId: string, checked: boolean) => void;
  toggleYtdExpanded: (ytdId: string) => void;
  toggleTextureExcluded: (ytdId: string, textureId: string, excluded: boolean) => void;
  removeTexture: (ytdId: string, textureId: string) => void;
  renameTexture: (ytdId: string, oldTextureId: string, next: TextureItem) => void;
  upsertTexture: (ytdId: string, texture: TextureItem) => void;
  addExclusionPattern: (pattern: string) => void;
  removeExclusionPattern: (pattern: string) => void;
  setGlobalExclusions: (global: boolean) => void;
  selectedCount: () => number;
  textureCount: () => number;
  totalSizeMb: () => number;
}

const updateYtd = (ytds: YtdFileItem[], ytdId: string, updater: (ytd: YtdFileItem) => YtdFileItem): YtdFileItem[] =>
  ytds.map((ytd) => (ytd.id === ytdId ? updater(ytd) : ytd));
const cloneYtds = (items: YtdFileItem[]): YtdFileItem[] => items.map((item) => ({ ...item, textures: item.textures.map((texture) => ({ ...texture, optimizedInfo: texture.optimizedInfo ? { ...texture.optimizedInfo } : undefined })) }));
const withHistory = (state: YtdState) => {
  const snapshot = { ytds: cloneYtds(state.ytds), selectedTextureId: state.selectedTextureId };
  const nextHistory = [...state.history, snapshot];
  return nextHistory.length > 50 ? nextHistory.slice(nextHistory.length - 50) : nextHistory;
};

export const useYtdStore = create<YtdState>((set, get) => ({
  ytds: [],
  history: [],
  filter: "",
  selectedTextureId: null,
  exclusions: [],
  globalExclusions: false,
  setYtds: (ytds) => set({ ytds }),
  addYtds: (incoming) =>
    set((state) => {
      const existing = new Map(state.ytds.map((item) => [item.path.toLowerCase(), item]));
      for (const ytd of incoming) {
        existing.set(ytd.path.toLowerCase(), ytd);
      }
      return { ytds: Array.from(existing.values()), history: withHistory(state) };
    }),
  checkpoint: () =>
    set((state) => ({
      history: withHistory(state)
    })),
  removeYtd: (ytdId) =>
    set((state) => {
      const nextYtds = state.ytds.filter((item) => item.id !== ytdId);
      const selectedStillExists = nextYtds.some((ytd) => ytd.textures.some((texture) => texture.id === state.selectedTextureId));
      return {
        ytds: nextYtds,
        history: withHistory(state),
        selectedTextureId: selectedStillExists ? state.selectedTextureId : null
      };
    }),
  undo: () =>
    set((state) => {
      if (state.history.length === 0) {
        return state;
      }
      const snapshot = state.history[state.history.length - 1];
      return {
        ytds: cloneYtds(snapshot.ytds),
        selectedTextureId: snapshot.selectedTextureId,
        history: state.history.slice(0, -1)
      };
    }),
  canUndo: () => get().history.length > 0,
  reorderYtd: (from, to) =>
    set((state) => {
      const clone = [...state.ytds];
      const [moved] = clone.splice(from, 1);
      clone.splice(to, 0, moved);
      return { ytds: clone };
    }),
  setFilter: (value) => set({ filter: value }),
  setSelectedTexture: (id) => set({ selectedTextureId: id }),
  toggleYtdChecked: (ytdId, checked) =>
    set((state) => ({
      ytds: updateYtd(state.ytds, ytdId, (ytd) => ({
        ...ytd,
        checked,
        textures: ytd.textures.map((texture) => (texture.excluded ? texture : { ...texture, checked }))
      }))
    })),
  toggleTextureChecked: (ytdId, textureId, checked) =>
    set((state) => ({
      ytds: updateYtd(state.ytds, ytdId, (ytd) => ({
        ...ytd,
        checked: checked ? ytd.checked : false,
        textures: ytd.textures.map((texture) => (texture.id === textureId ? { ...texture, checked } : texture))
      }))
    })),
  toggleYtdExpanded: (ytdId) =>
    set((state) => ({
      ytds: state.ytds.map((ytd) => (ytd.id === ytdId ? { ...ytd, expanded: !ytd.expanded } : ytd))
    })),
  toggleTextureExcluded: (ytdId, textureId, excluded) =>
    set((state) => ({
      ytds: updateYtd(state.ytds, ytdId, (ytd) => ({
        ...ytd,
        textures: ytd.textures.map((texture) =>
          texture.id === textureId
            ? {
                ...texture,
                excluded,
                checked: excluded ? false : texture.checked,
                status: excluded ? "excluded" : texture.status === "excluded" ? "ready" : texture.status
              }
            : texture
        )
      }))
    })),
  removeTexture: (ytdId, textureId) =>
    set((state) => {
      const nextYtds = updateYtd(state.ytds, ytdId, (ytd) => ({
        ...ytd,
        textures: ytd.textures.filter((texture) => texture.id !== textureId)
      }));
      return {
        ytds: nextYtds,
        history: withHistory(state),
        selectedTextureId: state.selectedTextureId === textureId ? null : state.selectedTextureId
      };
    }),
  renameTexture: (ytdId, oldTextureId, next) =>
    set((state) => ({
      ytds: updateYtd(state.ytds, ytdId, (ytd) => ({
        ...ytd,
        textures: ytd.textures.map((texture) => (texture.id === oldTextureId ? { ...next } : texture))
      })),
      selectedTextureId: state.selectedTextureId === oldTextureId ? next.id : state.selectedTextureId
    })),
  upsertTexture: (ytdId, texture) =>
    set((state) => ({
      ytds: updateYtd(state.ytds, ytdId, (ytd) => ({
        ...ytd,
        textures: ytd.textures.map((item) => (item.id === texture.id ? { ...item, ...texture } : item))
      }))
    })),
  addExclusionPattern: (pattern) =>
    set((state) => ({
      exclusions: state.exclusions.includes(pattern) || !pattern.trim() ? state.exclusions : [...state.exclusions, pattern.trim()]
    })),
  removeExclusionPattern: (pattern) => set((state) => ({ exclusions: state.exclusions.filter((item) => item !== pattern) })),
  setGlobalExclusions: (global) => set({ globalExclusions: global }),
  selectedCount: () => get().ytds.flatMap((ytd) => ytd.textures).filter((texture) => texture.checked).length,
  textureCount: () => get().ytds.flatMap((ytd) => ytd.textures).length,
  totalSizeMb: () =>
    get()
      .ytds
      .flatMap((ytd) => ytd.textures)
      .reduce((sum, texture) => sum + (texture.optimizedInfo?.sizeKb ?? texture.sizeKb), 0) / 1024
}));

export const getSelectedTexture = (state: YtdState): { ytd: YtdFileItem; texture: TextureItem } | null => {
  if (!state.selectedTextureId) {
    return null;
  }

  for (const ytd of state.ytds) {
    const texture = ytd.textures.find((item) => item.id === state.selectedTextureId);
    if (texture) {
      return { ytd, texture };
    }
  }

  return null;
};
