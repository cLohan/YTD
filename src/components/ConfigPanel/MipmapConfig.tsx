import type { OutputConfig } from "../../types/ytd.types";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface MipmapConfigProps {
  value: OutputConfig;
  currentMipCount?: number;
  onChange: (config: Partial<OutputConfig>) => void;
}

export default function MipmapConfig({ value, currentMipCount, onChange }: MipmapConfigProps) {
  const language = useLanguageStore((s) => s.language);
  const effectiveLevels = value.keepOriginalMipmaps ? (currentMipCount ?? 1) : Math.max(1, value.mipmapLevels);

  return (
    <section className="border border-border rounded-sm p-3 space-y-2">
      <h3 className="text-xs font-semibold text-text">{tr(language, "Mipmaps", "Mipmaps")}</h3>
      <label className="text-xs flex items-center gap-2">
        <input type="checkbox" checked={value.keepOriginalMipmaps} onChange={(event) => onChange({ keepOriginalMipmaps: event.target.checked })} />
        {tr(language, "Manter mipmaps originais da textura", "Keep original texture mipmaps")}
      </label>
      <label className="text-xs flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.generateMipmaps}
          onChange={(event) => onChange({ generateMipmaps: event.target.checked })}
          disabled={value.keepOriginalMipmaps}
        />
        {tr(language, "Gerar mipmaps automaticamente", "Generate mipmaps automatically")}
      </label>
      <div className="space-y-1">
        <div className="text-xs text-muted">{tr(language, "Quantidade de mipmaps", "Mipmap count")}</div>
        <input
          type="number"
          min={1}
          max={16}
          value={value.keepOriginalMipmaps ? (currentMipCount ?? 1) : value.mipmapLevels}
          onChange={(event) => onChange({ mipmapLevels: Math.max(1, Number(event.target.value) || 1) })}
          disabled={value.keepOriginalMipmaps || !value.generateMipmaps}
          className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs disabled:opacity-60"
        />
      </div>
      <div className="text-[11px] text-muted">
        {tr(language, "Mipmaps atuais/alvo", "Current/target mipmaps")}: {effectiveLevels}
      </div>
    </section>
  );
}
