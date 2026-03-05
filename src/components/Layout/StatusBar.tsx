import { useMemo } from "react";
import { useConfigStore } from "../../store/configStore";
import { useProcessStore } from "../../store/processStore";
import { useYtdStore } from "../../store/ytdStore";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface StatusBarProps {
  onToggleLog: () => void;
}

export default function StatusBar({ onToggleLog }: StatusBarProps) {
  const status = useProcessStore((s) => s.status);
  const globalProgress = useProcessStore((s) => s.globalProgress);
  const outputFormat = useConfigStore((s) => s.output.format);
  const selectedEncoder = useConfigStore((s) => s.selectedEncoder);
  const ytds = useYtdStore((s) => s.ytds);
  const textureCount = useYtdStore((s) => s.textureCount);
  const totalSizeMb = useYtdStore((s) => s.totalSizeMb);
  const language = useLanguageStore((s) => s.language);

  const statusLabel = useMemo(() => {
    if (status === "processing") {
      return `${tr(language, "Processando...", "Processing...")} ${globalProgress}%`;
    }
    if (status === "success") {
      return tr(language, "Concluído", "Completed");
    }
    if (status === "error") {
      return tr(language, "Concluído com erros", "Completed with errors");
    }
    return tr(language, "Pronto", "Ready");
  }, [status, globalProgress, language]);

  return (
    <footer className="h-7 border-t border-border bg-[#121217] px-3 text-[11px] text-muted flex items-center justify-between cursor-pointer" onClick={onToggleLog}>
      <div className="w-1/3 truncate">{statusLabel}</div>
      <div className="w-1/3 text-center truncate">
        {selectedEncoder} | {outputFormat}
      </div>
      <div className="w-1/3 text-right truncate">
        {ytds.length} YTDs | {textureCount()} {tr(language, "texturas", "textures")} | {totalSizeMb().toFixed(2)} MB
      </div>
    </footer>
  );
}
