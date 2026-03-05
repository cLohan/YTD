import { open } from "@tauri-apps/plugin-dialog";
import type { ExportConfig as ExportConfigType } from "../../types/ytd.types";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface ExportConfigProps {
  value: ExportConfigType;
  onChange: (value: Partial<ExportConfigType>) => void;
}

export default function ExportConfig({ value, onChange }: ExportConfigProps) {
  const language = useLanguageStore((s) => s.language);

  const chooseFolder = async () => {
    const selected = await open({ directory: true });
    if (selected && !Array.isArray(selected)) {
      onChange({ outputDir: selected, mode: "custom" });
    }
  };

  return (
    <details className="border border-border rounded-sm p-3" open>
      <summary className="text-xs font-semibold text-text cursor-pointer">{tr(language, "Configurações de Exportação", "Export Settings")}</summary>
      <div className="space-y-2 mt-2">
        <label className="text-xs flex items-center gap-2">
          <input type="radio" checked={value.mode === "overwrite"} onChange={() => onChange({ mode: "overwrite" })} />
          {tr(language, "Sobrescrever YTD original", "Overwrite original YTD")}
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="radio" checked={value.mode === "suffix"} onChange={() => onChange({ mode: "suffix" })} />
          {tr(language, "Salvar como novo arquivo (_optimized)", "Save as new file (_optimized)")}
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="radio" checked={value.mode === "custom"} onChange={() => onChange({ mode: "custom" })} />
          {tr(language, "Pasta de saída personalizada", "Custom output folder")}
        </label>
        {value.mode === "custom" && (
          <div className="flex gap-2">
            <input value={value.outputDir} readOnly className="h-8 flex-1 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs" />
            <button className="h-8 px-2 border border-border rounded-sm" onClick={chooseFolder}>
              {tr(language, "Selecionar...", "Select...")}
            </button>
          </div>
        )}
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={value.createBackup} onChange={(event) => onChange({ createBackup: event.target.checked })} />
          {tr(language, "Criar backup (.bak)", "Create backup (.bak)")}
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={value.exportCsv} onChange={(event) => onChange({ exportCsv: event.target.checked })} />
          {tr(language, "Exportar relatório CSV", "Export CSV report")}
        </label>
      </div>
    </details>
  );
}
