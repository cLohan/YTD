import type { ScopeMode, YtdFileItem } from "../../types/ytd.types";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface ScopeSelectorProps {
  mode: ScopeMode;
  ytdId: string;
  ytds: YtdFileItem[];
  onChange: (mode: ScopeMode, ytdId?: string) => void;
}

export default function ScopeSelector({ mode, ytdId, ytds, onChange }: ScopeSelectorProps) {
  const language = useLanguageStore((s) => s.language);

  return (
    <section className="border border-border rounded-sm p-3 space-y-2">
      <h3 className="text-xs font-semibold text-text">{tr(language, "Seleção de Escopo", "Scope Selection")}</h3>
      <label className="text-xs flex items-center gap-2">
        <input type="radio" checked={mode === "selected"} onChange={() => onChange("selected")} />
        {tr(language, "Texturas selecionadas na hierarquia", "Selected textures in hierarchy")}
      </label>
      <label className="text-xs flex items-center gap-2">
        <input type="radio" checked={mode === "all"} onChange={() => onChange("all")} />
        {tr(language, "Todas as texturas (todos os YTDs)", "All textures (all YTDs)")}
      </label>
      <label className="text-xs flex items-center gap-2">
        <input type="radio" checked={mode === "single-ytd"} onChange={() => onChange("single-ytd", ytds[0]?.id ?? "")} />
        {tr(language, "YTD específico", "Specific YTD")}
      </label>
      {mode === "single-ytd" && (
        <select value={ytdId} onChange={(event) => onChange("single-ytd", event.target.value)} className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs">
          {ytds.map((ytd) => (
            <option key={ytd.id} value={ytd.id}>
              {ytd.name}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}
