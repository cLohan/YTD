import { open } from "@tauri-apps/plugin-dialog";
import type { MouseEvent } from "react";
import { tr } from "../../lib/i18n";
import trapoIcon from "../../assets/trapo.ico";
import { useLanguageStore } from "../../store/languageStore";

interface TopBarProps {
  onOpenYtd: (paths: string[]) => Promise<void>;
  onUndo: () => void;
  canUndo: boolean;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

export default function TopBar({ onOpenYtd, onUndo, canUndo, onOpenSettings, onOpenAbout }: TopBarProps) {
  const language = useLanguageStore((s) => s.language);

  const normalizePath = (value: unknown): string | null => {
    if (typeof value === "string") {
      return value;
    }

    if (value && typeof value === "object") {
      const maybePath = (value as { path?: unknown }).path;
      if (typeof maybePath === "string") {
        return maybePath;
      }
    }

    return null;
  };

  const chooseYtd = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "YTD", extensions: ["ytd"] }]
    });

    if (!selected) {
      return;
    }

    const raw = Array.isArray(selected) ? selected : [selected];
    const paths = raw.map(normalizePath).filter((item): item is string => Boolean(item));
    if (!paths.length) {
      return;
    }
    await onOpenYtd(paths);
  };

  const stop = (event: MouseEvent) => event.preventDefault();

  return (
    <header className="h-12 border-b border-border bg-surface px-3 flex items-center justify-between" onContextMenu={stop}>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-sm overflow-hidden">
          <img src={trapoIcon} alt="logo" className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="text-sm font-semibold text-text">YTD Texture Optimizer</div>
          <div className="text-[10px] text-muted">{tr(language, "Ferramenta de modding para GTA V", "GTA V Modding Toolchain")}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button className="h-8 px-3 border border-border rounded-sm bg-[#181821] hover:bg-[#1d1d28]" onClick={chooseYtd}>
          {tr(language, "Abrir YTD(s)", "Open YTD(s)")}
        </button>
        <button
          className="h-8 px-3 border border-border rounded-sm bg-transparent hover:bg-[#1d1d28] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onUndo}
          disabled={!canUndo}
          title={tr(language, "Desfazer", "Undo")}
        >
          ↶ {tr(language, "Desfazer", "Undo")}
        </button>
        <button className="h-8 px-3 border border-border rounded-sm bg-transparent hover:bg-[#1d1d28]" onClick={onOpenSettings}>
          {tr(language, "Configurações", "Settings")}
        </button>
        <button className="h-8 px-3 border border-border rounded-sm bg-transparent hover:bg-[#1d1d28]" onClick={onOpenAbout}>
          {tr(language, "Sobre", "About")}
        </button>
      </div>
    </header>
  );
}
