import { useState } from "react";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface ExclusionsListProps {
  exclusions: string[];
  global: boolean;
  onAdd: (pattern: string) => void;
  onRemove: (pattern: string) => void;
  onSetGlobal: (value: boolean) => void;
}

export default function ExclusionsList({ exclusions, global, onAdd, onRemove, onSetGlobal }: ExclusionsListProps) {
  const [input, setInput] = useState("");
  const language = useLanguageStore((s) => s.language);

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      <div className="text-xs text-muted">{tr(language, "Texturas nesta lista serão copiadas sem processamento para o YTD final.", "Textures in this list will be copied without processing to the final YTD.")}</div>
      <div className="flex gap-2">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={tr(language, "Ex.: *_bump ou vehicle_*", "Ex.: *_bump or vehicle_*")} className="h-8 flex-1 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs" />
        <button className="h-8 px-3 border border-border rounded-sm" onClick={() => { onAdd(input); setInput(""); }}>
          {tr(language, "Adicionar", "Add")}
        </button>
      </div>
      <label className="text-xs flex items-center gap-2">
        <input type="checkbox" checked={global} onChange={(event) => onSetGlobal(event.target.checked)} />
        {tr(language, "Aplicar exclusões globalmente a todos os YTDs abertos", "Apply exclusions globally to all open YTDs")}
      </label>
      <div className="flex-1 overflow-auto border border-border rounded-sm p-2 space-y-1 scrollbar">
        {exclusions.map((pattern) => (
          <div key={pattern} className="h-7 px-2 bg-[#171720] rounded-sm text-xs flex items-center justify-between font-mono">
            <span>{pattern}</span>
            <button className="text-error" onClick={() => onRemove(pattern)}>{tr(language, "remover", "remove")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
