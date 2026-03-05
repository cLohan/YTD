import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface ActionButtonsProps {
  processing: boolean;
  progress: number;
  line: string;
  canExportYtd: boolean;
  onProcessSelected: () => void;
  onProcessAll: () => void;
  onExportYtd: () => void;
  onCancel: () => void;
}

export default function ActionButtons({ processing, progress, line, canExportYtd, onProcessSelected, onProcessAll, onExportYtd, onCancel }: ActionButtonsProps) {
  const language = useLanguageStore((s) => s.language);

  return (
    <section className="space-y-2">
      <button className="w-full h-10 rounded-sm bg-accent text-white text-xs font-semibold hover:bg-accent/90" onClick={onProcessSelected} disabled={processing}>
        {tr(language, "PROCESSAR SELECIONADAS", "PROCESS SELECTED")}
      </button>
      <button className="w-full h-9 rounded-sm border border-accent text-accent text-xs" onClick={onProcessAll} disabled={processing}>
        {tr(language, "Processar Todos os YTDs", "Process All YTDs")}
      </button>
      <button className="w-full h-9 rounded-sm text-xs border border-border disabled:opacity-50" onClick={onExportYtd} disabled={processing || !canExportYtd}>
        {tr(language, "Exportar .YTD", "Export .YTD")}
      </button>
      {processing && (
        <div className="space-y-1">
          <div className="h-2 rounded-sm bg-[#1a1a23] border border-border overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[11px] text-muted truncate">{line}</div>
          <button className="w-full h-8 rounded-sm border border-error text-error text-xs" onClick={onCancel}>
            {tr(language, "Cancelar", "Cancel")}
          </button>
        </div>
      )}
    </section>
  );
}
