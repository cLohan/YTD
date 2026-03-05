import type { ResizeConfig as ResizeConfigType } from "../../types/ytd.types";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface ResizeConfigProps {
  value: ResizeConfigType;
  originalSize?: { width: number; height: number };
  onChange: (value: Partial<ResizeConfigType>) => void;
}

export default function ResizeConfig({ value, originalSize, onChange }: ResizeConfigProps) {
  const language = useLanguageStore((s) => s.language);
  const previewTarget = originalSize
    ? `${originalSize.width}x${originalSize.height} -> ${Math.max(1, Math.round(originalSize.width * (value.percentage / 100)))}x${Math.max(1, Math.round(originalSize.height * (value.percentage / 100)))} (${value.percentage}%)`
    : tr(language, "Sem textura selecionada", "No texture selected");

  return (
    <section className="border border-border rounded-sm p-3 space-y-2">
      <h3 className="text-xs font-semibold text-text">{tr(language, "Modo de Redimensionamento", "Resize Mode")}</h3>
      <label className="text-xs flex items-center gap-2">
        <input type="radio" checked={value.mode === "custom"} onChange={() => onChange({ mode: "custom" })} />
        {tr(language, "Dimensões personalizadas", "Custom dimensions")}
      </label>
      <label className="text-xs flex items-center gap-2">
        <input type="radio" checked={value.mode === "percent"} onChange={() => onChange({ mode: "percent" })} />
        {tr(language, "Porcentagem uniforme", "Uniform percentage")}
      </label>
      <label className="text-xs flex items-center gap-2">
        <input type="radio" checked={value.mode === "keep"} onChange={() => onChange({ mode: "keep" })} />
        {tr(language, "Manter original", "Keep original")}
      </label>

      {value.mode === "custom" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={value.width} onChange={(event) => onChange({ width: Number(event.target.value) })} className="h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs" placeholder={tr(language, "Largura", "Width")} />
            <input type="number" value={value.height} onChange={(event) => onChange({ height: Number(event.target.value) })} className="h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs" placeholder={tr(language, "Altura", "Height")} />
          </div>
          <label className="text-xs flex items-center gap-2">
            <input type="checkbox" checked={value.keepAspectRatio} onChange={(event) => onChange({ keepAspectRatio: event.target.checked })} />
            {tr(language, "Manter proporção", "Keep aspect ratio")}
          </label>
          <select value={value.minFilterThreshold} onChange={(event) => onChange({ minFilterThreshold: event.target.value })} className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs">
            <option value="none">{tr(language, "Aplicar a todas", "Apply to all")}</option>
            <option value="1024x1024">{tr(language, "Somente maiores que 1024x1024", "Only larger than 1024x1024")}</option>
            <option value="2048x2048">{tr(language, "Somente maiores que 2048x2048", "Only larger than 2048x2048")}</option>
            <option value="4096x4096">{tr(language, "Somente maiores que 4096x4096", "Only larger than 4096x4096")}</option>
          </select>
        </div>
      )}

      {value.mode === "percent" && (
        <div className="space-y-2">
          <input type="range" min={10} max={100} value={value.percentage} onChange={(event) => onChange({ percentage: Number(event.target.value) })} className="w-full" />
          <input type="number" min={10} max={100} value={value.percentage} onChange={(event) => onChange({ percentage: Number(event.target.value) })} className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs" />
          <div className="text-[11px] text-muted font-mono">{previewTarget}</div>
        </div>
      )}
    </section>
  );
}
