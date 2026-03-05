import type { OutputConfig } from "../../types/ytd.types";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface FormatSelectorProps {
  value: OutputConfig;
  onChange: (config: Partial<OutputConfig>) => void;
}

const formats = ["DXT1", "DXT3", "DXT5", "BC4", "BC5", "BC6H", "BC7_UNORM", "BC7_UNORM_SRGB", "A8R8G8B8", "R8G8B8A8", "AUTO"];

export default function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const language = useLanguageStore((s) => s.language);

  return (
    <section className="border border-border rounded-sm p-3 space-y-2">
      <h3 className="text-xs font-semibold text-text">{tr(language, "Formato de Saída DDS", "DDS Output Format")}</h3>
      <select value={value.format} onChange={(event) => onChange({ format: event.target.value })} className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs">
        {formats.map((format) => (
          <option key={format} value={format}>
            {format}
          </option>
        ))}
      </select>
      <label className="text-xs flex items-center gap-2">
        <input type="checkbox" checked={value.maxQuality} onChange={(event) => onChange({ maxQuality: event.target.checked })} />
        {tr(language, "Usar compressão de qualidade máxima", "Use maximum quality compression")}
      </label>
    </section>
  );
}
