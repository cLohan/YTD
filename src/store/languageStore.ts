import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppLanguage } from "../lib/i18n";

interface LanguageState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "pt",
      setLanguage: (language) => set({ language })
    }),
    {
      name: "ytd-optimizer-language",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
