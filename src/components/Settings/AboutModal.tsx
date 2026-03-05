import CreditsTab from "./CreditsTab";
import { tr } from "../../lib/i18n";
import { useLanguageStore } from "../../store/languageStore";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  const language = useLanguageStore((s) => s.language);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="w-[760px] max-w-[95vw] h-[700px] max-h-[94vh] rounded-sm border border-border bg-surface flex flex-col">
        <div className="h-11 border-b border-border px-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{tr(language, "Sobre", "About")}</h2>
          <button className="h-8 px-3 border border-border rounded-sm text-xs" onClick={onClose}>
            {tr(language, "Fechar", "Close")}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto scrollbar">
          <CreditsTab />
        </div>
      </div>
    </div>
  );
}
